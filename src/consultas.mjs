// Consultas de quipu como funciones puras que devuelven objetos. Las usan el CLI (--json) y el servidor MCP.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { crear, buscar, filtrar, avance, agregar, ranking, semaforo, porFuncion, obrasDe, normalizar, MESES, NIVELES } from "./core.mjs";

const datos = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

export function cargar() {
  const leer = (f) => JSON.parse(readFileSync(join(datos, f), "utf8"));
  return crear(leer("quipu.json"), existsSync(join(datos, "obras.json")) ? leer("obras.json") : null);
}

export class ErrorConsulta extends Error {}

const marco = (q, anio) => {
  const ultimo = q.datos.anios.at(-1);
  const a = String(anio ?? ultimo);
  if (!q.datos.anios.includes(a)) throw new ErrorConsulta(`Solo tengo datos de ${q.datos.anios.join(" y ")}.`);
  return { anio: a, hasta: a === ultimo ? q.mesCerrado : 12, previo: String(Number(a) - 1) };
};

/** Encuentra UNA entidad por texto; si hay duda, explica cuáles son los candidatos. */
export function elegir(q, texto, { nivel, depto } = {}) {
  const r = buscar(q, texto, { nivel, depto });
  if (r.length === 0) throw new ErrorConsulta(`No encontré ninguna entidad con "${texto}". Prueba con menos palabras.`);
  const t = normalizar(texto);
  const exactas = r.filter((e) => normalizar(e.nombre) === t);
  const unica = exactas.length === 1 ? exactas[0] : r.length === 1 ? r[0] : null;
  if (unica) return unica;
  const lista = r.slice(0, 8).map((e) => `${e.nombre} (${e.depto})`).join("; ");
  throw new ErrorConsulta(`Hay ${r.length} entidades con "${texto}". Sé más específica (agrega depto o nivel): ${lista}`);
}

export function consultaBuscar(q, texto, opts = {}) {
  return buscar(q, texto, opts).slice(0, opts.limit ?? 15).map((e) => ({ nombre: e.nombre, nivel: NIVELES[e.nivel], depto: e.depto, provincia: e.provincia }));
}

export function consultaAvance(q, { entidad, nivel, depto, anio } = {}) {
  const m = marco(q, anio);
  const ent = entidad ? elegir(q, entidad, { nivel, depto }) : null;
  const ents = ent ? [ent] : filtrar(q, { nivel, depto });
  const a = agregar(q, ents, m.anio, m.hasta);
  const p = q.datos.anios.includes(m.previo) ? agregar(q, ents, m.previo, m.hasta) : null;
  return {
    entidad: ent?.nombre ?? ["Todo el país", nivel && NIVELES[nivel.toUpperCase()], depto].filter(Boolean).join(" · "),
    anio: m.anio,
    hastaMes: MESES[m.hasta - 1],
    presupuestoSoles: Math.round(a.pim),
    gastadoSoles: Math.round(a.devengado),
    avancePct: a.pct === null ? null : Math.round(a.pct * 10) / 10,
    mismoMesAnioAnterior: p && { anio: m.previo, avancePct: p.pct === null ? null : Math.round(p.pct * 10) / 10 },
    semaforoRelativo: ent ? semaforo(q, ent, m.anio, m.hasta) : null,
    datosAl: q.datos.corte,
  };
}

export function consultaRanking(q, { nivel, depto, anio, peores = false, limit = 15 } = {}) {
  const m = marco(q, anio);
  let r = ranking(q, filtrar(q, { nivel, depto }), m.anio, m.hasta);
  if (peores) r = r.reverse();
  return r.slice(0, limit).map((x, i) => ({ puesto: i + 1, entidad: x.ent.nombre, depto: x.ent.depto, presupuestoSoles: Math.round(x.pim), avancePct: Math.round(x.pct * 10) / 10 }));
}

export function consultaFunciones(q, { entidad, nivel, depto, anio, limit = 10 }) {
  const m = marco(q, anio);
  const ent = elegir(q, entidad, { nivel, depto });
  return { entidad: ent.nombre, anio: m.anio, hastaMes: MESES[m.hasta - 1], funciones: porFuncion(q, ent, m.anio).slice(0, limit).map((f) => ({ funcion: f.nombre, presupuestoSoles: Math.round(f.pim), avancePct: f.pct === null ? null : Math.round(f.pct * 10) / 10 })) };
}

/** Obras con más presupuesto del año. Señala las que declaran poco avance físico y mucho gasto: son para VERIFICAR, no una acusación. */
export function consultaObras(q, { entidad, nivel, depto, limit = 8 }) {
  const ent = elegir(q, entidad, { nivel, depto });
  if (!q.obras) throw new ErrorConsulta("Este paquete no trae el archivo de obras (data/obras.json).");
  const obras = obrasDe(ent).slice(0, limit).map((o) => ({
    codigoInvierte: o.codigo,
    nombre: o.nombre,
    presupuestoAnioSoles: o.pim,
    gastadoAnioSoles: o.dev,
    avanceFisicoDeclaradoPct: o.fisico,
    ultimoMesConGasto: o.ultimoDev,
    paraVerificar: o.fisico !== null && o.pct !== null && o.pct >= 60 && o.fisico <= 20,
  }));
  return { entidad: ent.nombre, datosAl: q.obras.corte, nota: "Avance físico lo declara la propia entidad al MEF. 'paraVerificar' = gastó 60 % o más de su presupuesto del año pero declara 20 % o menos de avance físico; puede ser un retraso de registro, no necesariamente un problema.", obras };
}
