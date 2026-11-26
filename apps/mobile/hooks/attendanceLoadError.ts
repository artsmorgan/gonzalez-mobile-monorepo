/**
 * Mensajes para las personas cuando no se puede cargar la marca (turno) en «Marcar Ingreso/Salida». Módulo PURO (sin React Native) para probarlo en Node.
 *
 * Antes cualquier fallo mostraba el mismo texto genérico. Aquí cada situación tiene su propio mensaje, escrito para usuarios sin conocimientos técnicos:
 * qué pasó, qué hacer y un código corto que se le puede dar a soporte. El detalle técnico (excepción, respuesta cruda) NO se muestra: va solo al registro.
 */
export type AttendanceLoadStage =
  | 'preparacion' // antes de pedir la marca (hora del servidor, almacenamiento local)
  | 'respuesta_http' // el servidor respondió con un estado de error
  | 'respuesta_json' // el servidor respondió 200 pero el cuerpo no se pudo leer
  | 'procesar_bloqueada' // se recibió una marca bloqueada (ausente, permiso…) y falló al mostrarla
  | 'procesar_exito' // se recibió una marca normal y falló al prepararla
  | 'marca_mostrada' // la marca ya está en pantalla y falló un paso posterior (ubicación, validaciones, hora)
  | 'desconocida';

export type AttendanceLoadErrorInput = {
  stage: AttendanceLoadStage;
  error?: unknown;
  /** Estado HTTP cuando el servidor respondió con error. */
  httpStatus?: number | null;
  /** `code` que manda el servidor en sus errores (por ejemplo `SIN_MARCA`, `ESTRUCTURA_INCOMPLETA`). */
  serverCode?: string | null;
};

export type AttendanceLoadErrorInfo = {
  /** Código corto para soporte (no técnico para la persona: solo se lo dicta a quien la ayuda). */
  code: string;
  titulo: string;
  /** Qué pasó, en lenguaje sencillo. */
  mensaje: string;
  /** Qué puede hacer la persona. */
  queHacer: string;
};

const errorText = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error ?? '');
};

export function classifyAttendanceLoadError(input: AttendanceLoadErrorInput): AttendanceLoadErrorInfo {
  const { stage, httpStatus, serverCode } = input;
  const text = errorText(input.error);

  // La marca ya se ve en pantalla: lo que falló es un paso posterior. No se oculta la marca; se explica qué no se pudo terminar.
  if (stage === 'marca_mostrada') {
    return {
      code: 'VERIFICACION-PENDIENTE',
      titulo: 'Tu turno se muestra, pero falta una verificación',
      mensaje: 'No se pudo terminar de comprobar tu ubicación u hora, por eso el marcaje puede estar bloqueado por ahora.',
      queHacer: 'Revisa que la ubicación del teléfono esté activa y vuelve a intentarlo. Si continúa, avisa a tu administrador.',
    };
  }

  // 1) El servidor respondió con un error: lo más específico es su código y su estado.
  if (stage === 'respuesta_http' || (httpStatus != null && httpStatus >= 400)) {
    const status = Number(httpStatus ?? 0);
    if (serverCode === 'SIN_MARCA') {
      return {
        code: 'SIN-TURNO',
        titulo: 'No encontramos un turno para ti',
        mensaje: 'El sistema no tiene un turno registrado para ti en estos días.',
        queHacer: 'Si crees que es un error, avisa a tu supervisor o administrador para que revise tu horario.',
      };
    }
    if (serverCode === 'ESTRUCTURA_INCOMPLETA') {
      return {
        code: 'TURNO-INCOMPLETO',
        titulo: 'Tu turno tiene datos incompletos',
        mensaje: 'El turno que te corresponde no tiene toda la información necesaria registrada en el sistema (por ejemplo, el puesto, el cliente o el contrato).',
        queHacer: 'Avisa a tu supervisor o administrador para que lo revisen. No es un problema de tu teléfono.',
      };
    }
    if (serverCode === 'EMPLEADO_NO_ENCONTRADO') {
      return {
        code: 'USUARIO-NO-ENCONTRADO',
        titulo: 'No encontramos tu usuario',
        mensaje: 'El sistema no reconoce tu usuario en este momento.',
        queHacer: 'Cierra sesión y vuelve a entrar. Si continúa, avisa a tu administrador.',
      };
    }
    // Falta de permiso (Guardify): no es una sesión vencida, no hay que cerrar sesión.
    if (serverCode === 'permission_denied') {
      return {
        code: 'SIN-PERMISO',
        titulo: 'No tienes permiso para ver esto',
        mensaje: 'Tu rol no tiene permiso para esta información.',
        queHacer: 'Si crees que es un error, avisa a tu administrador para que revise tu rol.',
      };
    }
    if (status === 401 || status === 403) {
      return {
        code: 'SESION',
        titulo: 'Tu sesión ya no es válida',
        mensaje: 'Tu sesión terminó o ya no tienes permiso para ver esta información.',
        queHacer: 'Cierra sesión y vuelve a entrar. Si continúa, avisa a tu administrador.',
      };
    }
    if (status === 426) {
      return {
        code: 'ACTUALIZAR',
        titulo: 'Hay que actualizar la aplicación',
        mensaje: 'Esta versión de la aplicación ya no es compatible.',
        queHacer: 'Actualízala desde la pantalla de inicio de sesión (botón «Buscar actualización»).',
      };
    }
    if (status >= 500) {
      return {
        code: 'SERVICIO',
        titulo: 'El servicio tiene problemas',
        mensaje: 'El servicio no pudo atender tu solicitud en este momento. No es un problema de tu teléfono.',
        queHacer: 'Intenta de nuevo en unos minutos. Si continúa, avisa a tu administrador.',
      };
    }
    return {
      code: `SERVIDOR-${status || 'ERROR'}`,
      titulo: 'No se pudo cargar tu turno',
      mensaje: 'El servicio respondió con un problema al pedir tu turno.',
      queHacer: 'Intenta de nuevo. Si continúa, avisa a tu administrador.',
    };
  }

  // 2) El servidor respondió bien (200) pero lo enviado no se pudo leer.
  if (stage === 'respuesta_json' || /JSON Parse error|Unexpected (character|token|end)|SyntaxError/i.test(text)) {
    return {
      code: 'RESPUESTA-ILEGIBLE',
      titulo: 'No pudimos leer la respuesta',
      mensaje: 'El servicio respondió, pero lo que envió no se pudo entender. Suele ser un problema temporal del servicio o de la red a la que estás conectado.',
      queHacer: 'Intenta de nuevo en unos minutos o cambia de red (datos móviles o Wi-Fi). Si continúa, avisa a tu administrador.',
    };
  }

  // 3) Problemas del propio teléfono o de los datos recibidos.
  if (/database or disk is full|disk is full|SQLITE_FULL|row too big|CursorWindow|QuotaExceeded|ENOSPC|no space left/i.test(text)) {
    return {
      code: 'SIN-ESPACIO',
      titulo: 'Tu teléfono no tiene espacio',
      mensaje: 'No se pudo guardar la información de tu turno porque el almacenamiento del teléfono está lleno.',
      queHacer: 'Libera espacio (borra fotos, videos o aplicaciones que no uses) y vuelve a intentarlo.',
    };
  }
  if (/Invalid time value|Invalid Date/i.test(text)) {
    return {
      code: 'HORA-INVALIDA',
      titulo: 'Recibimos una hora que no se puede usar',
      mensaje: 'El servicio envió una fecha u hora con un formato que la aplicación no puede interpretar.',
      queHacer: 'Cierra la aplicación, ábrela de nuevo e intenta otra vez. Si sigue igual, avisa a tu administrador.',
    };
  }
  if (/Server time not found/i.test(text)) {
    return {
      code: 'HORA-SERVICIO',
      titulo: 'No se pudo sincronizar la hora',
      mensaje: 'Para marcar necesitamos la hora oficial del servicio y todavía no se ha podido obtener.',
      queHacer: 'Revisa tu conexión a internet y vuelve a intentarlo.',
    };
  }
  if (/getLunchTimeConfig|main-structure|lunch-time/i.test(text)) {
    return {
      code: 'TURNO-PARCIAL',
      titulo: 'Tu turno se encontró, pero faltó información',
      mensaje: 'Se encontró tu turno, pero no se pudieron preparar algunas partes de la pantalla (por ejemplo, el tiempo de alimentación).',
      queHacer: 'Vuelve a intentarlo. Si continúa, avisa a tu administrador.',
    };
  }
  // La consulta se cortó por tiempo: el teléfono sí tiene internet, pero el servicio está tardando más de lo normal.
  if (/TimeoutError|tard[oó] demasiado|timed out|timeout/i.test(text)) {
    return {
      code: 'TIEMPO-AGOTADO',
      titulo: 'El servicio está tardando más de lo normal',
      mensaje: 'La búsqueda de tu turno tardó demasiado y se detuvo antes de terminar.',
      queHacer: 'Espera un momento y vuelve a intentarlo. Si ya tenías un turno guardado en el teléfono, se muestra mientras tanto.',
    };
  }
  if (/Network request failed|network error|Failed to fetch|AbortError/i.test(text)) {
    return {
      code: 'SIN-CONEXION',
      titulo: 'No hay conexión estable',
      mensaje: 'No se pudo comunicar con el servicio.',
      queHacer: 'Revisa tu conexión a internet y vuelve a intentarlo.',
    };
  }
  if (stage === 'procesar_bloqueada' || stage === 'procesar_exito' || /cannot read propert|undefined is not an object|null is not an object|is not a function|split/i.test(text)) {
    return {
      code: 'DATOS-INCOMPLETOS',
      titulo: 'La información llegó incompleta',
      mensaje: 'El servicio envió datos incompletos o en un formato que esta versión de la aplicación no entiende.',
      queHacer: 'Revisa que tengas la última versión de la aplicación (en el inicio de sesión puedes buscar actualizaciones). Si continúa, avisa a tu administrador.',
    };
  }

  return {
    code: 'INESPERADO',
    titulo: 'Ocurrió un problema inesperado',
    mensaje: 'No se pudo cargar tu turno por un problema que no esperábamos.',
    queHacer: 'Intenta de nuevo. Si continúa, avisa a tu administrador.',
  };
}

/** Línea corta para la pantalla: el título y qué pasó. */
export function attendanceLoadErrorMessage(info: AttendanceLoadErrorInfo): string {
  return `${info.titulo}. ${info.mensaje}`;
}

/** Texto para compartir con soporte: lo que la persona ve más el código y la fecha (sin detalles técnicos). */
export function attendanceLoadErrorSupportText(info: AttendanceLoadErrorInfo, extra: { version?: string; fecha?: string } = {}): string {
  return [
    `Problema al cargar el turno: ${info.titulo}`,
    info.mensaje,
    `Código para soporte: ${info.code}`,
    extra.version ? `Versión de la aplicación: ${extra.version}` : '',
    extra.fecha ? `Fecha y hora: ${extra.fecha}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Fallos en los que sí vale la pena mostrar el último turno guardado en el teléfono: no hubo respuesta del servicio (sin red o plazo agotado). */
export function isConnectionLoadError(info: AttendanceLoadErrorInfo): boolean {
  return info.code === 'SIN-CONEXION' || info.code === 'TIEMPO-AGOTADO';
}
