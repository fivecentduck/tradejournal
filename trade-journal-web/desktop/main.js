const { app, BrowserWindow, Menu, shell, ipcMain, dialog, net } = require('electron');
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
function updateUserConfig(patch) {
  const cur = readJson(userConfigPath()) || {};
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(userConfigPath(), JSON.stringify({ ...cur, ...patch }));
}
function getRepo() {
  const user = readJson(userConfigPath());
  if (user && user.repo) return user.repo;
  const bundled = readJson(path.join(__dirname, 'app-config.json'));
  return (bundled && bundled.repo) || '';
}
function appOrigin() { try { return new URL(getUrl()).origin; } catch (e) { return ''; } }

function loadApp() {
  if (!win) return;
  const url = getUrl();
  if (!url) win.loadFile(path.join(__dirname, 'setup.html'));
  else win.loadURL(url);
}

/* ---------- Update notifier ----------
   The website itself always updates the moment you deploy. This only covers the Mac app shell:
   it looks at the latest GitHub release and offers the new DMG. (Silent in-place updates need an
   Apple Developer ID signature, which this build doesn't have.) */
function cmpVer(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0), pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1; }
  return 0;
}
async function checkForUpdates(manual) {
  const say = (message, detail) => dialog.showMessageBox(win || undefined, { type: 'info', message, detail, buttons: ['OK'] });
  const repo = getRepo();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    if (manual) say('Update checks are not set up', 'Rebuild the app with your GitHub repo, for example:\n./build.sh https://your-site.vercel.app your-name/trade-journal-web');
    return;
  }
  try {
    const r = await net.fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TradeJournal-Desktop' } });
    if (r.status === 404) { if (manual) say('No releases yet', `Nothing has been published at github.com/${repo}/releases.`); return; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rel = await r.json();
    const latest = String(rel.tag_name || '').replace(/^v/i, '');
    if (cmpVer(latest, app.getVersion()) > 0) {
      const asset = (rel.assets || []).find(a => /arm64\.dmg$/i.test(a.name));
      const url = asset ? asset.browser_download_url : rel.html_url;
      const { response } = await dialog.showMessageBox(win || undefined, {
        type: 'info', buttons: ['Download', 'Later'], defaultId: 0, cancelId: 1,
        message: `Trade Journal ${latest} is available`,
        detail: `You have ${app.getVersion()}. Download the new DMG, open it, and drag the app into Applications to replace the old one.`
      });
      if (response === 0 && /^https:\/\/github\.com\//.test(url)) shell.openExternal(url);
    } else if (manual) {
      say("You're up to date", `Trade Journal ${app.getVersion()} is the latest version.`);
    }
  } catch (e) {
    if (manual) say("Couldn't check for updates", 'Check your internet connection and try again.');
  }
}
function scheduledUpdateCheck() {
  const cfg = readJson(userConfigPath()) || {};
  if (Date.now() - (cfg.lastUpdateCheck || 0) < 12 * 3600 * 1000) return;
  updateUserConfig({ lastUpdateCheck: Date.now() });
  setTimeout(() => checkForUpdates(false), 4000);
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
        { label: 'Check for Updates...', click: () => checkForUpdates(true) },
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
  updateUserConfig({ url });
  loadApp();
  return { ok: true };
});
ipcMain.handle('tj:retry', e => { if (fromLocalPage(e)) loadApp(); });

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  scheduledUpdateCheck();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

module.exports = { normalizeUrl, cmpVer };
