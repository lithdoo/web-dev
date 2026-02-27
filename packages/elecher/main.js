const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createRpcServer } = require('./rpc-server');
const { spawn } = require('child_process');

let rpcServer;
let subprocess;

const appName = process.env.ELECTRON_APP_NAME;
const rpcPort = parseInt(process.env.ELECTRON_RPC_PORT || '9333', 10);
const subCmd = process.env.ELECTRON_SUBCMD;
const configDir = process.env.ELECTRON_CONFIG_DIR || process.cwd();

console.log('[Main] App name:', appName);
console.log('[Main] RPC port:', rpcPort);
console.log('[Main] SubCmd:', subCmd);
console.log('[Main] Config dir:', configDir);

if (appName) {
  app.setName(appName);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main] Another instance is running, quitting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('[Main] Second instance detected');
  });
}

function startSubprocess(cmd) {
  console.log('[Main] Starting subprocess:', cmd);
  
  subprocess = spawn(cmd, [], {
    stdio: 'pipe',
    cwd: configDir,
    shell: true,
    windowsHide: false
  });

  subprocess.stdout.on('data', (data) => {
    process.stdout.write(data.toString());
  });

  subprocess.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  subprocess.on('close', (code) => {
    console.log(`[Main] Subprocess exited with code ${code}, quitting...`);
    app.quit();
  });
}

app.whenReady().then(() => {
  rpcServer = createRpcServer(rpcPort);

  if (subCmd) {
    startSubprocess(subCmd);
  }

  app.on('activate', () => {
  });
});

app.on('window-all-closed', () => {
  if (rpcServer) {
    rpcServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('get-version', () => {
  return process.versions.electron;
});

ipcMain.handle('get-path', (event, name) => {
  return app.getPath(name);
});
