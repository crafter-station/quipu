"""Baja de los datos abiertos del MEF lo que quipu necesita (año actual, año anterior e inversiones).

Uso:  python -I scripts/bajar.py [AÑO]        (por defecto, el año en curso)
Deja en data/raw/: AAAA-Gasto-*.zip (año actual y anterior) y detalle-inversiones.csv

Los nombres de archivo no siguen un patrón fijo (Diario/Mensual), así que se leen de la API del portal.
"""
import json
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
UA = {"User-Agent": "quipu/0.1 (+https://github.com/crafter-station/quipu)"}
DETALLE = "https://datosabiertos.mef.gob.pe/Rest/PortalWebDatasetDetalle/v1.0/getDatasetDetalle"
DUMP = "https://api.datosabiertos.mef.gob.pe/DatosAbiertos/v1/dump?id={id}"
INVERSIONES = "f9cc4ba0-931a-4b70-86c9-eacbd8c68596"


def recursos() -> dict:
    pedido = urllib.request.Request(DETALLE, json.dumps({"dataset": "presupuesto-y-ejecucion-de-gasto"}).encode(), {**UA, "Content-Type": "application/json"})
    with urllib.request.urlopen(pedido, timeout=60) as r:
        d = json.load(r)
    if d.get("status") != "0000":
        raise RuntimeError(f"El portal del MEF respondió {d.get('status')}")
    return {x["resource_title"]: x["resource_download_url_zip"] for x in d["resources"] if x["resource_download_url_zip"]}


def descargar(url: str, destino: Path):
    if destino.exists():
        destino.unlink()
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r, open(destino, "wb") as f:
        while bloque := r.read(1 << 20):
            f.write(bloque)
    print(f"{destino.name}: {destino.stat().st_size / 1e6:.0f} MB", flush=True)


def elegir(rec: dict, anio: int):
    """Para cada año, el archivo diario si existe; si no, el mensual."""
    for sufijo in ("Gasto-Diario.csv", "Gasto-Mensual.csv"):
        if f"{anio}-{sufijo}" in rec:
            return rec[f"{anio}-{sufijo}"]
    raise RuntimeError(f"No encontré el gasto de {anio} en el portal del MEF")


def inversiones(destino: Path, intentos: int = 40, espera: float = 15.0):
    url = DUMP.format(id=INVERSIONES)
    for _ in range(intentos):
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r:
            cuerpo, tipo = r.read(), r.headers.get("Content-Type", "")
        if "csv" in tipo.lower():
            destino.write_bytes(cuerpo)
            print(f"{destino.name}: {len(cuerpo) / 1e6:.0f} MB", flush=True)
            return
        time.sleep(espera)  # el MEF arma el CSV en segundo plano: "Creando Consulta"
    raise TimeoutError("El MEF no terminó de armar el detalle de inversiones")


def main():
    anio = int(sys.argv[1]) if len(sys.argv) > 1 else date.today().year
    RAW.mkdir(parents=True, exist_ok=True)
    rec = recursos()
    for a in (anio, anio - 1):
        url = elegir(rec, a)
        descargar(url, RAW / Path(url).name)
    inversiones(RAW / "detalle-inversiones.csv")


if __name__ == "__main__":
    main()
