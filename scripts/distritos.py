"""Tabla compacta de distritos para `quipu ficha`: nombre, provincia, departamento e índice digital por ubigeo.

Uso:  python -I scripts/distritos.py
Lee data/nombres/shapes-ign.json (IGN 2020 + muniscan) y ubigeo-nombres.json (tildes). Salida: data/distritos.json
"""
import json
from pathlib import Path

D = Path(__file__).resolve().parent.parent / "data"
s = json.loads((D / "nombres" / "shapes-ign.json").read_text(encoding="utf8"))
tildes = json.loads((D / "nombres" / "ubigeo-nombres.json").read_text(encoding="utf8"))
nombre = lambda x: tildes.get(x["id"], x["name"])
dep = {x["id"]: nombre(x) for x in s["dep"]}
prov = {x["id"]: nombre(x) for x in s["prov"]}
out = {
    x["id"]: [nombre(x), prov.get(x["id"][:4], ""), dep.get(x["id"][:2], ""), x.get("digital")]
    for x in s["dist"]
}
(D / "distritos.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
print(len(out), "distritos", out["090101"])
