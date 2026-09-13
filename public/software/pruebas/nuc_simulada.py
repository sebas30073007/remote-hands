"""
NUC simulada para probar la aplicación del Meta Quest 3 sin el robot.

Corre en una PC de la misma red WiFi que el visor y abre los mismos puertos
que el coordinador de la NUC. Publica en el puerto 5555 un video de prueba
(tópico "video_rgb", JPEG 640 x 480) y muestra en consola cada comando que
el visor envía por el puerto 5002 (tópico "cmd", JSON). Si en el visor se ve
el video y aquí aparecen los comandos al mover los controles, la app y la red
funcionan.

En el visor, escribe la IP de esta PC como IP de la NUC.

Uso:
    pip install pyzmq numpy opencv-python
    python nuc_simulada.py
    python nuc_simulada.py --fps 15

Ctrl+C para salir.
"""

import argparse
import json
import socket
import sys
import time

import cv2
import numpy as np
import zmq

PUERTO_VIDEO = 5555
PUERTO_CMD = 5002
ANCHO, ALTO = 640, 480


def ip_local():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def cuadro_de_prueba(n, fps_real):
    """Barras de color que se desplazan, con la hora y el contador de cuadros."""
    x = (np.arange(ANCHO) + n * 4) % ANCHO
    barras = np.zeros((ALTO, ANCHO, 3), dtype=np.uint8)
    barras[:, :, 0] = (x * 255 // ANCHO)[None, :]
    barras[:, :, 1] = 128
    barras[:, :, 2] = 255 - barras[:, :, 0]
    texto = "NUC simulada  #{}  {:.1f} fps  {}".format(n, fps_real, time.strftime("%H:%M:%S"))
    cv2.putText(barras, texto, (16, ALTO // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    ok, jpeg = cv2.imencode(".jpg", barras, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return jpeg.tobytes()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fps", type=float, default=30.0)
    args = parser.parse_args()

    ctx = zmq.Context()
    video = ctx.socket(zmq.PUB)
    video.setsockopt(zmq.SNDHWM, 2)  # igual que la NUC: descartar antes que acumular
    video.bind("tcp://*:{}".format(PUERTO_VIDEO))

    comandos = ctx.socket(zmq.SUB)
    comandos.bind("tcp://*:{}".format(PUERTO_CMD))
    comandos.setsockopt(zmq.SUBSCRIBE, b"")

    print("IP de esta PC : {}".format(ip_local()))
    print("Video PUB     : tcp://*:{} (tópico video_rgb)".format(PUERTO_VIDEO))
    print("Comandos SUB  : tcp://*:{} (tópico cmd)\n".format(PUERTO_CMD))

    periodo = 1.0 / args.fps
    n, fps_real, t_fps, cuenta = 0, 0.0, time.time(), 0
    try:
        while True:
            t0 = time.time()
            video.send_multipart([b"video_rgb", cuadro_de_prueba(n, fps_real)])
            n += 1
            cuenta += 1
            if t0 - t_fps >= 1.0:
                fps_real, t_fps, cuenta = cuenta / (t0 - t_fps), t0, 0

            while True:
                try:
                    partes = comandos.recv_multipart(flags=zmq.NOBLOCK)
                except zmq.Again:
                    break
                if len(partes) >= 2:
                    crudo = partes[1].decode("utf-8", errors="ignore")
                    try:
                        crudo = json.dumps(json.loads(crudo), ensure_ascii=False)
                    except ValueError:
                        pass
                    print("[{}] {} {}".format(time.strftime("%H:%M:%S"), partes[0].decode(errors="ignore"), crudo))

            time.sleep(max(0.0, periodo - (time.time() - t0)))
    except KeyboardInterrupt:
        print("\nDetenido.")
    finally:
        video.close(linger=0)
        comandos.close(linger=0)
        ctx.term()
    return 0


if __name__ == "__main__":
    sys.exit(main())
