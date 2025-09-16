const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const config = getDefaultConfig(__dirname);

config.watchFolders = [
    // Ajusta según tu estructura de monorepo
    path.resolve(__dirname, "../../node_modules")
];

module.exports = config;
