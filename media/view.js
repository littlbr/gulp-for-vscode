(function () {
    const vscode = acquireVsCodeApi();
    const app = document.getElementById("app");
    let groups = [];
    const strings = JSON.parse(app.dataset.strings || "{}");
    const t = (key, ...args) => (strings[key] || key).replace(/\{(\d+)\}/g, (m, i) => args[i]);

    const ICONS = {
        play: '<path d="M5 3.5v9l7.5-4.5z" fill="currentColor"/>',
        stop: '<rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor"/>',
        restart: '<path d="M12.5 8a4.5 4.5 0 1 1-1.4-3.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12.8 2.6v3h-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
        terminal: '<rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 6l2 2-2 2M8 10.5h3.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
        copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" fill="none" stroke="currentColor" stroke-width="1.2"/>',
        refresh: '<path d="M12.5 8a4.5 4.5 0 1 1-1.4-3.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12.8 2.6v3h-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
        globe: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 8h12M8 2c1.8 1.7 2.7 3.7 2.7 6S9.8 12.3 8 14C6.2 12.3 5.3 10.3 5.3 8S6.2 3.7 8 2z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    };

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined) {
            node.textContent = text;
        }
        return node;
    };

    const icon = (name) => {
        const span = el("span", "icon");
        span.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${ICONS[name]}</svg>`;
        return span;
    };

    const button = (name, title, onClick, extra) => {
        const b = el("button", `icon-button ${extra || ""}`);
        b.title = title;
        b.setAttribute("aria-label", title);
        b.appendChild(icon(name));
        b.addEventListener("click", (e) => {
            e.stopPropagation();
            onClick();
        });
        return b;
    };

    const duration = (since) => {
        const s = Math.max(0, Math.floor((Date.now() - since) / 1000));
        if (s < 60) {
            return `${s} s`;
        }
        const m = Math.floor(s / 60);
        return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
    };

    const send = (type, group, task, extra) => vscode.postMessage({ type, path: group.path, task: task.name, ...extra });

    function statusOf(task) {
        if (task.status === "running" && task.hasError) {
            return { kind: "warning", text: t("compileError") };
        }
        if (task.status === "running") {
            return { kind: "running", text: t("running") };
        }
        if (task.status === "error") {
            return { kind: "error", text: t("errorCode", task.exitCode) };
        }
        return { kind: "idle", text: t("stopped") };
    }

    function urlRow(url) {
        const row = el("div", "url");
        row.title = t("open", url.url);
        row.addEventListener("click", (e) => {
            e.stopPropagation();
            vscode.postMessage({ type: "openUrl", url: url.url });
        });
        row.appendChild(icon("globe"));
        row.appendChild(el("span", "url-address", url.url.replace(/^https?:\/\//, "").replace(/\/$/, "")));
        row.appendChild(button("copy", t("copy"), () => vscode.postMessage({ type: "copyUrl", url: url.url }), "url-copy"));
        return row;
    }

    function card(group, task) {
        const status = statusOf(task);
        const running = task.status === "running";
        const node = el("section", `card is-${status.kind}`);
        node.tabIndex = 0;
        node.title = running ? t("clickTerminal") : t("doubleClickStart");
        node.addEventListener("click", () => send("open", group, task));
        node.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                send(running ? "terminal" : "start", group, task);
            }
        });

        const head = el("div", "card-head");
        head.appendChild(el("span", "dot"));
        const titles = el("div", "titles");
        titles.appendChild(el("div", "name", task.name));
        const meta = el("div", "meta", status.text);
        if (running && task.since) {
            const time = el("span", "since", ` · ${duration(task.since)}`);
            time.dataset.since = task.since;
            meta.appendChild(time);
        }
        titles.appendChild(meta);
        head.appendChild(titles);

        const actions = el("div", "actions");
        if (running) {
            actions.appendChild(button("terminal", t("showTerminal"), () => send("terminal", group, task)));
            actions.appendChild(button("restart", t("restart"), () => send("restart", group, task)));
            actions.appendChild(button("stop", t("stop"), () => send("stop", group, task), "danger"));
        } else {
            if (task.status === "error") {
                actions.appendChild(button("terminal", t("showTerminal"), () => send("terminal", group, task)));
            }
            actions.appendChild(button("play", t("start"), () => send("start", group, task), "primary"));
        }
        head.appendChild(actions);
        node.appendChild(head);

        if (running && task.hasError && task.lastError) {
            node.appendChild(el("div", "error-line", task.lastError));
        }

        if (task.urls.length) {
            const urls = el("div", "urls");
            task.urls.forEach((url) => urls.appendChild(urlRow(url)));
            node.appendChild(urls);
        }
        return node;
    }

    function render() {
        app.textContent = "";
        if (!groups.length) {
            const empty = el("div", "empty");
            empty.appendChild(el("p", "", t("empty")));
            const refresh = el("button", "text-button");
            refresh.appendChild(icon("refresh"));
            refresh.appendChild(el("span", "", t("refresh")));
            refresh.addEventListener("click", () => vscode.postMessage({ type: "refresh" }));
            empty.appendChild(refresh);
            app.appendChild(empty);
            return;
        }
        groups.forEach((group) => {
            if (groups.length > 1) {
                app.appendChild(el("h2", "group", group.name));
            }
            const list = el("div", "list");
            group.tasks.forEach((task) => list.appendChild(card(group, task)));
            app.appendChild(list);
        });
    }

    // Seules les durées changent chaque seconde : pas de rendu complet.
    setInterval(() => {
        document.querySelectorAll(".since").forEach((node) => {
            node.textContent = ` · ${duration(Number(node.dataset.since))}`;
        });
    }, 1000);

    window.addEventListener("message", (event) => {
        if (event.data.type === "state") {
            groups = event.data.groups;
            render();
        }
    });

    vscode.postMessage({ type: "ready" });
})();
