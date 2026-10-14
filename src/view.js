const vscode = require("vscode");
const crypto = require("crypto");

/**
 * Vue webview de la sidebar : une carte par tâche, avec statut, actions et URLs BrowserSync.
 * Le rendu est fait côté webview (media/view.js) à partir de l'état envoyé par postMessage.
 */
class TaskView {
    constructor(context, runner) {
        this.extensionUri = context.extensionUri;
        this.runner = runner;
        this.groups = [];
        this.view = null;
        this.lastClick = { key: null, time: 0 };
        this.subscription = runner.onDidChange(() => {
            this._post();
            this._badge();
        });
    }

    dispose() {
        this.subscription.dispose();
    }

    setGroups(groups) {
        this.groups = groups.filter((g) => g.tasks.length);
        this._post();
    }

    resolveWebviewView(view) {
        this.view = view;
        const media = vscode.Uri.joinPath(this.extensionUri, "media");
        view.webview.options = { enableScripts: true, localResourceRoots: [media] };
        view.webview.html = this._html(view.webview, media);
        view.webview.onDidReceiveMessage((message) => this._receive(message));
        view.onDidChangeVisibility(() => view.visible && this._post());
        view.onDidDispose(() => {
            this.view = null;
        });
        this._badge();
    }

    // Pastille sur l'icône Gulp de la barre d'activité : nombre de tâches en erreur, sinon en cours.
    // Sa couleur dépend du thème (activityBarBadge.background) : l'erreur se lit dans l'infobulle.
    _badge() {
        if (!this.view) {
            return;
        }
        const errors = this.runner.errorTasks();
        const running = this.runner.runningTasks();
        if (errors.length) {
            const names = errors.map((s) => s.name).join(", ");
            this.view.badge = { value: errors.length, tooltip: vscode.l10n.t("Gulp failed: {0}", names) };
        } else if (running.length) {
            const names = running.map((s) => s.name).join(", ");
            this.view.badge = { value: running.length, tooltip: vscode.l10n.t("Gulp running: {0}", names) };
        } else {
            this.view.badge = undefined;
        }
    }

    _post() {
        if (!this.view) {
            return;
        }
        const groups = this.groups.map(({ folder, tasks }) => ({
            name: folder.name,
            path: folder.uri.fsPath,
            tasks: tasks.map((name) => {
                const state = this.runner.state(folder, name);
                return {
                    name,
                    status: state.status,
                    since: state.since,
                    hasError: !!state.hasError,
                    lastError: state.lastError,
                    exitCode: state.exitCode,
                    urls: state.status === "running" ? this.runner.urlsOf(folder, name) : [],
                };
            }),
        }));
        this.view.webview.postMessage({ type: "state", groups });
    }

    _receive(message) {
        if (message.type === "ready") {
            this._post();
            return;
        }
        if (message.type === "refresh") {
            vscode.commands.executeCommand("gulpRunner.refresh");
            return;
        }
        if (message.type === "openUrl") {
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            return;
        }
        if (message.type === "copyUrl") {
            vscode.env.clipboard.writeText(message.url);
            vscode.window.setStatusBarMessage(vscode.l10n.t("Copied: {0}", message.url), 2000);
            return;
        }
        const group = this.groups.find((g) => g.folder.uri.fsPath === message.path);
        if (!group) {
            return;
        }
        const { folder } = group;
        const name = message.task;
        switch (message.type) {
            case "start":
                this.runner.start(folder, name);
                break;
            case "stop":
                this.runner.stop(folder, name);
                break;
            case "restart":
                this.runner.restart(folder, name);
                break;
            case "terminal":
                this.runner.showOutput(folder, name);
                break;
            case "open":
                this._open(folder, name);
                break;
        }
    }

    // Double clic sur une tâche arrêtée ou en erreur : la lancer. Simple clic : afficher sa console.
    _open(folder, name) {
        const key = `${folder.uri.fsPath}::${name}`;
        const now = Date.now();
        const isDouble = this.lastClick.key === key && now - this.lastClick.time < 500;
        this.lastClick = { key, time: now };
        if (isDouble && this.runner.state(folder, name).status !== "running") {
            this.runner.start(folder, name);
        } else {
            this.runner.showOutput(folder, name);
        }
    }

    // Libellés de la webview, traduits côté extension (vscode.l10n n'existe pas dans la webview).
    _strings() {
        const t = vscode.l10n.t;
        return {
            compileError: t("compilation error"),
            running: t("running"),
            errorCode: t("error, code {0}"),
            stopped: t("stopped"),
            open: t("Open {0}"),
            copy: t("Copy address"),
            clickTerminal: t("Click: show terminal"),
            doubleClickStart: t("Double-click: start task"),
            showTerminal: t("Show terminal"),
            restart: t("Restart"),
            stop: t("Stop"),
            start: t("Start"),
            empty: t("No gulpfile found in this folder."),
            refresh: t("Refresh"),
        };
    }

    _html(webview, media) {
        const nonce = crypto.randomBytes(16).toString("base64");
        const css = webview.asWebviewUri(vscode.Uri.joinPath(media, "view.css"));
        const js = webview.asWebviewUri(vscode.Uri.joinPath(media, "view.js"));
        return `<!DOCTYPE html>
<html lang="${vscode.env.language}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${css}">
</head>
<body>
<main id="app" data-strings="${escapeHtml(JSON.stringify(this._strings()))}"></main>
<script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

module.exports = { TaskView };
