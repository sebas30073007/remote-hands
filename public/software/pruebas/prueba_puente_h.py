"""
Prueba del Puente H maestro conectado directo a una PC por USB-C.

Hace lo mismo que la NUC por COM4: abre el puerto a 115 200 baudios y manda
líneas de texto. Sin opciones solo consulta (PING, STATUS y el escaneo del
bus I²C, que debe listar 0x8 y 0xb si el esclavo y el controlador CL57T
están conectados). Con --mover arma la placa y mueve los dos motores unos
segundos, reenviando la orden como hace la NUC para que no salte el timeout.
Con --consola puedes escribir cualquier comando a mano.

Antes de probar:
  - DIP switch en 100 (maestro) ANTES de alimentar la placa.
  - Para --mover: alimentación de potencia conectada y ruedas en el aire.

Uso:
    pip install pyserial
    python prueba_puente_h.py --puerto COM4
    python prueba_puente_h.py --puerto COM4 --mover --consigna 80 --segundos 3
    python prueba_puente_h.py --puerto COM4 --consola
"""

import argparse
import sys
import threading
import time

import serial

BAUDIOS = 115200
PERIODO_ORDEN_S = 1 / 15  # la NUC reenvía la tracción a 15 Hz


def lector(ser, alto):
    while not alto.is_set():
        linea = ser.readline().decode("utf-8", errors="ignore").strip()
        if linea:
            print("  <", linea)


def enviar(ser, linea):
    print("  >", linea)
    ser.write((linea + "\n").encode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--puerto", required=True)
    parser.add_argument("--mover", action="store_true", help="arma y mueve los dos motores")
    parser.add_argument("--consigna", type=int, default=80, help="-255 a 255 (default 80)")
    parser.add_argument("--segundos", type=float, default=3.0)
    parser.add_argument("--consola", action="store_true", help="escribir comandos a mano")
    args = parser.parse_args()

    ser = serial.Serial(args.puerto, BAUDIOS, timeout=0.1)
    alto = threading.Event()
    hilo = threading.Thread(target=lector, args=(ser, alto), daemon=True)
    time.sleep(1.0)
    ser.reset_input_buffer()
    hilo.start()

    try:
        for comando in ("PING", "STATUS", "SCAN"):
            enviar(ser, comando)
            time.sleep(0.4)

        if args.mover:
            v = max(-255, min(255, args.consigna))
            enviar(ser, "ARM")
            time.sleep(0.3)
            print("Moviendo {} s con consigna {} en ambos motores…".format(args.segundos, v))
            fin = time.time() + args.segundos
            while time.time() < fin:
                ser.write("{},{}\n".format(v, v).encode("utf-8"))
                time.sleep(PERIODO_ORDEN_S)
            enviar(ser, "S,S")
            time.sleep(1.5)  # la rampa tarda en llegar a cero
            enviar(ser, "DISARM")
            time.sleep(0.4)

        if args.consola:
            print("Consola: escribe comandos (HELP para la lista), vacío para salir.")
            while True:
                linea = input()
                if not linea.strip():
                    break
                enviar(ser, linea.strip())
    except KeyboardInterrupt:
        pass
    finally:
        ser.write(b"S,S\nDISARM\n")
        time.sleep(0.3)
        alto.set()
        ser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
