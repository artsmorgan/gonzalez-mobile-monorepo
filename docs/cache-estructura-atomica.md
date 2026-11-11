# Caché de la jerarquía: validar y escribir sin perder la anterior (issue #178, H08)

Lógica pura en `apps/mobile/hooks/mainStructureCacheAtomic.ts` (probada en `apps/server/utils/mainStructureCacheAtomic.test.ts` con almacenes en
memoria y fallos inyectados); el almacenamiento real (AsyncStorage y `expo-file-system`) está en `hooks/mainStructureCacheStorage.ts`.

## Qué cambió

| Antes | Ahora |
|---|---|
| El límite entre AsyncStorage y archivo se medía en **caracteres** (`json.length`); un árbol con `ñ`, `€` o tildes ocupa más bytes que caracteres y podía superar el límite de SQLite (CursorWindow). | Se mide en **bytes UTF-8** (`utf8ByteLength`), igual a lo que ocupa en SQLite. |
| La respuesta del servidor se escribía **antes** de comprobar que fuera JSON; una respuesta rota (p. ej. una página de error) reemplazaba la caché buena. | Se valida primero: debe ser un arreglo de objetos (y los fragmentos deben traer `empresas`). Si no, se lanza error y **no se toca nada**. |
| El archivo se escribía encima del definitivo: un corte a mitad dejaba un archivo cortado y se perdía la caché. | Se escribe un `.tmp`, se relee y se compara; solo entonces reemplaza al definitivo. La bandera que decide de dónde se lee cambia al final. |
| Los fragmentos viejos se borraban antes de escribir los nuevos. | Se escriben los nuevos completos, se registran las claves y solo entonces se quitan los que ya no existen y el monolito legado. |
| `apreciacionVulnerabilidadFunctions` escribía `main_structure_cache` directo en AsyncStorage, sin bandera, validación ni límite. | Usa el mismo almacenamiento seguro (escritura y lectura). |

Ante cualquier fallo (disco lleno, app cerrada a la mitad, JSON roto) el lector sigue encontrando **la caché anterior completa**. Si el archivo
definitivo se pierde justo al reemplazarlo, el lector recupera el `.tmp` (que ya estaba verificado). El `.tmp` también se conserva en
`deleteAllFiles`, igual que el definitivo.

Nota: `expo-file-system` no documenta qué hace `move` sobre un destino existente, por eso el adaptador borra el definitivo justo antes de mover el
temporal ya verificado; la ventana de ese instante está cubierta por la recuperación desde el `.tmp`.

## Prueba manual (pendiente, requiere dispositivo)

1. Iniciar sesión y sincronizar la jerarquía con conexión; abrir una pantalla que la use (p. ej. Actividades) y confirmar que carga.
2. Poner el equipo en modo avión, forzar el cierre de la app y volver a abrirla: la jerarquía debe cargar sin conexión.
3. Con una jerarquía grande (que use archivo), cerrar la app a la fuerza durante «Actualizar jerarquía» y reabrirla sin conexión: debe cargar la
   versión anterior, no quedar vacía.
4. Simular una respuesta inválida del servidor (en el ambiente de pruebas, apuntando a un endpoint que devuelva HTML): la app debe mostrar el error y
   conservar la jerarquía anterior.
