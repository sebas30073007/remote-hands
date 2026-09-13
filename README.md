# Remote Hands

Documentación de ingeniería de **Remote Hands**: un robot móvil con brazo
manipulador de 3 GDL, teleoperado desde un visor Meta Quest 3.

Un operador controla el robot a distancia con una interfaz de realidad
mixta hecha en Unity. A bordo, una NUC coordina el sistema: procesa la
percepción (RPLiDAR C1 y RealSense D435i), mantiene la comunicación con el
operador por ZeroMQ sobre WiFi y reparte las órdenes entre tres
controladores ESP32-C3 —tracción, manipulador y gripper—.

**Sitio:** [remote-hands.sebs.mx](https://remote-hands.sebs.mx)

Proyecto Terminal universitario. Del experimento de latencia salió un
artículo para el IEEE World Forum on IoT, y el proyecto se postuló al James
Dyson Award 2026.

## Qué hay aquí

Un sitio de documentación construido con [Astro](https://astro.build) y
[Starlight](https://starlight.astro.build). Se escribe en MDX con un
vocabulario de ingeniería propio: requisitos, interfaces, verificación,
decisiones de arquitectura (ADR), niveles de replicación y artefactos
descargables.

Además de la documentación, el repositorio publica lo necesario para
replicar el robot: firmware, código de la NUC, archivos de fabricación de
las PCB, planos DXF del manipulador y el dataset del experimento de latencia.

### Navegación por vista explosionada

El sitio tiene dos formas de navegar, que se alternan con el botón **UI/UX**
de la barra superior:

- **Lista**: el temario clásico.
- **Explosión**: el robot dibujado a partir de su CAD. Al elegir una pieza,
  la página cambia y el dibujo se separa en las piezas de esa parte.

Las imágenes de la explosión no son un modelo 3D embebido: son capas
renderizadas desde el CAD con cámara ortográfica, que el navegador traslada
con CSS.

## Empezar

```bash
npm install
npm run dev       # http://localhost:4321/
npm run build     # genera dist/
npm run check     # tipos y frontmatter
```

## Estructura

```text
src/
├── content/docs/   páginas del sitio (MDX)
├── components/
│   ├── core/       primitivas genéricas
│   └── project/    vocabulario de ingeniería: import { … } from '@project'
├── overrides/      componentes de Starlight sustituidos
├── lib/            configuración del proyecto y árbol de la vista explosionada
├── generated/      manifiesto de la vista explosionada (generado)
└── styles/         identidad SEBS y estilos del sitio
public/
├── models/         modelos 3D optimizados (.glb)
├── explode/        capas renderizadas de la vista explosionada
├── pcb/ firmware/ software/ cad/ datasets/   artefactos descargables
scripts/            pipelines de imágenes y modelos
```

## Pipeline de la vista explosionada

Los modelos originales (Inventor, KiCad) no se versionan: pesan ~50 MB. Si
cambia el CAD, se regeneran así:

```bash
node scripts/optimize-models.mjs   # raw assets/*.glb  ->  public/models/
node scripts/render-explode.mjs    # public/models/    ->  public/explode/ + manifiesto
```

Qué piezas forman cada capa y hacia dónde se separan está en
`scripts/explode-scenes.mjs`; a qué página lleva cada pieza, en
`src/lib/explode-nav.ts`.

## Despliegue

Cada push a `main` compila y publica en GitHub Pages
(`.github/workflows/deploy.yml`). El sitio se sirve en el subdominio
`remote-hands.sebs.mx`, configurado en *Settings → Pages* del repositorio y
con un registro `CNAME` en el DNS de `sebs.mx`.

`site` y `base` están en `astro.config.mjs`. Las rutas internas del
contenido se escriben desde la raíz (`/sistema/…`) y se ajustan al `base` al
compilar, así que mover el sitio a otra ruta solo cambia `BASE`.

## Escribir contenido

El frontmatter `type` (`project`, `subsystem`, `procedure`, `experiment`,
`decision`, `release`, `reference`) coloca la cabecera de la página
automáticamente. Los componentes se importan en una línea:

```mdx
import { ParameterTable, InterfaceTable, Requirement, VerificationResult, Artifact } from '@project';
```

Las páginas de `src/content/docs/sistema/subsistemas/robot-movil/` son la
referencia del patrón.

## Autor

Sebastián Méndez — [sebs.mx](https://sebs.mx)
