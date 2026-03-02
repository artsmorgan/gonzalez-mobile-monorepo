## API dinámica de base de datos y archivos

Este documento describe la API dinámica utilizada en este proyecto para interactuar con la base de datos y con el sistema de archivos, construida sobre **Next.js** (rutas de la carpeta `app/api`) y **Prisma**.

---

### 1. ¿Qué es la API dinámica?

La API dinámica está implementada principalmente a través de la ruta:

- `app/api/dynamic-prisma/route.ts`

Esta ruta fue creada usando **Next.js** y actúa como un _proxy_ genérico hacia la base de datos:

- Recibe una petición HTTP con un **payload JSON** que incluye:
  - `action`: `"GET" | "POST" | "UPDATE" | "DELETE"`
  - `table`: nombre de la tabla en la base de datos (por ejemplo, `"c_marca_dia"`, `"e_estructura_plazas"`, etc.).
  - `operation`: operación específica de Prisma (por ejemplo, `"findMany"`, `"findFirst"`, `"findUnique"`, `"create"`, `"update"`, `"deleteMany"`, etc.).
  - Parámetros de Prisma (`where`, `data`, `orderBy`, `include`, `select`, `take`, `skip`, etc.), según corresponda.
- La API traduce estos parámetros a una llamada concreta de Prisma contra la tabla indicada y devuelve el resultado en formato JSON.

### 2. Referencias de modelo y tablas utilizadas

Para entender las **tablas nuevas** y las **tablas preexistentes** que se implementan en la API dinámica (y si tienen diferencias respecto a la base original), es obligatorio revisar los siguientes documentos en `apps/server/docs`:

- `created-models-prisma.txt`
- `preexistent-tables-differences.md`
- `schema-modificado-modelos-nuevos-filtrados.md`

En estos documentos se detalla:

- Qué modelos/tablas nuevas se añadieron al `schema.prisma`.
- Qué tablas ya existentes se están utilizando en la API dinámica.
- Qué diferencias o ajustes se han hecho respecto al esquema original.

> **Nota de referencia de base:**  
> Para crear esta base de datos se usó como referencia la base **`corpglez_planillas_master_mirror`**, proporcionada al equipo de **Udevs**.
> Cualquier cambio sobre las tablas que se están utilizando debe considerar la compatibilidad con el modelo y el cliente de prisma.

En particular, el archivo:

- `schema-modificado-modelos-nuevos-filtrados.md`

incluye el bloque de **“Total preexistentes”**, donde se listan las tablas preexistentes que han sido modeladas en Prisma. Cambios en estas tablas requieren atención especial (ver sección 5).

---

### 3. Configuración de Prisma

El cliente de Prisma se configura a través de:

- `app/prisma/schema.prisma`
- `utils/prismaClient.ts`

Para que Prisma funcione correctamente, es necesario:

1. **Crear un archivo `.env`** en `apps/server` (o en el root indicado por la configuración de Prisma), basado en:
   - `.env.example`

2. Asegurarse de definir al menos:
   - `DATABASE_URL` apuntando a la instancia de base de datos adecuada.
   - Cualquier otra variable requerida por el proyecto (por ejemplo, `MOBILE_ACCESS_TOKEN`, `JWT_SECRET`, etc., según el contenido de `.env.example`).

---

### 4. Comandos básicos de Prisma (migraciones)

> Asegúrate de que `DATABASE_URL` apunte a la base correcta antes de ejecutar migraciones.

Dentro del directorio del servidor (por ejemplo `apps/server`), los comandos típicos de Prisma son:

- **Obtener el model actual de la base de datos** (antes de realizar migraciones):

  ```bash
  npx prisma db pull
  ```

- **Crear una nueva migración** (añadir o modificar tablas/campos en `schema.prisma`):

  ```bash
  npx prisma migrate dev --name nombre_de_la_migracion
  ```

- **Generar cliente de Prisma** (tras cambios en `schema.prisma`):

  ```bash
  npx prisma generate
  ```

  Esto:
  - Actualiza el esquema de la base de datos local.
  - Genera una nueva carpeta de migración en `app/prisma/migrations`.

- **Aplicar migraciones en un entorno específico** (por ejemplo, producción / staging):

  ```bash
  npx prisma migrate deploy
  ```

> Para más información, consulte la documentación oficial de prisma para realizar cambios sin comprometer el estado actual

---

### 5. Cambios en tablas preexistentes y flujo de trabajo

La API dinámica está pensada para **no interferir con el flujo de trabajo normal de la empresa**, pero es importante coordinar cambios en las tablas preexistentes.

En particular:

- Cuando se haga un cambio en **alguna de las tablas listadas en “Total preexistentes”** de  
  `apps/server/docs/schema-modificado-modelos-nuevos-filtrados.md`  
  (por ejemplo:
  - Añadir / eliminar columnas.
  - Cambiar tipos de datos.
  - Cambiar claves primarias o foráneas.
  - Renombrar tablas o columnas.)

  entonces:
  1. **Revisar y actualizar `schema.prisma`** para que siga reflejando fielmente la estructura de la base (incluyendo relaciones, índices, tipos, etc.).
  2. **Reiniciar o ajustar las migraciones de Prisma** para adaptar la API dinámica a los nuevos cambios de esquema:
     - Dependiendo de la política del proyecto, esto puede implicar:
       - Crear nuevas migraciones que apliquen los cambios de forma incremental, o
       - En entornos de desarrollo, regenerar todo el esquema de prisma (Lo que no implica reiniciar la base de datos, solamente el esquema de prisma y sus migraciones).
  3. **Ejecutar `npx prisma generate`** para actualizar el cliente de Prisma.
  4. **Probar los flujos afectados** (endpoints y pantallas móviles correspondientes).

- Además, **es obligatorio informar al equipo de Udevs** cuando se realicen cambios en estas tablas preexistentes, para que puedan:
  - Adaptar el servicio que brinda la API dinámica a los nuevos cambios de esquema.
  - Actualizar, si es necesario, el mapeo y las validaciones que se realizan del lado de la infraestructura o servicios auxiliares.

> En resumen: los cambios en tablas listadas como “Total preexistentes” deben ser tratados como cambios de contrato entre la base de datos corporativa y la API dinámica.
> Esto requiere coordinación y migraciones controladas, no simples modificaciones ad-hoc.

---

### 6. Resumen

- La API dinámica de este proyecto está construida con **Next.js + Prisma**.
- Antes de trabajar con tablas y modelos, se deben revisar:
  - `created-models-prisma.txt`
  - `preexistent-tables-differences.md`
  - `schema-modificado-modelos-nuevos-filtrados.md`
- Para usar Prisma:
  - Crear `.env` a partir de `.env.example`.
  - Usar `npx prisma generate` y `npx prisma migrate dev --name ...` para mantener el esquema.
- Cualquier cambio en tablas preexistentes:
  - Requiere adaptar `schema.prisma`, actualizar migraciones y coordinar con **Udevs** para mantener la API dinámica alineada con la base de datos de referencia.
