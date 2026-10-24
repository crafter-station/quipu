"""Exporta data/quipu.db a data/quipu.json (lo que leen el CLI y la web).

Formato (montos en soles enteros):
  ejec:    [[id, nivel, pliego, nombre, depto, provincia, distrito], ...]
  mensual: {anio: {id: [pia, pim, dev_ene, ..., dev_dic]}}
  funcion: {anio: {id: {cod_funcion: [pim, dev_total, dev_hasta_mes_cerrado]}}}
El mes 0 de la base guarda el presupuesto anual (PIA/PIM); los meses 1-12 guardan el devengado de cada mes.
"""
import json
import sqlite3
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
corte = sys.argv[1]  # fecha de los datos, AAAA-MM-DD
mes_cerrado = int(sys.argv[2])  # último mes completo del año más reciente

c = sqlite3.connect(RAIZ / "data" / "quipu.db")
NIVEL = {"GOBIERNO NACIONAL": "GN", "GOBIERNOS REGIONALES": "GR", "GOBIERNOS LOCALES": "GL"}
ejec = [
    [i, NIVEL[n], p, nom, d, pr, di]
    for i, n, p, nom, d, pr, di in c.execute(
        "SELECT id, nivel, pliego, nombre, depto, provincia, distrito FROM ejecutora ORDER BY id"
    )
]

mensual: dict = {}
for anio, eid, mes, pia, pim, dev in c.execute(
    "SELECT anio, ejecutora_id, mes, sum(pia), sum(pim), sum(devengado) FROM gasto GROUP BY 1,2,3"
):
    fila = mensual.setdefault(str(anio), {}).setdefault(str(eid), [0] * 14)
    if mes == 0:
        fila[0], fila[1] = round(pia), round(pim)
    else:
        fila[1 + mes] = round(dev)

funcion: dict = {}
for anio, eid, f, mes, pim, dev in c.execute(
    "SELECT anio, ejecutora_id, funcion, mes, sum(pim), sum(devengado) FROM gasto GROUP BY 1,2,3,4"
):
    celda = funcion.setdefault(str(anio), {}).setdefault(str(eid), {}).setdefault(f, [0, 0, 0])
    if mes == 0:
        celda[0] = round(pim)
    else:
        celda[1] += round(dev)
        if mes <= mes_cerrado:
            celda[2] += round(dev)

salida = {
    "corte": corte,
    "mesCerrado": mes_cerrado,
    "anios": sorted(mensual),
    "funciones": dict(c.execute("SELECT cod, nombre FROM funcion")),
    "ejec": ejec,
    "mensual": mensual,
    "funcion": funcion,
}
destino = RAIZ / "data" / "quipu.json"
destino.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(destino, round(destino.stat().st_size / 1e6, 1), "MB")
