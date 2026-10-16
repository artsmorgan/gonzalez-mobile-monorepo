# Solicitud de endpoints — tablas preexistentes

Se requieren los siguientes endpoints para escribir en tablas preexistentes del sistema de planillas (Prisma directo, autenticación JWT).

---

## 1. Coordenadas GPS de `e_estructura_puesto` _(prioridad alta)_

**Actualizar o eliminar ubicación del puesto**

- Tabla: `e_estructura_puesto`
- Campos a actualizar: `coordenadas_gpslat`, `coordenadas_gpslng`
- Entrada: ID del puesto, latitud y longitud (como string o número)
- Para eliminar ubicación: enviar ambas coordenadas en `null`
- Reglas: no permitir que solo una coordenada sea `null`

---

## 2. Ejecutivo de cuenta en `c_empleado` _(prioridad alta)_

**Asignar o quitar ejecutivo de cuenta**

- Tabla: `c_empleado`
- Campo a actualizar: `supervisor_id` (FK a `n_ejecutivo_cuenta.id`, o `null` para desasignar)
- Entrada: ID del empleado, `supervisor_id` (entero positivo o `null`)
- Reglas: validar que el empleado y el ejecutivo (si no es `null`) existan

**Listar ejecutivos de cuenta disponibles** — Para seleccionar el `supervisor_id` al asignar.

---

## 3. Archivos vinculados a `c_accion_personal` _(prioridad baja)_

**Subir archivo** — Asociar un archivo (texto, PDF, imagen, audio o video) a una acción personal.

- Tabla: `c_accion_personal`
- Campos a actualizar: `document` (nombre del archivo), `mobile_upload` = `true`
- Entrada: ID de la acción, archivo en base64, extensión, nombre y tipo (`image` | `video` | `audio` | `file`)
- Reglas: solo el empleado dueño de la acción puede subir; un solo archivo por acción; el binario debe quedar almacenado de forma que planillas pueda consultarlo

**Descargar archivo** — Obtener el archivo adjunto de una acción personal en el dispositivo.

- Entrada: ID de la acción y nombre del archivo
- Reglas: devolver el binario con el tipo MIME correcto

**Listar acciones sin adjunto** — Consultar acciones del empleado autenticado que aún no tienen `document`.

---

## 4. Carga masiva de artículos de puesto _(prioridad baja)_

**Registrar artículos masivamente en plan y entrega**

Por cada ítem del lote:

**Tabla `e_estructura_articulo_corpo_puesto_plan`** (si no existe la combinación puesto + artículo):

| Campo           | Valor                              |
| --------------- | ---------------------------------- |
| `puesto_id`     | Resuelto por código de puesto      |
| `corpo_id`      | `null`                             |
| `cantidad`      | Cantidad indicada                  |
| `articuloCP_id` | Número de artículo del nomenclador |
| `combo_id`      | `null`                             |

**Tabla `e_estructura_articulo_corpo_puesto_entrega`** (si no existe la combinación puesto + artículo + marca + serie + modelo):

| Campo                      | Valor                              |
| -------------------------- | ---------------------------------- |
| `puesto_id`                | Resuelto por código de puesto      |
| `corpo_id`                 | `null`                             |
| `marca`                    | Marca                              |
| `serie`                    | Serie                              |
| `modelo`                   | Modelo                             |
| `fechaEntrega`             | Fecha de entrega                   |
| `nomencladorArticuloCP_id` | Número de artículo del nomenclador |

**Entrada por ítem:** código de puesto, número de artículo, cantidad, serie, marca, modelo (opcional), fecha de entrega.

**Reglas:** el código de puesto y el número de artículo deben existir; no duplicar registros ya existentes con la misma clave lógica.

**Validar códigos de puesto** — Endpoint auxiliar que confirme que los códigos de puesto del lote existen antes de registrar.
