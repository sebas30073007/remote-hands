/**
 * DXF de corte láser → plano cotado en SVG.
 *
 * El proyecto se desmanteló, así que no hay forma de volver a medir una
 * pieza. Lo que sí sobrevive es el DXF que se mandó a cortar, y ese archivo
 * es la geometría real: el contorno que salió de la cortadora y cada
 * barreno con su diámetro y su posición. Este script lo convierte en un
 * plano que se puede leer en pantalla y usar para replicar la pieza.
 *
 * No intenta ser un CAD. Dibuja lo que hay —contorno, barrenos— y acota lo
 * que alguien necesita para reproducir la pieza sin abrir Inventor: la
 * envolvente y el cuadro de barrenos por diámetro. Las cotas de detalle
 * entre rasgos concretos siguen exigiendo el CAD, y el plano lo dice.
 *
 * Uso:
 *   node scripts/dxf-to-drawing.mjs
 *
 * Entra  public/cad/dxf/*.dxf
 * Sale   public/drawings/*.svg
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'public/cad/dxf';
const DST = 'public/drawings';

/** Nombre legible por archivo. Sin entrada aquí, se usa el del archivo. */
const TITULOS = {
  'primer-eslabon': 'Primer eslabón',
  'soporte-nema17': 'Soporte de motor NEMA 17',
  'soporte-drivers': 'Soporte de drivers',
  'soporte-top-rodamiento': 'Soporte superior de rodamiento',
  'silueta_50t': 'Silueta de polea 50T',
  'balero-plano': 'Balero plano',
  gripper_flex: 'Flexura del gripper',
};

/**
 * Parser DXF mínimo. Los archivos de este proyecto salen de Inventor como
 * pares (código, valor) en líneas alternas, con la geometría en la sección
 * ENTITIES y las polilíneas en el formato clásico POLYLINE/VERTEX/SEQEND.
 * Se cubren además LWPOLYLINE, LINE y ARC por si una exportación futura
 * las usa; cualquier otra entidad se ignora en silencio.
 */
function parseDxf(texto) {
  const l = texto.split(/\r?\n/).map((x) => x.trim());
  const pares = [];
  for (let i = 0; i + 1 < l.length; i += 2) pares.push([l[i], l[i + 1]]);

  const circulos = [];
  const caminos = [];
  let seccion = null;
  let i = 0;

  const leerCampos = (desde) => {
    const campos = {};
    let j = desde;
    while (j < pares.length && pares[j][0] !== '0') {
      const [c, v] = pares[j];
      if (!(c in campos)) campos[c] = v;
      j++;
    }
    return [campos, j];
  };

  while (i < pares.length) {
    const [cod, val] = pares[i];
    if (cod === '0' && val === 'SECTION') {
      seccion = pares[i + 1]?.[1] ?? null;
      i += 2;
      continue;
    }
    if (cod === '0' && val === 'ENDSEC') {
      seccion = null;
      i++;
      continue;
    }
    if (cod !== '0' || seccion !== 'ENTITIES') {
      i++;
      continue;
    }

    if (val === 'CIRCLE') {
      const [c, j] = leerCampos(i + 1);
      circulos.push({ x: +c['10'], y: +c['20'], r: +c['40'] });
      i = j;
    } else if (val === 'POLYLINE') {
      const [cab, j] = leerCampos(i + 1);
      const cerrado = (Number(cab['70']) & 1) === 1;
      const pts = [];
      let k = j;
      while (k < pares.length && pares[k][1] !== 'SEQEND') {
        if (pares[k][0] === '0' && pares[k][1] === 'VERTEX') {
          const [v, k2] = leerCampos(k + 1);
          pts.push([+v['10'], +v['20']]);
          k = k2;
        } else k++;
      }
      if (pts.length > 1) caminos.push({ pts, cerrado });
      i = k;
    } else if (val === 'LWPOLYLINE') {
      // Los pares 10/20 se repiten, así que no sirve `leerCampos`.
      const pts = [];
      let k = i + 1;
      let cerrado = false;
      let x = null;
      while (k < pares.length && pares[k][0] !== '0') {
        const [c, v] = pares[k];
        if (c === '70') cerrado = (Number(v) & 1) === 1;
        if (c === '10') x = +v;
        if (c === '20' && x !== null) {
          pts.push([x, +v]);
          x = null;
        }
        k++;
      }
      if (pts.length > 1) caminos.push({ pts, cerrado });
      i = k;
    } else if (val === 'LINE') {
      const [c, j] = leerCampos(i + 1);
      caminos.push({
        pts: [
          [+c['10'], +c['20']],
          [+c['11'], +c['21']],
        ],
        cerrado: false,
      });
      i = j;
    } else if (val === 'ARC') {
      const [c, j] = leerCampos(i + 1);
      const cx = +c['10'];
      const cy = +c['20'];
      const r = +c['40'];
      let a0 = (+c['50'] * Math.PI) / 180;
      let a1 = (+c['51'] * Math.PI) / 180;
      if (a1 < a0) a1 += 2 * Math.PI;
      const pasos = Math.max(8, Math.ceil(((a1 - a0) / (2 * Math.PI)) * 64));
      const pts = [];
      for (let s = 0; s <= pasos; s++) {
        const a = a0 + ((a1 - a0) * s) / pasos;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      caminos.push({ pts, cerrado: false });
      i = j;
    } else {
      i++;
    }
  }
  return { circulos, caminos };
}

const r2 = (n) => Math.round(n * 100) / 100;
/** Decimales con coma: es la convención del contenido en español. */
const coma = (n) => String(n).replace('.', ',');

/** Salto + sangría para que el SVG generado quede legible al abrirlo. */
const SALTO = `\n    `;

function generarSvg({ circulos, caminos }, titulo) {
  // Se trabaja en coordenadas de pantalla desde el principio: el eje Y del
  // DXF crece hacia arriba y el del SVG hacia abajo, y arrastrar esa
  // inversión con un `scale(1,-1)` obliga a des-invertir cada texto. Más
  // simple negar la Y una vez, aquí, y no volver a pensarlo.
  const cam = caminos.map((c) => ({ ...c, pts: c.pts.map(([x, y]) => [x, -y]) }));
  const todosCir = circulos.map((c) => ({ ...c, y: -c.y }));

  // La envolvente sale del CONTORNO EXTERIOR, que es el camino de mayor
  // caja, y no de todo lo que el archivo dibuja. Un DXF de corte trae más
  // cosas que el perfil de la pieza: el primer eslabón lleva ocho
  // polilíneas con las letras de «IBERO» grabadas en el centro, y círculos
  // de registro del nesting cuyo centro cae 18 mm fuera del borde. Medir
  // «todo lo dibujado» daba 341 mm de ancho para una pieza de 300.
  const caja = (pts) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  if (!cam.length && !todosCir.length) return null;

  let ext = null;
  for (const c of cam) {
    const b = caja(c.pts);
    const area = (b.x1 - b.x0) * (b.y1 - b.y0);
    if (!ext || area > ext.area) ext = { ...b, area };
  }
  if (!ext) {
    // Pieza sin contorno (solo círculos): la envolvente sí los incluye.
    const b = caja(todosCir.flatMap((c) => [[c.x - c.r, c.y - c.r], [c.x + c.r, c.y + c.r]]));
    ext = { ...b, area: 0 };
  }

  // Un barreno es un círculo cuyo centro cae dentro del contorno exterior.
  // Los de fuera se descartan del plano y del cuadro: no se pueden taladrar
  // en esta pieza, así que contarlos engañaría a quien la replique.
  const dentro = (c) => c.x >= ext.x0 && c.x <= ext.x1 && c.y >= ext.y0 && c.y <= ext.y1;
  const cir = todosCir.filter(dentro);
  const descartados = todosCir.length - cir.length;

  const minX = ext.x0;
  const maxX = ext.x1;
  const minY = ext.y0;
  const maxY = ext.y1;
  const ancho = maxX - minX;
  const alto = maxY - minY;

  const u = Math.max(ancho, alto); // unidad de referencia para trazos y texto
  const t = u / 260; // grosor base de línea
  const fs = u / 30; // tamaño de texto de cota

  // Márgenes asimétricos: arriba entra la cota horizontal, a la derecha la
  // vertical con su texto, y abajo a la izquierda el cuadro de barrenos.
  //
  // El margen derecho se calcula sobre el ANCHO REAL del texto de la cota,
  // no con un factor fijo: con uno fijo, «210,83 mm» perdía la última letra
  // en las piezas más anchas. En una monoespaciada el avance ronda 0,6 em,
  // y sobre eso va el hueco entre la línea de cota y su texto.
  const diametros = [...cir.reduce((m, c) => m.set(r2(c.r * 2), (m.get(r2(c.r * 2)) ?? 0) + 1), new Map())]
    .sort((a, b) => a[0] - b[0]);
  const textoAlto = `${coma(r2(alto))} mm`;
  const mIzq = u * 0.06;
  const mArr = fs * 3.2;
  const mDer = fs * (2.4 + textoAlto.length * 0.62);
  const mAba = fs * (diametros.length ? 1.6 + diametros.length * 1.25 : 1.2);

  const vb = `${r2(minX - mIzq)} ${r2(minY - mArr)} ${r2(ancho + mIzq + mDer)} ${r2(alto + mArr + mAba)}`;

  const d = cam
    .map((c) => 'M ' + c.pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(' L ') + (c.cerrado ? ' Z' : ''))
    .join(' ');

  const yCota = minY - fs * 1.5; // línea de cota horizontal, sobre la pieza
  const xCota = maxX + fs * 1.5; // línea de cota vertical, a la derecha

  const stats = {
    ancho: r2(ancho),
    alto: r2(alto),
    barrenos: cir.length,
    descartados,
    diametros: diametros.map(([d]) => d),
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img"
     aria-label="Plano de ${titulo}: envolvente de ${coma(r2(ancho))} por ${coma(r2(alto))} milímetros con ${cir.length} barrenos">
  <title>${titulo} — plano cotado</title>
  <g fill="none" stroke="currentColor" stroke-width="${r2(t * 1.7)}"
     stroke-linejoin="round" stroke-linecap="round">
    <path d="${d}" />
    ${cir.map((c) => `<circle cx="${r2(c.x)}" cy="${r2(c.y)}" r="${r2(c.r)}" />`).join(SALTO)}
  </g>
  <g stroke="currentColor" stroke-width="${r2(t * 0.7)}" opacity="0.4" fill="none">
    ${cir
      .map(
        (c) =>
          `<path d="M ${r2(c.x - c.r * 1.6)} ${r2(c.y)} H ${r2(c.x + c.r * 1.6)} M ${r2(c.x)} ${r2(c.y - c.r * 1.6)} V ${r2(c.y + c.r * 1.6)}" />`
      )
      .join(SALTO)}
  </g>
  <g stroke="currentColor" stroke-width="${r2(t)}" opacity="0.7" fill="none">
    <path d="M ${r2(minX)} ${r2(yCota)} H ${r2(maxX)}" />
    <path d="M ${r2(minX)} ${r2(yCota - t * 4)} v ${r2(t * 8)}" />
    <path d="M ${r2(maxX)} ${r2(yCota - t * 4)} v ${r2(t * 8)}" />
    <path d="M ${r2(xCota)} ${r2(minY)} V ${r2(maxY)}" />
    <path d="M ${r2(xCota - t * 4)} ${r2(minY)} h ${r2(t * 8)}" />
    <path d="M ${r2(xCota - t * 4)} ${r2(maxY)} h ${r2(t * 8)}" />
  </g>
  <g fill="currentColor" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="${r2(fs)}">
    <text x="${r2((minX + maxX) / 2)}" y="${r2(yCota - fs * 0.55)}" text-anchor="middle">${coma(r2(ancho))} mm</text>
    <text x="${r2(xCota + fs * 0.6)}" y="${r2((minY + maxY) / 2)}" dominant-baseline="middle">${coma(r2(alto))} mm</text>
  </g>
  <g fill="currentColor" font-family="IBM Plex Mono, ui-monospace, monospace"
     font-size="${r2(fs * 0.9)}" opacity="0.85">
    ${diametros
      .map(([dia, n], k) => `<text x="${r2(minX)}" y="${r2(maxY + fs * (1.9 + k * 1.25))}">${n} × ⌀${coma(dia)} mm</text>`)
      .join(SALTO)}
  </g>
</svg>
`;

  return { svg, stats };
}

await mkdir(DST, { recursive: true });
const archivos = (await readdir(SRC)).filter((f) => f.toLowerCase().endsWith('.dxf'));
const resumen = [];

for (const archivo of archivos) {
  const slug = archivo.replace(/\.dxf$/i, '');
  const titulo = TITULOS[slug] ?? slug;
  const geo = parseDxf(await readFile(path.join(SRC, archivo), 'latin1'));
  const salida = generarSvg(geo, titulo);
  if (!salida) {
    console.log(`${slug.padEnd(26)} SIN GEOMETRÍA LEGIBLE`);
    resumen.push({ slug, ok: false });
    continue;
  }
  const { svg, stats } = salida;
  await writeFile(path.join(DST, `${slug}.svg`), svg, 'utf8');
  console.log(
    `${slug.padEnd(26)} ${coma(stats.ancho).padStart(7)} × ${coma(stats.alto).padStart(7)} mm  ` +
      `${String(stats.barrenos).padStart(2)} barrenos  ⌀ ${stats.diametros.map(coma).join(', ') || '—'}` +
      (stats.descartados ? `   [${stats.descartados} círculo(s) fuera del contorno, descartado(s)]` : '')
  );
  resumen.push({ slug, ok: true, ...stats });
}

console.log(`\n${resumen.filter((r) => r.ok).length}/${archivos.length} planos generados en ${DST}/`);
