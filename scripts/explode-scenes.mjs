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
 *    `instancias` repite el mismo modelo en varias posiciones.
 *  - `componentes`: capa armada con VARIOS modelos distintos, cada uno con
 *    su `modelo`, `posicion`, `escala` y `rotacion`. Es el caso del
 *    conjunto I²C: dos Puente H y el controlador de steppers.
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
// La caja de elevación viaja con el manipulador, no con la plataforma: es
// la columna sobre la que va montado el brazo.
const PLATAFORMA = [...BASE_MOVIL, ...LIDAR];
const MANIPULADOR = [...TORRE, ...TORRETA, ...DRIVERS, ...HOMBRO, ...ESLABON1, ...ESLABON2, ...GRIPPER];

/* --- Electrónica embebida -------------------------------------------
   Las placas se colocan en el mundo como un grupo, con un punto de
   referencia. Todas quedan de frente a la cámara.

   - Puente H ×2, encimados con desfase: el maestro al frente y el esclavo
     detrás, corrido hacia arriba y a la derecha para que se vean los dos.
   - Controlador de steppers al lado.
   - DRV8833: marcador temporal del controlador del gripper (la placa real
     es un DRV8833 y un ESP32-C3 cableados a mano). El modelo viene
     acostado y mide 1.8 cm: se pone de pie y se escala ×3, porque a escala
     real sería un punto junto a las otras placas.

   `k` escala el grupo entero —tamaño y separación— para las escenas donde
   las placas conviven con piezas de decenas de centímetros: a escala real,
   un Puente H de 8 cm junto a una base de 40 cm no se distingue. */
const RAD = Math.PI / 2;
const puentesH = ([x, y, z], k = 1) => [
  { modelo: 'puente-h', escala: k, posicion: [x, y, z] },
  { modelo: 'puente-h', escala: k, posicion: [x + 0.014 * k, y + 0.016 * k, z - 0.034 * k] },
];
const steppers = ([x, y, z], k = 1) => [
  { modelo: 'controlador-steppers', escala: k, posicion: [x + 0.092 * k, y - 0.004 * k, z - 0.012 * k] },
];
const drv8833 = ([x, y, z], k = 1) => [
  { modelo: 'drv8833', escala: 3 * k, rotacion: [RAD, 0, 0], posicion: [x + 0.086 * k, y + 0.066 * k, z - 0.01 * k] },
];
/** Factor para las escenas en las que las placas acompañan al robot. */
const K_ROBOT = 1.8;
/** Dentro de la caja de elevación, donde van físicamente. */
const EN_CAJA = [0.16, 0.12, -0.1];

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

  /* Nivel 2 — el robot se parte en lo que se mueve, lo que manipula y la
     electrónica que manda sobre ambos. Las placas van dentro de la caja de
     elevación, así que salen de ella al explotar. */
  robot: {
    base: 'robot-completo',
    capas: [
      { id: 'plataforma', piezas: PLATAFORMA, explota: [0, -0.16] },
      { id: 'manipulador', piezas: MANIPULADOR, explota: [0.04, 0.08] },
      {
        id: 'embebidos',
        componentes: [...puentesH(EN_CAJA, K_ROBOT), ...steppers(EN_CAJA, K_ROBOT), ...drv8833(EN_CAJA, K_ROBOT)],
        oculto: true,
        explota: [-0.46, 0.02],
      },
    ],
  },

  /* Nivel 3 — plataforma: la base diferencial, el LiDAR que va sobre ella y
     los dos Puente H que mueven sus motores. */
  plataforma: {
    base: 'robot-completo',
    soloPiezas: PLATAFORMA,
    capas: [
      { id: 'base', piezas: BASE_MOVIL, explota: [0, -0.12] },
      { id: 'lidar', piezas: LIDAR, explota: [0.3, 0.06] },
      {
        id: 'puenteh',
        componentes: puentesH([0.14, 0.08, -0.1], K_ROBOT),
        oculto: true,
        explota: [-0.22, 0.34],
      },
    ],
  },

  /* Nivel 3 — embebidos: las cuatro placas que mandan sobre los motores. */
  embebidos: {
    capas: [
      { id: 'puenteh', componentes: puentesH([0, 0, 0]), explota: [-0.2, -0.04] },
      { id: 'stepper', componentes: steppers([0, 0, 0]), explota: [0.26, -0.2] },
      { id: 'drv8833', componentes: drv8833([0, 0, 0]), explota: [0.22, 0.3] },
    ],
  },

  /* Nivel 3 — manipulador. Apilado en vertical, en el orden de la cadena
     cinemática: caja de elevación, torreta, hombro, eslabón 1, eslabón 2,
     gripper. Los drivers CL57T viajan en la torreta y se apartan a un lado. */
  manipulador: {
    base: 'robot-completo',
    soloPiezas: MANIPULADOR,
    capas: [
      { id: 'caja', piezas: TORRE, explota: [0, -0.34] },
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
     todo lo que se conecta a ella. Arriba, los dos sensores de la
     percepción. Abajo, la electrónica: el conjunto I²C —solo el Puente H
     maestro va a la NUC por USB; el esclavo y el controlador de steppers
     cuelgan de él en serie, así que se dibujan como un solo conjunto— y el
     controlador del gripper, que va a la NUC por su propio USB. Escala real
     entre todos. */
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
      {
        id: 'conjunto',
        componentes: [...puentesH([-0.03, 0, 0]), ...steppers([-0.03, 0, 0])],
        oculto: true,
        explota: [-0.4, -0.95],
      },
      {
        id: 'drv8833',
        componentes: drv8833([-0.08, -0.06, 0]),
        oculto: true,
        explota: [0.56, -0.8],
      },
    ],
  },
};
