const vscode = require("vscode");
const { spawn } = require("child_process");

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const SHELL_NOISE = /no job control|cannot set terminal process group|Inappropriate ioctl/i;
const ERROR_LINE = /\bError\b\s*:|✘ \[ERROR\]|errored after/i;
// URLs BrowserSync du site (vhost proxifié, Local, External) ; celles de l'interface d'admin (UI, UI External) sont ignorées.
const BROWSERSYNC_URL = /(?<!UI )\b(Proxying|Local|External)\s*:\s*(https?:\/\/[^\s'"]+)/i;
const STARTING = /Starting '([^']+)'/;
const FINISHED = /Finished '([^']+)'/;
const ERRORED = /'([^']+)' errored after/;
// Une tâche encore active 5 s après son démarrage quand une autre démarre est un processus de fond (default, initWatch) : on l'ignore.
const BACKGROUND_AFTER_MS = 5000;

/**
 * Terminal pseudo : lance gulp dans un shell de connexion (PATH identique à un terminal),
 * relaie la sortie telle quelle et la lit ligne à ligne pour détecter les erreurs de compilation.
 * `events` : { onError(message), onClear(), onExit(code), onUrl(label, url) }.
 */
class GulpPty {
    constructor(cwd, command, events) {
        this.cwd = cwd;
        this.command = command;
        this.events = events;
        this.writeEmitter = new vscode.EventEmitter();
        this.closeEmitter = new vscode.EventEmitter();
        this.onDidWrite = this.writeEmitter.event;
        this.onDidClose = this.closeEmitter.event;
        this.killed = false;
        this.buffer = "";
        this.active = new Map();
        this.dirty = new Map();
        this.failing = new Set();
    }

    open() {
        const shell = process.env.SHELL || "/bin/zsh";
        this.child = spawn(shell, ["-ilc", this.command], {
            cwd: this.cwd,
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, FORCE_COLOR: "1" },
        });
        const onData = (chunk) => this._data(chunk.toString());
        this.child.stdout.on("data", onData);
        this.child.stderr.on("data", onData);
        this.child.on("error", (error) => this.writeEmitter.fire(`${error.message}\r\n`));
        this.child.on("close", (code) => {
            this.child = null;
            const exitCode = this.killed || code === null ? undefined : code;
            this.events.onExit(exitCode);
            this.closeEmitter.fire(exitCode);
        });
    }

    handleInput() {}

    // Appelé par VS Code quand le terminal est fermé ou la tâche terminée.
    close() {
        this.stop();
    }

    stop() {
        this.killed = true;
        if (this.child && this.child.pid) {
            try {
                process.kill(-this.child.pid, "SIGTERM");
            } catch (e) {
                // processus déjà terminé
            }
        }
    }

    _data(text) {
        const lines = (this.buffer + text).split(/\r?\n/);
        this.buffer = lines.pop();
        const out = [];
        for (const line of lines) {
            if (SHELL_NOISE.test(line)) {
                continue;
            }
            out.push(line);
            this._analyse(line.replace(ANSI, "").trim());
        }
        if (out.length) {
            this.writeEmitter.fire(out.join("\r\n") + "\r\n");
        }
        // Fragment sans saut de ligne (prompt, progression) : affiché tel quel.
        if (this.buffer && !/\n/.test(this.buffer) && this.buffer.length > 0) {
            this.writeEmitter.fire(this.buffer);
            this.buffer = "";
        }
    }

    _analyse(line) {
        let m = BROWSERSYNC_URL.exec(line);
        if (m) {
            this.events.onUrl(m[1], m[2]);
            return;
        }
        m = STARTING.exec(line);
        if (m) {
            this._dropBackgroundTasks();
            this.active.set(m[1], Date.now());
            this.dirty.set(m[1], false);
            return;
        }
        m = FINISHED.exec(line);
        if (m) {
            this.active.delete(m[1]);
            if (!this.dirty.get(m[1]) && this.failing.delete(m[1]) && !this.failing.size) {
                this.events.onClear();
            }
            return;
        }
        if (ERROR_LINE.test(line) && this.active.size) {
            m = ERRORED.exec(line);
            for (const task of this.active.keys()) {
                this.dirty.set(task, true);
                this.failing.add(task);
            }
            if (m) {
                this.active.delete(m[1]);
            }
            this.events.onError(line);
        }
    }

    _dropBackgroundTasks() {
        const now = Date.now();
        const hadFailures = this.failing.size > 0;
        for (const [task, since] of this.active) {
            if (now - since > BACKGROUND_AFTER_MS) {
                this.active.delete(task);
                this.failing.delete(task);
            }
        }
        if (hadFailures && !this.failing.size) {
            this.events.onClear();
        }
    }
}

module.exports = { GulpPty };
