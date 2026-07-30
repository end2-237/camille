// ─────────────────────────────────────────────────────────────────────────────
// Signature de release.
//
// Le template Expo signe la release avec la clé de DEBUG :
//     buildTypes { release { signingConfig signingConfigs.debug } }
// C'est pratique pour tester, mais inacceptable en production : la clé de debug
// est publique, identique chez tout le monde, et le Play Store la refuse.
//
// Ce plugin injecte une vraie configuration de signature, alimentée par des
// propriétés Gradle. Si elles sont absentes (build local, contributeur sans la
// clé), on retombe sur le comportement d'origine plutôt que d'échouer.
//
// Propriétés attendues (gradle.properties ou -P) :
//   CAMILLE_STORE_FILE, CAMILLE_STORE_PASSWORD, CAMILLE_KEY_ALIAS, CAMILLE_KEY_PASSWORD
// ─────────────────────────────────────────────────────────────────────────────
const { withAppBuildGradle } = require("@expo/config-plugins");

const SIGNING_BLOCK = `
        release {
            if (project.hasProperty('CAMILLE_STORE_FILE')) {
                storeFile file(CAMILLE_STORE_FILE)
                storePassword CAMILLE_STORE_PASSWORD
                keyAlias CAMILLE_KEY_ALIAS
                keyPassword CAMILLE_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;

    // 1. Déclarer le signingConfig 'release' à côté de 'debug'
    if (!src.includes("CAMILLE_STORE_FILE")) {
      src = src.replace(
        /(signingConfigs\s*\{)/,
        `$1${SIGNING_BLOCK}`
      );
    }

    // 2. La release utilise sa propre clé — et seulement si elle est fournie.
    //    Sans la clé, on garde debug : un build local doit rester possible.
    src = src.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig project.hasProperty('CAMILLE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`
    );

    cfg.modResults.contents = src;
    return cfg;
  });
};
