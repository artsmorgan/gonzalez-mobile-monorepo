const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');
const { applyAbiSplitsToBuildGradle, reactNativeArchitecturesValue } = require('./androidAbiSplits');

/**
 * Plugin de Expo (issue #179, H10): genera un APK por arquitectura en vez de uno universal de ~130 MB. Corre en cada `expo prebuild`, por lo
 * que no se pierde al regenerar `android/`. La lógica está en `androidAbiSplits.js`.
 */
function withAndroidAbiSplits(config) {
  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applyAbiSplitsToBuildGradle(cfg.modResults.contents);
    return cfg;
  });

  return withGradleProperties(config, (cfg) => {
    const key = 'reactNativeArchitectures';
    const value = reactNativeArchitecturesValue();
    const existing = cfg.modResults.find((item) => item.type === 'property' && item.key === key);
    if (existing) existing.value = value;
    else cfg.modResults.push({ type: 'property', key, value });
    return cfg;
  });
}

module.exports = withAndroidAbiSplits;
