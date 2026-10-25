#!/usr/bin/env node
import { cargar, consultaAvance, consultaBuscar, consultaRanking, consultaFunciones, consultaObras, consultaFicha, ErrorConsulta } from "./consultas.mjs";
import { soles, pct } from "./core.mjs";

const AYUDA = `quipu — ¿cuánto del presupuesto público ya se gastó?

Uso:
  quipu avance [entidad]       avance del gasto (sin entidad: todo el país)
  quipu buscar <texto>         encuentra entidades por nombre, provincia o distrito
  quipu ranking                entidades ordenadas por avance
  quipu funciones <entidad>    en qué se gasta (educación, salud, transporte...)
  quipu ficha <distrito>       las cinco capas de un distrito, como hilos de un quipu
  quipu obras <entidad>        obras con más presupuesto del año y su avance declarado
  quipu mcp                    servidor MCP para agentes de IA (stdio)

Opciones:
  --nivel gn|gr|gl    gobierno nacional, regional o local
  --depto <nombre>    filtra por departamento (ej. huancavelica)
  --anio 2025|2026    año (por defecto el más reciente)
  --peores            en ranking, las de menos avance primero
  --limit <n>         cuántas filas mostrar (por defecto 15)
  --json              salida para programas y agentes de IA

Datos: Consulta Amigable de Gasto e Invierte.pe del MEF (datos abiertos). Avance = devengado / PIM.
No es un sitio oficial del Estado.`;

const SEM = { verde: "🟢", ambar: "🟡", rojo: "🔴" };
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const padL = (s, n) => String(s).padStart(n);

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
if (cmd === "mcp") {
  await import("./mcp.mjs");
} else {
  const texto = pos.join(" ");
  const opts = { nivel: flags.nivel, depto: flags.depto, anio: flags.anio, peores: !!flags.peores, limit: flags.limit ? Number(flags.limit) : undefined };
  const salida = (obj, formato) => console.log(flags.json ? JSON.stringify(obj, null, 2) : formato(obj));
  try {
    const q = cargar();
    if (cmd === "buscar") {
      salida(consultaBuscar(q, texto, opts), (r) => r.map((e) => `${pad(e.nivel, 17)} ${pad(e.nombre, 62)} ${e.depto}`).join("\n") || "Sin resultados.");
    } else if (cmd === "avance") {
      salida(consultaAvance(q, { entidad: texto || undefined, ...opts }), (a) => {
        let t = `${a.entidad}\n${a.anio}, hasta ${a.hastaMes} ${a.anio}\n\n`;
        t += `Presupuesto del año   ${soles(a.presupuestoSoles)}\nGastado               ${soles(a.gastadoSoles)}\nAvance                ${pct(a.avancePct)}\n`;
        if (a.mismoMesAnioAnterior) t += `Año pasado, mismo mes ${pct(a.mismoMesAnioAnterior.avancePct)}  (${a.mismoMesAnioAnterior.anio}, hasta ${a.hastaMes})\n`;
        const s = a.semaforoRelativo;
        if (s) t += `\n${SEM[s.color]} Más avance que el ${s.mejorQue} % de sus pares (puesto ${s.posicion} de ${s.de} del mismo nivel)\n`;
        return t + `\nDatos del MEF al ${a.datosAl}. El mes en curso no se cuenta hasta que termina.`;
      });
    } else if (cmd === "ficha") {
      salida(consultaFicha(q, texto, opts), (f) => {
        // Un quipu en texto: el cordón arriba y un hilo por capa; más largo = más arriba frente a los demás distritos.
        const ALTO = 8, ANCHO = 15, SANGRIA = "  ";
        const hilo = (c) => (c.largo === null ? 1 : 2 + Math.round(c.largo * (ALTO - 2)));
        const alto = Math.max(...f.capas.map(hilo));
        const fila = (celda) => SANGRIA + f.capas.map(celda).join("");
        const lineas = [SANGRIA + "━".repeat(ANCHO * f.capas.length - 2)];
        for (let y = 1; y <= alto; y++) {
          lineas.push(fila((c) => { const n = hilo(c); return pad(y < n ? "│" : y === n ? (c.largo === null ? "○" : "●") : "", ANCHO); }));
        }
        lineas.push(fila((c) => pad(c.texto, ANCHO)));
        lineas.push(fila((c) => pad(c.etiqueta, ANCHO)));
        return [
          f.distrito,
          `${f.provincia}, ${f.departamento}`,
          ...(f.habitantes ? [`${f.habitantes.toLocaleString("es-PE")} habitantes · ${f.densidad} por km² (INEI, proyección 2025)`] : []),
          "",
          ...lineas,
          "",
          "Más largo el hilo, más arriba está frente a los demás distritos del país.",
          `Datos al ${f.datosAl}. Gasto = devengado / presupuesto de inversión del año.`,
        ].join("\n");
      });
    } else if (cmd === "ranking") {
      salida(consultaRanking(q, opts), (r) => `Entidades con presupuesto ≥ S/ 1 millón\n\n` + r.map((x) => `${padL(x.puesto, 3)}  ${padL(pct(x.avancePct), 8)}  ${padL(soles(x.presupuestoSoles), 24)}  ${pad(x.entidad, 55)} ${x.depto}`).join("\n"));
    } else if (cmd === "funciones") {
      salida(consultaFunciones(q, { entidad: texto, ...opts }), (r) => `${r.entidad} — ${r.anio}, avance hasta ${r.hastaMes}\n\n` + r.funciones.map((x) => `${pad(x.funcion, 34)} ${padL(soles(x.presupuestoSoles), 24)}  ${padL(pct(x.avancePct), 8)}`).join("\n"));
    } else if (cmd === "obras") {
      salida(consultaObras(q, { entidad: texto, ...opts }), (r) =>
        `${r.entidad} — obras con más presupuesto este año (datos al ${r.datosAl})\n\n` +
        r.obras.map((o) => `${o.paraVerificar ? "⚠ " : "  "}${pad(o.nombre, 78)}\n   presupuesto ${soles(o.presupuestoAnioSoles)} · gastado ${soles(o.gastadoAnioSoles)} · avance físico declarado ${o.avanceFisicoDeclaradoPct === null ? "sin dato" : pct(o.avanceFisicoDeclaradoPct)} · cód. ${o.codigoInvierte}`).join("\n") +
        `\n\n⚠ = para verificar (gastó ≥60 % del presupuesto del año y declara ≤20 % de avance físico). ${r.nota}`);
    } else {
      console.error(`No conozco "${cmd}".\n\n${AYUDA}`);
      process.exit(1);
    }
  } catch (e) {
    if (!(e instanceof ErrorConsulta)) throw e;
    console.error(e.message);
    process.exit(1);
  }
}
