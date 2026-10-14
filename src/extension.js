const vscode = require("vscode");
const { detectTasks, hasGulpfile } = require("./detect");
const { Runner } = require("./runner");
const { TaskView } = require("./view");
const { StatusBar } = require("./status");

async function activate(context) {
    const runner = new Runner();
    const view = new TaskView(context, runner);
    const status = new StatusBar(runner);

    const refresh = async () => {
        const folders = (vscode.workspace.workspaceFolders || []).filter(hasGulpfile);
        const groups = await Promise.all(
            folders.map(async (folder) => ({ folder, tasks: await detectTasks(folder) }))
        );
        view.setGroups(groups);
    };

    context.subscriptions.push(
        runner,
        view,
        status,
        vscode.window.registerWebviewViewProvider("gulpRunner.tasks", view),
        vscode.commands.registerCommand("gulpRunner.statusBarClick", () => {
            const action = vscode.workspace.getConfiguration("gulpRunner").get("statusBarClickAction");
            if (action === "terminal") {
                runner.toggleTerminal();
            } else {
                vscode.commands.executeCommand("gulpRunner.tasks.focus");
            }
        }),
        vscode.commands.registerCommand("gulpRunner.configureStatusBar", async () => {
            const config = vscode.workspace.getConfiguration("gulpRunner");
            const current = config.get("statusBarClickAction");
            const picked = await vscode.window.showQuickPick(
                [
                    { label: vscode.l10n.t("Show the Gulp view"), value: "view" },
                    { label: vscode.l10n.t("Show or hide the task terminal"), value: "terminal" },
                ].map((entry) => ({ ...entry, description: entry.value === current ? vscode.l10n.t("current") : "" })),
                { title: vscode.l10n.t("Action when clicking the Gulp indicator in the status bar") }
            );
            if (picked) {
                await config.update("statusBarClickAction", picked.value, vscode.ConfigurationTarget.Global);
            }
        }),
        vscode.commands.registerCommand("gulpRunner.refresh", refresh),
        vscode.workspace.onDidChangeWorkspaceFolders(refresh)
    );

    const watcher = vscode.workspace.createFileSystemWatcher("**/gulpfile.{js,mjs,cjs,ts}");
    watcher.onDidCreate(refresh);
    watcher.onDidChange(refresh);
    watcher.onDidDelete(refresh);
    context.subscriptions.push(watcher);

    await refresh();
}

function deactivate() {}

module.exports = { activate, deactivate };
