const vscode = require("vscode");

function duration(since) {
    const s = Math.floor((Date.now() - since) / 1000);
    if (s < 60) {
        return `${s} s`;
    }
    const m = Math.floor(s / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

class TaskTree {
    constructor(runner) {
        this.runner = runner;
        this.groups = [];
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        this.subscription = runner.onDidChange(() => this._onDidChangeTreeData.fire());
        this.timer = setInterval(() => {
            if (this.runner.runningTasks().length) {
                this._onDidChangeTreeData.fire();
            }
        }, 1000);
    }

    dispose() {
        clearInterval(this.timer);
        this.subscription.dispose();
        this._onDidChangeTreeData.dispose();
    }

    setGroups(groups) {
        this.groups = groups.filter((g) => g.tasks.length);
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            if (this.groups.length === 1) {
                return this._taskItems(this.groups[0]);
            }
            return this.groups.map((group) => {
                const item = new vscode.TreeItem(group.folder.name, vscode.TreeItemCollapsibleState.Expanded);
                item.group = group;
                item.iconPath = new vscode.ThemeIcon("folder");
                return item;
            });
        }
        return this._taskItems(element.group);
    }

    _taskItems({ folder, tasks }) {
        return tasks.map((name) => {
            const state = this.runner.state(folder, name);
            const item = new vscode.TreeItem(name, vscode.TreeItemCollapsibleState.None);
            item.folder = folder;
            item.task = name;
            item.contextValue = `gulpTask.${state.status}`;
            item.command = { command: "gulpRunner.open", title: "Ouvrir", arguments: [item] };

            if (state.status === "running" && state.hasError) {
                item.iconPath = new vscode.ThemeIcon("warning", new vscode.ThemeColor("charts.red"));
                item.description = `en cours, erreur de compilation (${duration(state.since)})`;
                item.tooltip = state.lastError;
            } else if (state.status === "running") {
                item.iconPath = new vscode.ThemeIcon("sync~spin", new vscode.ThemeColor("charts.green"));
                item.description = `en cours depuis ${duration(state.since)}`;
            } else if (state.status === "error") {
                item.iconPath = new vscode.ThemeIcon("error", new vscode.ThemeColor("charts.red"));
                item.description = `erreur (code ${state.exitCode})`;
            } else {
                item.iconPath = new vscode.ThemeIcon("circle-outline");
                item.description = "arrêtée";
            }
            return item;
        });
    }
}

module.exports = { TaskTree };
