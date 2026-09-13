/**
 * Traduce los valores de estado del frontmatter (inglés, para que el
 * esquema de contenido sea estable en cualquier idioma de autoría) a una
 * etiqueta legible en español y un tono para `StatusBadge`.
 *
 * Una sola fuente para esta traducción: si se añade un estado nuevo al
 * esquema (`content.config.ts`), se añade aquí también.
 */

type Tone = 'ok' | 'warn' | 'neutral' | 'error' | 'info';

const PROJECT_STATUS: Record<string, { label: string; tone: Tone }> = {
  concept: { label: 'Concepto', tone: 'neutral' },
  prototype: { label: 'Prototipo', tone: 'info' },
  validated: { label: 'Validado', tone: 'ok' },
  'in-review': { label: 'En revisión', tone: 'warn' },
  archived: { label: 'Archivado', tone: 'neutral' },
};

const DECISION_STATUS: Record<string, { label: string; tone: Tone }> = {
  proposed: { label: 'Propuesta', tone: 'warn' },
  accepted: { label: 'Aceptada', tone: 'ok' },
  superseded: { label: 'Reemplazada', tone: 'neutral' },
  rejected: { label: 'Rechazada', tone: 'error' },
};

const VERIFICATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  pass: { label: 'PASS', tone: 'ok' },
  fail: { label: 'FAIL', tone: 'error' },
  pending: { label: 'Pendiente', tone: 'warn' },
};

/**
 * Nivel de replicación — el eje que ordena toda la documentación de este
 * proyecto. No describe en qué estado está el trabajo (eso es `status`),
 * sino qué puede hacer alguien que llegue de fuera con lo publicado aquí.
 *
 * La escala es deliberadamente corta y su frontera es objetiva: no depende
 * de lo bien escrita que esté una página, sino de qué archivos existen.
 *
 *   reproducible — están los archivos de fabricación. Se puede producir una
 *                  copia idéntica sin rediseñar nada.
 *   buildable    — está la geometría acotada y el procedimiento, pero hay
 *                  que adaptarlos a las herramientas y materiales propios.
 *   described    — está el diseño explicado, con dimensiones críticas y las
 *                  razones de cada decisión. Permite rediseñar, no copiar.
 *   pending      — todavía no hay material suficiente para ninguna de las
 *                  tres cosas anteriores.
 */
const REPLICATION_LEVEL: Record<string, { label: string; tone: Tone }> = {
  reproducible: { label: 'Reproducible', tone: 'ok' },
  buildable: { label: 'Construible', tone: 'info' },
  described: { label: 'Descrito', tone: 'warn' },
  pending: { label: 'Sin fuente', tone: 'neutral' },
};

function resolve(map: Record<string, { label: string; tone: Tone }>, key?: string) {
  if (!key) return { label: 'Sin estado', tone: 'neutral' as Tone };
  return map[key] ?? { label: key, tone: 'neutral' as Tone };
}

export const projectStatusTone = (key?: string) => resolve(PROJECT_STATUS, key);
export const decisionStatusTone = (key?: string) => resolve(DECISION_STATUS, key);
export const verificationStatusTone = (key?: string) => resolve(VERIFICATION_STATUS, key);
export const replicationLevelTone = (key?: string) => resolve(REPLICATION_LEVEL, key);
