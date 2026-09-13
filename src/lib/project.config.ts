/**
 * Configuración a nivel de proyecto.
 *
 * Igual que `course.config.ts` en @sebs/course-docs: el framework
 * (@sebs/project-docs) no debe saber nada de Remote Hands en concreto. Lo
 * que es específico de ESTE proyecto se declara aquí, en un único lugar, y
 * lo consumen `astro.config.mjs` y `project-nav.ts`.
 */

/**
 * Nodo raíz del temario: el grupo del que cuelga todo lo demás.
 *
 * Se declara aquí y no solo en el sidebar porque las migas lo omiten
 * —sería redundante con «Inicio»— y para eso tienen que reconocerlo.
 */
export const ROOT_GROUP_LABEL = 'Remote Hands';
