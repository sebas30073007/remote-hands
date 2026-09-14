/**
 * Agrupa los artefactos en una cuadrícula.
 *
 * En el contenido, los archivos se escriben uno tras otro:
 *
 *   <Artifact href="/pcb/puente-h/gerbers.zip" … />
 *   <Artifact href="/pcb/puente-h/bom.csv" … />
 *
 * y así se leían: una lista vertical, cada uno con su rótulo «Artefacto».
 * Este plugin envuelve cada racha de `<Artifact>` seguidos —aunque haya
 * saltos de línea entre ellos— en `<div class="c-files">`, que el CSS
 * reparte en tres columnas con un solo rótulo. Así todas las páginas los
 * presentan igual sin que ninguna tenga que envolverlos a mano.
 */
const esArtefacto = (n) => n.type === 'mdxJsxFlowElement' && n.name === 'Artifact';
const esVacio = (n) => n.type === 'text' && !n.value.trim();

export default function rehypeArtefactos() {
  const recorrer = (nodo) => {
    if (!nodo.children) return;
    const hijos = [];
    let racha = null;

    const cerrar = () => {
      if (!racha) return;
      hijos.push({
        type: 'element',
        tagName: 'div',
        properties: { className: ['c-files'] },
        children: [
          {
            type: 'element',
            tagName: 'p',
            properties: { className: ['c-files__label'] },
            children: [{ type: 'text', value: racha.length > 1 ? 'Artefactos' : 'Artefacto' }],
          },
          ...racha,
        ],
      });
      racha = null;
    };

    for (const hijo of nodo.children) {
      if (esArtefacto(hijo)) {
        (racha ??= []).push(hijo);
      } else if (racha && esVacio(hijo)) {
        // Un salto de línea entre dos artefactos no corta la racha.
        continue;
      } else {
        cerrar();
        recorrer(hijo);
        hijos.push(hijo);
      }
    }
    cerrar();
    nodo.children = hijos;
  };

  return (arbol) => recorrer(arbol);
}
