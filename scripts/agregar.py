"""Agrega la Consulta Amigable de Gasto (MEF) en una base SQLite chica.

Lee cada zip en streaming (el CSV descomprimido pesa 8-10 GB) y suma los montos por
(año, mes, ejecutora, función, categoría de gasto). Las ejecutoras van en una tabla aparte.

Uso:  python -I scripts/agregar.py data/raw/2026-Gasto-Diario.zip data/raw/2025-Gasto-Mensual.zip
"""
import csv
import io
import sqlite3
import sys
import time
import zipfile
from collections import defaultdict
from pathlib import Path

MONTOS = ["MONTO_PIA", "MONTO_PIM", "MONTO_CERTIFICADO", "MONTO_COMPROMETIDO", "MONTO_DEVENGADO", "MONTO_GIRADO"]
DB = Path(__file__).resolve().parent.parent / "data" / "quipu.db"


def num(s: str) -> float:
    try:
        return float(s)
    except ValueError:
        return 0.0


def agregar(zip_path: str, acum, ejecutoras, funciones):
    t0 = time.time()
    with zipfile.ZipFile(zip_path) as z:
        info = z.infolist()[0]
        with z.open(info) as h:
            lector = csv.DictReader(io.TextIOWrapper(h, encoding="utf-8", errors="replace", newline=""))
            n = 0
            for f in lector:
                ek = (f["NIVEL_GOBIERNO"], f["PLIEGO"], f["SEC_EJEC"])
                if ek not in ejecutoras:
                    ejecutoras[ek] = (
                        f["NIVEL_GOBIERNO_NOMBRE"], f["SECTOR_NOMBRE"], f["PLIEGO_NOMBRE"], f["EJECUTORA_NOMBRE"],
                        f["DEPARTAMENTO_EJECUTORA"], f["DEPARTAMENTO_EJECUTORA_NOMBRE"],
                        f["PROVINCIA_EJECUTORA_NOMBRE"], f["DISTRITO_EJECUTORA_NOMBRE"],
                    )
                funciones[f["FUNCION"]] = f["FUNCION_NOMBRE"]
                k = (int(f["ANO_EJE"]), int(f["MES_EJE"]), ek, f["FUNCION"], f["CATEGORIA_GASTO_NOMBRE"])
                a = acum[k]
                for i, m in enumerate(MONTOS):
                    a[i] += num(f[m])
                n += 1
                if n % 1_000_000 == 0:
                    print(f"  {zip_path}: {n:,} filas, {time.time() - t0:.0f}s, {len(acum):,} grupos", flush=True)
    print(f"{zip_path}: {n:,} filas en {time.time() - t0:.0f}s", flush=True)


def main(zips):
    acum = defaultdict(lambda: [0.0] * len(MONTOS))
    ejecutoras, funciones = {}, {}
    for z in zips:
        agregar(z, acum, ejecutoras, funciones)
    DB.parent.mkdir(exist_ok=True)
    if DB.exists():
        DB.unlink()
    c = sqlite3.connect(DB)
    c.executescript("""
    CREATE TABLE ejecutora(id INTEGER PRIMARY KEY, nivel_cod TEXT, pliego_cod TEXT, sec_ejec TEXT,
      nivel TEXT, sector TEXT, pliego TEXT, nombre TEXT, depto_cod TEXT, depto TEXT, provincia TEXT, distrito TEXT);
    CREATE TABLE funcion(cod TEXT PRIMARY KEY, nombre TEXT);
    CREATE TABLE gasto(anio INT, mes INT, ejecutora_id INT, funcion TEXT, categoria TEXT,
      pia REAL, pim REAL, certificado REAL, comprometido REAL, devengado REAL, girado REAL);
    """)
    ids = {}
    for i, (ek, v) in enumerate(ejecutoras.items(), 1):
        ids[ek] = i
        c.execute("INSERT INTO ejecutora VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (i, ek[0], ek[1], ek[2], v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7]))
    c.executemany("INSERT INTO funcion VALUES (?,?)", funciones.items())
    c.executemany(
        "INSERT INTO gasto VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ((k[0], k[1], ids[k[2]], k[3], k[4], *v) for k, v in acum.items()),
    )
    c.execute("CREATE INDEX gasto_idx ON gasto(anio, mes, ejecutora_id)")
    c.commit()
    c.close()
    print(f"Listo: {len(acum):,} filas de gasto, {len(ejecutoras):,} ejecutoras -> {DB}")


if __name__ == "__main__":
    main(sys.argv[1:])
