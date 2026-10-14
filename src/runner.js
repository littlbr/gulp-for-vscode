const vscode = require("vscode");
const { GulpPty } = require("./pty");

const TASK_TYPE = "gulpRunner";
const URL_ORDER = ["proxying", "local", "external"];

const keyOf = (folder, task) => `${folder.uri.fsPath}::${task}`;

/**
 * Pilote les tâches Gulp via l'API Tasks de VS Code.
 * États : "idle" | "running" | "error".
 */
class Runner {
    constructor() {
        this.states = new Map();
        this.urls = new Map();
        this.ptys = new Set();
        this.waiters = new Map();
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;

        this.disposables = [
            vscode.tasks.onDidEndTask((e) => this._ended(e.execution.task)),
            vscode.window.onDidCloseTerminal(() => {
                this.shownTerminal = null;
            }),
            this._onDidChange,
        ];
    }

    dispose() {
        // Rechargement de la fenêtre ou fermeture : gulp tourne dans son propre groupe de processus
        // et survivrait à l'extension (ports BrowserSync gardés), on l'arrête explicitement.
        this.ptys.forEach((pty) => pty.stop());
        this.disposables.forEach((d) => d.dispose());
    }

    state(folder, task) {
        return this.states.get(keyOf(folder, task)) || { status: "idle" };
    }

    /** URLs BrowserSync détectées dans la sortie de la tâche : [{ label, url }]. */
    urlsOf(folder, task) {
        return this.urls.get(keyOf(folder, task)) || [];
    }

    runningTasks() {
        return [...this.states.values()].filter((s) => s.status === "running");
    }

    /** Tâches en échec : arrêtées en erreur, ou en cours mais avec une erreur de compilation. */
    errorTasks() {
        return [...this.states.values()].filter((s) => s.status === "error" || (s.status === "running" && s.hasError));
    }

    async start(folder, name) {
        const key = keyOf(folder, name);
        if (this.state(folder, name).status === "running") {
            return;
        }
        const command = name === "default" ? "npx gulp" : `npx gulp ${name}`;
        this.urls.delete(key);
        const events = {
            onUrl: (label, url) => this._addUrl(key, label, url),
            onError: (message) => this._setError(key, message),
            onClear: () => this._clearError(key),
            onExit: (code) => {
                const state = this.states.get(key);
                if (state) {
                    state.exitCode = code;
                }
            },
        };
        let pty;
        const task = new vscode.Task(
            { type: TASK_TYPE, folder: folder.uri.fsPath, task: name },
            folder,
            `gulp ${name}`,
            "Gulp for VS Code",
            new vscode.CustomExecution(async () => {
                pty = new GulpPty(folder.uri.fsPath, command, events);
                this.ptys.add(pty);
                pty.onDidClose(() => this.ptys.delete(pty));
                return pty;
            })
        );
        task.isBackground = true;
        task.presentationOptions = {
            reveal: vscode.TaskRevealKind.Silent,
            focus: false,
            panel: vscode.TaskPanelKind.Dedicated,
            clear: true,
        };
        const execution = await vscode.tasks.executeTask(task);
        this.states.set(key, {
            status: "running",
            since: Date.now(),
            execution,
            folder,
            name,
            hasError: false,
        });
        this._onDidChange.fire();
    }

    _addUrl(key, label, url) {
        const urls = this.urls.get(key) || [];
        if (!urls.some((u) => u.url === url)) {
            urls.push({ label, url });
            // Ordre fixe quel que soit l'ordre d'arrivée : vhost, Local, External.
            urls.sort((a, b) => URL_ORDER.indexOf(a.label.toLowerCase()) - URL_ORDER.indexOf(b.label.toLowerCase()));
            this.urls.set(key, urls);
            this._onDidChange.fire();
        }
    }

    _setError(key, message) {
        const state = this.states.get(key);
        if (state && state.status === "running") {
            state.hasError = true;
            state.lastError = message;
            this._onDidChange.fire();
        }
    }

    _clearError(key) {
        const state = this.states.get(key);
        if (state && state.status === "running" && state.hasError) {
            state.hasError = false;
            state.lastError = undefined;
            this._onDidChange.fire();
        }
    }

    async stop(folder, name) {
        const state = this.states.get(keyOf(folder, name));
        if (!state || state.status !== "running") {
            return;
        }
        state.stopping = true;
        const ended = new Promise((resolve) => this.waiters.set(keyOf(folder, name), resolve));
        state.execution.terminate();
        await Promise.race([ended, new Promise((resolve) => setTimeout(resolve, 5000))]);
    }

    async restart(folder, name) {
        await this.stop(folder, name);
        await this.start(folder, name);
    }

    terminalOf(name) {
        const label = `gulp ${name}`;
        return vscode.window.terminals.find((t) => t.name.includes(label));
    }

    /** Affiche le terminal de la tâche ; un second appel referme le panneau. */
    showOutput(folder, name) {
        const terminal = this.terminalOf(name);
        if (!terminal) {
            if (this.state(folder, name).status === "running") {
                vscode.commands.executeCommand("workbench.action.terminal.focus");
            }
            return;
        }
        if (this.shownTerminal === terminal) {
            this.shownTerminal = null;
            vscode.commands.executeCommand("workbench.action.closePanel");
        } else {
            this.shownTerminal = terminal;
            terminal.show(true);
        }
    }

    /** Terminal de la tâche en cours (ou en erreur) : même bascule que showOutput. */
    toggleTerminal() {
        const state = this.runningTasks()[0] || this.errorTasks()[0];
        if (!state) {
            vscode.window.setStatusBarMessage(vscode.l10n.t("No Gulp task running."), 3000);
            return;
        }
        this.showOutput(state.folder, state.name);
    }

    _stateOf(task) {
        if (task.definition.type !== TASK_TYPE) {
            return null;
        }
        return this.states.get(`${task.definition.folder}::${task.definition.task}`) || null;
    }

    _ended(task) {
        const state = this._stateOf(task);
        if (!state) {
            return;
        }
        const key = `${task.definition.folder}::${task.definition.task}`;
        this.urls.delete(key);
        const failed = !state.stopping && state.exitCode !== undefined && state.exitCode !== 0;
        this.states.set(key, {
            status: failed ? "error" : "idle",
            exitCode: state.exitCode,
            folder: state.folder,
            name: state.name,
        });
        const waiter = this.waiters.get(key);
        if (waiter) {
            this.waiters.delete(key);
            waiter();
        }
        this._onDidChange.fire();
    }
}

module.exports = { Runner };
