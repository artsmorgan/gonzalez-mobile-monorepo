/**
 * Política de seguridad de Android (issues #177 «Backup» y #180 «Permisos»). Parte PURA, sin dependencias, para poder probarla en Node y
 * para que `withAndroidSecurityPolicy.js` (el plugin de Expo) y el manifiesto commiteado salgan SIEMPRE del mismo lugar.
 */

/**
 * Permisos que la app NO usa y se quitan del manifiesto final (se agregan con `tools:node="remove"`, que también limpia los que aportan las
 * librerías al fusionar manifiestos). Ver `docs/android-permisos.md` para el porqué de cada uno.
 *  - SYSTEM_ALERT_WINDOW: superposición sobre otras apps; la plantilla de Expo lo agrega para el menú de desarrollo. El manifiesto de DEBUG lo
 *    declara por su cuenta, así que el modo debug no se ve afectado.
 *  - READ/WRITE_EXTERNAL_STORAGE: la app guarda sus archivos en el almacenamiento propio (\`Paths.document\`) y descarga con el selector de
 *    carpetas del sistema (SAF); no lee ni escribe almacenamiento compartido. \`expo-file-system\` los declara por defecto.
 */
const REMOVED_PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

/**
 * Datos que NO viajan en las copias de seguridad ni en la transferencia entre equipos: la app guarda ahí la sesión (SecureStore usa
 * SharedPreferences), las colas sin conexión, la jerarquía, ubicaciones, vehículos, visitas y firmas (AsyncStorage = base de datos; los
 * archivos de \`Paths.document\`). Se excluye todo: lo que se necesite se vuelve a descargar al iniciar sesión.
 */
const BACKUP_EXCLUDED_DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external'];

function excludes(indent) {
  return BACKUP_EXCLUDED_DOMAINS.map((d) => `${indent}<exclude domain="${d}" path="." />`).join('\n');
}

/** Android 11 e inferior (`android:fullBackupContent`). */
function buildFullBackupContentXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Issue #177: ningún dato de la app viaja en copias de seguridad (sesión, colas, firmas y cachés se vuelven a obtener al iniciar sesión). -->
<full-backup-content>
${excludes('  ')}
</full-backup-content>
`;
}

/** Android 12 y superior (`android:dataExtractionRules`): copia en la nube y transferencia entre equipos. */
function buildDataExtractionRulesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Issue #177: ningún dato de la app viaja en la copia en la nube ni al transferir de equipo a equipo. -->
<data-extraction-rules>
  <cloud-backup>
${excludes('    ')}
  </cloud-backup>
  <device-transfer>
${excludes('    ')}
  </device-transfer>
</data-extraction-rules>
`;
}

const BACKUP_FILES = {
  'backup_rules.xml': buildFullBackupContentXml,
  'data_extraction_rules.xml': buildDataExtractionRulesXml,
};

/** Atributos del `<application>` que enlazan las reglas. */
function backupApplicationAttributes() {
  return {
    'android:fullBackupContent': '@xml/backup_rules',
    'android:dataExtractionRules': '@xml/data_extraction_rules',
  };
}

/**
 * Aplica la política a un manifiesto como lo representa `@expo/config-plugins` (`{ manifest: { $, 'uses-permission': [...], application: [{ $ }] } }`).
 * Idempotente: aplicarla dos veces da lo mismo.
 */
function applySecurityPolicyToManifest(androidManifest) {
  const manifest = androidManifest.manifest;
  manifest.$ = manifest.$ || {};
  manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

  const perms = Array.isArray(manifest['uses-permission']) ? manifest['uses-permission'] : [];
  const kept = perms.filter((p) => !REMOVED_PERMISSIONS.includes(p?.$?.['android:name']));
  for (const name of REMOVED_PERMISSIONS) {
    kept.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
  }
  manifest['uses-permission'] = kept;

  const app = manifest.application && manifest.application[0];
  if (app) {
    app.$ = { ...app.$, ...backupApplicationAttributes() };
  }
  return androidManifest;
}

module.exports = {
  REMOVED_PERMISSIONS,
  BACKUP_EXCLUDED_DOMAINS,
  BACKUP_FILES,
  buildFullBackupContentXml,
  buildDataExtractionRulesXml,
  backupApplicationAttributes,
  applySecurityPolicyToManifest,
};
