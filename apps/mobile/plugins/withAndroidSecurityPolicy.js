const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { BACKUP_FILES, applySecurityPolicyToManifest } = require('./androidSecurityPolicy');

/**
 * Plugin de Expo (issues #177 y #180): quita los permisos que la app no usa, escribe las reglas de exclusión de backup y las enlaza en el
 * `<application>`. Corre en cada `expo prebuild`, por lo que no se pierde al regenerar `android/`. La lógica está en `androidSecurityPolicy.js`.
 */
function withAndroidSecurityPolicy(config) {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = applySecurityPolicyToManifest(cfg.modResults);
    return cfg;
  });

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      for (const [name, build] of Object.entries(BACKUP_FILES)) {
        fs.writeFileSync(path.join(xmlDir, name), build());
      }
      return cfg;
    },
  ]);
}

module.exports = withAndroidSecurityPolicy;
