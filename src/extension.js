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
                    { label: "Afficher la vue Gulp", value: "view" },
                    { label: "Afficher ou masquer le terminal de la tâche", value: "terminal" },
                ].map((entry) => ({ ...entry, description: entry.value === current ? "actuel" : "" })),
                { title: "Action au clic sur l'indicateur Gulp de la barre d'état" }
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
