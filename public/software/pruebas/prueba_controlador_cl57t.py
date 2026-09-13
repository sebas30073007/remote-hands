"""
Prueba del Controlador CL57T conectado directo a una PC por USB-C.

La placa acepta por USB los mismos comandos de texto que recibe por I²C, así
que se prueba sin el Puente H maestro. Cada comando de movimiento bloquea
hasta terminar y la placa responde con una línea OK / ERR / ABORT.

Sin opciones solo consulta: PING, STATE? y TUNE?. Con --home ejecuta el
homing del codo y la muñeca. Con --mover hace un vaivén corto de la base.
Con --consola puedes escribir cualquier comando a mano.

Antes de mover: drivers CL57T alimentados y el brazo libre de obstáculos.

Uso:
    pip install pyserial
    python prueba_controlador_cl57t.py --puerto COM6
    python prueba_controlador_cl57t.py --puerto COM6 --home --mover
    python prueba_controlador_cl57t.py --puerto COM6 --consola
"""

import argparse
import sys
import time

import serial

BAUDIOS = 115200
FINALES = ("OK", "ERR", "ABORT", "PONG")


def comando(ser, linea, plazo_s=5.0):
    """Manda una línea y espera la respuesta final; imprime el registro intermedio."""
    print("  >", linea)
    ser.write((linea + "\n").encode("utf-8"))
    limite = time.time() + plazo_s
    while time.time() < limite:
        r = ser.readline().decode("utf-8", errors="ignore").strip()
        if not r:
            continue
        print("  <", r)
        if r.startswith(FINALES):
            return r
    print("  (sin respuesta en {:.0f} s)".format(plazo_s))
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--puerto", required=True)
    parser.add_argument("--home", action="store_true", help="HOME_ALL (codo y muñeca)")
    parser.add_argument("--mover", action="store_true", help="vaivén de ±5° en la base")
    parser.add_argument("--consola", action="store_true", help="escribir comandos a mano")
    args = parser.parse_args()

    ser = serial.Serial(args.puerto, BAUDIOS, timeout=0.2)
    time.sleep(1.0)
    ser.reset_input_buffer()

    try:
        comando(ser, "PING")
        comando(ser, "STATE?")
        comando(ser, "TUNE?")

        if args.home:
            comando(ser, "HOME_ALL", plazo_s=120)
            comando(ser, "STATE?")

        if args.mover:
            for delta in (5, -5):
                comando(ser, "BASE_REL {}".format(delta), plazo_s=30)
            comando(ser, "STATE?")

        if args.consola:
            print("Consola: escribe comandos (HELP para la lista), vacío para salir.")
            while True:
                linea = input()
                if not linea.strip():
                    break
                comando(ser, linea.strip(), plazo_s=120)
    except KeyboardInterrupt:
        pass
    finally:
        ser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
