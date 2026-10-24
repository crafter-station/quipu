# quipu

¿Cuánto del presupuesto público del Perú ya se gastó? Para cualquier municipalidad, región o sector, con
datos abiertos del MEF (Consulta Amigable de Gasto), 2025 y 2026. Sin claves, sin cuentas.

Dos caras con las mismas cifras:

- **Web** para todos: escribes el nombre de tu distrito y lees "ha gastado S/ 16,7 millones de los S/ 27,1 millones que tiene este año".
- **CLI** para gente técnica y agentes de IA: tablas en pantalla y `--json`.

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
node serve.mjs                                # web en http://localhost:8080/web/
```

## Cómo se arma

```bash
# 1. bajar los zip del portal de datos abiertos del MEF (datosabiertos.mef.gob.pe → Presupuesto y Ejecución de Gasto)
# 2. resumir (lee el zip en streaming; el CSV pesa 8-10 GB)
python -I scripts/agregar.py data/raw/2026-Gasto-Diario.zip data/raw/2025-Gasto-Mensual.zip
# 3. exportar el JSON que usan el CLI y la web: fecha de los datos y último mes completo
python -I scripts/exportar.py 2026-10-23 9
```

## Qué hay que saber para leerlo bien

- **Semáforo relativo.** Compara cada entidad con las de su mismo nivel (nacional, regional, local): verde = tercio de más avance, rojo = tercio de menos. No es un juicio de gestión; sirve para saber dónde preguntar. Una entidad con una obra grande que se paga al final del año puede salir en rojo sin problema.
- **Solo meses cerrados.** El mes en curso se excluye para que la comparación con el año anterior sea justa.
- **Gobiernos locales.** El MEF no trae pliego para ellos: la entidad es la municipalidad (su ejecutora). Si una municipalidad tiene varias ejecutoras, se suman.
- **PIM** es el presupuesto vigente al corte, no el de apertura: puede subir durante el año y bajar el porcentaje.
- Los enlaces antiguos del catálogo de datosabiertos.gob.pe (`fs.datosabiertos.mef.gob.pe/.../2025-Gasto.csv`) dan 404; los archivos vigentes salen del portal del MEF.

MIT · Hecho por [Lizeth Riveros](https://github.com/LizethRiveros)
