"""Limpia los gentilicios crudos de Wikipedia y agrega los de los 25 departamentos (a mano).
Entrada: data/nombres/gentilicios-wikipedia.json. Salida: data/nombres/gentilicios.json {ubigeo: gentilicio}.
Solo se guarda lo que la ficha del artículo dice, en minúscula y en masculino; si la ficha trae
varias formas se queda con la primera. Lo que no se pueda leer limpio se descarta."""
import json, re
crudo = json.load(open("data/nombres/gentilicios-wikipedia.json", encoding="utf8"))
DEP = {"01": "amazonense", "02": "ancashino", "03": "apurimeño", "04": "arequipeño", "05": "ayacuchano",
       "06": "cajamarquino", "07": "chalaco", "08": "cusqueño", "09": "huancavelicano", "10": "huanuqueño",
       "11": "iqueño", "12": "juninense", "13": "liberteño", "14": "lambayecano", "15": "limeño",
       "16": "loretano", "17": "madrediosense", "18": "moqueguano", "19": "pasqueño", "20": "piurano",
       "21": "puneño", "22": "sanmartinense", "23": "tacneño", "24": "tumbesino", "25": "ucayalino"}
OK = re.compile(r"^[a-záéíóúüñ]+(?: [a-záéíóúüñ]+)?$")
out = dict(DEP)
for ub, v in crudo.items():
    if not v: continue
    t = re.split(r"<br|<ref|\n|\{\{|<", v[0])[0]
    t = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", t)
    t = re.sub(r",\s*-?\w+\.?$|-\w{1,2}$|\s*/\s*\w+$", "", t).strip().lower()
    if OK.match(t) and len(t) >= 4:
        out[ub] = t
json.dump(dict(sorted(out.items())), open("data/nombres/gentilicios.json", "w", encoding="utf8"), ensure_ascii=False, indent=0)
print(len(out), "gentilicios (25 departamentos a mano)")
