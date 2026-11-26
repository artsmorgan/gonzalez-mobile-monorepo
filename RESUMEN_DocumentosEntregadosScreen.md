# Resumen Detallado: Pantalla de Documentos Entregados

## ¿Qué es esta pantalla?

Pantalla para gestionar el registro y control de documentos entregados al cliente. Permite:

- Registrar documentos entregados con información de entrega y recepción
- Gestionar firmas del representante del cliente y del responsable
- Filtrar y buscar documentos registrados
- Editar y eliminar registros
- Funcionar sin conexión a internet

**Requisitos para usar esta pantalla:**
- Debes tener una marca de ingreso activa (registro de entrada al trabajo). Si no tienes una marca activa, la aplicación te mostrará un mensaje indicando que primero debes registrar tu entrada.

---

## Funciones principales

### 1. Registro de documentos entregados
- Permite crear nuevos registros de documentos entregados al cliente
- Cada registro incluye información de quién entrega y quién recibe el documento
- Requiere seleccionar el tipo de documento desde una lista
- Permite agregar una descripción detallada del documento

### 2. Edición y eliminación de documentos
- Puedes editar cualquier campo de un documento registrado
- Puedes eliminar documentos que ya no necesites
- Los cambios se guardan automáticamente cuando hay conexión o se sincronizan cuando vuelve la conexión

### 3. Firma del representante del cliente
- Se dibuja manualmente en la pantalla del dispositivo
- Se guarda como imagen y se vincula al registro
- Es obligatoria para guardar el registro

### 4. Firma responsable
- Se genera automáticamente con tu ubicación GPS o se puede escanear desde un código QR
- La firma incluye información de sesión, empleado, ubicación GPS y hora exacta
- Es obligatoria para guardar el registro

### 5. Selección de tipo de documento
- Muestra una lista de tipos de documentos disponibles
- Se selecciona desde un modal flotante
- Los tipos se cargan desde el servidor o desde la caché local si no hay conexión

### 6. Filtros y búsqueda
- Puedes buscar documentos por tipo, nombres de oficiales o descripción
- Puedes filtrar por fecha de entrega
- Los filtros se pueden expandir o contraer para ahorrar espacio
- Puedes reiniciar los filtros con un solo botón

### 7. Funcionamiento sin internet
- Si no hay conexión, los registros se guardan localmente en tu dispositivo
- Cuando vuelve la conexión, los registros se sincronizan automáticamente con el servidor
- Los registros guardados offline se marcan con la etiqueta "(offline)" hasta que se sincronicen

### 8. Visualización de detalles
- Cada registro muestra información básica de forma compacta
- Puedes expandir cada registro para ver todos los detalles
- Muestra las firmas del representante del cliente y del responsable
- Muestra información de las firmas digitales (sesión, empleado, ubicación, hora)

---

## Datos que se registran

### Información básica del documento:
1. **Fecha**: Fecha en que se entregó el documento
2. **Nombre oficial que entrega**: Nombre del empleado que entrega el documento
3. **Nombre oficial que recibe**: Nombre del empleado que recibe el documento (del cliente)
4. **Tipo de documento**: Tipo de documento entregado (se selecciona de una lista)
5. **Descripción**: Descripción detallada del documento entregado

### Firmas:
1. **Firma representante cliente**: Firma dibujada manualmente por el representante del cliente (se guarda como imagen)
2. **Firma responsable**: Código QR generado automáticamente que incluye:
   - ID de sesión
   - ID del empleado responsable
   - Coordenadas GPS (latitud y longitud)
   - Hora exacta de la firma

### Información adicional:
1. **Marca ID**: Se asocia automáticamente con tu marca de ingreso activa

---

## Cómo usar la pantalla

### Opción 1: Crear un nuevo registro de documento entregado

1. Presiona el botón "Nuevo registro"

2. Completa los campos:
   - **Fecha**: Selecciona la fecha de entrega del documento
   - **Nombre oficial que entrega**: Ingresa el nombre del empleado que entrega
   - **Nombre oficial que recibe**: Ingresa el nombre del empleado que recibe (del cliente)
   - **Tipo de documento**: Presiona el botón para abrir el modal y selecciona el tipo de documento
   - **Descripción**: Escribe una descripción detallada del documento

3. Registra la firma del representante del cliente:
   - Presiona "Agregar firma" o "Modificar firma"
   - Se abrirá un modal con un recuadro para dibujar
   - Dibuja la firma del representante del cliente en el recuadro blanco
   - Presiona "Aceptar" para guardar la firma
   - Puedes presionar "Limpiar" si quieres volver a dibujar

4. Registra la firma responsable:
   - Presiona "Generar" para crear automáticamente un código QR con tu ubicación
   - O presiona "Escanear QR" para escanear un código QR existente

5. Presiona "Guardar" para crear el registro

### Opción 2: Seleccionar tipo de documento

1. En el formulario, presiona el botón "Seleccionar tipo de documento"

2. Se abrirá un modal con la lista de tipos disponibles

3. Presiona sobre el tipo de documento que deseas seleccionar

4. El modal se cerrará automáticamente y el tipo seleccionado aparecerá en el formulario

5. Si no hay tipos disponibles (sin conexión y sin caché), verás un mensaje indicándolo

### Opción 3: Buscar y filtrar registros

1. Presiona "Filtros" para expandir la sección de búsqueda

2. Usa el campo de búsqueda para buscar por:
   - Tipo de documento
   - Nombres de oficiales (entrega o recibe)
   - Descripción

3. Selecciona una fecha para filtrar por fecha de entrega

4. Los resultados se actualizan automáticamente mientras escribes

5. Presiona "Reiniciar" para limpiar todos los filtros

### Opción 4: Ver detalles de un registro

1. En la lista de documentos, presiona "Ver detalles" en el registro que te interesa

2. Se expandirá mostrando:
   - Descripción completa
   - Firma del representante del cliente (imagen)
   - Información detallada de la firma responsable (sesión, empleado, ubicación GPS, hora)

3. Presiona "Ocultar detalles" para contraer la información

### Opción 5: Editar un registro

1. En la lista de documentos, presiona "Editar" en el registro que deseas modificar

2. Se abrirá el formulario con todos los datos cargados

3. Modifica los campos que necesites

4. Puedes modificar o volver a dibujar la firma del representante del cliente

5. Puedes regenerar o escanear una nueva firma responsable

6. Presiona "Guardar" para actualizar el registro

### Opción 6: Eliminar un registro

1. En la lista de documentos, presiona "Eliminar" en el registro que deseas eliminar

2. Confirma la eliminación en el mensaje que aparece

3. El registro se eliminará del sistema

---

## Validaciones automáticas

El sistema verifica:
- Que el campo "Fecha" no esté vacío
- Que el campo "Nombre oficial que entrega" no esté vacío
- Que el campo "Nombre oficial que recibe" no esté vacío
- Que se haya seleccionado un tipo de documento
- Que el campo "Descripción" no esté vacío
- Que la firma del representante del cliente esté dibujada antes de guardar
- Que la firma responsable esté registrada antes de guardar

---

## Características adicionales

- **Sincronización automática**: Cuando vuelve la conexión a internet, todos los registros guardados offline se sincronizan automáticamente
- **Indicadores visuales**: Los registros guardados offline se marcan con "(offline)" hasta que se sincronicen
- **Persistencia de datos**: Si cierras la aplicación, todos los registros se mantienen guardados
- **Interfaz intuitiva**: Los formularios se muestran de forma clara y organizada
- **Confirmaciones**: El sistema te pide confirmación antes de eliminar cualquier registro
- **Información de firmas**: Puedes ver los detalles técnicos de cada firma digital (sesión, empleado, ubicación, hora)
- **Modal de firma**: La firma del representante del cliente se dibuja en un modal flotante con un recuadro claro
- **Modal de tipos**: Los tipos de documento se seleccionan desde un modal flotante con lista deslizable

---

## Resumen visual

La pantalla muestra:
- **Lista de documentos registrados**: Cada tarjeta muestra el tipo de documento, fecha, nombres de oficiales
- **Botones de acción**: Editar y Eliminar para cada documento
- **Sección de filtros**: Expandible para buscar y filtrar registros
- **Formulario de creación/edición**: Se muestra cuando presionas "Nuevo registro" o "Editar"
- **Modal de tipo de documento**: Se abre cuando presionas el botón de selección de tipo
- **Modal de firma**: Se abre cuando presionas "Agregar firma" o "Modificar firma" para dibujar la firma del representante del cliente
- **Vista expandible**: Cada registro se puede expandir para ver más detalles

---

## Beneficios para el usuario

1. **Control de documentos**: Mantén un registro organizado de todos los documentos entregados al cliente
2. **Trazabilidad**: Sabes exactamente qué documento se entregó, cuándo, quién lo entregó y quién lo recibió
3. **Validación digital**: Las firmas digitales garantizan la autenticidad de los registros
4. **Trabajo offline**: Puedes registrar documentos incluso sin conexión a internet
5. **Búsqueda rápida**: Encuentra rápidamente cualquier registro usando los filtros
6. **Información detallada**: Accede a todos los detalles de cada registro cuando los necesites
7. **Sincronización automática**: No te preocupes por perder datos, todo se sincroniza automáticamente
8. **Firmas claras**: La firma del representante del cliente se dibuja en un recuadro claro y fácil de usar
9. **Tipos organizados**: Los tipos de documento están organizados en una lista fácil de navegar

