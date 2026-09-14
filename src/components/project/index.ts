/**
 * Vocabulario de ingeniería de @sebs/project-docs.
 *
 * Una sola línea de import por página:
 *
 *   import { ParameterTable, InterfaceTable, Requirement } from '@project';
 *
 * Los componentes de cabecera (ProjectHeader, SubsystemHeader,
 * DecisionHeader, ReleaseHeader, ExperimentHeader) los coloca
 * automáticamente el override de `PageTitle` según `type`; no hace falta
 * importarlos al escribir contenido.
 */

// MVP: nueve componentes, salidos de necesidades
// reales de Remote Hands, no para igualar el número de course-docs.
// El contrato de replicación de cada página: qué puede hacer alguien de
// fuera con lo publicado, y qué le falta para poder hacer más.
export { default as ReplicationLevel } from './ReplicationLevel.astro';

export { default as ParameterTable } from './ParameterTable.astro';
export { default as InterfaceTable } from './InterfaceTable.astro';
export { default as Requirement } from './Requirement.astro';
export { default as VerificationResult } from './VerificationResult.astro';
export { default as Artifact } from './Artifact.astro';
export { default as Model3D } from './Model3D.astro';
export { default as RevisionHistory } from './RevisionHistory.astro';
export { default as StatusBadge } from './StatusBadge.astro';

// El diagrama de arquitectura como navegación: los nodos del dibujo son
// los enlaces a los subsistemas. Dirigido por datos —el framework no sabe
// cuántos subsistemas tiene el proyecto ni cómo se llaman—.
export { default as SystemMap } from './SystemMap.astro';

// Cadena de señal con miniaturas 3D: del operador al motor, un eslabón por
// componente, con el medio por el que viaja la orden en cada tramo.
export { default as SignalChain } from './SignalChain.astro';
export { default as SignalHub } from './SignalHub.astro';
export { default as ArchitectureDiagram } from './ArchitectureDiagram.astro';

// Plantillas de página (colocadas automáticamente por PageTitle; se
// exportan también por si una página necesita repetir una cabecera fuera
// de su posición por defecto, igual que course-docs expone CourseHeader).
export { default as ProjectHeader } from './ProjectHeader.astro';
export { default as SubsystemHeader } from './SubsystemHeader.astro';
export { default as DecisionHeader } from './DecisionHeader.astro';
export { default as ReleaseHeader } from './ReleaseHeader.astro';
export { default as ExperimentHeader } from './ExperimentHeader.astro';
