/**
 * Segunda pasada de migración de imágenes desde el sitio anterior
 * (teleop-mobile-manipulator, Jekyll + Just the Docs).
 *
 * `optimize-images.mjs` trajo las fotos de `assets/raw_assets` —las
 * originales de cámara, sin procesar—. Este script trae lo que quedaba en
 * `assets/img`: las figuras que el sitio viejo ya publicaba, que son de dos
 * naturalezas distintas y por eso se tratan distinto.
 *
 *  - DIAGRAMAS: gráficas, esquemáticos, renders de PCB, capturas de la
 *    interfaz XR. Llevan texto y líneas finas, así que se quedan en PNG:
 *    un WebP con pérdida a calidad 82 emborrona la tipografía de un
 *    esquemático justo donde hay que leer un valor. Se recomprimen sin
 *    tocar los píxeles.
 *  - FOTOS: fotografías guardadas como PNG por el camino que siguieran en
 *    su día. Ahí el PNG solo es peso muerto —hasta 2 MB por imagen— y van
 *    a WebP con el mismo perfil que el resto de fotos del sitio, a
 *    `images/build/` junto a ellas.
 *
 * El destino de cada una y su pie de foto salen del sitio viejo, no de
 * cero: cada figura ya estaba publicada con su texto, y ese texto es el
 * que sabe qué se está mirando.
 */
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'E:/20_UNI/Html proyects/Claude_JustTheDocs_ProyectoTerminal/teleop-mobile-manipulator/assets/img';
const FIGS = 'E:/20_UNI/Html proyects/Claude_JustTheDocs_ProyectoTerminal/teleop-mobile-manipulator/IEEE_IOT/figs';
const OUT = 'E:/20_UNI/Html proyects/remote-hands/public/images';

/** Diagramas y capturas: PNG → PNG recomprimido, en `images/`. */
const DIAGRAMAS = {
  'Comercio Minorista.png': 'comercio-minorista',
  'Ciclo de vida del E-commerce.png': 'ciclo-de-vida-ecommerce',
  'Costos logisticos.png': 'costos-logisticos',
  'Discapacidad.png': 'discapacidad',
  'Diagrama detalle.png': 'diagrama-detalle',
  'Esquematico DriversController.png': 'esquematico-controlador-drivers',
  'PCB 2 layers Drivers-controller.png': 'pcb-2-capas-controlador-drivers',
  'Manofactura JLCPCB DriversController.png': 'manufactura-jlcpcb-controlador-drivers',
  'UI MixReality.png': 'ui-realidad-mixta',
  'full-cronograma.png': 'cronograma',
};

/** Fotografías guardadas como PNG: → WebP, en `images/build/`. */
const FOTOS = {
  'Controlador.png': 'controlador-cl57t-placa',
  'Finales de carrera.png': 'finales-de-carrera',
  'render.png': 'manipulador-render',
  'AGV_manipulador completo.png': 'manipulador-ensamble-completo',
  'Manipulador gripper.png': 'gripper-conjunto',
  'Mecanismos.png': 'mecanismos-transmision',
  'Eje rotacional.png': 'eje-rotacional-base',
  'Poleas.png': 'poleas-correas',
  'Hardware base.png': 'plataforma-hardware-base',
  'PuenteH.png': 'conexiones-puente-h',
  'Primer prueba de movilidad.png': 'primera-prueba-movilidad',
  'Integración estructural.png': 'integracion-estructural',
  'Proto_PuenteH.png': 'prototipo-puente-h-prueba',
};

/** Figuras del paper IEEE que el sitio todavía no tenía. */
const PAPER = {
  'fig_rtt_box.png': 'fig-rtt-caja-por-condicion',
  'fig_burst_c1.png': 'fig-rafagas-c1',
  'fig_tail_vs_load.png': 'fig-cola-vs-carga',
};

await mkdir(path.join(OUT, 'build'), { recursive: true });

let entrada = 0;
let salida = 0;
let n = 0;

async function convertir(src, destino, transformar) {
  try {
    const s = await stat(src);
    const info = await transformar(sharp(src).rotate()).toFile(destino);
    entrada += s.size;
    salida += info.size;
    n++;
    const nombre = path.basename(destino);
    console.log(
      `${nombre.padEnd(44)} ${(s.size / 1024).toFixed(0).padStart(5)}KB -> ` +
        `${(info.size / 1024).toFixed(0).padStart(5)}KB  ${info.width}x${info.height}`
    );
  } catch (e) {
    console.log(`FALTA  ${path.basename(src)}: ${e.message.split('\n')[0]}`);
  }
}

const aPng = (p) =>
  p.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).png({
    compressionLevel: 9,
    // Paleta indexada: las figuras son planas (pocos colores, mucho texto)
    // y así pesan la mitad sin tocar la nitidez de las líneas.
    palette: true,
  });

const aWebp = (p) =>
  p
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 });

console.log('— Diagramas y capturas (PNG) —');
for (const [file, slug] of Object.entries(DIAGRAMAS)) {
  await convertir(path.join(SRC, file), path.join(OUT, `${slug}.png`), aPng);
}

console.log('\n— Figuras del paper (PNG) —');
for (const [file, slug] of Object.entries(PAPER)) {
  await convertir(path.join(FIGS, file), path.join(OUT, `${slug}.png`), aPng);
}

console.log('\n— Fotografías (WebP) —');
for (const [file, slug] of Object.entries(FOTOS)) {
  await convertir(path.join(SRC, file), path.join(OUT, 'build', `${slug}.webp`), aWebp);
}

console.log(
  `\n${n} imágenes | ${(entrada / 1048576).toFixed(1)} MB -> ${(salida / 1048576).toFixed(1)} MB`
);
