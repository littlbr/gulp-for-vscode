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
            this.item.text = `$(error) ${compile ? vscode.l10n.t("Gulp: compilation error") : vscode.l10n.t("Gulp: error")}`;
            this.item.tooltip = errors
                .map((s) =>
                    s.status === "running"
                        ? vscode.l10n.t("{0}: {1}", s.name, s.lastError || vscode.l10n.t("compilation error"))
                        : vscode.l10n.t("{0} (code {1})", s.name, s.exitCode)
                )
                .join("\n");
            this.item.color = undefined;
            this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        } else if (running.length) {
            const names = running.map((s) => s.name).join(", ");
            this.item.text = `$(circle-filled) ${vscode.l10n.t("Gulp: {0}", names)}`;
            this.item.tooltip = vscode.l10n.t("Gulp is running. Click to act (see the \"gulpRunner.statusBarClickAction\" setting).");
            this.item.color = new vscode.ThemeColor("charts.green");
            this.item.backgroundColor = undefined;
        } else {
            this.item.text = `$(circle-outline) Gulp`;
            this.item.tooltip = vscode.l10n.t("No Gulp task running.");
            this.item.color = undefined;
            this.item.backgroundColor = undefined;
        }
        this.item.show();
    }
}

module.exports = { StatusBar };
