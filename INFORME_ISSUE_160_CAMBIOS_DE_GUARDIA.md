# Issue #160 — Cambios de guardia: ¿el error viene de Planillas o es local?

_Informe de análisis de código (20 oct 2026). No se escribió nada en la base de Planillas ni se cambió el flujo de marcas para este informe._

## Conclusión

**Son dos causas encadenadas y una de ellas es nuestra.**

1. **Planillas entrega marcas que se traslapan** para un mismo empleado y día (su marca propia y la del compañero al que reemplaza). Eso es un dato de Planillas.
2. **Nuestra lógica elegía mal entre ellas.** La app toma «la última marca que ya empezó»; con dos marcas traslapadas gana la que empieza más tarde, que es la del turno original. **Esto ya está corregido** (`apps/server/utils/resolveMarcaConflicto.ts`, 10 pruebas).
3. **Un tercer punto local también está corregido:** al marcar entrada, el servidor cierra solo «el turno anterior abierto» y, si ese turno no había llegado a su hora de fin, lo registraba como **salida anticipada** (ver «Corregido en el cierre automático»).

## Cómo se decide hoy el turno

`GET /api/attendance/user/[id]` (`apps/server/app/api/attendance/user/[id]/route.ts`):

1. Pide a Planillas las marcas del empleado por día (`GET {PLANILLAS_URL}/marcas?empleado_codigo&fecha`) y las lee de `c_marca_dia` (solo lectura).
2. Descarta las marcas del fijo cuando tienen un reemplazo distinto al consultado.
3. Si la próxima marca empieza dentro de la ventana de monitoreo, usa esa; si no, usa **la última que ya empezó**.
4. Con esa marca calcula `is_late` (tardía) y `is_salida_anticipada`, y la devuelve a la app.
5. La app manda ese `marca_id` en `PUT /api/attendance/[id]`: tardía y salida anticipada se calculan contra **esa** marca. Es decir, el turno al que queda asociada la acción lo decide la selección del paso 3.

## Ejemplo real

Empleado 3730, 15 oct 2026 (el caso enviado por el equipo):

| Marca | Horario | Reemplaza a |
|---|---|---|
| 11319911 | 07:00 – 16:00 | — (la propia) |
| 11322388 | 05:30 – 17:30 | el empleado 3730 (cambio de guardia) |

Las dos se traslapan 9 horas. Con «la última que ya empezó», a las 08:00 la app ofrecía la 11319911 (empezó 07:00 > 05:30), o sea el turno original, y la tardía o la salida anticipada se registraba contra ella.

## Corregido en el cierre automático

`PUT /api/attendance/[id]`, caso `entrada` (`findPreviousOpenMarcaViaPlanillas` + `marcar_salida`):

- Busca, hasta 5 días atrás, una marca con entrada digitada y sin salida cuyo inicio sea anterior al de la que se está marcando.
- Si la encuentra, la **cierra con la hora de la nueva entrada**. Si esa hora es anterior a `hora_fin − tiempo de gracia`, envía a Planillas `salida_anticipada = true` con el `motivo` de la petición de entrada (normalmente vacío) y notifica «Salida anticipada» a administrativos y supervisores.
- Con marcas traslapadas (el ejemplo de arriba) la «anterior abierta» puede ser el **mismo turno físico** del empleado, no un turno previo: se cierra y se marca como salida anticipada algo que no lo es.

**Corrección aplicada:** ese cierre automático ahora ignora las marcas que se traslapan con la nueva (`puedeCerrarseAutomaticamente` en `utils/resolveMarcaConflicto.ts`, usada por `findPreviousOpenMarcaViaPlanillas`). Un turno anterior que ya terminó se sigue cerrando como antes. Una marca traslapada se cierra por el flujo normal de salida, no como efecto de otra entrada. 4 pruebas nuevas.

## Por verificar (no lo pude confirmar solo con el código)

- **Datos reales:** solo hay un caso concreto con ids. Para sustentar el reclamo a Planillas conviene sacar 3 a 5 casos más. Consulta de solo lectura sobre la base de Planillas (no ejecutada) para listar traslapes del mismo día:

```sql
SELECT a.id AS marca_a, b.id AS marca_b, a.fecha,
       a.hora_inicio AS inicio_a, a.hora_fin AS fin_a, b.hora_inicio AS inicio_b, b.hora_fin AS fin_b,
       a.empleadoFijo_id AS fijo_a, a.empleadoReemplaza_id AS reemplaza_a,
       b.empleadoFijo_id AS fijo_b, b.empleadoReemplaza_id AS reemplaza_b
FROM c_marca_dia a
JOIN c_marca_dia b
  ON a.id < b.id AND a.fecha = b.fecha
 AND (a.empleadoFijo_id IN (b.empleadoFijo_id, b.empleadoReemplaza_id)
   OR a.empleadoReemplaza_id IN (b.empleadoFijo_id, b.empleadoReemplaza_id))
 AND a.hora_inicio < b.hora_fin AND b.hora_inicio < a.hora_fin
WHERE a.hora_inicio < a.hora_fin AND b.hora_inicio < b.hora_fin   -- sin turnos nocturnos que cruzan medianoche
ORDER BY a.fecha DESC;
```

- **Sin conexión:** no revisé si, con el equipo sin conexión durante el cambio de guardia, la app sigue usando la marca guardada en caché hasta sincronizar.
- **Qué hace Planillas** al recibir `marcas/entrada` o `marcas/salida` sobre una marca traslapada: no tengo su código.

## Propuesta para Planillas

Que `GET /marcas` no entregue dos marcas traslapadas para el mismo empleado, o que indique cuál prevalece (por ejemplo, marcar la de reemplazo). Mientras tanto la regla temporal acordada en la reunión ya está aplicada de nuestro lado:

1. Si alguna marca en conflicto tiene como `empleadoReemplaza` al empleado consultado, se usa esa.
2. Entre las candidatas gana la que empieza primero (fecha + hora de inicio) y, a igual inicio, la de `id` menor.

## Criterio de aceptación del issue

- [x] Causa identificada (mixta: dato de Planillas + selección local ya corregida + cierre automático pendiente).
- [x] Un ejemplo con ids y propuesta.
- [x] Corrección local aplicada (selección de marca + cierre automático).
- [ ] Más ejemplos y confirmación con Planillas.
