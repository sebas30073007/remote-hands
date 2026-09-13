"""
Prueba de la Intel RealSense D435i conectada directo a una PC.

Usa la misma configuración que la NUC: color 640 x 480 BGR y profundidad
640 x 480 Z16, ambos a 30 fps, con la profundidad alineada al color. Muestra
los dos streams lado a lado, la distancia al centro de la imagen y los fps
reales. Sin ventana (--sin-ventana) solo imprime las lecturas.

Uso:
    pip install pyrealsense2 numpy opencv-python
    python prueba_realsense_d435i.py
    python prueba_realsense_d435i.py --sin-ventana

Q o Esc cierran la ventana; Ctrl+C detiene la prueba sin ventana.
"""

import argparse
import sys
import time

import numpy as np
import pyrealsense2 as rs

ANCHO, ALTO, FPS = 640, 480, 30


def listar_dispositivos():
    dispositivos = rs.context().query_devices()
    if len(dispositivos) == 0:
        print("No se encontró ninguna RealSense. Revisa el cable: debe ser USB 3.")
        return False
    for d in dispositivos:
        usb = d.get_info(rs.camera_info.usb_type_descriptor) if d.supports(rs.camera_info.usb_type_descriptor) else "?"
        print(
            "Cámara : {} · serie {} · firmware {} · USB {}".format(
                d.get_info(rs.camera_info.name),
                d.get_info(rs.camera_info.serial_number),
                d.get_info(rs.camera_info.firmware_version),
                usb,
            )
        )
        if usb.startswith("2"):
            print("         Aviso: está conectada como USB 2; puede no dar 30 fps en ambos streams.")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sin-ventana", action="store_true", help="solo imprime, no abre ventana")
    args = parser.parse_args()

    if not listar_dispositivos():
        return 1

    pipeline = rs.pipeline()
    config = rs.config()
    config.enable_stream(rs.stream.color, ANCHO, ALTO, rs.format.bgr8, FPS)
    config.enable_stream(rs.stream.depth, ANCHO, ALTO, rs.format.z16, FPS)
    perfil = pipeline.start(config)
    escala = perfil.get_device().first_depth_sensor().get_depth_scale()
    alinear = rs.align(rs.stream.color)
    print("Escala de profundidad: {:.6f} m por unidad\n".format(escala))

    if not args.sin_ventana:
        import cv2

    cuadros, t0 = 0, time.time()
    try:
        while True:
            frames = alinear.process(pipeline.wait_for_frames())
            color = frames.get_color_frame()
            profundidad = frames.get_depth_frame()
            if not color or not profundidad:
                continue

            cuadros += 1
            centro_mm = profundidad.get_distance(ANCHO // 2, ALTO // 2) * 1000.0
            ahora = time.time()
            if ahora - t0 >= 1.0:
                print("{:4.1f} fps · distancia al centro {:6.0f} mm".format(cuadros / (ahora - t0), centro_mm))
                cuadros, t0 = 0, ahora

            if args.sin_ventana:
                continue

            imagen = np.asanyarray(color.get_data())
            z16 = np.asanyarray(profundidad.get_data())
            mapa = cv2.applyColorMap(cv2.convertScaleAbs(z16, alpha=0.03), cv2.COLORMAP_JET)
            cv2.circle(imagen, (ANCHO // 2, ALTO // 2), 4, (255, 255, 255), -1)
            cv2.putText(imagen, "{:.0f} mm".format(centro_mm), (ANCHO // 2 + 8, ALTO // 2 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.imshow("RealSense D435i: color | profundidad", np.hstack((imagen, mapa)))
            if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                break
    except KeyboardInterrupt:
        print("\nDetenido.")
    finally:
        pipeline.stop()
        if not args.sin_ventana:
            cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    sys.exit(main())
