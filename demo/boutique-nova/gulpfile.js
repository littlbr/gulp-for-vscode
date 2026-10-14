// Projet fictif : les tâches simulent un build (délais et journaux), sans dépendance autre que Gulp.
const { series, parallel } = require("gulp");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function styles() {
    await wait(400);
    console.log("  dist/css/shop.css  24.7 kb");
}

async function scripts() {
    await wait(500);
    console.log("  dist/js/shop.js  57.3 kb");
}

async function lint() {
    await wait(300);
    throw new Error("src/js/cart.js:14:9 'total' is assigned a value but never used");
}

exports.styles = styles;
exports.scripts = scripts;
exports.lint = lint;
exports.build = parallel(styles, scripts);
