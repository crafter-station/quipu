import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { crear, agregar, buscar, semaforo, normalizar } from "../src/core.mjs";

const q = crear(JSON.parse(readFileSync(new URL("../data/quipu.json", import.meta.url), "utf8")));

test("normalizar quita tildes y mayúsculas", () => assert.equal(normalizar("  Áncash "), "ancash"));
test("el avance nacional está entre 0 y 100", () => {
  const a = agregar(q, q.entidades, "2025", 12);
  assert.ok(a.pct > 80 && a.pct < 100, `avance 2025 = ${a.pct}`);
});
test("buscar encuentra municipalidades por nombre sin tildes", () => {
  assert.ok(buscar(q, "municipalidad distrital de acoria").length >= 1);
});
test("el semáforo da un color y una posición válida", () => {
  const e = buscar(q, "acoria")[0];
  const s = semaforo(q, e, "2026");
  assert.ok(["verde", "ambar", "rojo"].includes(s.color));
  assert.ok(s.posicion >= 1 && s.posicion <= s.de);
});

import { consultaAvance, consultaObras, ErrorConsulta, cargar } from "../src/consultas.mjs";

test("consultas: avance de una entidad trae semáforo y año anterior", () => {
  const r = consultaAvance(cargar(), { entidad: "municipalidad distrital de acoria" });
  assert.ok(r.avancePct > 0 && r.avancePct <= 100);
  assert.ok(r.mismoMesAnioAnterior.avancePct > 0);
  assert.ok(["verde", "ambar", "rojo"].includes(r.semaforoRelativo.color));
});
test("consultas: un nombre ambiguo no adivina, pide precisión", () => {
  assert.throws(() => consultaAvance(cargar(), { entidad: "santa rosa" }), ErrorConsulta);
});
test("consultas: las obras traen código y avance físico (o null)", () => {
  const r = consultaObras(cargar(), { entidad: "gobierno regional del departamento de huancavelica" });
  assert.ok(r.obras.length > 0 && r.obras.every((o) => o.codigoInvierte && "avanceFisicoDeclaradoPct" in o));
});
test("el nombre con mala codificación y el bueno dan la misma llave", async () => {
  const { doblar } = await import("../src/core.mjs");
  assert.equal(doblar("MUNICIPALIDAD DISTRITAL DE MAÑAZO"), doblar("MUNICIPALIDAD DISTRITAL DE MA�AZO"));
});

test("ficha: Huancavelica trae las cinco capas con las cifras de la web", async () => {
  const { cargar, consultaFicha } = await import("../src/consultas.mjs");
  const f = consultaFicha(cargar(), "huancavelica", { depto: "huancavelica" });
  assert.equal(f.ubigeo, "090101");
  assert.equal(f.habitantes, 43556);
  assert.equal(f.densidad, 85.3);
  assert.deepEqual(f.capas.map((c) => c.texto), ["17 %", "9 %", "8", "5", "47"]);
  assert.throws(() => consultaFicha(cargar(), "san juan"), /Hay 4 distritos/);
});
