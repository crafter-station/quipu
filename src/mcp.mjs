// Servidor MCP mínimo de quipu (stdio, JSON-RPC por líneas, sin dependencias).
// Config en un cliente MCP: { "command": "npx", "args": ["-y", "@lizethriveros/quipu", "mcp"] }
import { createInterface } from "node:readline";
import { cargar, consultaAvance, consultaBuscar, consultaRanking, consultaFunciones, consultaObras, consultaFicha, ErrorConsulta } from "./consultas.mjs";

const q = cargar();
const filtros = {
  nivel: { type: "string", enum: ["gn", "gr", "gl"], description: "Gobierno nacional, regional o local" },
  depto: { type: "string", description: "Departamento, ej. huancavelica" },
  anio: { type: "string", enum: q.datos.anios, description: "Año (por defecto el más reciente)" },
};
const entidad = { type: "string", description: "Nombre de la entidad, ej. 'municipalidad distrital de acoria'. Usa buscar_entidad si no estás segura." };

const HERRAMIENTAS = [
  { nombre: "buscar_entidad", descripcion: "Busca municipalidades, gobiernos regionales y entidades nacionales por nombre, provincia o distrito.", props: { texto: { type: "string" }, nivel: filtros.nivel, depto: filtros.depto }, req: ["texto"], run: (a) => consultaBuscar(q, a.texto, a) },
  { nombre: "avance_presupuesto", descripcion: "Cuánto del presupuesto del año (PIM) ya se gastó (devengado) en el país, un departamento o una entidad; compara con el mismo mes del año anterior y da un semáforo relativo frente a entidades del mismo nivel.", props: { entidad, ...filtros }, req: [], run: (a) => consultaAvance(q, a) },
  { nombre: "ranking_avance", descripcion: "Entidades ordenadas por avance del gasto (solo las de presupuesto ≥ S/ 1 millón).", props: { ...filtros, peores: { type: "boolean", description: "Primero las de menos avance" }, limit: { type: "number" } }, req: [], run: (a) => consultaRanking(q, a) },
  { nombre: "gasto_por_funcion", descripcion: "En qué funciones (educación, salud, transporte...) tiene presupuesto una entidad y cuánto avanzó en cada una.", props: { entidad, ...filtros }, req: ["entidad"], run: (a) => consultaFunciones(q, a) },
  { nombre: "obras_de_entidad", descripcion: "Las obras (inversiones) con más presupuesto del año de una entidad, su gasto y el avance físico que declara. 'paraVerificar' es una señal para revisar, no una acusación.", props: { entidad, ...filtros }, req: ["entidad"], run: (a) => consultaObras(q, a) },
  { nombre: "ficha_distrito", descripcion: "Las cinco capas de un distrito: gasto en obras, señal 4G, emergencias, zonas críticas e índice digital, cada una con su posición frente a los demás distritos del país.", props: { distrito: { type: "string", description: "Nombre del distrito, ej. 'huancavelica'" }, depto: filtros.depto }, req: ["distrito"], run: (a) => consultaFicha(q, a.distrito, a) },
];

const responder = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
const fallar = (id, code, message) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");

createInterface({ input: process.stdin }).on("line", (linea) => {
  if (!linea.trim()) return;
  let m;
  try { m = JSON.parse(linea); } catch { return fallar(null, -32700, "JSON inválido"); }
  if (m.id === undefined) return; // notificaciones (initialized, etc.): no se responde
  if (m.method === "initialize") {
    return responder(m.id, { protocolVersion: m.params?.protocolVersion ?? "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "quipu", version: "0.1.0" }, instructions: `Presupuesto público del Perú (MEF), datos al ${q.datos.corte}. Avance = devengado / PIM. Los montos están en soles.` });
  }
  if (m.method === "ping") return responder(m.id, {});
  if (m.method === "tools/list") {
    return responder(m.id, { tools: HERRAMIENTAS.map((h) => ({ name: h.nombre, description: h.descripcion, inputSchema: { type: "object", properties: h.props, required: h.req } })) });
  }
  if (m.method === "tools/call") {
    const h = HERRAMIENTAS.find((x) => x.nombre === m.params?.name);
    if (!h) return fallar(m.id, -32602, `Herramienta desconocida: ${m.params?.name}`);
    try {
      return responder(m.id, { content: [{ type: "text", text: JSON.stringify(h.run(m.params.arguments ?? {}), null, 2) }] });
    } catch (e) {
      if (!(e instanceof ErrorConsulta)) return fallar(m.id, -32603, String(e.message));
      return responder(m.id, { isError: true, content: [{ type: "text", text: e.message }] });
    }
  }
  fallar(m.id, -32601, `Método no soportado: ${m.method}`);
});
