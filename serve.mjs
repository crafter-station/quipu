// Servidor estático mínimo para ver la web en local: node serve.mjs  →  http://localhost:8080/web/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL(".", import.meta.url));
const TIPOS = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".json": "application/json", ".js": "text/javascript" };

createServer(async (req, res) => {
  const ruta = posix.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const archivo = join(raiz, ruta.endsWith("/") ? ruta + "index.html" : ruta);
  if (!archivo.startsWith(raiz) || /[\\/]data[\\/]raw/.test(archivo)) { res.writeHead(403).end(); return; }
  try {
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] ?? "application/octet-stream" }).end(cuerpo);
  } catch {
    res.writeHead(404).end("No encontrado");
  }
}).listen(8080, () => console.log("quipu en http://localhost:8080/web/"));
