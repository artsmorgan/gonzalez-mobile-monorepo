# Propiedades realmente utilizadas por tabla

A partir de [prisma-find-fields-batch1.md](./prisma-find-fields-batch1.md) (qué campos *devuelve* cada consulta `find*`), este documento reduce esa información a qué columnas de cada tabla se **usan realmente** en el código — es decir, a cuáles se accede explícitamente (`objeto.propiedad`, desestructuración, o construcción de columnas/objetos de respuesta nombrando el campo) en algún punto de `apps/server/app/api/` o `apps/server/utils/` (incluyendo `utils/reports-functions/`).

No se listan relaciones (tablas relacionadas), solo columnas escalares. Cuando una consulta simplemente reenvía el objeto completo sin nombrar campos (`return empleado;`, `NextResponse.json(empleado)`, `...empleado`), esa consulta puntual no aporta información nueva a esta lista — solo se cuentan los campos que se ven accedidos por nombre en algún lugar del código revisado.

Las consultas que solo verifican la existencia de un registro (patrón `if (!registro) { ... }` tras un `findUnique`/`findFirst`, sin leer ninguna otra propiedad) **sí se cuentan**: son necesarias para validar que el registro referenciado existe antes de continuar, y ese uso se registra como consumo de `id` (la columna con la que se realiza la búsqueda y cuya existencia se está determinando).

* `c_accion_personal`
   * aceptar_restricciones_reversion
   * accionGeneraSeparacion_id
   * adenda_id
   * ajuste_salario_id
   * ausencia_id
   * ausencia_transformada
   * baja_id
   * cambio_horario_id
   * cambio_periodo_pago_id
   * cantidad_horas
   * categoriaEmpleado_id
   * cliente_id
   * comentarios
   * consecutivo
   * contratacion_id
   * contrato_id
   * coordinadoPor_id
   * coordinador_id
   * corpo_id
   * document
   * empleado_id
   * empresa_id
   * estado_aprobacion
   * fecha_actualizacion
   * fecha_aprobado_ec
   * fecha_aprobado_jo
   * fecha_fin
   * fecha_fin_traslado
   * fecha_insercion
   * fecha_reversion
   * fecha_sobrepuesto
   * fecha_vence_justificar_ausencia
   * fecha_vence_subir_adjunto
   * horario_id
   * id
   * incapacidad_ccss_id
   * incapacidad_ins_id
   * libre_cubre_vacasiones_id
   * licencia_id
   * llegada_tardia_id
   * mobile_upload
   * monto_descontar_turnos
   * motivo_reversion
   * numero_hed
   * numero_hem
   * numero_hen
   * operacion
   * periodoPago_id
   * permiso_con_goce_id
   * permiso_sin_goce_id
   * plaza_id
   * preaviso_id
   * puesto_id
   * reemplazo_id
   * reversible
   * salario
   * salario_base_diario
   * salario_base_mensual
   * salida_anticipada_id
   * separacion_temp_id
   * suspension_id
   * tipoAccion_id
   * tipoContratacion_id
   * traslado_id
   * traslado_temp_id
   * usuario_actualizacion
   * usuario_aprueba_ec
   * usuario_aprueba_jo
   * usuario_insercion
   * usuario_reversion
   * vacacionMes_id
   * vacacion_disfrute_id
   * vacacion_pago_id

* `c_cambio_guardia`
   * id

* `c_configuracion`
   * tiempo_gracia_marcar_salida

* `c_empleado`
   * categoriaEmpleado_id
   * cedula
   * codigo
   * Email
   * estado
   * fecha_contratacion
   * firma_manual
   * id
   * nombre
   * password
   * password_expires_at
   * periodoPago_id
   * primer_apellido
   * segundo_apellido
   * supervisor_id
   * telefono
   * tipoCedula
   * tipoContratacion_id

* `c_empleado_datos_adjuntos_rrhh`
   * empleado_id
   * fecha
   * tipoDatoAdjunto_id

* `c_empleado_plaza`
   * division_id
   * empleado_id
   * plaza_id
   * salario

* `c_horario`
   * id
   * minutos_almuerzo
   * tiene_almuerzo
   * titulo

* `c_marca_dia`
   * cliente_id
   * contrato_id
   * corpo_id
   * empleadoFijo_id
   * empleadoReemplaza_id
   * empresa_id
   * fecha
   * hora_entrada
   * hora_entrada_digitada
   * hora_fin
   * hora_inicio
   * hora_salida
   * hora_salida_anticipada
   * hora_salida_digitada
   * horario_id
   * horas_duracion
   * id
   * plaza_id
   * puesto_id
   * tipo_turno

* `c_tipo_accion`
   * nombre

* `e_estructura_articulo_corpo_puesto_entrega`
   * corpo_id
   * fechaEntrega
   * id
   * marca
   * modelo
   * nomencladorArticuloCP_id
   * puesto_id
   * serie

* `e_estructura_articulo_corpo_puesto_plan`
   * articuloCP_id
   * cantidad
   * combo_id
   * corpo_id
   * id
   * puesto_id

* `e_estructura_cliente`
   * empresa_id
   * id
   * nombre

* `e_estructura_combo_articulo_cp`
   * id
   * nombre

* `e_estructura_contrato`
   * cliente_id
   * division_id
   * empresa_id
   * id
   * nombre
   * nro_contrato

* `e_estructura_empresa`
   * codigo
   * id
   * nombre

* `e_estructura_plazas`
   * categoriaSalarial_id
   * codigo_plaza
   * id
   * nombre
   * nro_plaza
   * puesto_id

* `e_estructura_puesto`
   * codigo
   * comboArticulosCP_id
   * coordenadas_gpslat
   * coordenadas_gpslng
   * id
   * nombre
   * sucursal_id
   * tiene_relevo

* `e_estructura_sucursal`
   * contrato_id
   * coordenadas_gpslat
   * coordenadas_gpslng
   * ejecutivoCuenta_id
   * id
   * nombre
   * nro_sucursal

* `e_licencia`
   * empleado_id
   * tipoLicencia_id
   * vence

* `n_articulo_corpo_puesto`
   * id
   * nombre

* `n_coordinador`
   * id
   * nombre

* `n_division`
   * codigo
   * id
   * nombre

* `n_ejecutivo_cuenta`
   * id
   * nombre

* `n_tipo_dato_adjunto_rrhh`
   * id
   * nombre

* `n_tipo_licencia`
   * id
   * nombre

* `pg_categoria_empleado`
   * codigo
   * id
   * nombre

* `pg_categoria_salarial`
   * categoriaEmpleado_id
   * horas_extras_diurnas
   * horas_extras_mixtas
   * horas_extras_nocturnas
   * id
   * salario_dia
   * salario_mes

## Notas

- Cuatro tablas (`c_empleado_datos_adjuntos_rrhh`, `e_licencia`, `n_tipo_dato_adjunto_rrhh`, `n_tipo_licencia`) ya se consultaban con `select` explícito en `main-structure/mainStructureQueries.ts`; se confirmó que los tres/dos campos seleccionados en cada caso sí se usan al construir el árbol de estructura.
- `c_accion_personal` es la única tabla donde se usa prácticamente el modelo completo: `apps/server/utils/reports-functions/accionesPersonalesReport.ts` genera una columna de Excel por cada campo escalar.
- Varias consultas son solo verificaciones de existencia (`if (!registro) ...`) sin acceso a ninguna otra propiedad — se cuentan igualmente como uso de `id`, ya que determinar si el registro existe es en sí una necesidad real del código (ver tablas `c_empleado`, `c_horario`, `c_marca_dia`, `e_estructura_cliente`, `e_estructura_plazas`, `e_estructura_puesto` y `e_estructura_sucursal`, todas con casos de este tipo en al menos un archivo).
- Se detectaron algunos bloques de código muerto (comentados) que invocan `.find()` sobre estas tablas (p. ej. en `activities/marca/[id]/route.ts`); no se contaron como uso real.
- Un caso notable de inconsistencia: `apps/server/app/api/puestos/[id]/ubicacion/route.ts` construye un objeto `updatedPuestoData` con campos limitados que nunca se usa, y en su lugar devuelve el objeto `e_estructura_puesto` completo sin filtrar en la respuesta.
- Este análisis se generó mediante 5 revisiones paralelas de todo `apps/server/app/api/` y `apps/server/utils/` (incluyendo `reports-functions/`); las propiedades reportadas por cada revisión se cruzaron contra la lista de columnas reales de cada modelo (documentada en `prisma-find-fields-batch1.md`) para descartar atribuciones erróneas.
