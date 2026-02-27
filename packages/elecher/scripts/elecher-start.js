#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const toml = require('toml');

const electronBinDir = path.join(__dirname, '..', 'electron_bin');
const mainPath = path.join(__dirname, '..', 'main.js');

const electronExe = process.platform === 'win32' ? 'electron.exe' : 'electron';
const electronPath = path.join(electronBinDir, electronExe);

function loadConfig(configPath) {
  if (!configPath) {
    return {
      port: 9333,
      cmd: null,
      configDir: process.cwd()
    };
  }

  const configFilePath = path.resolve(configPath);
  if (!fs.existsSync(configFilePath)) {
    console.error(`Config file not found: ${configFilePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(configFilePath, 'utf-8');
  const config = toml.parse(content);

  return {
    appName: config.appName || null,
    port: config.port || 9333,
    cmd: config.cmd || null,
    configDir: path.dirname(configFilePath)
  };
}

const configPath = process.argv[2] || 'app.toml';
const config = loadConfig(configPath);

console.log('[elecher-start] Config:', config);

const env = { ...process.env };

if (config.appName) {
  env.ELECTRON_APP_NAME = config.appName;
}

env.ELECTRON_RPC_PORT = config.port.toString();

if (config.cmd) {
  env.ELECTRON_SUBCMD = config.cmd;
}

env.ELECTRON_CONFIG_DIR = config.configDir;

console.log('[elecher-start] Electron path:', electronPath);

const child = spawn(electronPath, [mainPath], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env
});

child.on('close', (code) => {
  process.exit(code);
});
