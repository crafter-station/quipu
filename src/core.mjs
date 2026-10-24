// Núcleo de quipu: lo usan el CLI y la web, para que ambos den las mismas cifras.
// Avance = devengado acumulado / PIM (presupuesto institucional modificado) del año.

export const NIVELES = { GN: "Gobierno Nacional", GR: "Gobierno Regional", GL: "Gobierno Local" };

export function normalizar(s) {
  return String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function crear(datos) {
  const porEntidad = new Map();
  for (const [id, nivel, pliego, ejecutora, depto, provincia, distrito] of datos.ejec) {
    // Los gobiernos locales no traen pliego: la entidad es la municipalidad (su ejecutora).
    const nombre = nivel === "GL" ? ejecutora : pliego;
    const k = nivel === "GL" ? `${nivel}|${nombre}|${depto}|${provincia}|${distrito}` : `${nivel}|${nombre}`;
    if (!porEntidad.has(k)) {
      porEntidad.set(k, { clave: k, nivel, nombre, depto, provincia, distrito, ids: [], buscable: normalizar(`${nombre} ${depto} ${provincia} ${distrito}`) });
    }
    porEntidad.get(k).ids.push(id);
  }
  return { datos, entidades: [...porEntidad.values()], mesCerrado: datos.mesCerrado };
}

/** Presupuesto y devengado por mes de una entidad en un año. dev[0] = enero. */
export function serie(q, ent, anio) {
  const filas = q.datos.mensual[anio] ?? {};
  const r = { pia: 0, pim: 0, dev: Array(12).fill(0) };
  for (const id of ent.ids) {
    const f = filas[id];
    if (!f) continue;
    r.pia += f[0];
    r.pim += f[1];
    for (let m = 0; m < 12; m++) r.dev[m] += f[2 + m];
  }
  return r;
}

export const suma = (xs, hasta) => xs.slice(0, hasta).reduce((a, b) => a + b, 0);

/** Avance de una entidad hasta el mes `hasta` (1-12) de un año. null si no tiene presupuesto. */
export function avance(q, ent, anio, hasta = q.mesCerrado) {
  const s = serie(q, ent, anio);
  const dev = suma(s.dev, hasta);
  return { anio, hasta, pia: s.pia, pim: s.pim, devengado: dev, pct: s.pim > 0 ? (100 * dev) / s.pim : null, porMes: s.dev };
}

/** Total de un conjunto de entidades (por ejemplo, todo el país o todos los gobiernos locales). */
export function agregar(q, ents, anio, hasta = q.mesCerrado) {
  const t = { anio, hasta, pia: 0, pim: 0, devengado: 0, pct: null, porMes: Array(12).fill(0) };
  for (const e of ents) {
    const a = avance(q, e, anio, hasta);
    t.pia += a.pia;
    t.pim += a.pim;
    t.devengado += a.devengado;
    a.porMes.forEach((v, i) => (t.porMes[i] += v));
  }
  t.pct = t.pim > 0 ? (100 * t.devengado) / t.pim : null;
  return t;
}

export function buscar(q, texto, { nivel, depto } = {}) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  return filtrar(q, { nivel, depto }).filter((e) => palabras.every((p) => e.buscable.includes(p)));
}

export function filtrar(q, { nivel, depto } = {}) {
  const d = depto ? normalizar(depto) : null;
  const n = nivel ? nivel.toUpperCase() : null;
  return q.entidades.filter((e) => (!n || e.nivel === n) && (!d || normalizar(e.depto) === d));
}

/** Ranking por avance entre entidades con presupuesto de al menos `minPim` soles. */
export function ranking(q, ents, anio, hasta = q.mesCerrado, minPim = 1_000_000) {
  return ents
    .map((e) => ({ ent: e, ...avance(q, e, anio, hasta) }))
    .filter((r) => r.pct !== null && r.pim >= minPim)
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Semáforo RELATIVO: compara a la entidad con sus pares del mismo nivel de gobierno.
 * Verde: está en el tercio de más avance. Rojo: en el tercio de menos avance. No es un juicio sobre la gestión:
 * cada entidad tiene proyectos de distinto ritmo; es una señal para mirar con más detalle.
 */
export function semaforo(q, ent, anio, hasta = q.mesCerrado) {
  const pares = ranking(q, filtrar(q, { nivel: ent.nivel }), anio, hasta);
  const i = pares.findIndex((r) => r.ent.clave === ent.clave);
  if (i < 0) return null;
  const posicion = i + 1;
  const mejorQue = pares.length > 1 ? Math.round((100 * (pares.length - posicion)) / (pares.length - 1)) : 100;
  const color = posicion <= pares.length / 3 ? "verde" : posicion > (2 * pares.length) / 3 ? "rojo" : "ambar";
  return { color, posicion, de: pares.length, mejorQue };
}

/** Gasto por función (educación, salud...) de una entidad: presupuesto, devengado del año y avance al mes cerrado. */
export function porFuncion(q, ent, anio) {
  const acum = {};
  for (const id of ent.ids) {
    for (const [f, [pim, dev, devCerrado]] of Object.entries(q.datos.funcion[anio]?.[id] ?? {})) {
      const a = (acum[f] ??= { pim: 0, dev: 0, devCerrado: 0 });
      a.pim += pim;
      a.dev += dev;
      a.devCerrado += devCerrado;
    }
  }
  return Object.entries(acum)
    .map(([cod, a]) => ({ cod, nombre: q.datos.funciones[cod] ?? cod, ...a, pct: a.pim > 0 ? (100 * a.devCerrado) / a.pim : null }))
    .filter((f) => f.pim > 0 || f.dev > 0)
    .sort((a, b) => b.pim - a.pim);
}

export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function soles(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return `S/ ${(n / 1e9).toFixed(2).replace(".", ",")} mil millones`;
  if (a >= 1e6) return `S/ ${(n / 1e6).toFixed(1).replace(".", ",")} millones`;
  return `S/ ${Math.round(n).toLocaleString("es-PE")}`;
}

export const pct = (x) => (x === null || x === undefined ? "sin dato" : `${x.toFixed(1).replace(".", ",")} %`);
