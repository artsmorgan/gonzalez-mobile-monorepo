const { withFinalizedMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

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

function rewritePackage(contents) {
  return contents.replace(/^package\s+[^\n]+/m, `package ${LITE_PACKAGE}`);
}

function removeAllKotlinUnder(javaRoot) {
  if (!fs.existsSync(javaRoot)) return;
  for (const file of findKotlinEntryPoints(javaRoot)) {
    fs.unlinkSync(file);
  }
}

function writeFlavorSources(projectRoot, sourceContentsByFile) {
  for (const flavor of ["lite", "full"]) {
    removeAllKotlinUnder(path.join(projectRoot, "android", "app", "src", flavor, "java"));

    const destDir = path.join(
      projectRoot,
      "android",
      "app",
      "src",
      flavor,
      "java",
      packageToPath(LITE_PACKAGE)
    );
    fs.mkdirSync(destDir, { recursive: true });

    for (const [fileName, contents] of Object.entries(sourceContentsByFile)) {
      fs.writeFileSync(path.join(destDir, fileName), rewritePackage(contents), "utf8");
    }
  }
}

/** Copia google-services.json a src/lite (y app/) para que el plugin de Google Services resuelva el flavor. */
function ensureGoogleServicesForLiteFlavor(projectRoot) {
  const candidates = [
    path.join(projectRoot, "google-services.json"),
    path.join(projectRoot, "android", "app", "google-services.json"),
  ];
  const source = candidates.find((p) => fs.existsSync(p));
  if (!source) {
    console.warn("[withAndroidAppVariants] google-services.json no encontrado");
    return;
  }

  const targets = [
    path.join(projectRoot, "android", "app", "google-services.json"),
    path.join(projectRoot, "android", "app", "src", "lite", "google-services.json"),
  ];

  const contents = fs.readFileSync(source);
  for (const dest of targets) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (path.resolve(dest) === path.resolve(source)) continue;
    fs.writeFileSync(dest, contents);
  }
}

function withAndroidAppVariantsFinalize(config) {
  return withFinalizedMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;

      const buildGradlePath = path.join(projectRoot, "android", "app", "build.gradle");
      if (fs.existsSync(buildGradlePath)) {
        const contents = fs.readFileSync(buildGradlePath, "utf8");
        fs.writeFileSync(buildGradlePath, patchAppBuildGradle(contents), "utf8");
      }

      ensureGoogleServicesForLiteFlavor(projectRoot);

      const mainJava = path.join(projectRoot, "android", "app", "src", "main", "java");
      const mainFiles = findKotlinEntryPoints(mainJava);

      const sourceContentsByFile = {};
      for (const file of mainFiles) {
        sourceContentsByFile[path.basename(file)] = fs.readFileSync(file, "utf8");
      }

      if (!sourceContentsByFile["MainActivity.kt"] || !sourceContentsByFile["MainApplication.kt"]) {
        return cfg;
      }

      writeFlavorSources(projectRoot, sourceContentsByFile);
      removeAllKotlinUnder(mainJava);
      return cfg;
    },
  ]);
}

module.exports = withAndroidAppVariantsFinalize;
