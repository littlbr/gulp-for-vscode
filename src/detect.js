const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const GULPFILES = ["gulpfile.js", "gulpfile.mjs", "gulpfile.cjs", "gulpfile.ts"];

function hasGulpfile(folder) {
    return GULPFILES.some((name) => fs.existsSync(path.join(folder.uri.fsPath, name)));
}

/**
 * Lance `gulp --tasks-simple` dans un shell de connexion interactif pour hériter
 * du PATH de l'utilisateur (nvm, Homebrew…), comme dans un terminal.
 */
function detectTasks(folder) {
    const cwd = folder.uri.fsPath;
    const local = path.join(cwd, "node_modules", ".bin", "gulp");
    const gulp = fs.existsSync(local) ? "./node_modules/.bin/gulp" : "npx gulp";
    const shell = process.env.SHELL || "/bin/zsh";

    return new Promise((resolve) => {
        exec(`${shell} -ilc '${gulp} --tasks-simple'`, { cwd, timeout: 30000 }, (error, stdout) => {
            const tasks = String(stdout || "")
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => /^[\w:.\-]+$/.test(line));
            resolve(error && !tasks.length ? [] : tasks);
        });
    });
}

module.exports = { detectTasks, hasGulpfile };
