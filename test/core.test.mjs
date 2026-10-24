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
