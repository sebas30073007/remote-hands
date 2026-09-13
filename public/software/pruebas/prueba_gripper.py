"""
Prueba del controlador del gripper conectado directo a una PC por USB-C.

Hace lo mismo que la NUC por COM5: pide el estado con "p" y manda
posiciones con "m <mm>". Sin opciones solo lee el estado. Con --mover, si el
gripper está calibrado, lo lleva a cada posición de --posiciones y espera a
que termine (busy=0). Con --consola puedes escribir cualquier comando a mano.

Uso:
    pip install pyserial
    python prueba_gripper.py --puerto COM5
    python prueba_gripper.py --puerto COM5 --mover --posiciones 60 20 40
    python prueba_gripper.py --puerto COM5 --consola
"""

import argparse
import re
import sys
import time

import serial

BAUDIOS = 115200
PATRON = re.compile(r"GRIPPER_STATE\s+mm=(?P<mm>-?[\d.]+).*busy=(?P<busy>[01])\s+calibrated=(?P<cal>[01])")


def leer_estado(ser, plazo_s=1.0):
    """Pide el estado y devuelve (mm, busy, calibrado) de la última línea GRIPPER_STATE."""
    ser.write(b"p\n")
    limite = time.time() + plazo_s
    estado = None
    while time.time() < limite:
        linea = ser.readline().decode("utf-8", errors="ignore").strip()
        m = PATRON.search(linea)
        if m:
            estado = (float(m.group("mm")), m.group("busy") == "1", m.group("cal") == "1")
            break
        elif linea:
            print("  <", linea)
    return estado


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--puerto", required=True)
    parser.add_argument("--mover", action="store_true")
    parser.add_argument("--posiciones", type=float, nargs="+", default=[60.0, 20.0, 40.0], help="mm, de 0 a 80")
    parser.add_argument("--consola", action="store_true", help="escribir comandos a mano")
    args = parser.parse_args()

    ser = serial.Serial(args.puerto, BAUDIOS, timeout=0.1)
    time.sleep(1.0)
    ser.reset_input_buffer()

    try:
        estado = leer_estado(ser)
        if estado is None:
            print("No llegó GRIPPER_STATE. ¿Es el puerto correcto y el firmware está corriendo?")
            return 1
        mm, busy, calibrado = estado
        print("Estado : {:.1f} mm · busy={} · calibrado={}".format(mm, int(busy), int(calibrado)))

        if args.mover:
            if not calibrado:
                print("Sin calibrar: los comandos de posición están bloqueados. Calibra con 'so' y 'sc'.")
                return 1
            for objetivo in args.posiciones:
                objetivo = max(0.0, min(80.0, objetivo))
                print("  > m {:.1f}".format(objetivo))
                ser.write("m {:.1f}\n".format(objetivo).encode("utf-8"))
                t0 = time.time()
                time.sleep(0.3)
                while True:
                    estado = leer_estado(ser)
                    if estado and not estado[1]:
                        print("    llegó a {:.1f} mm en {:.2f} s".format(estado[0], time.time() - t0))
                        break
                    if time.time() - t0 > 10:
                        print("    no terminó en 10 s (¿stall?)")
                        break
                    time.sleep(0.25)

        if args.consola:
            print("Consola: escribe comandos (? para la lista), vacío para salir.")
            while True:
                linea = input()
                if not linea.strip():
                    break
                ser.write((linea.strip() + "\n").encode("utf-8"))
                time.sleep(0.3)
                while ser.in_waiting:
                    print("  <", ser.readline().decode("utf-8", errors="ignore").strip())
    except KeyboardInterrupt:
        pass
    finally:
        ser.write(b"s\n")
        ser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
