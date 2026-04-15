const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// IMPORTANT for monorepo stability
const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, "..", "..");

config.projectRoot = projectRoot;
config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, "packages"),
  path.resolve(workspaceRoot, "services"),
];

module.exports = config;
