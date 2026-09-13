/**
 * Antepone `base` a las rutas internas del contenido.
 *
 * El contenido se escribe con rutas absolutas desde la raíz del sitio
 * —`[ADR-0001](/registro/decisiones/0001-nuc-como-coordinador/)`,
 * `<img src="/images/robot-agv.png" />`— y este plugin las ajusta al
 * `base` real al compilar. Así el sitio puede vivir en la raíz de un
 * dominio (`remote-hands.sebs.mx`, base `/`) o en una subruta
 * (`usuario.github.io/remote-hands`, base `/remote-hands`) sin tocar una
 * sola página.
 *
 * Existe porque la primera versión escribía el base a mano: 184 rutas
 * `/remote-hands/…` en 52 archivos, que se rompían todas al pasar a un
 * subdominio.
 *
 * Cubre los dos tipos de nodo que produce MDX:
 *  - `element`: enlaces e imágenes escritos en Markdown.
 *  - `mdxJsxFlowElement` / `mdxJsxTextElement`: etiquetas JSX escritas a
 *    mano (`<img>`, `<a>`), cuyo atributo es un literal de texto.
 *
 * No toca: URLs externas, rutas protocolo-relativas (`//cdn…`), anclas
 * (`#seccion`), ni rutas que ya empiezan por `base`. Las props de
 * componentes (`<Artifact href=…>`) no pasan por aquí: cada componente
 * aplica `import.meta.env.BASE_URL` por su cuenta.
 */
export default function rehypeBase({ base = '/' } = {}) {
  const prefijo = base.replace(/\/$/, '');

  const ajustar = (valor) => {
    if (typeof valor !== 'string' || !prefijo) return valor;
    if (!valor.startsWith('/') || valor.startsWith('//')) return valor;
    if (valor === prefijo || valor.startsWith(`${prefijo}/`)) return valor;
    return `${prefijo}${valor}`;
  };

  const recorrer = (nodo) => {
    if (nodo.type === 'element' && nodo.properties) {
      for (const clave of ['href', 'src']) {
        if (clave in nodo.properties) nodo.properties[clave] = ajustar(nodo.properties[clave]);
      }
    } else if (
      (nodo.type === 'mdxJsxFlowElement' || nodo.type === 'mdxJsxTextElement') &&
      // Solo etiquetas HTML (`img`, `a`), nunca componentes (`Artifact`):
      // los componentes ya aplican `BASE_URL`, y tocar sus props duplicaba
      // el prefijo (`/remote-hands/remote-hands/cad/…`) en cuanto el sitio
      // vivía en una subruta.
      /^[a-z]/.test(nodo.name ?? '')
    ) {
      for (const attr of nodo.attributes ?? []) {
        if (attr.type === 'mdxJsxAttribute' && (attr.name === 'href' || attr.name === 'src')) {
          attr.value = ajustar(attr.value);
        }
      }
    }
    for (const hijo of nodo.children ?? []) recorrer(hijo);
  };

  return (arbol) => recorrer(arbol);
}
