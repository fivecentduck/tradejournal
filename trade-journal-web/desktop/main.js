const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;

/* ---------- Server URL (which Trade Journal site this app connects to) ---------- */
const userConfigPath = () => path.join(app.getPath('userData'), 'config.json');
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function getUrl() {
  const user = readJson(userConfigPath());
  if (user && user.url) return user.url;
  const bundled = readJson(path.join(__dirname, 'app-config.json'));
  return (bundled && bundled.url) || '';
}
function normalizeUrl(input) {
  try {
    const raw = String(input || '').trim();
    if (!raw) return null;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return null; // other schemes (ftp://, file://...)
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    return u.origin;
  } catch (e) { return null; }
}
function appOrigin() { try { return new URL(getUrl()).origin; } catch (e) { return ''; } }

function loadApp() {
  if (!win) return;
  const url = getUrl();
  if (!url) win.loadFile(path.join(__dirname, 'setup.html'));
  else win.loadURL(url);
}

/* ---------- Window ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 800, minWidth: 820, minHeight: 560,
    title: 'Trade Journal', backgroundColor: '#0e131b', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.once('ready-to-show', () => win.show());

  // Keep the window on the configured site; send everything else to the default browser.
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;
    let origin = ''; try { origin = new URL(url).origin; } catch (_) { /* ignore */ }
    if (origin !== appOrigin()) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Friendly page when the site can't be reached
  win.webContents.on('did-fail-load', (e, code, desc, failedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3 || String(failedUrl).startsWith('file:')) return;
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { host: appOrigin() } });
  });

  loadApp();
  win.on('closed', () => { win = null; });
}

function buildMenu() {
  const template = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Server',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => loadApp() },
        { label: 'Change Server URL...', click: () => win && win.loadFile(path.join(__dirname, 'setup.html')) }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- IPC (only local setup/offline pages may call these) ---------- */
const fromLocalPage = e => e.senderFrame && String(e.senderFrame.url).startsWith('file:');
ipcMain.handle('tj:getUrl', e => (fromLocalPage(e) ? getUrl() : ''));
ipcMain.handle('tj:saveUrl', (e, input) => {
  if (!fromLocalPage(e)) return { ok: false, error: 'Not allowed.' };
  const url = normalizeUrl(input);
  if (!url) return { ok: false, error: 'Enter a valid https:// address, like https://my-journal.vercel.app' };
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(userConfigPath(), JSON.stringify({ url }));
  loadApp();
  return { ok: true };
});
ipcMain.handle('tj:retry', e => { if (fromLocalPage(e)) loadApp(); });

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

module.exports = { normalizeUrl };
