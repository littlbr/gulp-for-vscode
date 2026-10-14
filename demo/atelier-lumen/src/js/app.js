// Atelier Lumen: scripts (demo project)
document.querySelectorAll("[data-reveal]").forEach((node) => {
    new IntersectionObserver(([entry], observer) => {
        if (entry.isIntersecting) {
            node.classList.add("is-visible");
            observer.disconnect();
        }
    }).observe(node);
});
