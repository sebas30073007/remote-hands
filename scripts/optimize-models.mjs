/**
 * Optimiza los modelos 3D de `raw assets/` para la web.
 *
 * Los .glb salen de Inventor y de KiCad con la geometría de fabricación:
 * cada tornillo, cada chaflán y, en el módulo Puente H, cada componente SMD
 * con sus pines modelados. Eso es correcto para fabricar y desproporcionado
 * para mirar: el Puente H solo pesaba 19 MB y medio millón de triángulos.
 *
 * Qué se hace, en este orden, y por qué ese orden:
 *
 *  1. `dedup` + `prune`: materiales y accesores repetidos fuera. Inventor
 *     exporta un material por cuerpo aunque sean idénticos.
 *  2. `weld`: une vértices coincidentes. Sin esto `simplify` no puede
 *     colapsar aristas, porque cada triángulo llega con vértices propios.
 *  3. `simplify` (meshoptimizer): reduce triángulos con un error máximo
 *     relativo al radio de cada malla. El ratio es por modelo: un PCB con
 *     cientos de piezas diminutas aguanta mucha más reducción que un eslabón
 *     de lámina, donde cada arista es la forma.
 *  4. Texturas a WebP de máximo 1024 px, con una función propia en vez de
 *     `textureCompress`: una textura de Inventor llega sin espacio de color
 *     declarado y `sharp` aborta la conversión entera. Aquí se fuerza sRGB
 *     y, si una textura aun así falla, se conserva la original en vez de
 *     tumbar el modelo.
 *  5. `meshopt`: cuantiza y comprime la geometría (EXT_meshopt_compression).
 *     Lo decodifican `<model-viewer>` y three.js.
 *
 * Lo que NO se hace, a propósito: ni `join` ni `flatten` ni `instance`. Los
 * tres fusionan o reparentan nodos, y el render de la vista explosionada
 * (`render-explode.mjs`) agrupa las piezas por el nombre de su nodo
 * —`nema17:2`, `AA_gripper:1`…—. Perder la jerarquía de nombres es perder
 * la posibilidad de separar el robot en partes.
 *
 * Uso: node scripts/optimize-models.mjs
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'raw assets';
const OUT = 'public/models';

/**
 * archivo fuente -> [nombre de salida, ratio de simplificación, error máx.]
 *
 * `ratio` es la fracción de triángulos que se intenta conservar; `error`
 * frena la reducción si la forma se deforma más que esa fracción del radio
 * de la malla, así que el ratio es un objetivo, no una garantía.
 */
const MODELOS = {
  'Full_ensamble.glb': ['robot-completo', 0.5, 0.001],
  'robot manipulador.glb': ['manipulador', 0.5, 0.001],
  'robot mobil.glb': ['plataforma-movil', 0.8, 0.001],
  'nuc.glb': ['nuc', 0.4, 0.002],
  // Cientos de SMD con pines modelados: es el que más aguanta.
  'modulo puenteH.glb': ['puente-h', 0.12, 0.006],
  'realsensed435.glb': ['realsense-d435', 0.6, 0.001],
  'rplidarc1.glb': ['rplidar-c1', 0.6, 0.001],
  // Superficies curvas muy teseladas: con error 0.002 no bajaba ni un
  // triángulo; a 0.01 la silueta sigue intacta a tamaño de panel.
  'quest3.glb': ['meta-quest-3', 0.25, 0.01],
  // Controlador de los steppers del manipulador: otro PCB de KiCad.
  'steppercontroler.glb': ['controlador-steppers', 0.12, 0.006],
  // Marcador temporal del controlador del gripper: un DRV8833 con un
  // ESP32-C3 cableado a mano, sin PCB propia.
  'drv8833.glb': ['drv8833', 0.7, 0.002],
  // Final de carrera con palanca: hay uno por cada eje del manipulador.
  'finaldecarrera.glb': ['final-de-carrera', 0.8, 0.002],
};

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });

await mkdir(OUT, { recursive: true });

/** Texturas a WebP ≤ 1024 px. Devuelve cuántas se convirtieron. */
const comprimirTexturas = async (doc) => {
  let n = 0;
  for (const tex of doc.getRoot().listTextures()) {
    const img = tex.getImage();
    if (!img) continue;
    try {
      const webp = await sharp(Buffer.from(img))
        .toColourspace('srgb')
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      if (webp.length < img.byteLength) {
        tex.setImage(new Uint8Array(webp)).setMimeType('image/webp');
        const uri = tex.getURI();
        if (uri) tex.setURI(uri.replace(/\.(png|jpe?g)$/i, '.webp'));
        n++;
      }
    } catch (e) {
      console.warn(`  textura conservada (${tex.getName() || 'sin nombre'}): ${e.message.split('\n')[0]}`);
    }
  }
  if (n) doc.createExtension(EXTTextureWebP).setRequired(true);
  return n;
};

const triangulos = (doc) => {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      t += (idx ? idx.getCount() : pos.getCount()) / 3;
    }
  }
  return Math.round(t);
};

let totalIn = 0;
let totalOut = 0;

for (const [file, [slug, ratio, error]] of Object.entries(MODELOS)) {
  const src = path.join(SRC, file);
  const out = path.join(OUT, `${slug}.glb`);
  const pesoIn = (await stat(src)).size;

  const doc = await io.read(src);
  const trisIn = triangulos(doc);

  await doc.transform(
    dedup(),
    prune(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error })
  );
  await comprimirTexturas(doc);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

  const trisOut = triangulos(doc);
  await io.write(out, doc);
  const pesoOut = (await stat(out)).size;
  totalIn += pesoIn;
  totalOut += pesoOut;

  console.log(
    `${slug.padEnd(18)} ${(pesoIn / 1048576).toFixed(2).padStart(6)} MB -> ` +
      `${(pesoOut / 1048576).toFixed(2).padStart(5)} MB   ` +
      `${trisIn.toLocaleString('es-MX').padStart(8)} -> ${trisOut.toLocaleString('es-MX').padStart(7)} tris`
  );
}

console.log(
  `\nTotal: ${(totalIn / 1048576).toFixed(1)} MB -> ${(totalOut / 1048576).toFixed(1)} MB`
);
