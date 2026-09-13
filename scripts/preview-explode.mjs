/**
 * Vista previa de una escena: compone las capas del manifiesto en estado
 * ensamblado y explosionado, lado a lado, sobre fondo claro. Sirve para
 * revisar encuadre, agrupación de piezas y desplazamientos sin abrir el
 * sitio. No forma parte del build.
 *
 * Uso: node scripts/preview-explode.mjs <escena> <salida.png>
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const [escena, salida] = process.argv.slice(2);
const man = JSON.parse(await readFile('src/generated/explode-manifest.json', 'utf8'));
const { w: W, h: H } = man.lienzo;
const esc = man.escenas[escena];

const pct = (p, total) => Math.round((p / 100) * total);

async function componer(explotado) {
  const capas = [];
  if (!explotado) {
    const [x, y] = esc.ensamble.box;
    capas.push({ input: `public/${esc.ensamble.src}`, left: pct(x, W), top: pct(y, H) });
  } else {
    for (const c of [...esc.capas].sort((a, b) => a.z - b.z)) {
      const [x, y] = c.box;
      capas.push({ input: `public/${c.src}`, left: pct(x + c.dx, W), top: pct(y + c.dy, H) });
    }
  }
  // Recorta lo que se salga del lienzo en vez de fallar.
  const partes = [];
  for (const c of capas) {
    const meta = await sharp(c.input).metadata();
    const left = Math.max(0, c.left), top = Math.max(0, c.top);
    const cx = left - c.left, cy = top - c.top;
    const w = Math.min(meta.width - cx, W - left), h = Math.min(meta.height - cy, H - top);
    if (w <= 0 || h <= 0) continue;
    const input = await sharp(c.input).extract({ left: cx, top: cy, width: w, height: h }).toBuffer();
    partes.push({ input, left, top });
  }
  return sharp({ create: { width: W, height: H, channels: 4, background: '#F4F5F7' } })
    .composite(partes)
    .png()
    .toBuffer();
}

const a = await componer(false);
const b = await componer(true);
await sharp({ create: { width: W * 2 + 16, height: H, channels: 4, background: '#FFFFFF' } })
  .composite([{ input: a, left: 0, top: 0 }, { input: b, left: W + 16, top: 0 }])
  .png()
  .toFile(salida);
console.log('ok ->', salida);
