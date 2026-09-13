"""
Prueba del RPLiDAR C1 conectado directo a una PC.

Habla el protocolo serie de Slamtec sin librerías del fabricante: solo
necesita pyserial. Pide la información y el estado del sensor, arranca un
escaneo y muestra, por cada vuelta, la frecuencia de giro, los puntos
medidos y la distancia al frente. Con --grafica dibuja la vuelta en polar.

Uso:
    pip install pyserial            (y matplotlib si usas --grafica)
    python prueba_rplidar_c1.py --puerto COM3
    python prueba_rplidar_c1.py --puerto /dev/ttyUSB0 --grafica

Ctrl+C detiene el escaneo y apaga el motor.
"""

import argparse
import struct
import sys
import time

import serial

BAUDIOS = 460800

# Peticiones: 0xA5 + comando.
CMD_STOP = b"\xA5\x25"
CMD_RESET = b"\xA5\x40"
CMD_SCAN = b"\xA5\x20"
CMD_GET_INFO = b"\xA5\x50"
CMD_GET_HEALTH = b"\xA5\x52"

ESTADOS = {0: "OK", 1: "ADVERTENCIA", 2: "ERROR"}


def leer_exacto(ser, n, plazo_s=2.0):
    """Lee n bytes o falla si el sensor no los entrega a tiempo."""
    datos = b""
    limite = time.time() + plazo_s
    while len(datos) < n:
        if time.time() > limite:
            raise TimeoutError("el sensor no respondió ({} de {} bytes)".format(len(datos), n))
        datos += ser.read(n - len(datos))
    return datos


def leer_descriptor(ser):
    """Cada respuesta empieza con 7 bytes: A5 5A, longitud y tipo."""
    d = leer_exacto(ser, 7)
    if d[0:2] != b"\xA5\x5A":
        raise ValueError("descriptor inválido: {}".format(d.hex(" ")))
    longitud = struct.unpack("<I", d[2:6])[0] & 0x3FFFFFFF
    return longitud, d[6]


def pedir_info(ser):
    ser.write(CMD_GET_INFO)
    longitud, _ = leer_descriptor(ser)
    r = leer_exacto(ser, longitud)
    modelo, fw_menor, fw_mayor, hw = r[0], r[1], r[2], r[3]
    serie = r[4:20].hex().upper()
    return "modelo 0x{:02X} · firmware {}.{:02d} · hardware {} · serie {}".format(modelo, fw_mayor, fw_menor, hw, serie)


def pedir_estado(ser):
    ser.write(CMD_GET_HEALTH)
    longitud, _ = leer_descriptor(ser)
    r = leer_exacto(ser, longitud)
    codigo = struct.unpack("<H", r[1:3])[0]
    return ESTADOS.get(r[0], "?"), codigo


def decodificar_nodo(b):
    """
    Un punto del escaneo: 5 bytes.
      b0: calidad (6 bits) · !S · S   (S = 1 marca el inicio de una vuelta)
      b1-b2: ángulo en Q6, con un bit de control que siempre vale 1
      b3-b4: distancia en Q2, en milímetros
    Devuelve None si los bits de control no cuadran (trama desalineada).
    """
    s = b[0] & 0x01
    no_s = (b[0] >> 1) & 0x01
    if s == no_s or (b[1] & 0x01) != 1:
        return None
    calidad = b[0] >> 2
    angulo = (((b[2] << 8) | b[1]) >> 1) / 64.0
    distancia = ((b[4] << 8) | b[3]) / 4.0
    return bool(s), angulo, distancia, calidad


def escanear(ser, grafica=False):
    ser.write(CMD_SCAN)
    longitud, _ = leer_descriptor(ser)
    if longitud != 5:
        raise ValueError("respuesta de escaneo inesperada (longitud {})".format(longitud))

    if grafica:
        import matplotlib.pyplot as plt

        plt.ion()
        figura = plt.figure("RPLiDAR C1")
        eje = figura.add_subplot(projection="polar")

    vuelta = []
    t_vuelta = None
    buffer = b""
    while True:
        buffer += ser.read(max(5, ser.in_waiting))
        while len(buffer) >= 5:
            nodo = decodificar_nodo(buffer[:5])
            if nodo is None:
                buffer = buffer[1:]  # resincroniza byte a byte
                continue
            buffer = buffer[5:]
            inicio, angulo, distancia, calidad = nodo

            if inicio and vuelta:
                ahora = time.time()
                if t_vuelta is not None:
                    reportar_vuelta(vuelta, ahora - t_vuelta)
                    if grafica:
                        dibujar(eje, vuelta)
                t_vuelta = ahora
                vuelta = []
            vuelta.append((angulo, distancia, calidad))


def reportar_vuelta(vuelta, periodo_s):
    validos = [(a, d) for a, d, q in vuelta if d > 0]
    frente = [d for a, d in validos if a < 3 or a > 357]
    minimo = min((d for a, d in validos), default=0)
    print(
        "{:5.1f} Hz · {:4d} puntos ({:4d} válidos) · frente {:>6} mm · más cercano {:6.0f} mm".format(
            1.0 / periodo_s,
            len(vuelta),
            len(validos),
            "{:.0f}".format(sum(frente) / len(frente)) if frente else "—",
            minimo,
        )
    )


def dibujar(eje, vuelta):
    import math
    import matplotlib.pyplot as plt

    eje.clear()
    eje.set_rmax(6000)
    eje.scatter([math.radians(a) for a, d, q in vuelta if d > 0], [d for a, d, q in vuelta if d > 0], s=2)
    plt.pause(0.001)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--puerto", required=True, help="COM3 en Windows, /dev/ttyUSB0 en Linux")
    parser.add_argument("--grafica", action="store_true", help="dibuja cada vuelta (requiere matplotlib)")
    args = parser.parse_args()

    ser = serial.Serial(args.puerto, BAUDIOS, timeout=0.1)
    try:
        ser.write(CMD_STOP)
        time.sleep(0.05)
        ser.reset_input_buffer()

        print("Sensor :", pedir_info(ser))
        estado, codigo = pedir_estado(ser)
        print("Estado : {} (código {})".format(estado, codigo))
        if estado == "ERROR":
            print("El sensor reporta error. Reinícialo (desconecta y conecta) y vuelve a probar.")
            ser.write(CMD_RESET)
            return 1

        print("Escaneando… Ctrl+C para detener.\n")
        escanear(ser, grafica=args.grafica)
    except KeyboardInterrupt:
        print("\nDetenido.")
    finally:
        ser.write(CMD_STOP)
        time.sleep(0.05)
        ser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
