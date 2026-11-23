/* PDF "Как пользоваться Мастерской" из того же текста, что вкладка "Помощь" (site/krasnodar/masterskaya/pomosh.js).
   Запуск: node site/tools/pomosh-pdf.js <куда.pdf>   (нужен playwright) */
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const P = require("../krasnodar/masterskaya/pomosh.js");
const F = path.join(__dirname, "../vitrina/dizajn2/fonts/");
const ff = (fam, file, w) => `@font-face{font-family:"${fam}";src:url(data:font/woff2;base64,${fs.readFileSync(F + file).toString("base64")}) format("woff2");font-weight:${w}}`;
const css = [ff("Jost", "jost-300-normal-cyrillic.woff2", 300), ff("Jost", "jost-300-normal-latin.woff2", 300), ff("Jost", "jost-500-normal-cyrillic.woff2", 500), ff("Jost", "jost-500-normal-latin.woff2", 500),
  ff("Playfair", "playfair-display-400-normal-cyrillic.woff2", 400), ff("Playfair", "playfair-display-400-normal-latin.woff2", 400)].join("") + `
@page{size:A4;margin:16mm 16mm 18mm}
body{font-family:Jost,sans-serif;font-weight:300;color:#1d1c1a;font-size:10.5pt;line-height:1.55;margin:0}
.cap{font-weight:500;font-size:7.5pt;letter-spacing:.26em;text-transform:uppercase;color:#77726b;margin:0 0 6mm}
h1{font-family:Playfair,serif;font-weight:400;font-size:26pt;line-height:1.1;margin:0 0 3mm}
.lead{color:#5d5a55;margin:0 0 7mm}
.hp-toc{list-style:none;counter-reset:t;margin:0 0 6mm;padding:0;border-top:.5pt solid #cfcac2;columns:2;column-gap:10mm}
.hp-toc li{counter-increment:t;border-bottom:.5pt solid #cfcac2;break-inside:avoid}
.hp-toc a{display:flex;gap:8px;padding:2mm 0;color:#1d1c1a;text-decoration:none}
.hp-toc a::before{content:counter(t);font-family:Playfair,serif;color:#77726b;min-width:10px}
.hp-s{display:grid;grid-template-columns:12mm 1fr;padding:5mm 0 1mm;border-top:.5pt solid #cfcac2;break-inside:avoid}
.hp-n{font-family:Playfair,serif;font-size:22pt;line-height:1;color:#9a958d}
h2{font-family:Playfair,serif;font-weight:400;font-size:15pt;margin:0 0 2.5mm}
p{margin:0 0 2.5mm}ol,ul{margin:0 0 3mm;padding-left:5mm}li{margin:0 0 1.5mm}b{font-weight:500}
.adr a{color:#1d1c1a;font-weight:500}
.vazh{border-left:1pt solid #1d1c1a;padding-left:3.5mm}`;
const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><style>${css}</style><body>
<div class="cap">Для мастера</div><h1>Как пользоваться Мастерской</h1>
<p class="lead">Семь шагов: от входа до того, как правка появится на сайте. Эта же инструкция есть в Мастерской, вкладка «Помощь».</p>${P.html()}</body></html>`;
(async () => {
  const out = process.argv[2] || "instrukciya-mastera.pdf";
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.setContent(html, { waitUntil: "load" }); await pg.evaluate(() => document.fonts.ready);
  await pg.pdf({ path: out, format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: '<div style="width:100%;text-align:center;font-size:7pt;color:#9a958d"><span class="pageNumber"></span> / <span class="totalPages"></span></div>', margin: { top: "16mm", bottom: "18mm", left: "16mm", right: "16mm" } });
  await b.close(); console.log("PDF:", out);
})();
