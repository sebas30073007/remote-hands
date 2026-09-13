/**
 * Navegación por vista explosionada — el árbol de NODOS.
 *
 * La geometría (qué piezas forman cada capa y hacia dónde se separan) vive
 * en `scripts/explode-scenes.mjs`. Este archivo decide qué significa cada
 * capa: a qué página lleva, cómo se llama y qué documentos tiene cada parte
 * del sistema. Los dos se hablan por el `id` de escena y de capa.
 *
 * Un nodo es una parte del sistema con página propia:
 *
 *  - `nombre` y `descripcion` son los que se ven al señalar la pieza
 *    («NUC (cómputo al borde)»), los de las migas y el título de la página.
 *    Una sola fuente para los tres, para que no puedan contradecirse.
 *  - Si tiene `escena`, al visitarlo esa escena se dibuja explosionada y sus
 *    `piezas` son los hijos navegables.
 *  - Si no la tiene (una hoja: el Puente H, el controlador CL57T…), se
 *    dibuja la escena desde la que se llegó, con su pieza resaltada.
 *  - `facetas`: documentos del nodo que no son piezas. Se listan como
 *    etiquetas bajo la escena.
 *
 * El árbol NO es un árbol: es un grafo. Un mismo nodo se alcanza por varias
 * rutas —el controlador CL57T por Sistema / Robot / Embebidos y por Sistema
 * / NUC / Conjunto I²C— y la página es la misma, pero el panel conserva la
 * ruta por la que se llegó: sus migas, y la escena en la que se resalta.
 * `padre` solo decide la ruta canónica, la que se usa al entrar directo a
 * la página sin venir de ningún lado.
 */

export interface DestinoPieza {
  /** Nodo al que lleva la pieza. */
  nodo?: string;
  /** O bien una página que no es nodo (slug); por defecto, la del nodo actual. */
  pagina?: string;
  /** Sección de esa página (id del encabezado). */
  ancla?: string;
  /** Nombre y descripción de la pieza. Por defecto, los del nodo destino. */
  nombre?: string;
  descripcion?: string;
}

export interface NodoExplode {
  id: string;
  nombre: string;
  /** Qué es o qué hace, en dos o tres palabras. */
  descripcion: string;
  /** Slug de la página del nodo, sin base ni barras. */
  pagina: string;
  /** Padre de la ruta canónica. */
  padre?: string;
  /** Escena propia (se explota al visitar el nodo). */
  escena?: string;
  /** Solo nodos con escena: a dónde lleva cada capa. */
  piezas?: Record<string, DestinoPieza>;
  /** Documentos del nodo que no son piezas. Slugs. */
  facetas?: string[];
}

const SUB = 'sistema/subsistemas';
const ROBOT = `${SUB}/robot-movil`;
const GRIPPER_CONEXIONES = { pagina: `${ROBOT}/controladores/gripper`, ancla: 'conexiones' };

export const NODOS: NodoExplode[] = [
  {
    id: 'sistema',
    nombre: 'Sistema',
    descripcion: 'teleoperación móvil',
    pagina: 'sistema/arquitectura/resumen',
    escena: 'sistema',
    piezas: {
      robot: { nodo: 'robot' },
      nuc: { nodo: 'servidor' },
      quest: { nodo: 'quest' },
    },
    facetas: ['sistema/arquitectura/comunicaciones', 'sistema/arquitectura/diagrama-de-bloques'],
  },
  {
    id: 'robot',
    nombre: 'Robot',
    descripcion: 'manipulación móvil',
    pagina: ROBOT,
    padre: 'sistema',
    escena: 'robot',
    piezas: {
      plataforma: { nodo: 'plataforma' },
      manipulador: { nodo: 'manipulador' },
      embebidos: { nodo: 'embebidos' },
      sensores: { nodo: 'sensores' },
    },
    facetas: ['sistema/interfaces/electronica', `${ROBOT}/verificacion`],
  },
  {
    id: 'plataforma',
    nombre: 'Plataforma móvil',
    descripcion: 'tracción diferencial',
    pagina: `${ROBOT}/plataforma-movil`,
    padre: 'robot',
    escena: 'plataforma',
    piezas: {
      base: { nombre: 'Base diferencial', descripcion: 'chasis rehabilitado', ancla: 'rehabilitación' },
      puenteh: { nodo: 'puenteh', nombre: 'Puente H ×2' },
      lidar: { nodo: 'rplidar' },
    },
  },
  {
    // Las placas que mandan sobre los motores. Su página es la de software
    // embebido, que las documenta como conjunto.
    id: 'embebidos',
    nombre: 'Embebidos',
    descripcion: 'control de motores',
    pagina: `${ROBOT}/firmware`,
    padre: 'robot',
    escena: 'embebidos',
    piezas: {
      puenteh: { nodo: 'puenteh', nombre: 'Puente H ×2' },
      stepper: { nodo: 'cl57t' },
      drv8833: { nombre: 'Controlador del gripper', descripcion: 'DRV8833 + ESP32-C3', ...GRIPPER_CONEXIONES },
    },
  },
  {
    id: 'sensores',
    nombre: 'Sensores',
    descripcion: 'percepción y límites',
    pagina: `${ROBOT}/sensores`,
    padre: 'robot',
    escena: 'sensores',
    piezas: {
      realsense: { nodo: 'realsense' },
      lidar: { nodo: 'rplidar' },
      finales: {
        nombre: 'Finales de carrera ×3',
        descripcion: 'referencia de homing',
        pagina: `${ROBOT}/controladores/cl57t`,
        ancla: 'rutina-de-homing',
      },
    },
  },
  {
    id: 'puenteh',
    nombre: 'Puente H',
    descripcion: 'tracción DC',
    pagina: `${ROBOT}/electronica`,
    padre: 'embebidos',
  },
  {
    id: 'cl57t',
    nombre: 'Controlador CL57T',
    descripcion: 'tres ejes paso a paso',
    pagina: `${ROBOT}/controladores/cl57t`,
    padre: 'embebidos',
  },
  {
    id: 'rplidar',
    nombre: 'RPLiDAR C1',
    descripcion: 'LiDAR 2D',
    pagina: `${ROBOT}/sensores/rplidar-c1`,
    padre: 'sensores',
  },
  {
    // También es la cámara del manipulador: se llega por Sensores y por
    // Robot / Manipulador / Cámara, a la misma página.
    id: 'realsense',
    nombre: 'RealSense D435i',
    descripcion: 'cámara RGB-D',
    pagina: `${ROBOT}/sensores/realsense-d435i`,
    padre: 'sensores',
  },
  {
    id: 'manipulador',
    nombre: 'Manipulador',
    descripcion: 'brazo de 3 GDL',
    pagina: `${ROBOT}/manipulador`,
    padre: 'robot',
    escena: 'manipulador',
    piezas: {
      estructura: { nombre: 'Estructura', descripcion: 'lámina de acero', ancla: 'estructura' },
      mecanismo: { nombre: 'Mecanismo', descripcion: 'poleas y bandas', ancla: 'mecanismo' },
      actuadores: { nodo: 'cl57t', nombre: 'Actuadores', descripcion: 'motores, drivers y controlador' },
      gripper: { nodo: 'gripper' },
      camara: { nodo: 'realsense', nombre: 'Cámara', descripcion: 'RealSense D435i' },
    },
  },
  {
    id: 'gripper',
    nombre: 'Gripper',
    descripcion: 'pinza lineal',
    pagina: `${ROBOT}/controladores/gripper`,
    padre: 'manipulador',
    escena: 'gripper',
    piezas: {
      dedos: { nombre: 'Dedos y cremalleras', descripcion: 'apertura lineal', ancla: 'mecanismo' },
      pinon: { nombre: 'Piñón', descripcion: 'transmisión', ancla: 'mecanismo' },
      base: { nombre: 'Base y soporte', descripcion: 'montaje', ancla: 'mecanismo' },
      motor: { nombre: 'Motor con encoder', descripcion: 'accionamiento', ancla: 'encoder-de-cuadratura' },
    },
  },
  {
    id: 'servidor',
    nombre: 'NUC',
    descripcion: 'cómputo al borde',
    pagina: `${SUB}/servidor-percepcion`,
    padre: 'sistema',
    escena: 'servidor',
    piezas: {
      nuc: { nodo: 'middleware' },
      realsense: { nodo: 'realsense' },
      lidar: { nodo: 'rplidar' },
      conjunto: { nodo: 'conjunto-i2c' },
      drv8833: { nombre: 'Controlador del gripper', descripcion: 'USB directo', ...GRIPPER_CONEXIONES },
    },
    facetas: [`${SUB}/servidor-percepcion/percepcion`, `${SUB}/servidor-percepcion/verificacion`],
  },
  {
    id: 'conjunto-i2c',
    nombre: 'Conjunto I²C',
    descripcion: 'bus de los motores',
    pagina: `${ROBOT}/conjunto-i2c`,
    padre: 'servidor',
    escena: 'conjunto-i2c',
    piezas: {
      maestro: { nodo: 'puenteh', nombre: 'Puente H maestro', descripcion: 'USB a la NUC' },
      esclavo: { nodo: 'puenteh', nombre: 'Puente H esclavo', descripcion: 'I²C 0x08' },
      cl57t: { nodo: 'cl57t', descripcion: 'I²C 0x0B' },
    },
  },
  {
    id: 'middleware',
    nombre: 'Middleware ZMQ',
    descripcion: 'mensajería con el visor',
    pagina: `${SUB}/servidor-percepcion/middleware`,
    padre: 'servidor',
  },
  {
    id: 'percepcion',
    nombre: 'Percepción',
    descripcion: 'LiDAR y RGB-D',
    pagina: `${SUB}/servidor-percepcion/percepcion`,
    padre: 'servidor',
  },
  {
    id: 'quest',
    nombre: 'Meta Quest 3',
    descripcion: 'interfaz de usuario',
    pagina: `${SUB}/interfaz-xr`,
    padre: 'sistema',
    facetas: [`${SUB}/interfaz-xr/interfaz`, `${SUB}/interfaz-xr/unity`, `${SUB}/interfaz-xr/verificacion`],
  },
];

/**
 * Pestañas que no son el sistema. Cada una es un grupo de primer nivel del
 * sidebar de `astro.config.mjs`, identificado por su etiqueta: el listado se
 * toma de ahí, así que el temario clásico y el nuevo no pueden
 * desincronizarse.
 */
export const PESTANAS = [
  { id: 'reporte', etiqueta: 'Reporte', grupo: 'Reporte' },
  { id: 'operar', etiqueta: 'Operar', grupo: 'Operar' },
  { id: 'construir', etiqueta: 'Construir', grupo: 'Construir' },
  { id: 'evidencia', etiqueta: 'Evidencia', grupo: 'Evidencia' },
  { id: 'referencia', etiqueta: 'Referencia', grupo: 'Referencia' },
] as const;

export const nodoPorId = new Map(NODOS.map((n) => [n.id, n]));

/** Ruta canónica: de la raíz al nodo, siguiendo `padre`. */
export function rutaCanonica(id: string): string[] {
  const out: string[] = [];
  let n = nodoPorId.get(id);
  while (n) {
    out.unshift(n.id);
    n = n.padre ? nodoPorId.get(n.padre) : undefined;
  }
  return out;
}

/** Nodo dueño de una escena. */
export function duenoDeEscena(escena: string): NodoExplode {
  return NODOS.find((n) => n.escena === escena) ?? NODOS[0];
}

/** Capas de una escena que llevan a un nodo. */
export function capasHacia(escena: string, nodo: string): string[] {
  const piezas = duenoDeEscena(escena).piezas ?? {};
  return Object.keys(piezas).filter((capa) => piezas[capa].nodo === nodo);
}

/**
 * Escena que se dibuja para una ruta y capas resaltadas en ella. Un nodo con
 * escena la explota; una hoja se resalta en la escena del nodo anterior de
 * la ruta, que es por donde se llegó.
 */
export function escenaDeRuta(ruta: string[]): { escena: string; resaltadas: string[] } {
  const ultimo = nodoPorId.get(ruta[ruta.length - 1]);
  if (!ultimo) return { escena: 'sistema', resaltadas: [] };
  if (ultimo.escena) return { escena: ultimo.escena, resaltadas: [] };
  const previo = nodoPorId.get(ruta[ruta.length - 2] ?? ultimo.padre ?? 'sistema');
  const escena = previo?.escena ?? 'sistema';
  return { escena, resaltadas: capasHacia(escena, ultimo.id) };
}
