"""Arma data/obras.json: las inversiones (obras) con más presupuesto de cada entidad, del Detalle de inversiones del MEF.

Uso:  python -I scripts/obras.py data/raw/detalle-inversiones.csv 2026-10-24
(El CSV se baja con la API de datos abiertos del MEF: ver scripts/bajar.py)

La llave de cada entidad es `nivel|nombre|depto` con el nombre reducido a letras A-Z. Así "MAÑAZO" y "MA?AZO"
(un nombre mal codificado en el origen) quedan iguales.
"""
import csv
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TOP = 8
csv.field_size_limit(10_000_000)


def doblar(s: str, nivel: str = "") -> str:
    """Solo letras A-Z y espacios. Igual que `doblar` en src/core.mjs."""
    s = s.upper().split(" - ")[0]  # "BONGARA - JUMBILLA" -> "BONGARA"
    if nivel == "GR":  # "GOBIERNO REGIONAL DEL DEPARTAMENTO DE CUSCO" -> "GOBIERNO REGIONAL CUSCO"
        s = re.sub(r"DEL DEPARTAMENTO DE |DE LA PROVINCIA CONSTITUCIONAL DEL ", "", s)
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z ]", "", s)).strip()


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def main(ruta: str, corte: str):
    por = {}
    anio = None
    with open(ruta, encoding="utf-8", newline="") as h:
        for f in csv.DictReader(h):
            pim = num(f["PIM_ANIO_ACTUAL"]) or 0
            if pim <= 0:
                continue
            anio = f["ANIO_PROCESO"] or anio
            nivel = f["NIVEL"]
            clave = f"{nivel}|{doblar(f['ENTIDAD'], nivel)}" + (f"|{doblar(f['DEPARTAMENTO'])}" if nivel == "GL" else "")
            fisico = num(f["AVANCE_FISICO"]) if f["TIENE_AVAN_FISICO"] == "SI" else None
            por.setdefault(clave, []).append([
                f["CODIGO_UNICO"],
                re.sub(r"\s+", " ", f["NOMBRE_INVERSION"]).strip(),
                round(pim),
                round(num(f["DEV_ANIO_ACTUAL"]) or 0),
                fisico,
                num(f["AVANCE_EJECUCION"]),
                f["ULTIMO_DEVENGADO"],
                round(num(f["COSTO_ACTUALIZADO"]) or 0),
            ])
    salida = {"corte": corte, "anio": anio, "obras": {k: sorted(v, key=lambda o: -o[2])[:TOP] for k, v in por.items()}}
    destino = RAIZ / "data" / "obras.json"
    destino.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{destino}: {len(por):,} entidades, {round(destino.stat().st_size / 1e6, 1)} MB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
