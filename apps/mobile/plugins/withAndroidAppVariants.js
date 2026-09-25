const {
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/** Lite-first: namespace Kotlin/R/BuildConfig + applicationId por defecto. */
const LITE_PACKAGE = "com.abrjpo98.MonitoreApp.lite";
const FULL_APPLICATION_ID = "com.abrjpo98.MonitoreApp.full";

const FLAVORS_BLOCK = `flavorDimensions "appVariant"
    productFlavors {
        lite {
            dimension "appVariant"
            applicationId '${LITE_PACKAGE}'
        }
        full {
            dimension "appVariant"
            applicationId '${FULL_APPLICATION_ID}'
        }
    }`;

function ensureLiteNamespace(contents) {
  if (/namespace\s+['"]/.test(contents)) {
    return contents.replace(/namespace\s+['"][^'"]+['"]/, `namespace '${LITE_PACKAGE}'`);
  }
  return contents.replace(
    /android\s*\{\s*\r?\n/,
    `android {\n    namespace '${LITE_PACKAGE}'\n`
  );
}

function ensureLiteDefaultApplicationId(contents) {
  return contents.replace(
    /(defaultConfig\s*\{[\s\S]*?applicationId\s+')[^']+(')/,
    `$1${LITE_PACKAGE}$2`
  );
}

function ensureBuildFeatures(contents) {
  if (/buildFeatures\s*\{[\s\S]*?buildConfig\s+true/.test(contents)) {
    return contents;
  }
  if (/buildFeatures\s*\{/.test(contents)) {
    return contents.replace(/buildFeatures\s*\{/, "buildFeatures {\n        buildConfig true");
  }
  return contents.replace(
    /(defaultConfig\s*\{[\s\S]*?\n    \})/,
    `$1\n    buildFeatures {\n        buildConfig true\n    }`
  );
}

function ensureDebuggableVariants(contents) {
  if (contents.includes('debuggableVariants = ["liteDebug", "fullDebug"]')) {
    return contents;
  }
  return contents.replace(
    /\/\/\s*debuggableVariants\s*=\s*\[[^\]]*\]/,
    'debuggableVariants = ["liteDebug", "fullDebug"]'
  );
}

function stripFlavorNamespaces(contents) {
  return contents.replace(/\n\s*namespace\s+['"][^'"]+['"]/g, "");
}

function ensureProductFlavors(contents) {
  contents = stripFlavorNamespaces(contents);

  if (/productFlavors\s*\{[\s\S]*?\blite\b[\s\S]*?\bfull\b/.test(contents)) {
    return contents
      .replace(/(lite\s*\{[\s\S]*?applicationId\s+')[^']+(')/, `$1${LITE_PACKAGE}$2`)
      .replace(/(full\s*\{[\s\S]*?applicationId\s+')[^']+(')/, `$1${FULL_APPLICATION_ID}$2`);
  }

  if (/flavorDimensions/.test(contents)) {
    return contents.replace(/flavorDimensions[\s\S]*?productFlavors\s*\{[\s\S]*?\n    \}/, FLAVORS_BLOCK);
  }

  return contents.replace(/(defaultConfig\s*\{[\s\S]*?\n    \})/, `$1\n    ${FLAVORS_BLOCK}`);
}

function ensureFirebaseMessagingDependency(contents) {
  // Quitar declaraciones sueltas previas para reinsertar en orden correcto (BOM → messaging).
  let next = contents.replace(
    /^\s*implementation\(["']com\.google\.firebase:firebase-messaging["']\)\s*\r?\n/gm,
    ""
  );

  if (/implementation\(platform\(["']com\.google\.firebase:firebase-bom/.test(next)) {
    if (/com\.google\.firebase:firebase-messaging/.test(next)) {
      return next;
    }
    return next.replace(
      /(implementation\(platform\(["']com\.google\.firebase:firebase-bom[^)]+\)\))/,
      `$1\n    implementation("com.google.firebase:firebase-messaging")`
    );
  }

  return next.replace(
    /dependencies\s*\{/,
    `dependencies {\n    implementation(platform("com.google.firebase:firebase-bom:34.16.0"))\n    implementation("com.google.firebase:firebase-messaging")`
  );
}

function patchAppBuildGradle(contents) {
  let next = contents;
  next = ensureLiteDefaultApplicationId(next);
  next = ensureDebuggableVariants(next);
  next = ensureBuildFeatures(next);
  next = ensureProductFlavors(next);
  // Después de stripFlavorNamespaces: el namespace del módulo debe quedar en .lite
  next = ensureLiteNamespace(next);
  next = ensureFirebaseMessagingDependency(next);
  return next;
}

function packageToPath(pkg) {
  return pkg.replace(/\./g, path.sep);
}

function findKotlinEntryPoints(javaRoot) {
  if (!fs.existsSync(javaRoot)) return [];
  const results = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name === "MainActivity.kt" || entry.name === "MainApplication.kt") {
        results.push(full);
      }
    }
  }

  walk(javaRoot);
  return results;
}

function readFlavorEntry(projectRoot, fileName) {
  const litePath = path.join(
    projectRoot,
    "android",
    "app",
    "src",
    "lite",
    "java",
    packageToPath(LITE_PACKAGE),
    fileName
  );
  if (fs.existsSync(litePath)) return fs.readFileSync(litePath, "utf8");

  const fullPath = path.join(
    projectRoot,
    "android",
    "app",
    "src",
    "full",
    "java",
    packageToPath(LITE_PACKAGE),
    fileName
  );
  if (fs.existsSync(fullPath)) return fs.readFileSync(fullPath, "utf8");

  return null;
}

function rewritePackage(contents) {
  return contents.replace(/^package\s+[^\n]+/m, `package ${LITE_PACKAGE}`);
}

function withAndroidAppVariantsBootstrap(config) {
  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchAppBuildGradle(cfg.modResults.contents);
    return cfg;
  });

  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const mainJava = path.join(projectRoot, "android", "app", "src", "main", "java");
      const mainFiles = findKotlinEntryPoints(mainJava);
      const hasActivity = mainFiles.some((f) => path.basename(f) === "MainActivity.kt");
      const hasApplication = mainFiles.some((f) => path.basename(f) === "MainApplication.kt");

      if (hasActivity && hasApplication) {
        return cfg;
      }

      const destDir = path.join(mainJava, packageToPath(LITE_PACKAGE));
      fs.mkdirSync(destDir, { recursive: true });

      for (const fileName of ["MainActivity.kt", "MainApplication.kt"]) {
        const dest = path.join(destDir, fileName);
        if (fs.existsSync(dest)) continue;

        const source = readFlavorEntry(projectRoot, fileName);
        if (!source) continue;

        fs.writeFileSync(dest, rewritePackage(source), "utf8");
      }

      return cfg;
    },
  ]);

  return config;
}

module.exports = withAndroidAppVariantsBootstrap;
