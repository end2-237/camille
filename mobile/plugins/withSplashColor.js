// Config-plugin Expo : garantit que la couleur `splashscreen_background`
// (référencée par le drawable de splash généré par le template) existe bien
// dans res/values/colors.xml. Évite l'erreur AAPT
// "resource color/splashscreen_background not found" au build release.
const { withAndroidColors, AndroidConfig } = require("@expo/config-plugins");

module.exports = function withSplashColor(config, { color = "#ECECEC" } = {}) {
  return withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: "splashscreen_background",
      value: color,
    });
    return cfg;
  });
};
