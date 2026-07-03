import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { convertDateTimestampToLocalString } from '../hooks/convertDateTimestampToLocalString';
import { formatEmpleadoNombre } from '../hooks/reportesFunctions';

const ENTREGA_PUESTO_NA = 'N/A';

export type ReportesPreviewRenderOptions = {
  tipoReporte?: string;
};

const previewStyles = StyleSheet.create({
  record: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#EEF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E8FF',
  },
  field: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
    marginBottom: 2,
  },
  fieldLabel: {
    fontWeight: '700',
    color: '#111',
  },
  subRecord: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E8FF',
  },
  signature: {
    width: 160,
    height: 72,
    borderWidth: 1,
    borderColor: '#DDD',
    marginTop: 4,
    marginBottom: 4,
  },
  signatureSmall: {
    width: 140,
    height: 60,
    borderWidth: 1,
    borderColor: '#DDD',
    marginTop: 4,
    marginBottom: 4,
  },
});

function displayPreviewValue(v: unknown, fallback = '—'): string {
  if (v == null) return fallback;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  const s = String(v).trim();
  return s === '' ? fallback : s;
}

function formatReportCreatedAt(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) {
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      try {
        return convertDateTimestampToLocalString(d.toISOString()) || s;
      } catch {
        return s;
      }
    }
  }
  try {
    return convertDateTimestampToLocalString(s) || s;
  } catch {
    return s;
  }
}

function formatPreviewDateTime(raw: unknown, fallback = '—'): string {
  if (raw == null || String(raw).trim() === '') return fallback;
  return formatReportCreatedAt(String(raw));
}

function formatPreviewEmpleadoNombre(emp: any, fallback = '—'): string {
  if (!emp || typeof emp !== 'object') return fallback;
  const codigo = emp.codigo != null ? String(emp.codigo).trim() : '';
  const nombre = formatEmpleadoNombre(emp);
  if (codigo && nombre) return `${codigo} — ${nombre}`;
  return nombre || codigo || fallback;
}

function formatPreviewDeviceLines(device: unknown): string[] {
  if (device == null || String(device).trim() === '') return ['—'];
  const raw = String(device).trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return ['Sin dispositivos registrados'];
      return parsed.map((d, i) => {
        if (d == null) return `Dispositivo ${i + 1}`;
        if (typeof d === 'string') return d;
        if (typeof d === 'object') {
          const o = d as Record<string, unknown>;
          const parts = [o.model ?? o.deviceModel ?? o.name, o.platform ?? o.os, o.brand, o.deviceId ?? o.id]
            .filter((x) => x != null && String(x).trim() !== '')
            .map(String);
          return parts.length ? parts.join(' · ') : `Dispositivo ${i + 1}`;
        }
        return String(d);
      });
    }
    if (parsed != null && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      const parts = [o.model ?? o.deviceModel ?? o.name, o.platform ?? o.os, o.brand]
        .filter((x) => x != null && String(x).trim() !== '')
        .map(String);
      if (parts.length) return [parts.join(' · ')];
    }
  } catch {
    /* texto plano */
  }
  return [raw.length > 120 ? `${raw.slice(0, 117)}…` : raw];
}

function formatArticulosPuestoPreviewLines(raw: unknown): string[] {
  if (raw == null || String(raw).trim() === '') return [];
  const s = String(raw).trim();
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return parsed.map((a: any, i: number) => {
      const nombre = a?.nombre ?? 'Artículo';
      const estado = a?.estado ?? '—';
      const cant =
        a?.cantidad_real != null && a?.cantidad_requerida != null
          ? `${a.cantidad_real}/${a.cantidad_requerida}`
          : '';
      return cant ? `${nombre} (${cant}, ${estado})` : `${nombre} (${estado})`;
    });
  } catch {
    return [s.length > 200 ? `${s.slice(0, 197)}…` : s];
  }
}

function signatureUri(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith('data:image/')) return s;
  return `data:image/png;base64,${s}`;
}

function isEmptyEntregaPuestoValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function displayEntregaPuestoText(v: unknown): string {
  return isEmptyEntregaPuestoValue(v) ? ENTREGA_PUESTO_NA : String(v).trim();
}

function formatEntregaPuestoPreviewDate(raw: unknown): string {
  if (isEmptyEntregaPuestoValue(raw)) return ENTREGA_PUESTO_NA;
  const s = String(raw);
  const ymdPart = s.includes('T') ? s.split('T')[0] : s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymdPart)) {
    try {
      const [y, m, d] = ymdPart.split('-').map((x) => parseInt(x, 10));
      const iso = new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
      return convertDateTimestampToLocalString(iso, false) || ymdPart;
    } catch {
      return ymdPart;
    }
  }
  return ymdPart || ENTREGA_PUESTO_NA;
}

function formatEntregaPuestoPreviewTime(raw: unknown): string {
  if (isEmptyEntregaPuestoValue(raw)) return ENTREGA_PUESTO_NA;
  const s = String(raw).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (s.includes('T')) {
    const part = s.split('T')[1]?.split('.')[0]?.slice(0, 5);
    if (part && /^\d{2}:\d{2}$/.test(part)) return part;
  }
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    }
  } catch {
    /* ignore */
  }
  return ENTREGA_PUESTO_NA;
}

function displayEntregaPuestoTurno(v: unknown): string {
  if (isEmptyEntregaPuestoValue(v)) return ENTREGA_PUESTO_NA;
  const t = String(v).trim().toUpperCase();
  if (t === 'D') return 'Diurno';
  if (t === 'M') return 'Mixto';
  if (t === 'N') return 'Nocturno';
  return String(v).trim();
}

function displayEntregaPuestoMarcaId(v: unknown): string {
  if (v == null || v === '') return ENTREGA_PUESTO_NA;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : ENTREGA_PUESTO_NA;
}

type PreviewFieldProps = {
  label: string;
  value?: unknown;
  text?: string;
  selectable?: boolean;
  numberOfLines?: number;
};

function PreviewField({ label, value, text, selectable, numberOfLines }: PreviewFieldProps) {
  const shown = text ?? displayPreviewValue(value);
  return (
    <ThemedText selectable={selectable} style={previewStyles.field} numberOfLines={numberOfLines}>
      <ThemedText style={previewStyles.fieldLabel}>{label}: </ThemedText>
      {shown}
    </ThemedText>
  );
}

function PreviewRecord({ children }: { children: React.ReactNode }) {
  return <ThemedView style={previewStyles.record}>{children}</ThemedView>;
}

function PreviewSignature({ label, uri, small }: { label: string; uri: string | null; small?: boolean }) {
  return (
    <>
      <PreviewField label={label} text={uri ? 'Adjunta' : 'Sin firma'} />
      {uri ? (
        <Image
          source={{ uri }}
          style={small ? previewStyles.signatureSmall : previewStyles.signature}
          resizeMode="contain"
        />
      ) : null}
    </>
  );
}

function PreviewUbicacionNombre({ row }: { row: any }) {
  return (
    <>
      <PreviewField label="Empresa" value={row.empresa_nombre} />
      <PreviewField label="Cliente" value={row.cliente_nombre} />
      <PreviewField label="División" value={row.division_nombre} />
      <PreviewField label="Contrato" value={row.contrato_nombre} />
      <PreviewField label="Corpo" value={row.corpo_nombre} />
      <PreviewField label="Puesto" value={row.puesto_nombre} />
    </>
  );
}

function PreviewUbicacionTxt({ row }: { row: any }) {
  return (
    <>
      <PreviewField label="Empresa" value={row.empresa_txt} />
      <PreviewField label="Cliente" value={row.cliente_txt} />
      <PreviewField label="División" value={row.division_txt} />
      <PreviewField label="Contrato" value={row.contrato_txt} />
      <PreviewField label="Corpo" value={row.corpo_txt} />
      <PreviewField label="Puesto" value={row.puesto_txt} />
    </>
  );
}

function PreviewDeviceFields({ labelPrefix, device }: { labelPrefix: string; device: unknown }) {
  const lines = formatPreviewDeviceLines(device);
  if (lines.length <= 1) {
    return <PreviewField label={labelPrefix} text={lines[0]} />;
  }
  return (
    <>
      {lines.map((line, i) => (
        <PreviewField key={`${labelPrefix}-${i}`} label={`${labelPrefix} ${i + 1}`} text={line} />
      ))}
    </>
  );
}

export function reportesPreviewRowKey(modulo: string, row: any, idx: number): string {
  const rowKey = row?.id ?? row?.sessionId ?? row?.numero ?? 'row';
  return `prev-${modulo}-${rowKey}-${idx}`;
}

export function renderReportesPreviewRow(
  modulo: string,
  row: any,
  idx: number,
  options?: ReportesPreviewRenderOptions,
): React.ReactElement {
  const key = reportesPreviewRowKey(modulo, row, idx);

  switch (modulo) {
    case 'ingresos_usuario':
      return (
        <PreviewRecord>
          <PreviewField label="Empleado" text={formatPreviewEmpleadoNombre(row.c_empleado)} />
          <PreviewField label="Id de sesión" value={row.sessionId} />
          <PreviewField label="Creado" text={formatPreviewDateTime(row.createdAt)} />
          <PreviewField label="Expira" text={formatPreviewDateTime(row.expiresAt)} />
          <PreviewField label="Revocado" value={row.revoked} />
          <PreviewDeviceFields labelPrefix="Dispositivo" device={row.device} />
        </PreviewRecord>
      );

    case 'login_marca':
      return (
        <PreviewRecord>
          <PreviewField label="Empleado" value={row.nombre_empleado} />
          <PreviewField label="Cédula" value={row.cedula_empleado} />
          <PreviewField
            label="Fecha y hora"
            text={displayPreviewValue(row.fecha_hora_txt, formatPreviewDateTime(row.fecha_hora))}
          />
          <PreviewField label="Puesto" value={row.puesto_nombre} />
          <PreviewField label="Entrada teórica" value={row.marca_entrada_teorica_txt} />
          <PreviewField label="Entrada real" value={row.marca_entrada_real_txt} />
          <PreviewField label="Salida teórica" value={row.marca_salida_teorica_txt} />
          <PreviewField label="Salida real" value={row.marca_salida_real_txt} />
          {row.hora_inicio_almuerzo_txt || row.hora_fin_almuerzo_txt ? (
            <>
              <PreviewField label="Inicio almuerzo" value={row.hora_inicio_almuerzo_txt} />
              <PreviewField label="Fin almuerzo" value={row.hora_fin_almuerzo_txt} />
            </>
          ) : null}
          <PreviewDeviceFields labelPrefix="Dispositivo" device={row.device} />
          <PreviewField label="Latitud" value={row.lat} />
          <PreviewField label="Longitud" value={row.lng} />
        </PreviewRecord>
      );

    case 'acciones_personales':
      return (
        <PreviewRecord>
          <PreviewField label="Empleado" value={row.empleado_txt} />
          <PreviewField label="Tipo de acción" value={row.tipo_accion_txt} />
          <PreviewUbicacionTxt row={row} />
          <PreviewField label="Plaza" value={row.plaza_txt} />
          <PreviewField label="Fecha inicio" value={row.fecha_inicio_txt} />
          <PreviewField label="Fecha fin" value={row.fecha_fin_txt} />
        </PreviewRecord>
      );

    case 'agenda_minuta':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha_txt ?? row.fecha} />
          <PreviewSignature label="Firma responsable" uri={signatureUri(row.firma_responsable_data_uri || row.firma_responsable)} />
          {(row.participantes_preview || []).map((p: any, j: number) => (
            <ThemedView key={`${key}-p-${j}`} style={previewStyles.subRecord}>
              <PreviewField label="Participante" value={p.nombre} />
              <PreviewField label="Puesto participante" value={p.puesto} />
              <PreviewSignature label="Firma participante" uri={signatureUri(p.firma_data_uri || p.firma)} small />
            </ThemedView>
          ))}
        </PreviewRecord>
      );

    case 'apertura_cierre_puesto':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" text={displayPreviewValue(row.fecha_txt, formatPreviewDateTime(row.fecha))} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Tipo" value={row.tipo_txt ?? row.tipo} />
          <PreviewField label="Creado por" value={row.creador_nombre} />
          {(row.imagenes_names || []).length > 0 ? (
            <PreviewField label="Imágenes adjuntas" value={(row.imagenes_names as string[]).length} />
          ) : null}
          <PreviewSignature label="Firma responsable" uri={signatureUri(row.firma_responsable_data_uri || row.firma_responsable)} />
        </PreviewRecord>
      );

    case 'apreciacion_vulnerabilidad':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" text={displayPreviewValue(row.fecha_txt, formatPreviewDateTime(row.fecha))} />
          <PreviewUbicacionNombre row={row} />
          {row.observaciones != null && String(row.observaciones).trim() !== '' ? (
            <PreviewField label="Observaciones" text={String(row.observaciones).slice(0, 400)} selectable numberOfLines={6} />
          ) : null}
          <PreviewSignature label="Firma solicitante" uri={signatureUri(row.firma_solicitante_data_uri || row.firma_solicitante)} />
          <PreviewSignature label="Firma responsable" uri={signatureUri(row.firma_responsable_data_uri || row.firma_responsable)} />
        </PreviewRecord>
      );

    case 'actividades':
      return (
        <PreviewRecord>
          <PreviewField label="Actividad" value={row.nombre_actividad} />
          <PreviewField label="Fecha" value={row.fecha_txt} />
          {row.frecuencia_titulo ? <PreviewField label="Frecuencia" value={row.frecuencia_titulo} /> : null}
          {row.frecuencia_horario ? <PreviewField label="Horario" value={row.frecuencia_horario} /> : null}
          <PreviewField
            label="Descripción"
            text={
              row.descripcion_actividad != null && String(row.descripcion_actividad).trim() !== ''
                ? String(row.descripcion_actividad)
                : '—'
            }
            selectable
          />
        </PreviewRecord>
      );

    case 'control_asistencia':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha_txt ?? row.fecha} />
          <PreviewField label="Turno" value={row.turno_label ?? row.turno} />
          <PreviewField label="Supervisor" value={row.nombre_supervisor} />
          <PreviewSignature
            label="Firma supervisor"
            uri={signatureUri(row.firma_manual_supervisor_data_uri || row.firma_manual_supervisor)}
          />
        </PreviewRecord>
      );

    case 'documentos_entregados':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha_txt ?? row.fecha} />
          <PreviewField label="Tipo de documento" value={row.tipo_documento} />
          <PreviewField label="Oficial entrega" value={row.nombre_oficial_entrega} />
          <PreviewField label="Oficial recibe" value={row.nombre_oficial_recibe} />
          <PreviewSignature
            label="Firma representante cliente"
            uri={signatureUri(row.firma_representante_cliente_data_uri || row.firma_representante_cliente)}
          />
        </PreviewRecord>
      );

    case 'encuesta_satisfaccion':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha_txt ?? row.fecha} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Responsable" value={row.responsable_nombre} />
          {row.evaluaciones_resumen != null && String(row.evaluaciones_resumen).trim() !== '' ? (
            <PreviewField label="Evaluaciones" text={String(row.evaluaciones_resumen)} selectable numberOfLines={8} />
          ) : null}
          <PreviewSignature label="Firma evaluado" uri={signatureUri(row.firma_evaluado_data_uri || row.firma_evaluado)} />
        </PreviewRecord>
      );

    case 'registro_visitas':
      return (
        <PreviewRecord>
          <PreviewField label="Nombre" value={row.nombre} />
          <PreviewField label="Cédula" value={row.cedula} />
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.e_estructura_cliente?.nombre} />
          <PreviewField label="División" value={row.division_nombre} />
          <PreviewField label="Contrato" value={row.contrato_nombre} />
          <PreviewField label="Sucursal" value={row.e_estructura_sucursal?.nombre} />
          <PreviewField label="Puesto" value={row.e_estructura_puesto?.nombre} />
          <PreviewField label="Responsable" value={row.responsable_label} />
          <PreviewField
            label="Activos registrados"
            value={Array.isArray(row.e_activo_visitante) ? row.e_activo_visitante.length : 0}
          />
        </PreviewRecord>
      );

    case 'visitas_vehiculos':
      return (
        <PreviewRecord>
          <PreviewField label="Placa" value={row.placa} />
          <PreviewField label="Tipo" value={row.tipo} />
          <PreviewField label="Nombre" value={row.nombre} />
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.e_estructura_cliente?.nombre} />
          <PreviewField label="División" value={row.division_nombre} />
          <PreviewField label="Contrato" value={row.contrato_nombre} />
          <PreviewField label="Sucursal" value={row.e_estructura_sucursal?.nombre} />
          <PreviewField label="Puesto" value={row.e_estructura_puesto?.nombre} />
          <PreviewField label="Hora entrada" value={row.hora_entrada} />
          <PreviewField label="Hora salida" value={row.hora_salida} />
          <PreviewField label="Responsable" value={row.responsable_label} />
        </PreviewRecord>
      );

    case 'evaluacion_personal':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.created_at_txt} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Tipo" value={row.tipo} />
          <PreviewField label="Evaluado" value={row.empleado_evaluado_txt} />
          <PreviewField label="Evaluador" value={row.evaluador_txt} />
          <PreviewSignature label="Firma evaluador" uri={signatureUri(row.firma_evaluador_data_uri || row.firma_evaluador)} />
          <PreviewSignature label="Firma empleado" uri={signatureUri(row.firma_empleado_data_uri || row.firma_empleado)} />
        </PreviewRecord>
      );

    case 'articulos_puesto':
      return (
        <PreviewRecord>
          <PreviewField label="Puesto" value={row.puesto_txt} />
          <PreviewUbicacionTxt row={row} />
          <PreviewField label="Cantidad de artículos" value={row.articulos_count ?? 0} />
        </PreviewRecord>
      );

    case 'mantenimiento_articulos':
      return (
        <PreviewRecord>
          <PreviewField label="Registro" value={row.id != null ? `#${row.id}` : undefined} />
          <PreviewField label="Artículo" value={row.articulo_nombre} />
          <PreviewField label="Estado" value={row.estado} />
          <PreviewField label="Puesto" value={row.puesto_txt} />
          <PreviewField label="Origen" value={row.origen} />
          <PreviewField label="Acción" value={row.accion} />
          <PreviewUbicacionTxt row={row} />
          <PreviewField label="Creado" value={row.created_at_txt} />
          <PreviewField label="Solucionado" value={row.fecha_solucion_txt} />
        </PreviewRecord>
      );

    case 'registro_vehiculos_corporativos':
      return (
        <PreviewRecord>
          <PreviewField label="Placa" value={row.placa || 'Sin placa'} />
          <PreviewField label="Tipo" value={row.tipo} />
          <PreviewField label="Tipo autoría" value={row.tipo_autoria} />
          <PreviewField label="Marca" value={row.marca} />
          <PreviewField label="Modelo" value={row.modelo} />
          <PreviewField label="Año" value={row.anno} />
          <PreviewField label="Estado" value={row.estado} />
          <PreviewUbicacionTxt row={row} />
          <PreviewField label="Creado" value={row.created_at_txt} />
          <PreviewField label="Usos" value={row.usos_count ?? 0} />
          <PreviewField label="Mantenimientos" value={row.mantenimientos_count ?? 0} />
        </PreviewRecord>
      );

    case 'revision_vehiculos':
      return (
        <PreviewRecord>
          <PreviewField label="Registro" value={row.id != null ? `#${row.id}` : undefined} />
          <PreviewField label="Tipo" value={row.tipo} />
          <PreviewField label="Vehículo" value={row.vehiculo_txt} />
          <PreviewUbicacionTxt row={row} />
          <PreviewField label="Creado" value={row.created_at_txt} />
          <PreviewField label="Ítems info. general" value={row.info_general_count ?? 0} />
          <PreviewField label="Ítems revisión" value={row.info_revision_count ?? 0} />
          <PreviewField label="Movimientos" value={row.movimientos_count ?? 0} />
        </PreviewRecord>
      );

    case 'manuales_puesto':
      return (
        <PreviewRecord>
          <PreviewField label="Título" value={row.title} />
          <PreviewField label="Fecha" value={row.created_at_txt} />
          <PreviewUbicacionTxt row={row} />
          <PreviewField label="Puesto principal" value={row.puesto_principal_txt} />
          <PreviewField label="Descripción" text={String(row.description ?? '').slice(0, 400)} selectable numberOfLines={6} />
        </PreviewRecord>
      );

    case 'producto_no_conforme':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha registro" value={row.created_at_txt} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Tipo de servicio" value={row.tipo_servicio_no_conforme} />
          <PreviewField label="Fecha identificación" value={row.fecha_identificacion_txt} />
          <PreviewField label="Persona que identificó" value={row.persona_identifico_pnc} />
          <PreviewField label="Persona que originó" value={row.persona_origino_pnc} />
          <PreviewField label="Descripción" text={String(row.descripcion ?? '').slice(0, 400)} selectable numberOfLines={6} />
          <PreviewSignature
            label="Firma persona que identificó"
            uri={signatureUri(row.firma_persona_identifico_pnc_data_uri || row.firma_persona_identifico_pnc)}
          />
          <PreviewSignature
            label="Firma persona que originó"
            uri={signatureUri(row.firma_persona_origino_pnc_data_uri || row.firma_persona_origino_pnc)}
          />
        </PreviewRecord>
      );

    case 'notas_voz':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha_txt} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Título" value={row.titulo} />
          {row.descripcion != null && String(row.descripcion).trim() !== '' ? (
            <PreviewField label="Descripción" text={String(row.descripcion)} selectable numberOfLines={4} />
          ) : null}
          {row.transcripcion != null && String(row.transcripcion).trim() !== '' ? (
            <PreviewField label="Transcripción" text={String(row.transcripcion)} selectable numberOfLines={6} />
          ) : null}
          <PreviewField label="Creado por" value={row.creador_nombre} />
        </PreviewRecord>
      );

    case 'cambios_ubicacion_puesto':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha_txt} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Latitud anterior" value={row.latitud_anterior_txt} />
          <PreviewField label="Longitud anterior" value={row.longitud_anterior_txt} />
          <PreviewField label="Latitud nueva" value={row.latitud_nueva_txt} />
          <PreviewField label="Longitud nueva" value={row.longitud_nueva_txt} />
          <PreviewField label="Responsable" value={row.responsable_nombre} />
        </PreviewRecord>
      );

    case 'registro_capacitaciones':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha_txt} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Tipo" value={row.tipo} />
          <PreviewField label="Título" value={row.titulo} />
          {row.empleados_cap_txt ? (
            <PreviewField label="Empleados" text={String(row.empleados_cap_txt)} selectable numberOfLines={4} />
          ) : null}
          {row.puestos_cap_txt ? (
            <PreviewField label="Puestos" text={String(row.puestos_cap_txt)} selectable numberOfLines={4} />
          ) : null}
          <PreviewField label="Responsable" value={row.responsable_nombre} />
        </PreviewRecord>
      );

    case 'tiempo_almuerzo':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Empleado" value={row.empleado_nombre} />
          <PreviewField label="Cédula" value={row.cedula_empleado} />
          <PreviewField label="Inicio" value={row.inicio_txt} />
          <PreviewField label="Fin" value={row.fin_txt} />
          <PreviewField label="Minutos" value={row.minutos_almuerzo} />
          <PreviewField label="Registro manual" value={row.es_manual} />
          {(row.pausas_list || []).length > 0 ? (
            <PreviewField label="Pausas registradas" value={(row.pausas_list as any[]).length} />
          ) : null}
        </PreviewRecord>
      );

    case 'solicitudes_permiso':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha registro" value={row.created_at_txt} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Empleado" value={row.empleado_nombre} />
          <PreviewField label="Código empleado" value={row.empleado_codigo} />
          <PreviewField label="Ejecutivo de cuenta" value={row.ejecutivo_cuenta_nombre} />
          <PreviewField label="Fecha inicio" value={row.fecha_inicio_txt} />
          <PreviewField label="Fecha fin" value={row.fecha_fin_txt} />
          <PreviewField label="Días de permiso" value={row.dias_permiso} />
          <PreviewField label="Tipo salario" value={row.tipo} />
          <PreviewField label="Estado" value={row.estado} />
          {row.motivo_txt || row.motivo ? (
            <PreviewField label="Motivo" value={row.motivo_txt ?? row.motivo} />
          ) : null}
          {row.observaciones_txt || row.observaciones ? (
            <PreviewField label="Observaciones" value={row.observaciones_txt ?? row.observaciones} />
          ) : null}
          <PreviewSignature
            label="Firma empleado (manual)"
            uri={signatureUri(row.firma_empleado_manual_data_uri || row.firma_empleado_manual)}
          />
          <PreviewSignature
            label="Firma ejecutivo (manual)"
            uri={signatureUri(row.firma_ejecutivo_manual_data_uri || row.firma_ejecutivo_cuenta_manual)}
          />
        </PreviewRecord>
      );

    case 'registro_induccion_recorrido': {
      let participantes: any[] = [];
      try {
        const p = JSON.parse(String(row.participantes ?? '[]'));
        if (Array.isArray(p)) participantes = p;
      } catch {
        participantes = [];
      }
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.created_at_txt} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Responsable" value={row.created_by_nombre} />
          <PreviewField label="Empleado" value={row.empleado_txt} />
          <PreviewSignature label="Firma supervisor" uri={signatureUri(row.firma_supervisor_data_uri || row.firma_supervisor)} />
          <PreviewSignature label="Firma empleado" uri={signatureUri(row.firma_empleado_data_uri || row.firma_empleado)} />
          {participantes.map((p, j) => (
            <ThemedView key={`${key}-p-${j}`} style={previewStyles.subRecord}>
              <PreviewField label="Participante" value={p?.nombre_completo} />
              <PreviewField label="Cédula participante" value={p?.cedula} />
              <PreviewSignature label="Firma participante" uri={signatureUri(p?.firma)} small />
            </ThemedView>
          ))}
        </PreviewRecord>
      );
    }

    case 'registro_induccion_general':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha_txt} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Creador" value={row.empleado_creador_nombre} />
          <PreviewSignature label="Firma responsable" uri={signatureUri(row.firma_responsable_data_uri || row.firma_responsable)} />
          {(row.colaboradores_preview || []).map((p: any, j: number) => (
            <ThemedView key={`${key}-col-${j}`} style={previewStyles.subRecord}>
              <PreviewField label="Colaborador" value={p?.nombre} />
              <PreviewField label="Cédula colaborador" value={p?.cedula} />
              <PreviewSignature label="Firma colaborador" uri={signatureUri(p?.firma_data_uri || p?.firma)} small />
            </ThemedView>
          ))}
          {(row.capacitadores_preview || []).map((p: any, j: number) => (
            <ThemedView key={`${key}-cap-${j}`} style={previewStyles.subRecord}>
              <PreviewField label="Capacitador" value={p?.nombre} />
              <PreviewField label="Cédula capacitador" value={p?.cedula} />
              <PreviewSignature label="Firma capacitador" uri={signatureUri(p?.firma_data_uri || p?.firma)} small />
            </ThemedView>
          ))}
        </PreviewRecord>
      );

    case 'mutuos_acuerdos':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.created_at_txt} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Ejecutivo" value={row.ejecutivo_nombre} />
          <PreviewField label="Empleado ausente" value={row.empleado_ausente_txt} />
          <PreviewField label="Empleado reemplaza" value={row.empleado_reemplaza_txt} />
          <PreviewField label="Marca ausente" value={row.marca_ausente_txt} />
          <PreviewField label="Marca reemplaza" value={row.marca_reemplaza_txt} />
          <PreviewSignature
            label="Firma ejecutivo (manual)"
            uri={signatureUri(row.firma_ejecutivo_manual_data_uri || row.firma_ejecutivo_cuenta_manual)}
          />
        </PreviewRecord>
      );

    case 'entrega_puesto': {
      const isConsolidado = options?.tipoReporte === 'Consolidado';
      const oficialEntrega = row.oficial_entrega_display ?? displayEntregaPuestoText(row.oficial_entrega);
      const articulosLines = formatArticulosPuestoPreviewLines(row.articulos_puesto_preview);
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Corpo" value={row.corpo_nombre} />
          <PreviewField label="Puesto" value={row.puesto_nombre} />
          <PreviewField label="Oficial entrega" text={oficialEntrega} />
          <PreviewField
            label="Fecha entrada (entrega)"
            text={row.fecha_entrada_entrega_display ?? formatEntregaPuestoPreviewDate(row.fecha_entrada_entrega)}
          />
          <PreviewField
            label="Hora entrada (entrega)"
            text={row.hora_entrada_entrega_display ?? formatEntregaPuestoPreviewTime(row.hora_entrada_entrega)}
          />
          <PreviewField
            label="Fecha salida (entrega)"
            text={row.fecha_salida_entrega_display ?? formatEntregaPuestoPreviewDate(row.fecha_salida_entrega)}
          />
          <PreviewField
            label="Hora salida (entrega)"
            text={row.hora_salida_entrega_display ?? formatEntregaPuestoPreviewTime(row.hora_salida_entrega)}
          />
          <PreviewField
            label="Turno entrega"
            text={row.turno_entrega_display ?? displayEntregaPuestoTurno(row.turno_entrega)}
          />
          {isConsolidado ? (
            <PreviewField
              label="Marca entrega ID"
              text={row.marca_entrega_id_display ?? displayEntregaPuestoMarcaId(row.marca_entrega_id)}
            />
          ) : null}
          <PreviewField label="Oficial recibe" value={row.oficial_recibe} />
          {isConsolidado ? (
            <PreviewField
              label="Marca recibe ID"
              text={row.marca_recibe_id_display ?? displayEntregaPuestoMarcaId(row.marca_recibe_id)}
            />
          ) : null}
          <PreviewField label="Turno recibe" value={row.turno_recibe} />
          {articulosLines.map((line, j) => (
            <PreviewField key={`${key}-art-${j}`} label={j === 0 ? 'Artículo' : `Artículo ${j + 1}`} text={line} selectable />
          ))}
          <PreviewSignature
            label={`Firma entrega (${oficialEntrega})`}
            uri={signatureUri(row.firma_entrega_data_uri || row.firma_entrega)}
            small
          />
          <PreviewSignature
            label={`Firma recibe (${displayPreviewValue(row.oficial_recibe)})`}
            uri={signatureUri(row.firma_recibe_data_uri || row.firma_recibe)}
            small
          />
        </PreviewRecord>
      );
    }

    case 'incidentes':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha reporte" text={formatPreviewDateTime(row.fecha_reporte)} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Clasificación" value={row.clasificacion_nombre} />
          <PreviewField label="Estado" value={row.estado} />
          <PreviewField label="Ejecutivo de cuenta" value={row.ejecutivo_cuenta_nombre} />
          {row.descripcion != null && String(row.descripcion).trim() !== '' ? (
            <PreviewField label="Descripción" text={String(row.descripcion).slice(0, 400)} selectable numberOfLines={6} />
          ) : null}
          <PreviewField label="Solución estimada" text={formatPreviewDateTime(row.fecha_solucion)} />
          <PreviewField label="Solución real" text={formatPreviewDateTime(row.fecha_real_solucion)} />
        </PreviewRecord>
      );

    case 'bitacora_novedades':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Puesto" value={row.puesto_nombre} />
          <PreviewField label="Título" value={row.titulo} />
          <PreviewField label="Categoría" value={row.categoria_nombre} />
          <PreviewField label="Relevancia" value={row.relevancia} />
        </PreviewRecord>
      );

    case 'maestro_quejas':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha queja" value={row.fecha_queja} />
          <PreviewField label="Motivo" value={row.motivo_queja} />
          <PreviewField label="Medio de recepción" value={row.medio_recepcion_queja} />
          <PreviewField label="Tipo de queja" value={row.tipo_queja} />
          <PreviewField label="Nivel" value={row.nivel_queja} />
        </PreviewRecord>
      );

    case 'checklist_supervision':
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha != null ? String(row.fecha) : undefined} />
          <PreviewUbicacionNombre row={row} />
          <PreviewField label="Ejecutivo de cuenta" value={row.ejecutivo_cuenta_nombre} />
        </PreviewRecord>
      );

    case 'llaves':
      return (
        <PreviewRecord>
          <PreviewField label="Número de llave" value={row.numero_llave} />
          <PreviewField label="Lugar que abre" value={row.lugar_abre} />
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Corpo" value={row.corpo_nombre} />
          <PreviewField label="Puesto" value={row.puesto_nombre} />
          <PreviewField label="Movimientos" value={row.movimientos_count ?? 0} />
        </PreviewRecord>
      );

    case 'llaveros':
      return (
        <PreviewRecord>
          <PreviewField label="Número de llavero" value={row.numero_llavero} />
          <PreviewField label="Nombre llavero" value={row.nombre_llavero} />
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Corpo" value={row.corpo_nombre} />
          <PreviewField label="Puesto" value={row.puesto_nombre} />
          <PreviewField label="Movimientos" value={row.movimientos_count ?? 0} />
          <PreviewField label="Llaves vinculadas" value={row.llaves_vinculadas_count ?? 0} />
        </PreviewRecord>
      );

    case 'acta_entrega_productos':
    default:
      return (
        <PreviewRecord>
          <PreviewField label="Empresa" value={row.empresa_nombre} />
          <PreviewField label="Cliente" value={row.cliente_nombre} />
          <PreviewField label="Fecha" value={row.fecha} />
          <PreviewSignature label="Firma entrega" uri={signatureUri(row.firma_entrega_data_uri || row.firma_entrega)} small />
          <PreviewSignature label="Firma recibe" uri={signatureUri(row.firma_recibe_data_uri || row.firma_recibe)} small />
        </PreviewRecord>
      );
  }
}
