const vscode = require("vscode");

/** Indicateur global dans la barre d'état, avec pictogramme coloré selon l'état. */
class StatusBar {
    constructor(runner) {
        this.runner = runner;
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
        this.item.command = "gulpRunner.statusBarClick";
        this.subscription = runner.onDidChange(() => this.render());
        this.render();
    }

    dispose() {
        this.subscription.dispose();
        this.item.dispose();
    }

    render() {
        const running = this.runner.runningTasks();
        const errors = this.runner.errorTasks();

        if (errors.length) {
            const compile = errors.some((s) => s.status === "running");
            this.item.text = compile ? `$(error) Gulp : erreur de compilation` : `$(error) Gulp : erreur`;
            this.item.tooltip = errors
                .map((s) => (s.status === "running" ? `${s.name} : ${s.lastError || "erreur de compilation"}` : `${s.name} (code ${s.exitCode})`))
                .join("\n");
            this.item.color = undefined;
            this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        } else if (running.length) {
            const names = running.map((s) => s.name).join(", ");
            this.item.text = `$(circle-filled) Gulp : ${names}`;
            this.item.tooltip = "Gulp en cours. Cliquer pour agir (voir le réglage « gulpRunner.statusBarClickAction »).";
            this.item.color = new vscode.ThemeColor("charts.green");
            this.item.backgroundColor = undefined;
        } else {
            this.item.text = `$(circle-outline) Gulp`;
            this.item.tooltip = "Aucune tâche Gulp en cours.";
            this.item.color = undefined;
            this.item.backgroundColor = undefined;
        }
        this.item.show();
    }
}

module.exports = { StatusBar };
