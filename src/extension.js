const vscode = require("vscode");
const { detectTasks, hasGulpfile } = require("./detect");
const { Runner } = require("./runner");
const { TaskTree } = require("./tree");
const { StatusBar } = require("./status");

async function activate(context) {
    const runner = new Runner();
    const tree = new TaskTree(runner);
    const status = new StatusBar(runner);

    const refresh = async () => {
        const folders = (vscode.workspace.workspaceFolders || []).filter(hasGulpfile);
        const groups = await Promise.all(
            folders.map(async (folder) => ({ folder, tasks: await detectTasks(folder) }))
        );
        tree.setGroups(groups);
    };

    // Double clic sur une tâche arrêtée ou en erreur : la lancer. Simple clic : afficher sa console.
    let lastClick = { key: null, time: 0 };
    const open = (item) => {
        if (!item) {
            return;
        }
        const key = `${item.folder.uri.fsPath}::${item.task}`;
        const now = Date.now();
        const isDouble = lastClick.key === key && now - lastClick.time < 500;
        lastClick = { key, time: now };
        if (isDouble && runner.state(item.folder, item.task).status !== "running") {
            runner.start(item.folder, item.task);
        } else {
            runner.showOutput(item.folder, item.task);
        }
    };

    context.subscriptions.push(
        runner,
        tree,
        status,
        vscode.window.registerTreeDataProvider("gulpRunner.tasks", tree),
        vscode.commands.registerCommand("gulpRunner.start", (item) => item && runner.start(item.folder, item.task)),
        vscode.commands.registerCommand("gulpRunner.stop", (item) => item && runner.stop(item.folder, item.task)),
        vscode.commands.registerCommand("gulpRunner.restart", (item) => item && runner.restart(item.folder, item.task)),
        vscode.commands.registerCommand("gulpRunner.showOutput", (item) => item && runner.showOutput(item.folder, item.task)),
        vscode.commands.registerCommand("gulpRunner.open", open),
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
