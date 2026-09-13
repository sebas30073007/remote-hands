/**
 * Navegación por vista explosionada — el árbol de NODOS.
 *
 * La geometría (qué piezas forman cada capa y hacia dónde se separan) vive
 * en `scripts/explode-scenes.mjs`. Este archivo decide qué significa cada
 * capa: a qué página lleva y qué documentos tiene cada parte del sistema.
 * Los dos se hablan por el `id` de escena y de capa.
 *
 * Un nodo es una parte física (o funcional) del sistema con página propia:
 *
 *  - Si tiene `escena`, al visitarlo esa escena se dibuja explosionada y
 *    sus capas son los hijos navegables.
 *  - Si no la tiene (una hoja: el Puente H, los drivers CL57T…), se dibuja
 *    la escena de su padre con su `capa` resaltada. Una placa suelta no
 *    tiene nada que explotar, y verla en su sitio dice más que verla sola.
 *  - `facetas`: los documentos del nodo que no son piezas —software,
 *    verificación, contratos—. No se dibujan: se listan bajo la escena.
 *
 * Este árbol es FÍSICO, no el del temario clásico. El robot se abre en
 * tres: plataforma móvil, manipulador (con su caja de elevación) y
 * embebidos. Las placas cuelgan de «Embebidos», su hogar lógico, aunque
 * también se dibujen donde actúan: los Puente H aparecen en la plataforma,
 * y el conjunto I²C y el controlador del gripper junto a la NUC a la que se
 * conectan. Una pieza puede dibujarse en varias escenas, pero su nodo tiene
 * un solo padre.
 */

export interface DestinoPieza {
  /** Nodo al que lleva la pieza. */
  nodo?: string;
  /** O bien una página que no es nodo (slug); por defecto, la del nodo actual. */
  pagina?: string;
  /** Sección de esa página (id del encabezado). */
  ancla?: string;
  /** Obligatoria si no hay `nodo`; si lo hay, se usa la etiqueta del nodo. */
  etiqueta?: string;
}

export interface NodoExplode {
  id: string;
  etiqueta: string;
  /** Slug de la página del nodo, sin base ni barras. */
  pagina: string;
  padre?: string;
  /** Escena propia (se explota al visitar el nodo). */
  escena?: string;
  /** Capa (o capas) que representan al nodo en la escena de su padre. */
  capa?: string | string[];
  /** Solo nodos con escena: qué hace cada capa, en el orden del listado. */
  piezas?: Record<string, DestinoPieza>;
  /** Documentos del nodo que no son piezas. Slugs. */
  facetas?: string[];
}

const SUB = 'sistema/subsistemas';
const ROBOT = `${SUB}/robot-movil`;

export const NODOS: NodoExplode[] = [
  {
    id: 'sistema',
    etiqueta: 'Sistema',
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
    etiqueta: 'Robot',
    pagina: ROBOT,
    padre: 'sistema',
    capa: 'robot',
    escena: 'robot',
    piezas: {
      plataforma: { nodo: 'plataforma' },
      manipulador: { nodo: 'manipulador' },
      embebidos: { nodo: 'embebidos' },
    },
    facetas: ['sistema/interfaces/electronica', `${ROBOT}/verificacion`],
  },
  {
    id: 'plataforma',
    etiqueta: 'Plataforma móvil',
    pagina: `${ROBOT}/plataforma-movil`,
    padre: 'robot',
    capa: 'plataforma',
    escena: 'plataforma',
    piezas: {
      base: { etiqueta: 'Base diferencial', ancla: 'rehabilitación' },
      puenteh: { nodo: 'puenteh' },
      lidar: { nodo: 'percepcion', etiqueta: 'RPLiDAR C1' },
    },
  },
  {
    // Las cuatro placas que mandan sobre los motores. Su página es la de
    // software embebido, que las documenta como conjunto.
    id: 'embebidos',
    etiqueta: 'Embebidos',
    pagina: `${ROBOT}/firmware`,
    padre: 'robot',
    capa: 'embebidos',
    escena: 'embebidos',
    piezas: {
      puenteh: { nodo: 'puenteh', etiqueta: 'Puente H ×2' },
      stepper: { nodo: 'cl57t', etiqueta: 'Controlador de steppers' },
      drv8833: { etiqueta: 'Controlador del gripper', pagina: `${ROBOT}/controladores/gripper`, ancla: 'conexionado' },
    },
  },
  {
    id: 'puenteh',
    etiqueta: 'Puente H',
    pagina: `${ROBOT}/electronica`,
    padre: 'embebidos',
    capa: 'puenteh',
  },
  {
    id: 'manipulador',
    etiqueta: 'Manipulador 3 GDL',
    pagina: `${ROBOT}/manipulador`,
    padre: 'robot',
    capa: 'manipulador',
    escena: 'manipulador',
    piezas: {
      caja: { etiqueta: 'Caja de elevación', ancla: 'integración-con-la-plataforma' },
      torreta: { etiqueta: 'Base rotatoria', ancla: 'base-rotatoria' },
      hombro: { etiqueta: 'Hombro y transmisión', ancla: 'transmisión' },
      eslabon1: { etiqueta: 'Eslabón 1', ancla: 'arquitectura-mecánica' },
      eslabon2: { etiqueta: 'Eslabón 2', ancla: 'arquitectura-mecánica' },
      gripper: { nodo: 'gripper' },
      drivers: { nodo: 'cl57t' },
    },
  },
  {
    // Su placa es el controlador de steppers; los drivers CL57T del
    // manipulador también llevan aquí, porque son lo que controla.
    id: 'cl57t',
    etiqueta: 'Controlador CL57T',
    pagina: `${ROBOT}/controladores/cl57t`,
    padre: 'embebidos',
    capa: 'stepper',
  },
  {
    id: 'gripper',
    etiqueta: 'Gripper',
    pagina: `${ROBOT}/controladores/gripper`,
    padre: 'manipulador',
    capa: 'gripper',
    escena: 'gripper',
    piezas: {
      dedos: { etiqueta: 'Dedos y cremalleras', ancla: 'hardware' },
      pinon: { etiqueta: 'Piñón', ancla: 'hardware' },
      base: { etiqueta: 'Base y soporte', ancla: 'hardware' },
      motor: { etiqueta: 'Motor con encoder', ancla: 'encoder-de-cuadratura' },
    },
  },
  {
    id: 'servidor',
    etiqueta: 'Servidor / NUC',
    pagina: `${SUB}/servidor-percepcion`,
    padre: 'sistema',
    capa: 'nuc',
    escena: 'servidor',
    piezas: {
      nuc: { nodo: 'middleware', etiqueta: 'NUC · middleware' },
      realsense: { nodo: 'percepcion', etiqueta: 'RealSense D435i' },
      lidar: { nodo: 'percepcion', etiqueta: 'RPLiDAR C1' },
      conjunto: { nodo: 'embebidos', etiqueta: 'Conjunto I²C · USB' },
      drv8833: { etiqueta: 'Controlador del gripper · USB', pagina: `${ROBOT}/controladores/gripper`, ancla: 'conexionado' },
    },
    facetas: [`${SUB}/servidor-percepcion/verificacion`],
  },
  {
    id: 'middleware',
    etiqueta: 'Middleware ZMQ',
    pagina: `${SUB}/servidor-percepcion/middleware`,
    padre: 'servidor',
    capa: 'nuc',
  },
  {
    id: 'percepcion',
    etiqueta: 'Percepción',
    pagina: `${SUB}/servidor-percepcion/percepcion`,
    padre: 'servidor',
    capa: ['realsense', 'lidar'],
  },
  {
    id: 'quest',
    etiqueta: 'Visor Meta Quest',
    pagina: `${SUB}/interfaz-xr`,
    padre: 'sistema',
    capa: 'quest',
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

/** Escena que se dibuja para un nodo y capas resaltadas en ella. */
export function escenaDeNodo(id: string): { escena: string; resaltadas: string[] } {
  const n = nodoPorId.get(id);
  if (!n) return { escena: 'sistema', resaltadas: [] };
  if (n.escena) return { escena: n.escena, resaltadas: [] };
  const padre = n.padre ? nodoPorId.get(n.padre) : undefined;
  const capas = Array.isArray(n.capa) ? n.capa : n.capa ? [n.capa] : [];
  return { escena: padre?.escena ?? 'sistema', resaltadas: capas };
}

/**
 * Nodo cuyo listado se muestra en una escena: el dueño de la escena. Una
 * hoja muestra el listado de su padre (sus hermanos), con ella marcada.
 */
export function duenoDeEscena(escena: string): NodoExplode {
  return NODOS.find((n) => n.escena === escena) ?? NODOS[0];
}

/** Cadena de ancestros, de la raíz al nodo. */
export function cadena(id: string): NodoExplode[] {
  const out: NodoExplode[] = [];
  let n = nodoPorId.get(id);
  while (n) {
    out.unshift(n);
    n = n.padre ? nodoPorId.get(n.padre) : undefined;
  }
  return out;
}
