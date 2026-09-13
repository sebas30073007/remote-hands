/**
 * Arnés de render: three.js dentro de Chromium sin ventana (playwright).
 *
 * No hay Blender en esta máquina, y no hace falta: playwright ya es
 * dependencia del proyecto y trae un Chromium con WebGL. Se sirven three.js
 * y los modelos desde disco interceptando las peticiones de un origen falso
 * (`http://render.local/`), así que no se levanta ningún servidor ni se
 * choca con las restricciones de módulos ES sobre `file://`.
 *
 * Devuelve `{ page, close }`. Dentro de la página quedan disponibles
 * `window.THREE`, `window.loadGLB(url)` y `window.ready` (promesa).
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ORIGEN = 'http://render.local';
const RAIZ = process.cwd();

const TIPOS = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.html': 'text/html',
};

const HTML = `<!doctype html>
<html><head><meta charset="utf-8">
<script type="importmap">
{ "imports": {
  "three": "${ORIGEN}/three/build/three.module.js",
  "three/addons/": "${ORIGEN}/three/examples/jsm/"
} }
</script>
<style>html,body{margin:0;background:transparent}</style>
</head><body>
<script type="module">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
  window.THREE = THREE;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  window.loadGLB = (url) => new Promise((ok, ko) => loader.load(url, (g) => ok(g.scene), undefined, ko));
  window.readyResolve();
</script>
<script>window.ready = new Promise((r) => (window.readyResolve = r));</script>
</body></html>`;

export async function abrirArnes({ width = 720, height = 600 } = {}) {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });

  await page.route(`${ORIGEN}/**`, async (route) => {
    const url = new URL(route.request().url());
    let archivo;
    if (url.pathname === '/') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: HTML });
    } else if (url.pathname.startsWith('/three/')) {
      archivo = path.join(RAIZ, 'node_modules', decodeURIComponent(url.pathname));
    } else if (url.pathname.startsWith('/models/')) {
      archivo = path.join(RAIZ, 'public', decodeURIComponent(url.pathname));
    } else {
      return route.fulfill({ status: 404, body: 'no' });
    }
    try {
      const body = await readFile(archivo);
      route.fulfill({
        status: 200,
        contentType: TIPOS[path.extname(archivo)] ?? 'application/octet-stream',
        body,
      });
    } catch {
      route.fulfill({ status: 404, body: `falta ${archivo}` });
    }
  });

  page.on('console', (m) => {
    if (m.type() === 'error') console.error('  [página]', m.text());
  });
  page.on('pageerror', (e) => console.error('  [página]', e.message));

  await page.goto(`${ORIGEN}/`);
  await page.evaluate(() => window.ready);
  return { page, close: () => browser.close() };
}
