"""Gentilicios de distritos y provincias desde la ficha de cada artículo de Wikipedia (es).
Pide 50 artículos por consulta y espera entre consultas. Solo guarda lo que la ficha dice (campo
`gentilicio`); no se genera nada por reglas. Salida: data/nombres/gentilicios-wikipedia.json
{ubigeo: [crudo, ...]} (resumible)."""
import json, re, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path
H = {"User-Agent": "quipu-research/0.1 (github.com/crafter-station/quipu)"}
SAL = Path("data/nombres/gentilicios-wikipedia.json")
sh = json.load(open("data/nombres/shapes-ign.json", encoding="utf8"))
acc = json.load(open("data/nombres/ubigeo-nombres.json", encoding="utf8"))
prov = {p["id"]: acc.get(p["id"], p["name"]) for p in sh["prov"]}
items = [(p["id"], "Provincia de " + acc.get(p["id"], p["name"])) for p in sh["prov"]]
items += [(d["id"], "Distrito de " + acc.get(d["id"], d["name"])) for d in sh["dist"]]
hecho = json.load(open(SAL, encoding="utf8")) if SAL.exists() else {}
def get(titles):
    p = {"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "titles": "|".join(titles), "redirects": 1, "format": "json", "formatversion": 2, "maxlag": 5}
    for espera in (30, 60, 120, 240, 480):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request("https://es.wikipedia.org/w/api.php?" + urllib.parse.urlencode(p), headers=H), timeout=90))
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            print("429, espero", espera, flush=True); time.sleep(espera)
    raise SystemExit("429 persistente")
pend = [i for i in items if i[0] not in hecho]
for k in range(0, len(pend), 50):
    lote = pend[k:k + 50]
    r = get([t for _, t in lote])
    q = r["query"]
    norm = {x["from"]: x["to"] for x in q.get("normalized", [])}
    red = {x["from"]: x["to"] for x in q.get("redirects", [])}
    texto = {pg["title"]: (pg.get("revisions") or [{}])[0].get("slots", {}).get("main", {}).get("content", "") for pg in q["pages"]}
    for ub, t in lote:
        t2 = red.get(norm.get(t, t), norm.get(t, t))
        m = re.search(r"\|\s*gentilicio\s*=\s*([^\n|]+)", texto.get(t2, ""), re.I)
        hecho[ub] = [m.group(1).strip()] if m and m.group(1).strip() else []
    SAL.write_text(json.dumps(hecho, ensure_ascii=False), encoding="utf8")
    print(k + len(lote), "/", len(pend), flush=True)
    time.sleep(6)
print("listo", sum(1 for v in hecho.values() if v), "con gentilicio de", len(hecho))
