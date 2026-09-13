/**
 * Render de la vista explosionada: modelos 3D -> capas PNG + manifiesto.
 *
 * Para cada escena de `explode-scenes.mjs`:
 *   1. Arma la escena en three.js (Chromium sin ventana, ver
 *      `lib/three-harness.mjs`) con material de arcilla monocromo.
 *   2. Calcula el encuadre que contiene el conjunto ensamblado Y el
 *      explosionado, para que ninguna pieza se salga al separarse.
 *   3. Renderiza cada capa sola, a 2×, con fondo transparente, y una
 *      imagen del conjunto ensamblado con la profundidad real.
 *   4. En Node: reduce, recorta al contorno, guarda WebP, y extrae del
 *      canal alfa el polígono clicable y el punto donde va el globo
 *      numerado de cada pieza.
 *
 * Salidas:
 *   public/explode/<escena>/<capa>.webp
 *   public/explode/<escena>/_ensamble.webp
 *   src/generated/explode-manifest.json
 *
 * Uso: node scripts/render-explode.mjs            (todas las escenas)
 *      node scripts/render-explode.mjs robot gripper
 *      node scripts/render-explode.mjs --miniaturas [id …]
 *
 * Miniaturas: imágenes sueltas para las páginas (ver `MINIATURAS`), a
 * `public/images/3d/<id>.webp`. No tocan el manifiesto.
 *
 * Materiales: ver `MATERIAL` en `explode-scenes.mjs`. En modo `original`
 * se respetan los colores y texturas de cada modelo sobre un entorno de
 * estudio (sin él, todo material metálico sale negro: no tiene nada que
 * reflejar), con tone mapping neutro, que no desplaza el tono como ACES.
 * En modo `arcilla`, grises derivados de la luminancia de cada material.
 */
import { abrirArnes } from './lib/three-harness.mjs';
import { ESCENAS, MINIATURAS, VISTA, LIENZO, SUPERMUESTREO, TORNILLERIA, MATERIAL, ACABADOS } from './explode-scenes.mjs';
import sharp from 'sharp';
import { contours } from 'd3-contour';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const OUT_IMG = 'public/explode';
const OUT_MANIFEST = 'src/generated/explode-manifest.json';
const { w: W, h: H } = LIENZO;

const serializarRegex = (lista) => (lista ?? []).map((r) => [r.source, r.flags]);

const serializarEscena = (esc) => ({
  base: esc.base ?? null,
  sinTornilleria: Boolean(esc.sinTornilleria),
  soloPiezas: esc.soloPiezas ? serializarRegex(esc.soloPiezas) : null,
  capas: esc.capas.map((c) => ({ ...c, piezas: c.piezas ? serializarRegex(c.piezas) : null })),
});

/* ------------------------------------------------------------------ */
/* Código que corre DENTRO de la página                                */
/* ------------------------------------------------------------------ */
async function prepararEscena({ escena, vista, W, H, S, tornilleria, material, acabados }) {
  const THREE = window.THREE;
  const color = material === 'original';

  if (!window.__renderer) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(r.domElement);
    window.__renderer = r;
    window.__cache = {};
    if (color) {
      const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
      const pmrem = new THREE.PMREMGenerator(r);
      window.__entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    }
  }
  const renderer = window.__renderer;
  renderer.toneMapping = color ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = color ? 1.0 : 1.05;
  renderer.setSize(W * S, H * S);
  renderer.setClearColor(0x000000, 0);

  const cargar = async (nombre) => {
    if (!window.__cache[nombre]) {
      window.__cache[nombre] = await window.loadGLB(`http://render.local/models/${nombre}.glb`);
    }
    return window.__cache[nombre].clone(true);
  };

  const scene = new THREE.Scene();
  const luz = (x, y, z, i) => {
    const l = new THREE.DirectionalLight(0xffffff, i);
    l.position.set(x, y, z);
    scene.add(l);
  };
  if (color) {
    // El entorno ilumina y da reflejos; la luz direccional solo marca el
    // volumen, para que las caras planas de lámina no se lean iguales.
    scene.environment = window.__entorno;
    scene.environmentIntensity = 0.9;
    luz(-2, 3, 2, 1.4);
    luz(1, 2, -2.5, 0.5);
  } else {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6d7278, 1.35));
    luz(-2, 3, 2, 2.1); // principal, arriba a la izquierda del observador
    luz(2.5, 1, 1.5, 0.45); // relleno
    luz(1, 2, -2.5, 0.9); // contraluz: separa la silueta del fondo
  }

  // --- Arcilla monocromo derivada de la luminancia original -----------
  const materiales = new Map();
  const arcilla = (orig) => {
    const c = orig?.color ?? new THREE.Color(0.7, 0.7, 0.7);
    const srgb = c.clone().convertLinearToSRGB();
    const lum = 0.2126 * srgb.r + 0.7152 * srgb.g + 0.0722 * srgb.b;
    const g = Math.round((0.36 + 0.5 * Math.sqrt(Math.min(1, lum))) * 40) / 40;
    if (!materiales.has(g)) {
      materiales.set(
        g,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setRGB(g, g, g, THREE.SRGBColorSpace),
          roughness: 0.72,
          metalness: 0,
        })
      );
    }
    return materiales.get(g);
  };
  // Modo color: se conservan los materiales, salvo dos correcciones. Los
  // acabados declarados para modelos sin color, y la transmisión (vidrio)
  // desactivada: sobre fondo transparente se renderiza negra, porque no hay
  // nada detrás que refractar.
  const original = (mat, modelo) => {
    const ac = acabados[modelo]?.[mat.name];
    if (ac && !mat.userData.acabado) {
      mat.color = new THREE.Color(ac.color);
      mat.roughness = ac.roughness ?? mat.roughness;
      mat.metalness = ac.metalness ?? 0;
      mat.userData.acabado = true;
    }
    if (mat.transmission) mat.transmission = 0;
    return mat;
  };
  const aplicarArcilla = (obj, modelo) =>
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const f = color ? (m) => original(m, modelo) : arcilla;
      o.material = Array.isArray(o.material) ? o.material.map(f) : f(o.material);
    });

  const re = (lista) => (lista ?? []).map(([s, f]) => new RegExp(s, f));
  const nombreDe = (o) => o.userData?.name ?? o.name ?? '';
  const coincide = (o, pats) => pats.some((p) => p.test(nombreDe(o)));
  const TORN = re(tornilleria);

  // --- Construcción de las capas ---------------------------------------
  const capas = [];
  const grupos = new Map();
  for (const def of escena.capas) {
    const g = new THREE.Group();
    g.name = def.id;
    grupos.set(def.id, g);
    capas.push({ def, g });
    scene.add(g);
  }

  const informe = { sinAsignar: [], porCercania: 0 };

  if (escena.base) {
    const base = await cargar(escena.base);
    aplicarArcilla(base, escena.base);
    base.updateMatrixWorld(true);
    const solo = escena.soloPiezas ? re(escena.soloPiezas) : null;
    const conPatrones = capas.filter((c) => c.def.piezas);
    const pendientes = [];

    for (const parte of [...base.children]) {
      const dueña = conPatrones.find((c) => coincide(parte, re(c.def.piezas)));
      if (dueña && (!solo || coincide(parte, solo))) {
        dueña.g.attach(parte);
      } else if ((coincide(parte, TORN) && !escena.sinTornilleria) || !solo) {
        pendientes.push(parte);
      }
    }

    // Lo que ningún patrón reclamó va a la capa más cercana. En escenas
    // parciales (`soloPiezas`) solo si está pegado a ella: la tornillería
    // del brazo no debe colarse en la escena de la plataforma.
    const cajas = conPatrones.map((c) => ({ c, box: new THREE.Box3().setFromObject(c.g) }));
    for (const parte of pendientes) {
      const centro = new THREE.Box3().setFromObject(parte).getCenter(new THREE.Vector3());
      let mejor = null;
      let dmin = Infinity;
      for (const { c, box } of cajas) {
        if (box.isEmpty()) continue;
        const d = box.distanceToPoint(centro);
        if (d < dmin) {
          dmin = d;
          mejor = c;
        }
      }
      if (mejor && (!solo || dmin < 0.03)) {
        mejor.g.attach(parte);
        informe.porCercania++;
      } else if (!solo) {
        informe.sinAsignar.push(nombreDe(parte));
      }
    }
  }

  for (const { def, g } of capas) {
    // Tres formas de declarar modelos sueltos, reducidas a una lista:
    // `componentes` (varios modelos), `modelo` + `instancias` (el mismo
    // modelo repetido) o `modelo` + `posicion` (uno solo).
    const componentes =
      def.componentes ??
      (def.modelo
        ? (def.instancias ?? [def.posicion ?? [0, 0, 0]]).map((posicion) => ({
            modelo: def.modelo,
            posicion,
            escala: def.escala,
            rotacion: def.rotacion,
          }))
        : []);
    for (const c of componentes) {
      const m = await cargar(c.modelo);
      aplicarArcilla(m, c.modelo);
      const box = new THREE.Box3().setFromObject(m);
      const centro = box.getCenter(new THREE.Vector3());
      const envoltura = new THREE.Group();
      m.position.sub(centro);
      envoltura.add(m);
      envoltura.scale.setScalar(c.escala ?? 1);
      if (c.rotacion) envoltura.rotation.set(...c.rotacion);
      envoltura.position.set(...(c.posicion ?? [0, 0, 0]));
      g.add(envoltura);
    }
  }

  scene.updateMatrixWorld(true);

  // --- Cámara y proyección a pantalla ---------------------------------
  const todo = new THREE.Box3();
  for (const { g } of capas) todo.expandByObject(g);
  const objetivo = todo.getCenter(new THREE.Vector3());
  const radio = todo.getSize(new THREE.Vector3()).length();
  const dir = new THREE.Vector3(...vista).normalize();

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, radio * 20);
  cam.position.copy(objetivo).addScaledVector(dir, radio * 5);
  cam.up.set(0, 1, 0);
  cam.lookAt(objetivo);
  cam.updateMatrixWorld(true);
  const derecha = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const arriba = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);

  // Caja 2D exacta de una capa: se proyectan TODOS los vértices, no las
  // esquinas de su caja 3D, que sobrestimarían el contorno.
  const v = new THREE.Vector3();
  const caja2D = (g) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    g.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).sub(objetivo);
        const x = v.dot(derecha);
        const y = v.dot(arriba);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    });
    return { x0, x1, y0, y1 };
  };

  const info = capas.map(({ def, g }) => ({ def, g, b: caja2D(g) }));
  // Unidad de los desplazamientos: la dimensión MAYOR del conjunto
  // ensamblado en pantalla. Con la altura, un conjunto plano y ancho —el
  // gripper— apenas se separaba: su altura es una fracción de su ancho.
  const visibles = info.filter((i) => !i.def.oculto);
  const unidad = Math.max(
    Math.max(...visibles.map((i) => i.b.y1)) - Math.min(...visibles.map((i) => i.b.y0)),
    Math.max(...visibles.map((i) => i.b.x1)) - Math.min(...visibles.map((i) => i.b.x0))
  );

  // Encuadre: unión del estado ensamblado y del explosionado.
  let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity;
  for (const i of info) {
    const [dx, dy] = (i.def.explota ?? [0, 0]).map((k) => k * unidad);
    i.off = [dx, dy];
    const estados = i.def.oculto ? [[dx, dy]] : [[0, 0], [dx, dy]];
    for (const [ox, oy] of estados) {
      fx0 = Math.min(fx0, i.b.x0 + ox);
      fx1 = Math.max(fx1, i.b.x1 + ox);
      fy0 = Math.min(fy0, i.b.y0 + oy);
      fy1 = Math.max(fy1, i.b.y1 + oy);
    }
  }
  const pad = 0.06 * Math.max(fx1 - fx0, fy1 - fy0);
  fx0 -= pad; fx1 += pad; fy0 -= pad; fy1 += pad;
  // Ajuste a la proporción del lienzo sin deformar.
  const aspecto = W / H;
  let fw = fx1 - fx0;
  let fh = fy1 - fy0;
  const cx = (fx0 + fx1) / 2;
  const cy = (fy0 + fy1) / 2;
  if (fw / fh > aspecto) fh = fw / aspecto;
  else fw = fh * aspecto;
  cam.left = cx - fw / 2;
  cam.right = cx + fw / 2;
  cam.top = cy + fh / 2;
  cam.bottom = cy - fh / 2;
  cam.updateProjectionMatrix();

  window.__escena = { scene, cam, capas: info };

  return {
    sinAsignar: informe.sinAsignar,
    porCercania: informe.porCercania,
    capas: info.map((i) => {
      const centro = new THREE.Box3().setFromObject(i.g).getCenter(new THREE.Vector3());
      return {
        id: i.def.id,
        oculto: !!i.def.oculto,
        // % del lienzo; en pantalla `y` crece hacia abajo.
        dx: (i.off[0] / fw) * 100,
        dy: (-i.off[1] / fh) * 100,
        // Mayor = más cerca de la cámara = se dibuja encima.
        profundidad: centro.sub(objetivo).dot(dir),
        vacia: !isFinite(i.b.x0),
      };
    }),
  };
}

function renderizar(ids) {
  const { scene, cam, capas } = window.__escena;
  for (const c of capas) c.g.visible = ids.includes(c.def.id);
  window.__renderer.render(scene, cam);
  return window.__renderer.domElement.toDataURL('image/png');
}

/* ------------------------------------------------------------------ */
/* Node: recorte, WebP, polígono clicable y globo                      */
/* ------------------------------------------------------------------ */
const decodificar = (dataURL) => Buffer.from(dataURL.slice(dataURL.indexOf(',') + 1), 'base64');

/** Ramer–Douglas–Peucker sobre un anillo. */
function simplificar(puntos, eps) {
  if (puntos.length < 4) return puntos;
  const dist = (p, a, b) => {
    const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
    const dx = x2 - x1, dy = y2 - y1;
    const l = dx * dx + dy * dy;
    if (!l) return Math.hypot(x - x1, y - y1);
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l));
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
  };
  const rdp = (pts) => {
    let dmax = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = dist(pts[i], pts[0], pts[pts.length - 1]);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax <= eps) return [pts[0], pts[pts.length - 1]];
    return [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))];
  };
  return rdp(puntos);
}

const areaAnillo = (r) =>
  Math.abs(r.reduce((a, [x, y], i) => {
    const [x2, y2] = r[(i + 1) % r.length];
    return a + x * y2 - x2 * y;
  }, 0)) / 2;

async function procesarCapa(png, destino, W = LIENZO.w, H = LIENZO.h) {
  const { data, info } = await sharp(png)
    .resize(W, H, { kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Caja del alfa.
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const m = 2;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
  x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;

  const recorte = sharp(data, { raw: { width: W, height: H, channels: 4 } }).extract({
    left: x0, top: y0, width: bw, height: bh,
  });
  await recorte.clone().webp({ quality: 88, alphaQuality: 90, effort: 6 }).toFile(destino);

  // Rejilla de alfa reducida para contorno y globo.
  const escala = 96 / Math.max(bw, bh);
  const gw = Math.max(4, Math.round(bw * escala));
  const gh = Math.max(4, Math.round(bh * escala));
  const alfa = await recorte.clone().extractChannel(3).resize(gw, gh, { kernel: 'cubic' }).raw().toBuffer();
  const valores = Array.from(alfa);

  const multi = contours().size([gw, gh]).thresholds([96])(valores)[0].coordinates;
  let anillos = multi.map((poly) => poly[0]);
  const mayor = Math.max(0, ...anillos.map(areaAnillo));
  anillos = anillos
    .filter((r) => areaAnillo(r) > mayor * 0.03)
    .map((r) => simplificar(r, 0.7).map(([x, y]) => [+((x / gw) * 100).toFixed(1), +((y / gh) * 100).toFixed(1)]));

  // Globo: el punto interior más alejado del borde (transformada de
  // distancia de chaflán, dos pasadas). El centroide no sirve: en una pieza
  // en L cae fuera de la pieza.
  const dentro = valores.map((a) => a >= 128);
  const d = dentro.map((v) => (v ? Infinity : 0));
  const at = (x, y) => (x < 0 || y < 0 || x >= gw || y >= gh ? 0 : d[y * gw + x]);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++)
      if (dentro[y * gw + x]) d[y * gw + x] = Math.min(d[y * gw + x], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4, at(x + 1, y - 1) + 1.4);
  for (let y = gh - 1; y >= 0; y--)
    for (let x = gw - 1; x >= 0; x--)
      if (dentro[y * gw + x]) d[y * gw + x] = Math.min(d[y * gw + x], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4, at(x - 1, y + 1) + 1.4);
  let bi = 0;
  for (let i = 1; i < d.length; i++) if (d[i] > d[bi]) bi = i;
  const globo = [+((((bi % gw) + 0.5) / gw) * 100).toFixed(1), +(((Math.floor(bi / gw) + 0.5) / gh) * 100).toFixed(1)];

  return {
    box: [(x0 / W) * 100, (y0 / H) * 100, (bw / W) * 100, (bh / H) * 100].map((n) => +n.toFixed(2)),
    poly: anillos,
    globo,
  };
}

/* ------------------------------------------------------------------ */
const argumentos = process.argv.slice(2);
const modoMiniaturas = argumentos.includes('--miniaturas');
const pedidas = argumentos.filter((a) => !a.startsWith('--'));

if (modoMiniaturas) {
  const ids = pedidas.length ? pedidas : Object.keys(MINIATURAS);
  const { page, close } = await abrirArnes({ width: 64, height: 64 });
  await mkdir('public/images/3d', { recursive: true });
  for (const id of ids) {
    const mini = MINIATURAS[id];
    if (!mini) {
      console.error(`miniatura desconocida: ${id}`);
      continue;
    }
    const { w, h } = mini.lienzo ?? { w: 480, h: 360 };
    const meta = await page.evaluate(prepararEscena, {
      escena: serializarEscena(mini),
      vista: VISTA,
      W: w, H: h, S: SUPERMUESTREO,
      tornilleria: serializarRegex(TORNILLERIA),
      material: MATERIAL,
      acabados: ACABADOS,
    });
    const png = decodificar(await page.evaluate(renderizar, meta.capas.filter((c) => !c.vacia).map((c) => c.id)));
    const destino = `public/images/3d/${id}.webp`;
    const r = await procesarCapa(png, destino, w, h);
    console.log(`${id.padEnd(20)} -> ${destino}${r ? '' : ' (VACÍA)'}`);
  }
  await close();
  process.exit(0);
}

const nombres = pedidas.length ? pedidas : Object.keys(ESCENAS);

let manifiesto = {};
try {
  const { readFile } = await import('node:fs/promises');
  manifiesto = JSON.parse(await readFile(OUT_MANIFEST, 'utf8'));
} catch {}
manifiesto.lienzo = { w: W, h: H };
manifiesto.escenas ??= {};

const { page, close } = await abrirArnes({ width: W * SUPERMUESTREO, height: H * SUPERMUESTREO });

for (const nombre of nombres) {
  const esc = ESCENAS[nombre];
  if (!esc) {
    console.error(`escena desconocida: ${nombre}`);
    continue;
  }
  const t0 = Date.now();
  const carpeta = path.join(OUT_IMG, nombre);
  await rm(carpeta, { recursive: true, force: true });
  await mkdir(carpeta, { recursive: true });

  const meta = await page.evaluate(prepararEscena, {
    escena: serializarEscena(esc),
    vista: VISTA,
    W, H, S: SUPERMUESTREO,
    tornilleria: serializarRegex(TORNILLERIA),
    material: MATERIAL,
    acabados: ACABADOS,
  });

  const capas = [];
  for (const c of meta.capas) {
    if (c.vacia) {
      console.warn(`  ! ${nombre}/${c.id}: capa vacía, ninguna pieza coincidió`);
      continue;
    }
    const png = decodificar(await page.evaluate(renderizar, [c.id]));
    const r = await procesarCapa(png, path.join(carpeta, `${c.id}.webp`));
    if (!r) continue;
    capas.push({ id: c.id, src: `explode/${nombre}/${c.id}.webp`, oculto: c.oculto, dx: +c.dx.toFixed(2), dy: +c.dy.toFixed(2), profundidad: c.profundidad, ...r });
  }
  // Orden de dibujo: de lejos a cerca.
  capas.sort((a, b) => a.profundidad - b.profundidad);
  capas.forEach((c, i) => { c.z = i; delete c.profundidad; });

  const visibles = meta.capas.filter((c) => !c.oculto && !c.vacia).map((c) => c.id);
  const pngEns = decodificar(await page.evaluate(renderizar, visibles));
  const ens = await procesarCapa(pngEns, path.join(carpeta, '_ensamble.webp'));

  manifiesto.escenas[nombre] = {
    // El conjunto ensamblado también es clicable: en la portada, tocar el
    // robot entero es lo que lo explota.
    ensamble: { src: `explode/${nombre}/_ensamble.webp`, box: ens.box, poly: ens.poly },
    capas,
  };

  console.log(
    `${nombre.padEnd(12)} ${capas.length} capas · ${meta.porCercania} piezas por cercanía` +
      (meta.sinAsignar.length ? ` · SIN ASIGNAR: ${meta.sinAsignar.join(', ')}` : '') +
      ` · ${((Date.now() - t0) / 1000).toFixed(1)} s`
  );
}

await close();
await mkdir(path.dirname(OUT_MANIFEST), { recursive: true });
await writeFile(OUT_MANIFEST, JSON.stringify(manifiesto, null, 1));
console.log(`\nmanifiesto -> ${OUT_MANIFEST}`);
