# quipu

¿Cuánto del presupuesto público del Perú ya se gastó? Para cualquier municipalidad, región o sector, con
datos abiertos del MEF (Consulta Amigable de Gasto), 2025 y 2026. Sin claves, sin cuentas.

Tres caras con las mismas cifras:

- **Web** para todos: escribes el nombre de tu distrito y lees "ya gastó 62 de cada 100 soles que tiene este año", con un dibujo de su **quipu** (un nudo por mes, una cuerda por tema) y sus obras más grandes. Se comparte por WhatsApp.
- **CLI** para gente técnica: tablas en pantalla y `--json`.
- **MCP** para agentes de IA: `npx -y github:crafter-station/quipu mcp`.

> Proyecto no oficial, sin relación con el MEF. "Avance" = gasto devengado / PIM (presupuesto vigente del año).

```console
$ quipu avance "municipalidad distrital de acoria"
MUNICIPALIDAD DISTRITAL DE ACORIA
2026, hasta sep 2026

Presupuesto del año   S/ 27,1 millones
Gastado               S/ 16,7 millones
Avance                61,7 %
Año pasado, mismo mes 49,3 %  (2025, hasta sep)

🟢 Más avance que el 74 % de sus pares (puesto 490 de 1892 del mismo nivel)
```

```bash
quipu avance                                  # todo el país
quipu buscar acoria                           # encontrar una entidad
quipu ranking --nivel gl --depto huancavelica --peores
quipu funciones "gobierno regional de huancavelica"
quipu obras "gobierno regional de huancavelica"   # obras grandes y su avance físico declarado
quipu mcp                                     # servidor MCP (stdio)
node serve.mjs                                # web en http://localhost:8080/web/
```

Sin instalar nada: `npx github:crafter-station/quipu avance acoria`.

### MCP

```json
{ "mcpServers": { "quipu": { "command": "npx", "args": ["-y", "github:crafter-station/quipu", "mcp"] } } }
```

Herramientas: `buscar_entidad`, `avance_presupuesto`, `ranking_avance`, `gasto_por_funcion`, `obras_de_entidad`.

## Cómo se arma

```bash
python -I scripts/bajar.py                      # zips de gasto (año actual y anterior) + detalle de inversiones del MEF
python -I scripts/agregar.py data/raw/*-Gasto-*.zip   # resume en data/quipu.db (lee el zip en streaming: el CSV pesa 8-10 GB)
python -I scripts/exportar.py                   # data/quipu.json; opcional: fecha y último mes completo
python -I scripts/obras.py data/raw/detalle-inversiones.csv 2026-10-24   # data/obras.json
```

## Qué hay que saber para leerlo bien

- **Semáforo relativo.** Compara cada entidad con las de su mismo nivel (nacional, regional, local): verde = tercio de más avance, rojo = tercio de menos. No es un juicio de gestión; sirve para saber dónde preguntar. Una entidad con una obra grande que se paga al final del año puede salir en rojo sin problema.
- **Solo meses cerrados.** El mes en curso se excluye para que la comparación con el año anterior sea justa.
- **Gobiernos locales.** El MEF no trae pliego para ellos: la entidad es la municipalidad (su ejecutora). Si una municipalidad tiene varias ejecutoras, se suman.
- **PIM** es el presupuesto vigente al corte, no el de apertura: puede subir durante el año y bajar el porcentaje.
- **Obras.** Vienen del Detalle de inversiones (Invierte.pe). El **avance físico lo declara la propia entidad**; quipu no lo mide. Marca "vale la pena preguntar" cuando una obra gastó ≥ 60 % de su presupuesto del año y declara ≤ 20 % de avance físico. Esos umbrales son **provisionales** (falta validarlos con quien fiscaliza obras) y la señal no prueba nada: puede ser un retraso de registro. Se asignan obras a una entidad solo si su nombre es inequívoco (1.675 de 1.920 municipalidades y 25 de 29 regiones hoy).
- **Datos automáticos.** `.github/workflows/datos.yml` actualiza los JSON lunes y jueves (tarda ~20 min). Límite conocido: en enero, cuando aún no hay un mes cerrado, la comparación con el año anterior no es válida.
- Los enlaces antiguos del catálogo de datosabiertos.gob.pe (`fs.datosabiertos.mef.gob.pe/.../2025-Gasto.csv`) dan 404; los archivos vigentes salen del portal del MEF.

MIT · Hecho por [Lizeth Riveros](https://github.com/LizethRiveros)
