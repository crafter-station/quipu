"""Gasto municipal por UBIGEO (dep+prov+dist del ejecutor), para cruzar con mapas por distrito.

Por cada ubigeo y año suma, solo gobiernos locales: PIM y devengado mensual, en total y en
genérica 6 (adquisición de activos no financieros = inversión). Mes 0 = PIA/PIM; meses 1-12 = devengado del mes.
Las provincias reportan bajo el distrito capital (misma convención que peru-ordenado).

Uso:  python -I scripts/municipal_ubigeo.py data/raw/2026-Gasto-Diario.zip data/raw/2025-Gasto-Mensual.zip
Salida: data/municipal-ubigeo.json  {"2026": {"140101": {"inv":[pim,d1..d12], "tot":[pim,d1..d12]}}}
"""
import csv, io, json, sys, time, zipfile
from collections import defaultdict
from pathlib import Path

SAL = Path(__file__).resolve().parent.parent / "data" / "municipal-ubigeo.json"
num = lambda s: float(s) if s else 0.0

def leer(ruta, acum):
    t0 = time.time()
    with zipfile.ZipFile(ruta) as z, z.open(z.infolist()[0]) as h:
        for n, f in enumerate(csv.DictReader(io.TextIOWrapper(h, encoding="utf-8", errors="replace", newline="")), 1):
            if f["NIVEL_GOBIERNO"] != "M":
                continue
            ub = f["DEPARTAMENTO_EJECUTORA"].zfill(2) + f["PROVINCIA_EJECUTORA"].zfill(2) + f["DISTRITO_EJECUTORA"].zfill(2)
            mes = int(f["MES_EJE"])
            a = acum[f["ANO_EJE"]][ub]
            pim, dev = num(f["MONTO_PIM"]), num(f["MONTO_DEVENGADO"])
            for clave in ("tot", "inv") if f["GENERICA"] == "6" else ("tot",):
                v = a.setdefault(clave, [0.0] * 13)
                if mes == 0:
                    v[0] += pim
                else:
                    v[mes] += dev
            if n % 2_000_000 == 0:
                print(Path(ruta).name, n, f"{time.time() - t0:.0f}s", flush=True)

acum = defaultdict(lambda: defaultdict(dict))
for ruta in sys.argv[1:]:
    leer(ruta, acum)
salida = {a: {ub: {k: [round(x) for x in v] for k, v in d.items()} for ub, d in m.items()} for a, m in acum.items()}
SAL.write_text(json.dumps(salida, separators=(",", ":")), encoding="utf-8")
print("listo", {a: len(m) for a, m in salida.items()})
