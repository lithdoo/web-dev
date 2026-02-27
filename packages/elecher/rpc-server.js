const ws = require('ws');
const path = require('path');
const { BrowserWindow } = require('electron');

const windows = new Map();
let windowIdCounter = 0;
const configDir = process.env.ELECTRON_CONFIG_DIR || process.cwd();

const methods = {
  getVersion: function(args) {
    return process.versions.electron;
  },
  getPlatform: function(args) {
    return process.platform;
  },
  getArch: function(args) {
    return process.arch;
  },
  getAppPath: function(args) {
    const { app } = require('electron');
    return app.getPath(args.name);
  },
  openWindow: function(args) {
    const { title, width, height, loadUrl, devTool } = args;
    
    const windowId = `window_${++windowIdCounter}`;
    
    let url = loadUrl;
    if (loadUrl && !loadUrl.startsWith('http://') && !loadUrl.startsWith('https://') && !loadUrl.startsWith('file://')) {
      const resolvedPath = path.resolve(configDir, loadUrl);
      url = `file://${resolvedPath}`;
    }

    const win = new BrowserWindow({
      width: width || 800,
      height: height || 600,
      title: title || 'Electron',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        devTools: devTool || false
      }
    });

    if (url) {
      win.loadURL(url);
    }

    win.on('closed', () => {
      windows.delete(windowId);
    });

    windows.set(windowId, { win, option: args, windowId });
    
    return windowId;
  },
  closeWindow: function(args) {
    const { windowId } = args;
    const windowInfo = windows.get(windowId);
    
    if (windowInfo) {
      windowInfo.win.close();
      windows.delete(windowId);
      return true;
    } else {
      throw { code: -32602, message: `Window not found: ${windowId}` };
    }
  },
  getAllWindows: function(args) {
    const result = [];
    for (const [windowId, info] of windows) {
      result.push({
        windowId,
        title: info.option.title || 'Untitled',
        width: info.option.width || 800,
        height: info.option.height || 600,
        loadUrl: info.option.loadUrl || '',
        devTool: info.option.devTool || false
      });
    }
    return result;
  }
};

function createRpcServer(port = 9222) {
  const wss = new ws.WebSocketServer({ port });

  wss.on('connection', (clientWs, req) => {
    clientWs.on('message', (data) => {
      try {
        const request = JSON.parse(data.toString());
        
        if (request.method) {
          const method = methods[request.method];
          
          if (method) {
            try {
              const result = method(request.params || {});
              clientWs.send(JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                result: result
              }));
            } catch (err) {
              clientWs.send(JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                error: {
                  code: err.code || -32603,
                  message: err.message || String(err)
                }
              }));
            }
          } else {
            clientWs.send(JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              error: {
                code: -32601,
                message: `Method not found: ${request.method}`
              }
            }));
          }
        }
      } catch (e) {
        console.error('[RPC] Parse error:', e);
        clientWs.send(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error: ' + e.message },
          id: null
        }));
      }
    });
  });

  const rpcServer = {
    port,
    wss,
    call: function(method, params) {
      for (const client of wss.clients) {
        const request = { jsonrpc: '2.0', method, params, id: Date.now() };
        client.send(JSON.stringify(request));
      }
    },
    close: function() {
      for (const client of wss.clients) {
        client.close();
      }
      for (const [windowId, info] of windows) {
        info.win.close();
      }
      windows.clear();
      wss.close();
    }
  };

  console.log(`[JsonRpcServer] Started on ws://localhost:${port}`);
  console.log(`[JsonRpcServer] Config dir: ${configDir}`);
  return rpcServer;
}

module.exports = { createRpcServer };
