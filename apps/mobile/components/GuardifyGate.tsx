import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { describeDeviceStatus } from '@/hooks/deviceNotApproved';
import {
  beginGuardifyWipe,
  endGuardifySession,
  ensureGuardifySession,
  getGuardifySnapshot,
  installGuardifyUpdate,
  refreshGuardifyStatus,
  registerGuardifyDevice,
  setGuardifyHandlers,
  setLocationConsent,
  startGuardifyBackground,
  subscribeGuardify,
} from '@/hooks/guardifyClient';
import { gateScreenFor, isGateOpen } from '@/hooks/guardifyLogic';


type Props = {
  /** Cierra la sesión local de la app. */
  logout: () => Promise<unknown>;
  /** Hay una persona con sesión iniciada en la app. */
  isAuthenticated: boolean;
  /** Cédula del empleado con sesión (la que Guardify conoce como `externalUserId`). */
  cedula: string | null;
};

/**
 * Integración con Guardify (issues #145, #147 y #148). No dibuja nada mientras el equipo esté habilitado; encima de toda la app muestra:
 *  - el registro del equipo (código de empresa si la build no lo trae) y la espera de aprobación;
 *  - los estados rechazado, bloqueado, retirado y «sin permiso de uso» (política sin conexión);
 *  - la actualización obligatoria, con descarga del APK del catálogo de Guardify;
 *  - el borrado remoto en curso: la app se bloquea mientras sincroniza lo pendiente y después borra los datos locales;
 *  - el aviso de ubicación (una vez), con el que la persona acepta o no que Guardify vea la ubicación del equipo.
 * Además mantiene en marcha los latidos, la consulta de órdenes y la renovación del permiso, y abre/cierra la sesión de Guardify junto
 * con la de la app.
 */
export default function GuardifyGate({ logout, isAuthenticated, cedula }: Props) {
  const snap = useSyncExternalStore(subscribeGuardify, getGuardifySnapshot, getGuardifySnapshot);
  const [code, setCode] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const logoutRef = useRef(logout);
  const cedulaRef = useRef(cedula);
  logoutRef.current = logout;
  cedulaRef.current = cedula;

  // Ciclo en segundo plano y órdenes de la consola.
  useEffect(() => {
    setGuardifyHandlers({
      getCedula: () => cedulaRef.current,
      logout: () => logoutRef.current(),
    });
    const stop = startGuardifyBackground();
    return () => {
      stop();
      setGuardifyHandlers(null);
    };
  }, []);

  // La sesión de Guardify sigue a la de la app: se abre con la cédula del empleado (también para sesiones que ya existían antes de integrar
  // Guardify) y se cierra al cerrar sesión. Si Guardify no le da acceso a esa persona, se cierra su sesión en la app.
  const sdkKind = snap.sdk.kind;
  const wiping = !!snap.wipe;
  useEffect(() => {
    if (!snap.ready || !snap.enabled) return;
    // Durante un borrado la sesión de Guardify no se vuelve a abrir (la orden la acaba de cerrar).
    if (isAuthenticated && cedula && sdkKind === 'signed_out' && !wiping) {
      let cancelled = false;
      void ensureGuardifySession(cedula).then(async (result) => {
        if (cancelled || result !== 'denied') return;
        Alert.alert('Acceso no autorizado', getGuardifySnapshot().error || 'Guardify no autorizó el acceso de este usuario en este equipo.');
        await logoutRef.current();
      });
      return () => {
        cancelled = true;
      };
    }
    // Con un borrado en curso la sesión de la app se conserva: hace falta para sincronizar lo pendiente antes de borrar.
    if (!isAuthenticated && sdkKind === 'operational') void endGuardifySession();
  }, [snap.ready, snap.enabled, isAuthenticated, cedula, sdkKind, wiping]);

  // Equipo retirado: mismo borrado que una orden `WIPE` (primero se sincroniza lo pendiente; plazo máximo de 72 h).
  useEffect(() => {
    if (sdkKind === 'retired') void beginGuardifyWipe('retired');
  }, [sdkKind]);

  if (!snap.ready || !snap.enabled) return null;
  const screen = gateScreenFor(snap.sdk, { needsCode: snap.needsCode, updateRequired: !!snap.update?.required, wipePending: !!snap.wipe });

  // Aviso de ubicación: una sola vez, con el equipo habilitado y la persona dentro de la app (no sobre otra pantalla de bloqueo).
  if (!screen && snap.locationConsent === null && isAuthenticated && isGateOpen(snap.sdk)) {
    return (
      <Modal visible animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Ubicación del equipo</Text>
          <Text style={styles.body}>
            Tu empresa puede ver la ubicación de este equipo en un mapa mientras usas la aplicación. Solo se envía con tu autorización y puedes
            seguir trabajando si no la das; las acciones que registras siguen guardando su ubicación como hasta ahora.
          </Text>
          <TouchableOpacity style={styles.primary} onPress={() => void setLocationConsent('granted')} accessibilityRole="button">
            <Text style={styles.primaryText}>Aceptar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => void setLocationConsent('declined')} accessibilityRole="button">
            <Text style={styles.secondaryText}>No, gracias</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  if (!screen) return null;

  const info = describeDeviceStatus(screen.status, screen.reason);
  const apk = snap.update?.apk ?? null;

  const onInstall = async () => {
    setUpdating(true);
    setUpdateError(null);
    const result = await installGuardifyUpdate();
    if (!result.ok && !result.cancelled) setUpdateError(result.message ?? 'No se pudo descargar la actualización.');
    setUpdating(false);
  };

  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.container}>
        {screen.mode === 'wipe' ? (
          <>
            <Text style={styles.title}>Equipo en proceso de borrado</Text>
            <Text style={styles.body}>
              Un administrador ordenó borrar los datos de este equipo. Estamos enviando lo que quedó pendiente y, al terminar, se borrarán los datos
              locales. Mantén el equipo con conexión a internet.
            </Text>
            <Text style={styles.hint}>
              {snap.wipe && snap.wipe.pending > 0
                ? `Pendientes por enviar: ${snap.wipe.pending}.`
                : 'No hay datos pendientes por enviar.'}
            </Text>
            {snap.wipe ? <ActivityIndicator style={styles.spinner} /> : null}
          </>
        ) : screen.mode === 'update' ? (
          <>
            <Text style={styles.title}>Actualiza la app</Text>
            <Text style={styles.body}>
              {`Esta versión ya no se puede usar. Instala la versión ${snap.update?.minAppVersion ?? snap.update?.version ?? 'más reciente'} o posterior para continuar.`}
            </Text>
            {apk ? (
              <TouchableOpacity style={styles.primary} onPress={onInstall} disabled={updating} accessibilityRole="button">
                {updating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{`Descargar e instalar ${apk.version}`}</Text>}
              </TouchableOpacity>
            ) : (
              <Text style={styles.hint}>Pide el instalador actualizado a tu administrador.</Text>
            )}
            {updateError ? <Text style={styles.error}>{updateError}</Text> : null}
          </>
        ) : (
          <>
            <Text style={styles.title}>{screen.mode === 'register' ? 'Registrar este equipo' : info.title}</Text>
            <Text style={styles.body}>
              {screen.mode === 'register'
                ? 'Escribe el código de empresa para registrar este equipo. Un administrador deberá aprobarlo antes de que puedas ingresar.'
                : screen.message ?? info.body}
            </Text>
            {screen.mode === 'register' ? (
              <>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="Código de empresa"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!snap.busy}
                />
                <TouchableOpacity
                  style={styles.primary}
                  onPress={() => void registerGuardifyDevice(code)}
                  disabled={snap.busy || !code.trim()}
                  accessibilityRole="button"
                >
                  {snap.busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Registrar equipo</Text>}
                </TouchableOpacity>
              </>
            ) : screen.canRetry ? (
              <TouchableOpacity style={styles.primary} onPress={() => void refreshGuardifyStatus()} disabled={snap.busy} accessibilityRole="button">
                {snap.busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Reintentar</Text>}
              </TouchableOpacity>
            ) : null}
            {snap.error ? <Text style={styles.error}>{snap.error}</Text> : null}
            {isAuthenticated ? (
              <TouchableOpacity style={styles.secondary} onPress={() => void logoutRef.current()} accessibilityRole="button">
                <Text style={styles.secondaryText}>Cerrar sesión</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#111111', textAlign: 'center', marginBottom: 16 },
  body: { fontSize: 16, color: '#333333', textAlign: 'center', marginBottom: 24 },
  hint: { fontSize: 14, color: '#555555', textAlign: 'center', marginBottom: 16 },
  spinner: { marginTop: 8 },
  error: { fontSize: 14, color: '#B00020', textAlign: 'center', marginBottom: 16 },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#C7C7CC',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  primary: { backgroundColor: '#007AFF', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12, minWidth: 200, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondary: { paddingVertical: 12, paddingHorizontal: 24 },
  secondaryText: { color: '#007AFF', fontSize: 16 },
});
