/* BVQSS desktop app (Windows and Mac).
   One shell for three apps: BVQSS Tender, BVQSS Value and BVQSS Damage. Each build bundles build/app.json, which says
   which live site to open. The app always shows the current website, so website changes need no new app build.
   What the app adds: its own window and icon, Save dialogs for downloads, printing, reopening at your company's
   address, external links in your normal browser, an offline page, and automatic updates. */
const { app, BrowserWindow, Menu, shell, session, dialog, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'app.json'), 'utf8'));
const VERSION = app.getVersion();
app.setName(CFG.productName);
if (process.platform === 'win32') app.setAppUserModelId(CFG.appId);

// ---------------------------------------------------------------- settings kept between runs
const store = {
  file: () => path.join(app.getPath('userData'), 'settings.json'),
  all() { try { return JSON.parse(fs.readFileSync(this.file(), 'utf8')); } catch (_) { return {}; } },
  get(k) { return this.all()[k]; },
  set(k, v) { const a = this.all(); a[k] = v; try { fs.writeFileSync(this.file(), JSON.stringify(a)); } catch (_) {} },
};

// ---------------------------------------------------------------- which addresses open inside the app
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch (_) { return ''; } };
function isOwn(u) {
  if (/^(blob|data):/.test(u) || u === 'about:blank') return true;
  const h = hostOf(u); if (!h) return false;
  return CFG.roots.some((r) => h === r || h === 'www.' + r || h.endsWith('.' + r)) || (CFG.extraHosts || []).includes(h);
}
function isWorkspace(u) {
  if (!CFG.workspaces) return false;
  const h = hostOf(u);
  return CFG.roots.some((r) => h.endsWith('.' + r) && h !== 'www.' + r);
}
function startUrl() {
  // Value and Damage: reopen at the company's own address (e.g. bvqss.bvqssvalue.com) where the person is signed in
  const o = store.get('lastOrigin');
  if (CFG.workspaces && o && isWorkspace(o)) return o + '/';
  return CFG.startUrl;
}

// ---------------------------------------------------------------- one window, remembered size
let win = null;
function createWindow() {
  const st = store.get('window') || {};
  win = new BrowserWindow({
    width: st.width || 1360, height: st.height || 880, x: st.x, y: st.y, minWidth: 380, minHeight: 500,
    title: CFG.productName, backgroundColor: '#ffffff', show: false, autoHideMenuBar: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true, preload: path.join(__dirname, 'preload.js') },
  });
  if (st.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  const save = () => { if (!win || win.isDestroyed()) return; const b = win.getNormalBounds(); store.set('window', { ...b, maximized: win.isMaximized() }); };
  win.on('close', save);

  const wc = win.webContents;
  wc.setUserAgent(wc.getUserAgent() + ` BVQSSDesktop/${VERSION} (${CFG.key})`);
  wc.setWindowOpenHandler(({ url }) => {
    // stored files opened with a short-lived signed link: save them straight away (Save dialog), no empty window
    if (/\.supabase\.co\/storage\/v1\/object\/sign\//.test(url) && /[?&]download=/.test(url)) { wc.downloadURL(url); return { action: 'deny' }; }
    if (isOwn(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1100, height: 860, autoHideMenuBar: true, icon: path.join(__dirname, '..', 'build', 'icon.png'), webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } } };
    if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => { if (!isOwn(url)) { e.preventDefault(); if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url); } });
  wc.on('did-navigate', (_e, url) => {
    if (!CFG.workspaces) return;
    if (isWorkspace(url)) store.set('lastOrigin', new URL(url).origin);
    else if (/[?&]switch=1/.test(url)) store.set('lastOrigin', '');
  });
  // no connection: show the offline page (pages the site already saved for offline use still open as normal)
  wc.on('did-fail-load', (_e, code, _desc, url, isMain) => {
    if (!isMain || code === -3) return; // -3 = navigation replaced, not an error
    wc.loadFile(path.join(__dirname, 'offline.html'), { query: { to: url || CFG.startUrl, name: CFG.productName } });
  });
  wc.on('context-menu', (_e, p) => {
    const t = [];
    if (p.misspelledWord) { p.dictionarySuggestions.slice(0, 5).forEach((s) => t.push({ label: s, click: () => wc.replaceMisspelling(s) })); if (t.length) t.push({ type: 'separator' }); }
    if (p.isEditable) t.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
    else if (p.selectionText) t.push({ role: 'copy' });
    if (p.linkURL && /^https?:/.test(p.linkURL)) t.push({ type: 'separator' }, { label: 'Open link in browser', click: () => shell.openExternal(p.linkURL) }, { label: 'Copy link', click: () => require('electron').clipboard.writeText(p.linkURL) });
    t.push({ type: 'separator' }, { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() }, { label: 'Reload', click: () => wc.reload() }, { label: 'Print…', click: () => wc.print() });
    Menu.buildFromTemplate(t).popup({ window: win });
  });
  win.loadURL(startUrl());
}

// ---------------------------------------------------------------- downloads: always ask where to save
function wireSession(ses) {
  ses.on('will-download', (_e, item) => {
    const name = item.getFilename();
    item.setSaveDialogOptions({ title: 'Save ' + name, defaultPath: path.join(app.getPath('downloads'), name) });
    item.once('done', (_ev, state) => {
      if (state !== 'completed' || !win || win.isDestroyed()) return;
      const p = item.getSavePath();
      if (process.platform === 'darwin') app.dock.downloadFinished(p);
      const n = new (require('electron').Notification)({ title: 'Saved', body: path.basename(p) });
      n.on('click', () => shell.showItemInFolder(p)); n.show();
    });
  });
  // camera (field photos), location ("I'm at the property"), notifications, clipboard: only for our own sites
  const OK = new Set(['media', 'geolocation', 'notifications', 'clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'window-management']);
  ses.setPermissionRequestHandler((wc, perm, cb, details) => cb(OK.has(perm) && isOwn(details.requestingUrl || wc.getURL())));
  ses.setPermissionCheckHandler((wc, perm, origin) => OK.has(perm) && isOwn(origin || (wc && wc.getURL()) || ''));
}

// ---------------------------------------------------------------- menu
function buildMenu() {
  const mac = process.platform === 'darwin';
  const wc = () => (BrowserWindow.getFocusedWindow() || win).webContents;
  const tpl = [
    ...(mac ? [{ label: CFG.productName, submenu: [{ role: 'about' }, { type: 'separator' }, { label: 'Check for updates…', click: () => checkUpdates(true) }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'File', submenu: [
      { label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: () => win.loadURL(startUrl()) },
      { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => wc().print() },
      ...(CFG.workspaces ? [{ label: 'Switch company…', click: () => { store.set('lastOrigin', ''); win.loadURL(CFG.startUrl + '?switch=1'); } }] : []),
      { type: 'separator' }, mac ? { role: 'close' } : { role: 'quit', label: 'Exit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [
      { label: 'Back', accelerator: mac ? 'Cmd+[' : 'Alt+Left', click: () => wc().navigationHistory.canGoBack() && wc().navigationHistory.goBack() },
      { label: 'Forward', accelerator: mac ? 'Cmd+]' : 'Alt+Right', click: () => wc().navigationHistory.canGoForward() && wc().navigationHistory.goForward() },
      { role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' },
      ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }])] },
    { role: 'windowMenu' },
    { label: 'Help', submenu: [
      { label: 'Usage guide', click: () => shell.openExternal(CFG.guide) },
      { label: 'Open in web browser', click: () => shell.openExternal(win.webContents.getURL().startsWith('http') ? win.webContents.getURL() : CFG.startUrl) },
      { label: 'Contact BVQSS', click: () => shell.openExternal('mailto:office@bvqss.com') },
      ...(mac ? [] : [{ type: 'separator' }, { label: 'Check for updates…', click: () => checkUpdates(true) }, { label: `About ${CFG.productName}`, click: () => dialog.showMessageBox(win, { title: CFG.productName, message: `${CFG.productName} ${VERSION}`, detail: `${CFG.description}\n\nBVQSS, Quantity Surveyors & Valuers\nK&K Building, Bay Street, Kingstown, St Vincent & the Grenadines\nbvqss.com`, icon: path.join(__dirname, '..', 'build', 'icon.png') }) }])] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

// ---------------------------------------------------------------- automatic updates (from the public GitHub releases)
let updater = null;
function checkUpdates(manual) {
  if (!app.isPackaged) { if (manual) dialog.showMessageBox(win, { message: 'Updates are checked in the installed app only.' }); return; }
  try {
    if (!updater) {
      updater = require('electron-updater').autoUpdater;
      updater.channel = CFG.key; updater.allowDowngrade = false; updater.autoDownload = true;
      updater.on('update-downloaded', (info) => {
        dialog.showMessageBox(win, { type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, message: `${CFG.productName} ${info.version} is ready`, detail: 'Restart the app to finish updating.' })
          .then((r) => { if (r.response === 0) updater.quitAndInstall(); });
      });
    }
    const p = updater.checkForUpdates();
    if (manual) p.then((r) => { if (!r || !r.isUpdateAvailable) dialog.showMessageBox(win, { message: `You have the latest version (${VERSION}).` }); })
      .catch((e) => dialog.showMessageBox(win, { type: 'warning', message: 'Could not check for updates', detail: String(e && e.message || e) }));
    else p.catch(() => {});
  } catch (e) { if (manual) dialog.showMessageBox(win, { type: 'warning', message: 'Could not check for updates', detail: String(e.message || e) }); }
}

// ---------------------------------------------------------------- start
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    wireSession(session.defaultSession);
    ipcMain.on('bvq:retry', (_e, to) => { if (win && isOwn(String(to || ''))) win.loadURL(String(to)); else if (win) win.loadURL(startUrl()); });
    buildMenu(); createWindow();
    setTimeout(() => checkUpdates(false), 8000);
    setInterval(() => checkUpdates(false), 6 * 3600 * 1000);
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('web-contents-created', (_e, c) => {
    c.on('will-attach-webview', (ev) => ev.preventDefault());
    c.setWindowOpenHandler(({ url }) => { if (isOwn(url)) return { action: 'allow' }; if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
