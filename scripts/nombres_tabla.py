"""Tabla ubigeo -> nombre con tilde para distritos y provincias.

Fuente: Wikidata (etiquetas en español, bajadas con la consulta de abajo en data/nombres/wd-raw.json),
cruzadas con los nombres del IGN por nombre + departamento (+ provincia si hay duda).
Regla de seguridad: se acepta el nombre de Wikidata solo si es el del IGN con tildes y/o mayúsculas;
si difiere en espacios, guiones u otras letras (Tambo Grande / Tambogrande) se deja el del IGN.

  SELECT ?l ?pl ?dl WHERE { ?i wdt:P31 wd:Q2179958 . ?i rdfs:label ?l . FILTER(LANG(?l)="es")
    ?i wdt:P131 ?p . ?p rdfs:label ?pl . FILTER(LANG(?pl)="es")
    OPTIONAL { ?p wdt:P131 ?d . ?d rdfs:label ?dl . FILTER(LANG(?dl)="es") } }

Entrada: data/nombres/shapes-ign.json = copia de public/data/shapes.json de crafter-research/peru-ordenado
(antes de aplicar las tildes), que trae los nombres del IGN por ubigeo.
Salida: data/nombres/ubigeo-nombres.json {ubigeo: nombre} (solo los que cambian) y el informe de lo que falta.
"""
import collections, json, re, unicodedata

sin_tilde = lambda s: "".join(c for c in unicodedata.normalize("NFD", s.replace("ñ", "\0").replace("Ñ", "\1")) if unicodedata.category(c) != "Mn").replace("\0", "ñ").replace("\1", "Ñ")
fold = lambda s: re.sub(r"[^a-zñ0-9]", "", sin_tilde(s).lower())
quitar = lambda s: re.sub(r"^(distrito|provincia( constitucional)?|departamento) del? ", "", s.strip(), flags=re.I)

sh = json.load(open("data/nombres/shapes-ign.json", encoding="utf8"))
dep = {d["id"]: fold(d["name"]) for d in sh["dep"]}
depids = {v: k for k, v in dep.items()}
prov = {p["id"]: fold(p["name"]) for p in sh["prov"]}
wd = json.load(open("data/nombres/wd-raw.json", encoding="utf8"))

dist_c, prov_c = collections.defaultdict(set), collections.defaultdict(set)
for l, p, d in wd:
    n, pf = quitar(l), fold(quitar(p))
    if pf in depids:
        dist_c[(fold(n), pf)].add((n, None))
    else:
        df = fold(quitar(d)) if d else ""
        dist_c[(fold(n), df)].add((n, pf))
        prov_c[(pf, df)].add(quitar(p))

def acepta(ign, wd_name):
    # solo tildes y mayúsculas: mismas letras, mismos espacios y guiones
    return sin_tilde(wd_name).lower() == ign.lower()

# Casos que Wikidata no resuelve; revisados a mano (tilde u ortografía oficial frente a un error del IGN).
MANUAL = {
    "050116": "Andrés Avelino Cáceres Dorregaray", "160603": "Padre Márquez", "120129": "San Agustín",
    "180105": "San Cristóbal", "220706": "San Cristóbal", "250201": "Raimondi", "0203": "Antonio Raimondi",
    "060506": "Santa Cruz de Toledo", "1001": "Huánuco", "1205": "Junín", "2209": "San Martín",
    "200806": "Rinconada Llícuar", "051101": "Vilcas Huamán", "0511": "Vilcas Huamán", "0508": "Páucar del Sara Sara",
}
cambios, sin_dato, rechazados = {}, [], []
for nivel, items in (("dist", sh["dist"]), ("prov", sh["prov"])):
    for x in items:
        d = dep[x["id"][:2]]
        if nivel == "dist":
            v = {n for n, pr in dist_c.get((fold(x["name"]), d), set()) if pr in (None, prov[x["id"][:4]])}
        else:
            v = prov_c.get((fold(x["name"]), d), set())
        if len(v) != 1:
            sin_dato.append((x["id"], x["name"], len(v))); continue
        n = next(iter(v))
        if not acepta(x["name"], n):
            rechazados.append((x["id"], x["name"], n)); continue
        if n != x["name"]:
            cambios[x["id"]] = n
cambios.update(MANUAL)
for k in MANUAL:
    sin_dato = [s for s in sin_dato if s[0] != k]; rechazados = [r for r in rechazados if r[0] != k]
json.dump(dict(sorted(cambios.items())), open("data/nombres/ubigeo-nombres.json", "w", encoding="utf8"), ensure_ascii=False, indent=0)
print(f"{len(cambios)} cambian · {len(rechazados)} rechazados por regla · {len(sin_dato)} sin dato de {len(sh['dist']) + len(sh['prov'])}")

