import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

/**
 * Frontmatter de @sebs/project-docs.
 *
 * Mismo principio que en course-docs (brief §9, §16): solo se guarda
 * metadata que se renderiza. Si un campo no aparece en pantalla, no
 * pertenece aquí.
 *
 * MVP de tipos de página (Remote Hands es el primer proyecto de
 * validación, no el diseño del framework en sí):
 *   project | subsystem | procedure | experiment | decision | release | reference
 * El resto del contenido (arquitectura, interfaces, integración…) es MDX
 * normal sin `type`, igual que las páginas de Referencia rápida en
 * course-docs: no todo necesita andamiaje pedagógico/estructural propio.
 */
const projectSchema = z.object({
  /** Determina la cabecera automática de la página. */
  type: z
    .enum(['project', 'subsystem', 'procedure', 'experiment', 'decision', 'release', 'reference'])
    .optional(),

  // ---- type: project (portada) ----
  /** Estado general del proyecto, mostrado como panel en la portada. */
  status: z.enum(['concept', 'prototype', 'validated', 'in-review', 'archived']).optional(),
  currentRelease: z.string().optional(),
  /** Etiquetas cortas: "Robótica", "XR", "Investigación"… */
  projectType: z.array(z.string()).optional(),

  // ---- type: subsystem ----
  /** ID corto y estable del subsistema, p. ej. "SUB-ROBOT". */
  subsystemId: z.string().optional(),
  revision: z.string().optional(),
  disciplines: z.array(z.string()).optional(),
  responsibility: z.string().optional(),
  owner: z.string().optional(),
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),

  // ---- type: decision (ADR) ----
  decisionId: z.string().optional(),
  decisionStatus: z.enum(['proposed', 'accepted', 'superseded', 'rejected']).optional(),
  date: z.string().optional(),
  supersededBy: z.string().optional(),

  // ---- type: release ----
  version: z.string().optional(),

  // ---- type: experiment ----
  experimentId: z.string().optional(),
  hypothesis: z.string().optional(),

  // ---- type: procedure ----
  duration: z.string().optional(),
  software: z.array(z.string()).optional(),
});

export type ProjectFrontmatter = z.infer<typeof projectSchema>;

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({ extend: projectSchema }),
  }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
