import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'E:/20_UNI/Html proyects/Claude_JustTheDocs_ProyectoTerminal/teleop-mobile-manipulator/assets/raw_assets';
const DST = 'E:/20_UNI/Html proyects/remote-hands/public/images/build';

// slug -> archivo fuente. Nombres descriptivos tomados del catálogo de imágenes.
const MAP = {
  '20260428_160326.jpg': 'robot-completo-vista-superior',
  '20260428_160356.jpg': 'gripper-vista-superior',
  '20260428_160440.jpg': 'gripper-vista-inclinada',
  '20260428_160455.jpg': 'gripper-pinon-cremallera',
  '20260428_160521.jpg': 'gripper-alineacion-frontal',
  '20260428_160629.jpg': 'manipulador-vista-lateral',
  '20260428_160650.jpg': 'final-carrera-eslabon',
  '20260428_160702.jpg': 'final-carrera-base',
  '20260428_160728.jpg': 'realsense-montaje-frontal',
  '20260428_160750.jpg': 'robot-completo-vista-frontal',
  '20260428_160837.jpg': 'transmision-motores-nema17',
  '20260428_160848.jpg': 'transmision-poleas-diagonal',
  '20260428_160857.jpg': 'transmision-segundo-eslabon',
  '20260428_161123.jpg': 'base-rotatoria-lateral',
  '20260428_161210.jpg': 'union-base-caja-elevacion',
  '20260428_161309.jpg': 'caja-elevacion-interior-electronica',
  '20260428_161409.jpg': 'pcb-puente-h-detalle',
  '20260428_161510.jpg': 'articulacion-polea-chumacera',
  '20260428_161525.jpg': 'tensor-rodamiento-correa',
  '20260428_161557.jpg': 'soporte-c-refuerzo-doble',
  'Ensamble_de_manipulador.jpg': 'ensamble-manipulador',
  'Ensamble_manipulador_robot_movil.jpg': 'ensamble-manipulador-sobre-movil',
  'Manofactura_manipulador_corte_laser.jpg': 'manufactura-corte-laser',
  'Primeras_piezas del manipulador.jpeg': 'manufactura-primeras-piezas',
  'PCB recien soldada puenteH.jpg': 'pcb-puente-h-soldada',
  'Vista_PCB_final_puenteH.jpg': 'pcb-puente-h-final',
  'Esquema_puenteH_final.jpg': 'puente-h-esquema-final',
  'armado_puenteH_proto.jpg': 'puente-h-prototipo-protoboard',
  'test_puenteH_proto.jpg': 'puente-h-prototipo-prueba',
  'Temperatura_pueteH_proto.jpg': 'puente-h-prototipo-temperatura',
  'Conexiones_driver.jpg': 'conexiones-driver-cl57t',
  'material.jpg': 'material-lamina-acero',
  'material_drivers.jpg': 'material-drivers',
  'plataforma_movil_uniciclo_base.jpg': 'plataforma-movil-base',
  'Test en piso del robot movil.jpg': 'prueba-piso-robot-movil',
};

await mkdir(DST, { recursive: true });
let inTotal = 0, outTotal = 0, n = 0;
for (const [file, slug] of Object.entries(MAP)) {
  const src = path.join(SRC, file);
  try {
    const s = await stat(src);
    const out = path.join(DST, `${slug}.webp`);
    const info = await sharp(src)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(out);
    inTotal += s.size; outTotal += info.size; n++;
    console.log(`${slug.padEnd(38)} ${(s.size/1048576).toFixed(1)}MB -> ${(info.size/1024).toFixed(0)}KB  ${info.width}x${info.height}`);
  } catch (e) {
    console.log(`FALTA  ${file}: ${e.message.split('\n')[0]}`);
  }
}
console.log(`\n${n} imagenes | ${(inTotal/1048576).toFixed(1)} MB -> ${(outTotal/1048576).toFixed(1)} MB`);
