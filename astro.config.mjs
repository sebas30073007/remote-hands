// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import { ROOT_GROUP_LABEL } from './src/lib/project.config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import rehypeBase from './src/lib/rehype-base.mjs';
import rehypeArtefactos from './src/lib/rehype-artefactos.mjs';
import redirecciones from './src/lib/redirecciones.json' with { type: 'json' };

/** Dominio y ruta base de despliegue. Ver el comentario de `defineConfig`. */
const SITE = 'https://remote-hands.sebs.mx';
const BASE = '/';

/**
 * Configuración del sitio — Remote Hands.
 *
 * Despliegue: GitHub Pages con dominio propio, `remote-hands.sebs.mx`. El
 * sitio vive en la raíz del subdominio, así que `base` es `/`. La URL
 * `sebas30073007.github.io/remote-hands/` sigue existiendo y GitHub la
 * redirige al dominio.
 *
 * Por qué subdominio y no la URL de github.io: el link termina en el
 * portafolio, en el paper y en la postulación al Dyson, y tiene que
 * sobrevivir a un cambio de nombre del repo o de proveedor. Por qué GitHub
 * Pages y no Cloudflare: el build necesita Chromium (Mermaid se renderiza
 * a SVG al compilar) y el workflow de course-docs ya lo resuelve.
 *
 * El contenido escribe rutas desde la raíz (`/sistema/…`) y
 * `rehype-base.mjs` les antepone `BASE` al compilar: si algún día el sitio
 * vuelve a una subruta, solo cambia `BASE`.
 */
export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',

  // Páginas que se fusionaron: cada URL vieja lleva a su sección nueva.
  redirects: redirecciones,

  // KaTeX y Mermaid resueltos en build, igual que en course-docs — cero
  // JavaScript propio de ninguno de los dos en la página servida.
  markdown: {
    syntaxHighlight: { excludeLangs: ['mermaid'] },
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [rehypeBase, { base: BASE }],
        rehypeArtefactos,
        rehypeKatex,
        [
          rehypeMermaid,
          {
            strategy: 'inline-svg',
            css: new URL(
              './node_modules/@fontsource-variable/manrope/index.css',
              import.meta.url
            ),
            mermaidConfig: {
              theme: 'base',
              themeVariables: {
                fontFamily: '"Manrope Variable", Manrope, sans-serif',
                fontSize: '14px',
                primaryColor: '#E5E7EB',
                primaryTextColor: '#111317',
                primaryBorderColor: '#6B6F76',
                lineColor: '#6B6F76',
                secondaryColor: '#FFFFFF',
                tertiaryColor: '#FFFFFF',
              },
            },
          },
        ],
      ],
    }),
  },

  integrations: [
    starlight({
      title: 'Remote Hands',
      // Símbolo SEBS, copiado de portfolio/assets/img (la skill de marca
      // pide copiar los assets, no enlazarlos). Sin esto Starlight pide un
      // `/favicon.svg` que no existe y cada página daba un 404.
      favicon: '/favicon-32.png',
      head: [
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '48x48', href: `${BASE.replace(/\/$/, '')}/favicon-48.png` } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${BASE.replace(/\/$/, '')}/apple-touch-icon.png` } },
      ],
      description:
        'Plataforma de teleoperación para manipulación móvil: robot AGV con brazo manipulador, servidor de percepción e interfaz XR en Meta Quest.',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Español', lang: 'es' },
      },

      // Mismo sistema visual que course-docs: identidad SEBS consumida por
      // copia de tokens, nunca reinventada. `project.css` es la única pieza
      // nueva — los componentes de ingeniería de este framework.
      customCss: [
        '@fontsource-variable/manrope',
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/500.css',
        'katex/dist/katex.min.css',
        './src/styles/sebs-tokens.css',
        './src/styles/starlight-bridge.css',
        './src/styles/islands.css',
        './src/styles/project.css',
        // Navegación por vista explosionada y conmutador UI/UX.
        './src/styles/explode.css',
      ],

      components: {
        Head: './src/overrides/Head.astro',
        PageTitle: './src/overrides/PageTitle.astro',
        ThemeProvider: './src/overrides/ThemeProvider.astro',
        ThemeSelect: './src/overrides/ThemeSelect.astro',
        TableOfContents: './src/overrides/TableOfContents.astro',
        MobileTableOfContents: './src/overrides/MobileTableOfContents.astro',
        Pagination: './src/overrides/Pagination.astro',
        Sidebar: './src/overrides/Sidebar.astro',
        SiteTitle: './src/overrides/SiteTitle.astro',
      },

      // Árbol del temario — gramática de @sebs/project-docs aplicada a
      // Remote Hands.
      //
      // El eje de navegación es **la cosa**, no la fase del ciclo de vida.
      // La versión anterior ordenaba el temario por el modelo en V
      // —arquitectura, requisitos, subsistemas, interfaces, integración,
      // construcción, verificación, operación—, que es la ontología de
      // quien escribe la documentación. Quien la lee no busca una fase:
      // busca una cosa («¿cómo funciona el gripper?») o una tarea («¿cómo
      // lo enciendo?»). Con el eje de ciclo de vida, el manipulador queda
      // repartido en seis grupos y hay que conocer el modelo en V para
      // encontrarlo entero.
      //
      // Ahora hay seis cubetas, cada una respondiendo a un verbo del
      // lector —entender, contextualizar, operar, construir, confiar,
      // consultar— y «El sistema» es isomorfo al diagrama de arquitectura:
      // los tres nodos del dibujo (robot, NUC, visor) son los tres nodos
      // del menú. Ver la misma palabra en la figura y en el menú es
      // findability regalada, y era la virtud del sitio anterior
      // (teleop-mobile-manipulator) que se había perdido.
      //
      // El ciclo de vida no desaparece: baja de eje de navegación a patrón
      // de secciones dentro de cada página (requisitos → diseño →
      // verificación), que ya es como están escritas.
      //
      // Reglas que sostienen el árbol:
      //
      //  1. Ningún hijo puede confundirse con su padre. «Robot móvil» >
      //     «Plataforma móvil» lo violaba —ambos con «móvil», leídos como
      //     sinónimos—; «Robot» > «Plataforma móvil» no. Y ningún índice se
      //     etiqueta como su grupo: son «Vista general», para que las migas
      //     no digan «Robot móvil > Robot móvil».
      //  2. No colapsar todo. Catorce grupos cerrados con sustantivos
      //     abstractos obligan a abrirlos uno por uno. «El sistema» queda
      //     abierto; las cubetas meta (Reporte, Operar) no —nadie llega
      //     buscándolas.
      //  3. Una página canónica por contrato; las demás enlazan, no
      //     repiten.
      //
      // «Interfaces» desapareció como grupo de primer nivel: chocaba con
      // «Interfaz XR» y casi no cargaba peso. Sus dos páginas siguen en su
      // slug de siempre —los enlaces entrantes no se rompen— pero colgadas
      // de donde pertenecen: el contrato ZMQ es una arista del diagrama de
      // bloques, y el contrato eléctrico es un asunto interno del robot.
      //
      // «Reporte» va en segundo lugar, no al fondo: el sínodo del Proyecto
      // Terminal es la audiencia principal de los próximos meses.
      //
      // Grupos marcados "extensión opcional" (Académico)
      // existen porque Remote Hands los necesita —es Proyecto Terminal +
      // paper IEEE + James Dyson Award— pero el framework no los presupone
      // para un proyecto futuro que no los tenga.
      sidebar: [
        {
          label: ROOT_GROUP_LABEL,
          items: [
            { label: 'Inicio', link: '/' },

            // ── Entender ────────────────────────────────────────────────
            // Isomorfo al diagrama de arquitectura: Arquitectura + las tres
            // cajas del dibujo. Abierto por defecto; es a lo que casi todo
            // el mundo viene.
            {
              label: 'El sistema',
              collapsed: false,
              items: [
                {
                  label: 'Arquitectura',
                  collapsed: false,
                  items: [
                    { slug: 'sistema/arquitectura/resumen', label: 'Vista general' },
                    // Absorbió la antigua «Interfaces · ZMQ»: las dos
                    // páginas contaban el mismo contrato, una como mapa y
                    // otra como tabla, y esa distinción no sobrevivía a
                    // ningún lector. Es la página canónica de ZMQ; el resto
                    // enlaza aquí en vez de repetirlo.
                    { slug: 'sistema/arquitectura/comunicaciones' },
                  ],
                },
                {
                  label: 'Robot',
                  collapsed: true,
                  items: [
                    { slug: 'sistema/subsistemas/robot-movil', label: 'Vista general' },
                    // Mecánica
                    { slug: 'sistema/subsistemas/robot-movil/plataforma-movil' },
                    {
                      label: 'Manipulador',
                      collapsed: true,
                      items: [
                        { slug: 'sistema/subsistemas/robot-movil/manipulador', label: 'Manipulador' },
                        { slug: 'sistema/subsistemas/robot-movil/manipulador/estructura' },
                        { slug: 'sistema/subsistemas/robot-movil/manipulador/mecanismo' },
                      ],
                    },
                    {
                      label: 'Sensores',
                      collapsed: true,
                      items: [
                        { slug: 'sistema/subsistemas/robot-movil/sensores', label: 'Sensores' },
                        { slug: 'sistema/subsistemas/robot-movil/sensores/rplidar-c1' },
                        { slug: 'sistema/subsistemas/robot-movil/sensores/realsense-d435i' },
                      ],
                    },
                    // Electrónica y software. «Sistemas embebidos» es la
                    // página que compara los tres controladores ESP32-C3;
                    // el detalle de cada uno, y el código de los cuatro,
                    // cuelgan de ella en vez de competir con la mecánica
                    // al mismo nivel.
                    {
                      label: 'Sistemas embebidos',
                      collapsed: true,
                      items: [
                        { slug: 'sistema/subsistemas/robot-movil/firmware', label: 'Embebidos' },
                        { slug: 'sistema/subsistemas/robot-movil/conjunto-i2c', label: 'Conjunto I²C' },
                        { slug: 'sistema/subsistemas/robot-movil/electronica', label: 'Puente H' },
                        { slug: 'sistema/subsistemas/robot-movil/controladores/cl57t', label: 'CL57T' },
                        { slug: 'sistema/subsistemas/robot-movil/controladores/gripper', label: 'Gripper' },
                      ],
                    },
                    { slug: 'sistema/subsistemas/robot-movil/verificacion', label: 'Verificación' },
                  ],
                },
                {
                  label: 'Servidor / NUC',
                  collapsed: true,
                  items: [
                    { slug: 'sistema/subsistemas/servidor-percepcion', label: 'Vista general' },
                    { slug: 'sistema/subsistemas/servidor-percepcion/middleware' },
                    { slug: 'sistema/subsistemas/servidor-percepcion/percepcion' },
                    { slug: 'sistema/subsistemas/servidor-percepcion/verificacion', label: 'Verificación' },
                  ],
                },
                {
                  // Se llamaba «Interfaz XR». El nombre del hardware es el
                  // ancla que el lector reconoce: está en el diagrama de
                  // arquitectura y era el nombre del sitio anterior.
                  label: 'Visor Meta Quest',
                  collapsed: true,
                  items: [
                    { slug: 'sistema/subsistemas/interfaz-xr', label: 'Vista general' },
                    { slug: 'sistema/subsistemas/interfaz-xr/interfaz' },
                    { slug: 'sistema/subsistemas/interfaz-xr/unity' },
                    { slug: 'sistema/subsistemas/interfaz-xr/verificacion', label: 'Verificación' },
                  ],
                },
              ],
            },

            // ── Contextualizar ──────────────────────────────────────────
            {
              label: 'Reporte',
              collapsed: true,
              items: [
                { slug: 'proyecto' },
                { slug: 'academico' },
                { slug: 'latencia-wifi' },
                { slug: 'registro' },
              ],
            },

            // ── Operar ──────────────────────────────────────────────────
            {
              label: 'Operar',
              collapsed: true,
              items: [{ slug: 'operacion' }],
            },
          ],
        },
      ],

      expressiveCode: {
        themes: ['github-light'],
      },

      pagination: true,
      lastUpdated: false,
      credits: false,
    }),
  ],
});
