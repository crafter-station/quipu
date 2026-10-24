#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { crear, buscar, filtrar, avance, agregar, ranking, semaforo, porFuncion, soles, pct, MESES, NIVELES } from "./core.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const AYUDA = `quipu — ¿cuánto del presupuesto público ya se gastó?

Uso:
  quipu avance [entidad]       avance del gasto (sin entidad: todo el país)
  quipu buscar <texto>         encuentra entidades por nombre, provincia o distrito
  quipu ranking                entidades ordenadas por avance
  quipu funciones <entidad>    en qué se gasta (educación, salud, transporte...)

Opciones:
  --nivel gn|gr|gl    gobierno nacional, regional o local
  --depto <nombre>    filtra por departamento (ej. huancavelica)
  --anio 2025|2026    año (por defecto el más reciente)
  --peores            en ranking, las de menos avance primero
  --limit <n>         cuántas filas mostrar (por defecto 15)
  --json              salida para programas y agentes de IA

Datos: Consulta Amigable de Gasto del MEF (datos abiertos). Avance = devengado / PIM.
No es un sitio oficial del Estado.`;

function leerArgs(argv) {
  const a = { _: [], flags: {} };
  const conValor = new Set(["nivel", "depto", "anio", "limit"]);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const k = argv[i].slice(2);
      a.flags[k] = conValor.has(k) ? argv[++i] : true;
    } else a._.push(argv[i]);
  }
  return a;
}

const { _: pos, flags } = leerArgs(process.argv.slice(2));
const cmd = pos.shift();
if (!cmd || cmd === "ayuda" || flags.help) {
  console.log(AYUDA);
  process.exit(0);
}

const q = crear(JSON.parse(readFileSync(join(raiz, "data", "quipu.json"), "utf8")));
const anio = flags.anio ?? q.datos.anios.at(-1);
const hasta = anio === q.datos.anios.at(-1) ? q.mesCerrado : 12;
const limit = Number(flags.limit ?? 15);
const salida = (obj, texto) => (flags.json ? console.log(JSON.stringify(obj, null, 2)) : console.log(texto));
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const padL = (s, n) => String(s).padStart(n);
const SEM = { verde: "🟢", ambar: "🟡", rojo: "🔴" };
const hastaTxt = `${MESES[hasta - 1]} ${anio}`;
const previo = String(Number(anio) - 1);
const hayPrevio = q.datos.anios.includes(previo);

function elegir(texto) {
  const r = buscar(q, texto, { nivel: flags.nivel, depto: flags.depto });
  if (r.length === 0) {
    console.error(`No encontré ninguna entidad con "${texto}". Prueba con menos palabras: quipu buscar ${texto.split(" ")[0]}`);
    process.exit(1);
  }
  const exacta = r.filter((e) => e.nivel !== "GN" && e.nombre.includes(texto.toUpperCase()));
  if (r.length > 1 && exacta.length !== 1) {
    console.error(`Hay ${r.length} entidades con "${texto}". Sé más específica (agrega --depto o --nivel):`);
    r.slice(0, 10).forEach((e) => console.error(`  - ${e.nombre} (${e.depto})`));
    process.exit(1);
  }
  return exacta.length === 1 ? exacta[0] : r[0];
}

if (cmd === "buscar") {
  const r = buscar(q, pos.join(" "), { nivel: flags.nivel, depto: flags.depto }).slice(0, limit);
  salida(r.map((e) => ({ nombre: e.nombre, nivel: e.nivel, depto: e.depto, provincia: e.provincia })), r.map((e) => `${pad(NIVELES[e.nivel], 17)} ${pad(e.nombre, 62)} ${e.depto}`).join("\n") || "Sin resultados.");
} else if (cmd === "avance") {
  const ents = pos.length ? [elegir(pos.join(" "))] : filtrar(q, { nivel: flags.nivel, depto: flags.depto });
  const titulo = pos.length ? ents[0].nombre : ["Todo el país", flags.nivel && NIVELES[flags.nivel.toUpperCase()], flags.depto].filter(Boolean).join(" · ");
  const a = agregar(q, ents, anio, hasta);
  const p = hayPrevio ? agregar(q, ents, previo, hasta) : null;
  const sem = pos.length ? semaforo(q, ents[0], anio, hasta) : null;
  const obj = { entidad: titulo, anio, hasta: hastaTxt, presupuesto: a.pim, gastado: a.devengado, avancePct: a.pct, mismoMesAnioAnterior: p && { anio: previo, avancePct: p.pct, gastado: p.devengado }, semaforo: sem, corte: q.datos.corte };
  let t = `${titulo}\n${anio}, hasta ${hastaTxt}\n\n`;
  t += `Presupuesto del año   ${soles(a.pim)}\nGastado               ${soles(a.devengado)}\nAvance                ${pct(a.pct)}\n`;
  if (p) t += `Año pasado, mismo mes ${pct(p.pct)}  (${previo}, hasta ${MESES[hasta - 1]})\n`;
  if (sem) t += `\n${SEM[sem.color]} Más avance que el ${sem.mejorQue} % de sus pares (puesto ${sem.posicion} de ${sem.de} del mismo nivel)\n`;
  t += `\nDatos del MEF al ${q.datos.corte}. El mes en curso no se cuenta hasta que termina.`;
  salida(obj, t);
} else if (cmd === "ranking") {
  const ents = filtrar(q, { nivel: flags.nivel, depto: flags.depto });
  let r = ranking(q, ents, anio, hasta);
  if (flags.peores) r = r.reverse();
  r = r.slice(0, limit);
  salida(r.map((x) => ({ entidad: x.ent.nombre, depto: x.ent.depto, presupuesto: x.pim, avancePct: x.pct })), `Avance a ${hastaTxt} (entidades con presupuesto ≥ S/ 1 millón)\n\n` + r.map((x, i) => `${padL(i + 1, 3)}  ${padL(pct(x.pct), 8)}  ${padL(soles(x.pim), 24)}  ${pad(x.ent.nombre, 55)} ${x.ent.depto}`).join("\n"));
} else if (cmd === "funciones") {
  const ent = elegir(pos.join(" "));
  const f = porFuncion(q, ent, anio).slice(0, limit);
  salida(f, `${ent.nombre} — ${anio}, avance hasta ${hastaTxt}\n\n` + f.map((x) => `${pad(x.nombre, 34)} ${padL(soles(x.pim), 24)}  ${padL(pct(x.pct), 8)}`).join("\n"));
} else {
  console.error(`No conozco "${cmd}".\n\n${AYUDA}`);
  process.exit(1);
}
