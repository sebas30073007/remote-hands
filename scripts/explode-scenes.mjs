/**
 * Escenas de la vista explosionada — la geometría.
 *
 * Cada escena es un estado del navegador: un conjunto de CAPAS que se
 * dibujan juntas (ensamblado) y se separan (explosionado). Cada capa es un
 * PNG transparente renderizado por separado desde la MISMA cámara
 * ortográfica. Con proyección ortográfica, mover una pieza en 3D equivale
 * exactamente a moverla en 2D en pantalla —sin cambio de escala ni de
 * perspectiva—, así que la explosión es un `transform: translate()` que
 * anima el navegador. No es una aproximación.
 *
 * Este archivo solo sabe de geometría. A dónde lleva cada capa al hacer
 * clic lo decide `src/lib/explode-nav.ts`; los dos se hablan por el `id` de
 * la capa.
 *
 * Referencia de piezas: `Full_ensamble.glb` llega PLANO desde Inventor —101
 * piezas colgando de la raíz, sin subensambles—. Los grupos se arman aquí
 * por nombre de nodo. La tornillería y los rodamientos no se listan uno a
 * uno: lo que ningún patrón reclama se asigna a la capa más cercana en el
 * espacio (ver `render-explode.mjs`), que es donde está atornillado.
 *
 * Convenciones:
 *  - `piezas`: expresiones regulares sobre el nombre ORIGINAL del nodo
 *    (`nema17:3`), que three.js conserva en `userData.name`.
 *  - `explota`: desplazamiento en PANTALLA, como fracción del tamaño del
 *    conjunto ensamblado. `[dx, dy]`, con `dy > 0` hacia arriba. Se define
 *    en pantalla y no en el mundo porque lo que importa es cómo se lee en
 *    un panel alto y estrecho, no la dirección física de desmontaje. La
 *    unidad es la dimensión MAYOR del conjunto ensamblado (alto o ancho).
 *  - `oculto`: la capa no se ve ensamblada (va dentro de otra pieza, o no
 *    es parte física del conjunto) y aparece al explotar.
 *  - `modelo` + `posicion` + `escala` (+ `rotacion`, en radianes): capa que
 *    viene de otro .glb, colocada en coordenadas del mundo (metros).
 */

/** Dirección de la cámara: isométrica, con el gripper hacia la derecha. */
export const VISTA = [-1, 0.8, 1];

/** Lienzo de salida en px. ~2× el área de dibujo del panel (4:5). */
export const LIENZO = { w: 640, h: 800 };

/** Supermuestreo: se renderiza a este múltiplo y se reduce con sharp. */
export const SUPERMUESTREO = 2;

/**
 * Materiales del render.
 *
 *  - `original`: los colores y texturas que traen los modelos —el naranja
 *    de las piezas impresas del gripper, el verde del PCB, el acero—, con
 *    un entorno de estudio para que los metales reflejen algo en vez de
 *    salir negros.
 *  - `arcilla`: gris monocromo derivado de la luminancia de cada material.
 *    Deja el rojo de señal como único color del panel.
 *
 * Se usa `original`: se probaron las dos, y con color se identifica cada
 * pieza de un vistazo —el gripper es «lo naranja»— antes de leer el globo.
 */
export const MATERIAL = 'original';

/**
 * Acabados por modelo, para los que no traen color. `quest3.glb` llega con
 * los cinco materiales en blanco y nombres de color de alambre de 3ds Max
 * (`wire056035148`), que no describen nada: se identificaron pintando cada
 * uno de un color en un render de diagnóstico.
 */
export const ACABADOS = {
  'meta-quest-3': {
    wire126042025: { color: '#ECECEA', roughness: 0.45 }, // carcasa del visor
    wire056035148: { color: '#E4E4E2', roughness: 0.5 }, // controles Touch Plus
    wire160123147: { color: '#17181A', roughness: 0.2 }, // sensores frontales y lentes
    wire177161249: { color: '#5A5D62', roughness: 0.85 }, // correa y brazos
    wire194045245: { color: '#2B2D30', roughness: 0.9 }, // almohadilla facial
  },
};

const TORRE = [/^AA_Torre:/, /^AA_Petaña_L_union_torre/];
const BASE_MOVIL = [/^APOLO/];
const LIDAR = [/^AA_RPLIDAR/];

const TORRETA = [
  /^AA_sandwich_/,
  /^rodamiento_150mm:/,
  /^base_giratoria:/,
  /^base_nema:/,
  /^htd3m_50T_Base:/,
  /^nema17:3$/,
  /^reductor_nema17:3$/,
  /^htd3m_20T_offset_28_9mm:/,
  /^Cinta_base:/,
  /^AA_RealSense_D435:/,
  /^Soporte_R435I:/,
];
const DRIVERS = [/^driver_CL57T:/];
const HOMBRO = [
  /^Nueva L_nema17/,
  /^nema17:[12]$/,
  /^reductor_nema17:[12]$/,
  /^eje_primer_eslabon:/,
  /^KFL08_chmacera:[123]$/,
  /^AA_20T_Eslabon1:/,
  /^AA_20T_Eslabon1_2:/,
  /^AA_20T_Eslabon2_2:/,
  /^htd3m_20T_offset_16_5mm:/,
  /^Cinta_pequeña:/,
  /^7mm_145mm/,
];
const ESLABON1 = [/^eslabon_300mm:/, /^Cinta_larga:/];
const ESLABON2 = [/^eslabon_200mm:/, /^KFL08_chmacera:[4567]$/, /^AA_20T_Eslabon2_3:/, /^8mm_130mm/];
const DEDOS = [/^AA_gripper:/, /^AA_cremallera_gripper:/];
const PINON = [/^AA_piñon_gripper:/];
const BASE_GRIPPER = [/^AA_base_gripper_bueno:/, /^Soporte_Gripper:/];
const MOTOR_GRIPPER = [/^JGA25-370/];

const GRIPPER = [...DEDOS, ...PINON, ...BASE_GRIPPER, ...MOTOR_GRIPPER];
const PLATAFORMA = [...BASE_MOVIL, ...TORRE, ...LIDAR];
const MANIPULADOR = [...TORRETA, ...DRIVERS, ...HOMBRO, ...ESLABON1, ...ESLABON2, ...GRIPPER];

/** Piezas que se reparten por cercanía y no por nombre. */
export const TORNILLERIA = [/Screw head/, /BALL BEARING/, /^KFL08_chmacera/];

export const ESCENAS = {
  /* Nivel 1 — el sistema. Explosión FUNCIONAL, no física: la NUC y el visor
     no se desmontan del robot, se separan por su papel. Por eso aparecen
     al explotar en vez de estar ensamblados, y van a una escala mayor que
     la real: a escala, una NUC de 12 cm junto a un robot de 90 cm sería
     un punto. */
  sistema: {
    base: 'robot-completo',
    capas: [
      { id: 'robot', piezas: [/./], explota: [0.1, -0.04] },
      {
        id: 'nuc',
        modelo: 'nuc',
        escala: 1.9,
        posicion: [0.2, 0.45, -0.15],
        oculto: true,
        explota: [-0.36, 0.27],
      },
      {
        id: 'quest',
        modelo: 'meta-quest-3',
        escala: 1.15,
        rotacion: [0, -0.3, 0],
        posicion: [0.2, 0.55, -0.15],
        oculto: true,
        explota: [-0.36, -0.14],
      },
    ],
  },

  /* Nivel 2 — el robot se parte en lo que se mueve y lo que manipula. */
  robot: {
    base: 'robot-completo',
    capas: [
      { id: 'plataforma', piezas: PLATAFORMA, explota: [0, -0.13] },
      { id: 'manipulador', piezas: MANIPULADOR, explota: [0, 0.1] },
    ],
  },

  /* Nivel 3 — plataforma. Los Puente H van DENTRO de la caja de elevación
     (así los muestra la foto del interior), por eso salen de ella al
     explotar. Son dos: maestro y esclavo. */
  plataforma: {
    base: 'robot-completo',
    soloPiezas: PLATAFORMA,
    capas: [
      { id: 'base', piezas: BASE_MOVIL, explota: [0, -0.14] },
      { id: 'caja', piezas: TORRE, explota: [0, 0.18] },
      { id: 'lidar', piezas: LIDAR, explota: [0.28, -0.04] },
      {
        id: 'puenteh',
        modelo: 'puente-h',
        instancias: [
          [0.15, 0.1, -0.13],
          [0.24, 0.17, -0.08],
        ],
        oculto: true,
        explota: [-0.32, 0.22],
      },
    ],
  },

  /* Nivel 3 — manipulador. Apilado en vertical, en el orden de la cadena
     cinemática: torreta, hombro, eslabón 1, eslabón 2, gripper. Los
     drivers CL57T viajan en la torreta, y se apartan a un lado. */
  manipulador: {
    base: 'robot-completo',
    soloPiezas: MANIPULADOR,
    capas: [
      { id: 'torreta', piezas: TORRETA, explota: [0, -0.2] },
      { id: 'drivers', piezas: DRIVERS, explota: [-0.34, -0.12] },
      { id: 'hombro', piezas: HOMBRO, explota: [0, -0.03] },
      { id: 'eslabon1', piezas: ESLABON1, explota: [0, 0.12] },
      { id: 'eslabon2', piezas: ESLABON2, explota: [0.04, 0.27] },
      { id: 'gripper', piezas: GRIPPER, explota: [0.24, 0.36] },
    ],
  },

  /* Nivel 4 — gripper. */
  gripper: {
    base: 'robot-completo',
    soloPiezas: GRIPPER,
    capas: [
      { id: 'base', piezas: BASE_GRIPPER, explota: [0, 0] },
      { id: 'dedos', piezas: DEDOS, explota: [0.2, -0.2] },
      { id: 'pinon', piezas: PINON, explota: [0.04, 0.24] },
      { id: 'motor', piezas: MOTOR_GRIPPER, explota: [-0.26, 0.12] },
    ],
  },

  /* Nivel 2 — servidor. Tampoco es un ensamble físico: la NUC al centro y
     los dos sensores que alimentan la percepción. Escala real entre ellos. */
  servidor: {
    capas: [
      { id: 'nuc', modelo: 'nuc', posicion: [0, 0, 0], explota: [0, -0.1] },
      {
        id: 'realsense',
        modelo: 'realsense-d435',
        posicion: [0, 0.02, 0],
        oculto: true,
        explota: [-0.42, 0.5],
      },
      {
        id: 'lidar',
        modelo: 'rplidar-c1',
        posicion: [0, 0.02, 0],
        oculto: true,
        explota: [0.42, 0.5],
      },
    ],
  },
};
