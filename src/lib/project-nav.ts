import { ROOT_GROUP_LABEL } from './project.config';

/**
 * Ubicación de la página dentro del temario.
 *
 * Se deriva del sidebar que Starlight ya calculó para la página actual
 * (`Astro.locals.starlightRoute.sidebar`), así que no hay estado, ni
 * manifiesto duplicado, ni JavaScript de cliente: si el temario cambia
 * en `astro.config.mjs`, la ruta cambia con él.
 */

/** Forma mínima de una entrada de sidebar de Starlight. */
type SidebarEntry =
  | { type: 'link'; label: string; href: string; isCurrent: boolean }
  | { type: 'group'; label: string; entries: SidebarEntry[] };

export interface CoursePage {
  label: string;
  href: string;
  isCurrent: boolean;
  /** Cadena de grupos que contienen la página, del más externo al más interno. */
  ancestors: string[];
  /** Grupo inmediato, p. ej. "01 · Esquemático". */
  group: string | undefined;
}

/** Aplana el árbol del sidebar conservando la cadena de grupos de cada enlace. */
export function flattenSidebar(entries: SidebarEntry[], ancestors: string[] = []): CoursePage[] {
  return entries.flatMap((entry) =>
    entry.type === 'group'
      ? flattenSidebar(entry.entries, [...ancestors, entry.label])
      : [
          {
            label: entry.label,
            href: entry.href,
            isCurrent: entry.isCurrent,
            ancestors,
            group: ancestors[ancestors.length - 1],
          },
        ]
  );
}

/**
 * Ruta de migas de la página actual: los grupos que hay que atravesar
 * para llegar a ella. Vacía en la portada y en páginas fuera del sidebar.
 *
 * El nodo raíz se omite: la primera miga ya enlaza a la portada y
 * repetirlo no aporta nada.
 */
export function getBreadcrumbs(sidebar: SidebarEntry[]): string[] {
  const actual = flattenSidebar(sidebar).find((page) => page.isCurrent);
  return (actual?.ancestors ?? []).filter((label) => label !== ROOT_GROUP_LABEL);
}
