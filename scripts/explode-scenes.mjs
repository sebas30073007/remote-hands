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

const BASE_MOVIL = [/^APOLO/];
const LIDAR = [/^AA_RPLIDAR/];
const REALSENSE = [/^AA_RealSense_D435:/];

/* El manipulador por función, no por articulación. */
/** Toda la lámina de acero: la caja de elevación, la base giratoria, los soportes y los eslabones. */
const ESTRUCTURA = [
  /^AA_Torre:/,
  /^AA_Petaña_L_union_torre/,
  /^AA_sandwich_/,
  /^base_giratoria:/,
  /^base_nema:/,
  /^Nueva L_nema17/,
  /^eslabon_300mm:/,
  /^eslabon_200mm:/,
  /^Soporte_R435I:/,
];
/** Lo que transmite el giro: poleas, bandas, ejes, chumaceras y rodamientos. */
const MECANISMO = [
  /^rodamiento_150mm:/,
  /^htd3m_/,
  /^AA_20T_/,
  /^Cinta_/,
  /^KFL08_chmacera:/,
  /^eje_primer_eslabon:/,
  /^7mm_145mm/,
  /^8mm_130mm/,
  /BALL BEARING/,
];
/** Los tres motores con su reductor y sus tres drivers. El controlador CL57T no está en el CAD: se añade como modelo. */
const ACTUADORES = [/^nema17:/, /^reductor_nema17:/, /^driver_CL57T:/];
const DEDOS = [/^AA_gripper:/, /^AA_cremallera_gripper:/];
const PINON = [/^AA_piñon_gripper:/];
const BASE_GRIPPER = [/^AA_base_gripper_bueno:/, /^Soporte_Gripper:/];
const MOTOR_GRIPPER = [/^JGA25-370/];

const GRIPPER = [...DEDOS, ...PINON, ...BASE_GRIPPER, ...MOTOR_GRIPPER];
// La caja de elevación viaja con el manipulador, no con la plataforma: es
// la columna sobre la que va montado el brazo.
const PLATAFORMA = [...BASE_MOVIL, ...LIDAR];
/** El manipulador sin su cámara: en la escena del robot, la RealSense se va con los sensores. */
const BRAZO = [...ESTRUCTURA, ...MECANISMO, ...ACTUADORES, ...GRIPPER];
const MANIPULADOR = [...BRAZO, ...REALSENSE];

/* --- Electrónica embebida -------------------------------------------
   Las placas se colocan en el mundo como un grupo, con un punto de
   referencia. Todas quedan de frente a la cámara.

   - Puente H ×2, encimados con desfase: el maestro al frente y el esclavo
     detrás, corrido hacia arriba y a la derecha para que se vean los dos.
   - Controlador CL57T al lado, con un final de carrera debajo. El brazo
     lleva tres —uno por eje—, pero en los diagramas se dibuja uno solo: los
     tres son iguales, y tres cuerpos negros juntos se leían como un bloque.
   - DRV8833: marcador temporal del controlador del gripper (la placa real
     es un DRV8833 y un ESP32-C3 cableados a mano). El modelo viene
     acostado y mide 1.8 cm: se pone de pie y se escala ×3, porque a escala
     real sería un punto junto a las otras placas.

   `k` escala el grupo entero —tamaño y separación— para las escenas donde
   las placas conviven con piezas de decenas de centímetros: a escala real,
   un Puente H de 8 cm junto a una base de 40 cm no se distingue. */
const RAD = Math.PI / 2;
const puenteH = ([x, y, z], k = 1) => [{ modelo: 'puente-h', escala: k, posicion: [x, y, z] }];
const puenteHEsclavo = ([x, y, z], k = 1) => [
  { modelo: 'puente-h', escala: k, posicion: [x + 0.014 * k, y + 0.016 * k, z - 0.034 * k] },
];
const puentesH = (p, k = 1) => [...puenteH(p, k), ...puenteHEsclavo(p, k)];
const controladorCL57T = ([x, y, z], k = 1) => [
  { modelo: 'controlador-steppers', escala: k, posicion: [x + 0.092 * k, y - 0.004 * k, z - 0.012 * k] },
];
/**
 * Giro del final de carrera: de tres cuartos, con la palanca hacia arriba.
 * De frente a la cámara se veía de canto —un rectángulo negro— y no se
 * reconocía como microswitch. Se eligió entre cinco orientaciones
 * renderizadas.
 */
const GIRO_FINAL = [0.3, -Math.PI / 4 - 0.45, 0.15];
/** El final de carrera mide 13 mm: ×1.6 basta para que la palanca se lea. */
const final = (posicion, k = 1) => ({ modelo: 'final-de-carrera', escala: 1.6 * k, rotacion: GIRO_FINAL, posicion });
/** Bajo el controlador CL57T, que es quien lee los finales de carrera. */
const finalDelCL57T = ([x, y, z], k = 1) => [final([x + 0.092 * k, y - 0.05 * k, z - 0.012 * k], k)];
const cl57tConFinales = (p, k = 1) => [...controladorCL57T(p, k), ...finalDelCL57T(p, k)];
const drv8833 = ([x, y, z], k = 1) => [
  { modelo: 'drv8833', escala: 3 * k, rotacion: [RAD, 0, 0], posicion: [x + 0.086 * k, y + 0.066 * k, z - 0.01 * k] },
];
/** Factor para las escenas en las que las placas acompañan al robot. */
const K_ROBOT = 1.8;
/** Dentro de la caja de elevación, donde van físicamente. */
const EN_CAJA = [0.16, 0.12, -0.1];
/** El final de carrera, bajo la RealSense al frente de la torreta: junto a
    la cámara y el LiDAR se lee como parte del grupo «sensores». */
const JUNTO_A_CAMARA = [0.2, 0.33, 0.07];

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

  /* Nivel 2 — el robot en cuatro: lo que se mueve, lo que manipula, la
     electrónica que manda sobre ambos y los sensores. Las placas van dentro
     de la caja de elevación y salen de ella al explotar; los sensores salen
     de donde están montados. */
  robot: {
    base: 'robot-completo',
    capas: [
      { id: 'plataforma', piezas: BASE_MOVIL, explota: [0, -0.16] },
      { id: 'manipulador', piezas: BRAZO, explota: [0.02, 0.08] },
      {
        id: 'embebidos',
        componentes: [...puentesH(EN_CAJA, K_ROBOT), ...controladorCL57T(EN_CAJA, K_ROBOT), ...drv8833(EN_CAJA, K_ROBOT)],
        oculto: true,
        explota: [-0.46, 0.02],
      },
      {
        id: 'sensores',
        piezas: [...LIDAR, ...REALSENSE],
        componentes: [final(JUNTO_A_CAMARA, 2)],
        explota: [0.4, 0.04],
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

  /* Nivel 3 — embebidos: las cuatro placas que mandan sobre los motores. El
     controlador CL57T trae su final de carrera: los lee él. */
  embebidos: {
    capas: [
      { id: 'puenteh', componentes: puentesH([0, 0, 0]), explota: [-0.2, -0.04] },
      { id: 'stepper', componentes: cl57tConFinales([0, 0, 0]), explota: [0.26, -0.2] },
      { id: 'drv8833', componentes: drv8833([0, 0, 0]), explota: [0.22, 0.3] },
    ],
  },

  /* Nivel 3 — sensores del robot: el LiDAR y la RealSense, que alimentan la
     percepción, y un final de carrera en representación de los tres del
     manipulador. */
  sensores: {
    capas: [
      { id: 'realsense', modelo: 'realsense-d435', posicion: [0, 0.07, 0], explota: [-0.24, 0.2] },
      { id: 'lidar', modelo: 'rplidar-c1', posicion: [0.1, 0.01, -0.02], explota: [0.26, 0.1] },
      {
        id: 'finales',
        componentes: [final([0, -0.05, 0.02], 1.3)],
        explota: [0, -0.3],
      },
    ],
  },

  /* Nivel 3 — manipulador, por función. La estructura se queda en su
     lugar; el mecanismo y los actuadores se apartan a los lados, el gripper
     sube y la cámara baja al frente. El controlador CL57T va con los
     actuadores, en la caja de elevación donde está montado. */
  manipulador: {
    base: 'robot-completo',
    soloPiezas: MANIPULADOR,
    capas: [
      { id: 'estructura', piezas: ESTRUCTURA, explota: [0, 0] },
      { id: 'mecanismo', piezas: MECANISMO, explota: [-0.34, 0.06] },
      {
        id: 'actuadores',
        piezas: ACTUADORES,
        componentes: controladorCL57T(EN_CAJA, K_ROBOT),
        explota: [0.36, -0.08],
      },
      { id: 'gripper', piezas: GRIPPER, explota: [0.2, 0.3] },
      { id: 'camara', piezas: REALSENSE, explota: [-0.3, -0.26] },
    ],
  },

  /* Nivel 2 — servidor. Tampoco es un ensamble físico: la NUC al centro y
     todo lo que se conecta a ella. Arriba, los dos sensores de la
     percepción. Abajo, la electrónica: el conjunto I²C —solo el Puente H
     maestro va a la NUC por USB; el esclavo y el controlador CL57T cuelgan
     de él en serie, así que se dibujan como un solo conjunto— y el
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
        componentes: [...puentesH([-0.03, 0, 0]), ...controladorCL57T([-0.03, 0, 0])],
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

  /* Nivel 3 — conjunto I²C, visto desde la NUC: el Puente H maestro, que es
     el único con USB a la NUC; el esclavo, en 0x08; y el controlador CL57T,
     en 0x0B, con su final de carrera. */
  'conjunto-i2c': {
    capas: [
      { id: 'maestro', componentes: puenteH([0, 0, 0]), explota: [-0.28, -0.12] },
      { id: 'esclavo', componentes: puenteHEsclavo([0, 0, 0]), explota: [-0.06, 0.26] },
      { id: 'cl57t', componentes: cl57tConFinales([0, 0, 0]), explota: [0.3, -0.06] },
    ],
  },
};

/**
 * Miniaturas e imágenes de página: renders sueltos con los mismos
 * materiales que la vista explosionada. No entran en el manifiesto.
 *
 *  - `lienzo` en px. Grandes a propósito: una imagen recortada del lienzo de
 *    la explosión (640 px para toda la escena) se veía borrosa al
 *    ampliarla en una página. Estas se renderizan para el tamaño al que se
 *    muestran, a 2× para pantallas de alta densidad.
 *  - `vista`: dirección de cámara propia. Las piezas sueltas —placas,
 *    sensores— van casi de frente, que es donde está el detalle; la
 *    isométrica de la explosión es para ver cómo encajan, no para ver una
 *    pieza.
 *  - `sinTornilleria`: sin reparto de tornillos por cercanía; en una pieza
 *    aislada solo mete tornillos y rodamientos flotando.
 *
 * Uso: node scripts/render-explode.mjs --miniaturas [id …]
 */
/** Casi de frente, con un poco de profundidad para que se lean los volúmenes. */
const FRENTE = [-0.3, 0.3, 1];
const MINI = { w: 960, h: 720 };

/* El DRV8833 de frente, con la serigrafía al derecho. */
const GIRO_DRV = [Math.PI / 2, Math.PI, 0];

export const MINIATURAS = {
  // Eslabones de los diagramas de conexiones.
  'meta-quest-3': { lienzo: MINI, vista: [-0.45, 0.22, 1], capas: [{ id: 'm', modelo: 'meta-quest-3' }] },
  nuc: { lienzo: MINI, vista: [-0.7, 0.5, 1], capas: [{ id: 'm', modelo: 'nuc' }] },
  'puente-h': { lienzo: MINI, vista: FRENTE, capas: [{ id: 'm', modelo: 'puente-h' }] },
  'controlador-cl57t': { lienzo: MINI, vista: FRENTE, capas: [{ id: 'm', modelo: 'controlador-steppers' }] },
  'driver-cl57t': {
    lienzo: MINI,
    base: 'robot-completo',
    soloPiezas: [/^driver_CL57T:1$/],
    sinTornilleria: true,
    capas: [{ id: 'm', piezas: [/^driver_CL57T:1$/] }],
  },
  'nema17-reductor': {
    lienzo: MINI,
    base: 'robot-completo',
    soloPiezas: [/^nema17:1$/, /^reductor_nema17:1$/],
    sinTornilleria: true,
    capas: [{ id: 'm', piezas: [/^nema17:1$/, /^reductor_nema17:1$/] }],
  },
  'final-de-carrera': { lienzo: MINI, capas: [{ id: 'm', modelo: 'final-de-carrera', rotacion: GIRO_FINAL }] },
  robot: { lienzo: { w: 900, h: 1100 }, base: 'robot-completo', capas: [{ id: 'm', piezas: [/./] }] },
  /* La base diferencial, donde van los dos motores DC de tracción. */
  'base-diferencial': {
    lienzo: MINI,
    base: 'robot-completo',
    soloPiezas: BASE_MOVIL,
    sinTornilleria: true,
    capas: [{ id: 'm', piezas: BASE_MOVIL }],
  },
  manipulador: {
    lienzo: { w: 900, h: 1100 },
    base: 'robot-completo',
    soloPiezas: BRAZO,
    capas: [{ id: 'm', piezas: BRAZO }],
  },
  gripper: { lienzo: MINI, vista: FRENTE, base: 'robot-completo', soloPiezas: GRIPPER, capas: [{ id: 'm', piezas: GRIPPER }] },
  // La cara frontal del modelo de la RealSense es lisa, sin lentes: se ve
  // mejor por detrás, con el logotipo.
  'realsense-d435': { lienzo: MINI, vista: [0.45, 0.35, -1], capas: [{ id: 'm', modelo: 'realsense-d435' }] },
  'rplidar-c1': { lienzo: MINI, vista: [-0.45, 0.35, 1], capas: [{ id: 'm', modelo: 'rplidar-c1' }] },
  'controlador-gripper': { lienzo: MINI, vista: FRENTE, capas: [{ id: 'm', modelo: 'drv8833', escala: 3, rotacion: GIRO_DRV }] },

  // Piezas de la estructura y del mecanismo del manipulador.
  'polea-motriz': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^AA_20T_Eslabon1:1$/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^AA_20T_Eslabon1:1$/] }] },
  'polea-conducida': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^AA_20T_Eslabon1_2:1$/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^AA_20T_Eslabon1_2:1$/] }] },
  'banda-corta': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^Cinta_pequeña:1$/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^Cinta_pequeña:1$/] }] },
  'banda-larga': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^Cinta_larga:1$/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^Cinta_larga:1$/] }] },
  'chumacera': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^KFL08_chmacera:1$/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^KFL08_chmacera:1$/] }] },
  'eje': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^eje_primer_eslabon:1$/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^eje_primer_eslabon:1$/] }] },
  'rodamiento-base': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^rodamiento_150mm:1$/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^rodamiento_150mm:1$/] }] },
  'caja-elevacion': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^AA_Torre:/, /^AA_Petaña_L_union_torre/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^AA_Torre:/, /^AA_Petaña_L_union_torre/] }] },
  'base-giratoria': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^base_giratoria:/, /^AA_sandwich_/, /^base_nema:/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^base_giratoria:/, /^AA_sandwich_/, /^base_nema:/] }] },
  'soportes-nema17': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^Nueva L_nema17/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^Nueva L_nema17/] }] },
  'eslabon-1': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^eslabon_300mm:/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^eslabon_300mm:/] }] },
  'eslabon-2': { lienzo: MINI, base: 'robot-completo', soloPiezas: [/^eslabon_200mm:/], sinTornilleria: true, capas: [{ id: 'm', piezas: [/^eslabon_200mm:/] }] },
  // Cabeceras de las páginas de Estructura y Mecanismo (con tornillería).
  estructura: { lienzo: { w: 900, h: 1100 }, base: 'robot-completo', soloPiezas: ESTRUCTURA, capas: [{ id: 'm', piezas: ESTRUCTURA }] },
  mecanismo: { lienzo: { w: 900, h: 1100 }, base: 'robot-completo', soloPiezas: MECANISMO, sinTornilleria: true, capas: [{ id: 'm', piezas: MECANISMO }] },

  // Imágenes de cabecera de página: grandes y de frente.
  'portada-puente-h': { lienzo: { w: 1400, h: 1000 }, vista: FRENTE, capas: [{ id: 'm', modelo: 'puente-h' }] },
  'portada-sensores': {
    lienzo: { w: 1400, h: 820 },
    vista: [-0.45, 0.35, 1],
    capas: [
      { id: 'realsense', modelo: 'realsense-d435', rotacion: [0, Math.PI, 0], posicion: [-0.07, 0.03, 0] },
      { id: 'lidar', modelo: 'rplidar-c1', posicion: [0.075, 0.01, 0] },
      { id: 'final', componentes: [final([0.005, -0.04, 0.02], 1.2)] },
    ],
  },
  'portada-embebidos': {
    lienzo: { w: 1400, h: 1000 },
    vista: FRENTE,
    capas: [
      {
        id: 'm',
        componentes: [...puentesH([0, 0, 0]), ...controladorCL57T([0, 0, 0]), { modelo: 'drv8833', escala: 3, rotacion: GIRO_DRV, posicion: [0.155, -0.01, 0] }],
      },
    ],
  },
  'portada-percepcion': {
    lienzo: { w: 1400, h: 820 },
    vista: [-0.45, 0.35, 1],
    capas: [
      { id: 'realsense', modelo: 'realsense-d435', rotacion: [0, Math.PI, 0], posicion: [-0.045, 0.02, 0] },
      { id: 'lidar', modelo: 'rplidar-c1', posicion: [0.05, 0.0, 0] },
    ],
  },
  'portada-conjunto-i2c': {
    lienzo: { w: 1400, h: 1000 },
    vista: FRENTE,
    capas: [{ id: 'm', componentes: [...puentesH([0, 0, 0]), ...cl57tConFinales([0, 0, 0])] }],
  },
};
