// Projet fictif : les tâches simulent un build (délais et journaux), sans dépendance autre que Gulp.
const { series, parallel, watch } = require("gulp");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clean() {
    await wait(150);
}

async function styles() {
    await wait(400);
    console.log("  dist/css/main.css  18.4 kb");
}

async function scripts() {
    await wait(500);
    console.log("  dist/js/app.js  42.1 kb");
}

async function images() {
    await wait(300);
    console.log("  12 images optimisées (-38 %)");
}

function serve(done) {
    console.log("[Browsersync] Access URLs:");
    console.log(" --------------------------------------");
    console.log("       Local: http://localhost:3000");
    console.log("    External: http://192.168.1.20:3000");
    console.log(" --------------------------------------");
    console.log("          UI: http://localhost:3001");
    console.log(" UI External: http://localhost:3001");
    console.log(" --------------------------------------");
    console.log("[Browsersync] Serving files from: dist");
    watch("src/scss/**/*.scss", styles);
    watch("src/js/**/*.js", scripts);
    done();
}

const build = series(clean, parallel(styles, scripts, images));

exports.clean = clean;
exports.styles = styles;
exports.scripts = scripts;
exports.images = images;
exports.build = build;
exports.default = series(build, serve);
