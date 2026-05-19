const fs = require("fs");
const p = require("path").join(__dirname, "../portal-locadora-ui.js");
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  /panel\.innerHTML = `<motion class="portal-placa-dropdown__empty">\$\{msg\}<\/motion>`;/,
  'panel.innerHTML = `<div class="portal-placa-dropdown__empty">${msg}</div>`;'
);
fs.writeFileSync(p, s);
console.log("fixed");
