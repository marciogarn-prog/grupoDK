/**
 * Gera ícones PWA do app cliente/portal com contorno laranja (ambiente demo).
 * Uso: node grupodkempreendimentos/scripts/generate-demo-cliente-icons.mjs
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, "..", "icons");
const ORANGE = "#F97316";
const SIZES = [192, 512];

function ringSvg(size, ringPx) {
  const r = Math.round(size * 0.16);
  const half = ringPx / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${half}" y="${half}" width="${size - ringPx}" height="${size - ringPx}"
    rx="${r}" ry="${r}" fill="none" stroke="${ORANGE}" stroke-width="${ringPx}"/>
</svg>`
  );
}

async function buildDemoIcon(size) {
  const src = path.join(iconsDir, `icon-cliente-${size}.png`);
  const out = path.join(iconsDir, `icon-cliente-demo-${size}.png`);
  const ringPx = Math.max(10, Math.round(size * 0.07));
  const inner = size - ringPx * 2;
  const innerBuf = await sharp(src).resize(inner, inner).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 5, g: 5, b: 5, alpha: 1 },
    },
  })
    .composite([
      { input: innerBuf, top: ringPx, left: ringPx },
      { input: ringSvg(size, ringPx), top: 0, left: 0 },
    ])
    .png()
    .toFile(out);
  console.log("ok", path.basename(out));
}

for (const size of SIZES) {
  await buildDemoIcon(size);
}
