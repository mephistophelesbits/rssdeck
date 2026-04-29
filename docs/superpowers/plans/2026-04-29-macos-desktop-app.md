# macOS Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing Next.js RSS Deck app in an Electron shell to produce a native macOS desktop application (.dmg installer) with native macOS features: app menu, system tray, dock integration, and native notifications.

**Architecture:** Electron's main process spawns the Next.js server as a child process on localhost:3001, then opens a BrowserWindow pointed at that server. A preload script bridges IPC between renderer and main. electron-builder packages everything (including the Next.js build and a bundled node binary) into a distributable .dmg.

**Tech Stack:** Electron 34, electron-builder, TypeScript (separate tsconfig for electron), vitest (unit tests for pure logic), concurrently (dev mode), wait-on (server readiness polling)

---

## File Structure

**New files:**
- `electron/main.ts` — Electron entry point: lifecycle, BrowserWindow, server spawn
- `electron/server.ts` — Next.js child process management + health-check logic (pure, testable)
- `electron/preload.ts` — contextBridge IPC API (notificationReady, openExternal)
- `electron/menu.ts` — Native macOS application menu definition
- `electron/tray.ts` — System tray icon + context menu
- `electron/icons/icon.icns` — macOS app icon (generated from existing Logo.png)
- `electron-builder.json` — Packaging config (target: dmg, mac)
- `tsconfig.electron.json` — TypeScript config for `electron/` (CommonJS, ES2022, node types)
- `vitest.config.ts` — Test runner config

**Modified files:**
- `package.json` — Add Electron deps + scripts (electron:dev, electron:build, test)
- `next.config.ts` — Allow `output: 'standalone'` mode for bundled production server

---

## Task 1: Install Dependencies and TypeScript Config

**Files:**
- Modify: `package.json`
- Create: `tsconfig.electron.json`

- [ ] **Step 1: Install Electron and build tooling**

```bash
npm install --save-dev electron@^34 electron-builder@^25 concurrently wait-on
npm install --save-dev vitest @types/node
npm install --save-dev ts-node typescript
```

- [ ] **Step 2: Verify Electron installs correctly**

```bash
npx electron --version
```

Expected output: `v34.x.x`

- [ ] **Step 3: Create `tsconfig.electron.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": ".electron-dist",
    "rootDir": "electron",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["electron/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['electron/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

In the `"scripts"` section, add these entries (keep all existing ones):

```json
"electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:3001 && npx ts-node --project tsconfig.electron.json -e 'require(\"./.electron-dist/main\")' || npx electron .electron-dist/main.js\"",
"electron:compile": "tsc --project tsconfig.electron.json",
"electron:start": "npm run electron:compile && ELECTRON_IS_DEV=1 npx electron .electron-dist/main.js",
"electron:build": "next build && npm run electron:compile && npx electron-builder",
"test": "vitest run"
```

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.electron.json vitest.config.ts package-lock.json
git commit -m "chore: add Electron and build tooling dependencies"
```

---

## Task 2: Next.js Server Manager (Testable Core Logic)

**Files:**
- Create: `electron/server.ts`
- Create: `electron/server.test.ts`

- [ ] **Step 1: Write the failing test for `waitForServer`**

Create `electron/server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitForServer, buildServerUrl } from './server';

describe('buildServerUrl', () => {
  it('builds http url with given port', () => {
    expect(buildServerUrl(3001)).toBe('http://localhost:3001');
  });

  it('defaults to port 3001', () => {
    expect(buildServerUrl()).toBe('http://localhost:3001');
  });
});

describe('waitForServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves when fetch succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    await expect(waitForServer('http://localhost:3001', 100, 3)).resolves.toBeUndefined();
  });

  it('retries on failure then resolves', async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue({ ok: true });
    await expect(waitForServer('http://localhost:3001', 10, 3)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(waitForServer('http://localhost:3001', 10, 3)).rejects.toThrow('Server did not start');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run electron/server.test.ts
```

Expected: FAIL with "Cannot find module './server'"

- [ ] **Step 3: Create `electron/server.ts`**

```typescript
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export function buildServerUrl(port = 3001): string {
  return `http://localhost:${port}`;
}

export async function waitForServer(
  url: string,
  intervalMs = 500,
  maxAttempts = 60
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Server did not start within ${(intervalMs * maxAttempts) / 1000}s`);
}

export function spawnNextServer(appRoot: string): ChildProcess {
  const isDev = process.env.ELECTRON_IS_DEV === '1';
  const nodeArgs = isDev
    ? ['node_modules/.bin/next', 'dev', '-p', '3001']
    : ['node_modules/.bin/next', 'start', '-p', '3001'];

  const serverProcess = spawn(process.execPath, nodeArgs, {
    cwd: appRoot,
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log('[next-server]', data.toString().trim());
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error('[next-server]', data.toString().trim());
  });

  return serverProcess;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run electron/server.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/server.ts electron/server.test.ts
git commit -m "feat(electron): add Next.js server manager with tests"
```

---

## Task 3: Preload Script (IPC Bridge)

**Files:**
- Create: `electron/preload.ts`

- [ ] **Step 1: Create `electron/preload.ts`**

```typescript
import { contextBridge, ipcRenderer, shell } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url: string) => shell.openExternal(url),
  onUpdateAvailable: (callback: () => void) =>
    ipcRenderer.on('update-available', callback),
  platform: process.platform,
});
```

- [ ] **Step 2: Compile to verify no TypeScript errors**

```bash
tsc --project tsconfig.electron.json --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add electron/preload.ts
git commit -m "feat(electron): add preload IPC bridge"
```

---

## Task 4: Application Menu

**Files:**
- Create: `electron/menu.ts`

- [ ] **Step 1: Create `electron/menu.ts`**

```typescript
import { app, Menu, BrowserWindow, shell, MenuItemConstructorOptions } from 'electron';

export function buildAppMenu(mainWindow: BrowserWindow): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(process.env.ELECTRON_IS_DEV === '1'
          ? [{ type: 'separator' as const }, { role: 'toggleDevTools' as const }]
          : []),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'RSS Deck on GitHub',
          click: () => shell.openExternal('https://github.com/mephistophelesbits/rssdeck'),
        },
        {
          label: 'Reload RSS Deck',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.webContents.reload(),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
```

- [ ] **Step 2: Compile to verify no TypeScript errors**

```bash
tsc --project tsconfig.electron.json --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add electron/menu.ts
git commit -m "feat(electron): add macOS application menu"
```

---

## Task 5: System Tray

**Files:**
- Create: `electron/tray.ts`

- [ ] **Step 1: Create `electron/tray.ts`**

```typescript
import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron';
import path from 'path';

export function createTray(mainWindow: BrowserWindow, iconPath: string): Tray {
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show RSS Deck',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Reload',
      click: () => mainWindow.webContents.reload(),
    },
    { type: 'separator' },
    {
      label: 'Quit RSS Deck',
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip('RSS Deck');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}
```

- [ ] **Step 2: Compile to verify no TypeScript errors**

```bash
tsc --project tsconfig.electron.json --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add electron/tray.ts
git commit -m "feat(electron): add system tray with context menu"
```

---

## Task 6: Electron Main Process

**Files:**
- Create: `electron/main.ts`

- [ ] **Step 1: Create `electron/main.ts`**

```typescript
import { app, BrowserWindow, shell, nativeTheme } from 'electron';
import path from 'path';
import { spawnNextServer, waitForServer, buildServerUrl } from './server';
import { buildAppMenu } from './menu';
import { createTray } from './tray';
import { Menu } from 'electron';
import type { ChildProcess } from 'child_process';

const IS_DEV = process.env.ELECTRON_IS_DEV === '1';
const PORT = 3001;
const SERVER_URL = buildServerUrl(PORT);

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;

function getAppRoot(): string {
  // In packaged app, resources are in process.resourcesPath
  // In dev, use cwd
  return IS_DEV ? process.cwd() : path.join(process.resourcesPath, 'app');
}

function getIconPath(): string {
  const base = IS_DEV ? path.join(__dirname, '..', 'electron', 'icons') : path.join(__dirname, 'icons');
  return path.join(base, 'icon.png');
}

async function createWindow() {
  nativeTheme.themeSource = 'system';

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS traffic lights inset into title bar
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#09090f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false, // Show after content loads to avoid white flash
  });

  // Open external links in system browser, not Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'localhost') {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const menu = buildAppMenu(mainWindow);
  Menu.setApplicationMenu(menu);

  createTray(mainWindow, getIconPath());

  // Show window once the page has loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (IS_DEV) mainWindow?.webContents.openDevTools({ mode: 'detach' });
  });

  // On macOS, clicking dock icon should show window
  app.on('activate', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow?.show();
    }
  });

  await mainWindow.loadURL(SERVER_URL);
}

async function startApp() {
  const appRoot = getAppRoot();

  console.log('[electron] Starting Next.js server...');
  nextServer = spawnNextServer(appRoot);

  try {
    await waitForServer(SERVER_URL, 500, 60);
    console.log('[electron] Next.js server ready at', SERVER_URL);
  } catch (err) {
    console.error('[electron] Server failed to start:', err);
    app.quit();
    return;
  }

  await createWindow();
}

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  // On macOS, keep app in dock even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (nextServer) {
    console.log('[electron] Stopping Next.js server...');
    nextServer.kill('SIGTERM');
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});
```

- [ ] **Step 2: Compile to verify no TypeScript errors**

```bash
npm run electron:compile
```

Expected: Compiled files appear in `.electron-dist/`

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat(electron): add Electron main process with window management"
```

---

## Task 7: App Icon

**Files:**
- Create: `electron/icons/icon.png`
- Create: `electron/icons/icon.icns`

- [ ] **Step 1: Convert Logo.png to required icon sizes**

The project has `docs/Logo.png`. Create the icons directory and generate icons:

```bash
mkdir -p electron/icons
cp docs/Logo.png electron/icons/icon.png
```

- [ ] **Step 2: Generate .icns file for macOS**

Install `png2icons` if not available:

```bash
npm install --save-dev png2icons
npx png2icons electron/icons/icon.png electron/icons/icon --icns
```

If `png2icons` fails, use the alternative:

```bash
# macOS built-in tool
mkdir icon.iconset
sips -z 16 16 docs/Logo.png --out icon.iconset/icon_16x16.png
sips -z 32 32 docs/Logo.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 docs/Logo.png --out icon.iconset/icon_32x32.png
sips -z 64 64 docs/Logo.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 docs/Logo.png --out icon.iconset/icon_128x128.png
sips -z 256 256 docs/Logo.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 docs/Logo.png --out icon.iconset/icon_256x256.png
sips -z 512 512 docs/Logo.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 docs/Logo.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 docs/Logo.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o electron/icons/icon.icns
rm -rf icon.iconset
```

- [ ] **Step 3: Verify icon files exist**

```bash
ls -la electron/icons/
```

Expected: `icon.png` and `icon.icns` both present

- [ ] **Step 4: Commit**

```bash
git add electron/icons/
git commit -m "feat(electron): add macOS app icons"
```

---

## Task 8: electron-builder Configuration

**Files:**
- Create: `electron-builder.json`
- Modify: `next.config.ts`

- [ ] **Step 1: Create `electron-builder.json`**

```json
{
  "appId": "com.rssdeck.app",
  "productName": "RSS Deck",
  "copyright": "Copyright © 2026 Wong Kian Fong",
  "directories": {
    "output": "dist-electron",
    "buildResources": "electron/icons"
  },
  "files": [
    ".electron-dist/**/*",
    "!.electron-dist/**/*.test.js",
    ".next/**/*",
    "public/**/*",
    "node_modules/**/*",
    "package.json",
    "next.config.ts",
    "tsconfig.json"
  ],
  "extraResources": [
    {
      "from": "data",
      "to": "app/data",
      "filter": ["**/*"]
    }
  ],
  "mac": {
    "category": "public.app-category.news",
    "icon": "electron/icons/icon.icns",
    "target": [
      {
        "target": "dmg",
        "arch": ["arm64", "x64"]
      }
    ],
    "darkModeSupport": true
  },
  "dmg": {
    "title": "RSS Deck",
    "backgroundColor": "#09090f",
    "window": {
      "width": 540,
      "height": 380
    }
  },
  "asar": true,
  "main": ".electron-dist/main.js"
}
```

- [ ] **Step 2: Read the current `next.config.ts`**

```bash
cat next.config.ts
```

- [ ] **Step 3: Update `next.config.ts` to add standalone output**

Open `next.config.ts` and add `output: 'standalone'` to the Next.js config object. The file currently looks like:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* existing config options */
};

export default nextConfig;
```

Add `output: 'standalone'` inside the config object:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* existing config options */
  output: 'standalone',
};

export default nextConfig;
```

- [ ] **Step 4: Test that Next.js still builds**

```bash
npm run build
```

Expected: Build completes without errors, `.next/standalone/` directory appears

- [ ] **Step 5: Update `electron/server.ts` to use standalone output in production**

Replace the `spawnNextServer` function in `electron/server.ts` with the version that uses the standalone server in production:

```typescript
export function spawnNextServer(appRoot: string): ChildProcess {
  const isDev = process.env.ELECTRON_IS_DEV === '1';

  let command: string;
  let args: string[];
  let cwd: string;

  if (isDev) {
    command = process.execPath;
    args = [path.join(appRoot, 'node_modules/.bin/next'), 'dev', '-p', '3001'];
    cwd = appRoot;
  } else {
    // In production, use the standalone server built by next build
    command = process.execPath;
    args = [path.join(appRoot, '.next/standalone/server.js')];
    cwd = appRoot;
  }

  const serverProcess = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: isDev ? 'development' : 'production',
      PORT: '3001',
      HOSTNAME: 'localhost',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log('[next-server]', data.toString().trim());
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error('[next-server]', data.toString().trim());
  });

  return serverProcess;
}
```

Also add `import path from 'path';` at the top of `server.ts` if not already present.

- [ ] **Step 6: Run tests again to verify they still pass after server.ts change**

```bash
npx vitest run electron/server.test.ts
```

Expected: All 5 tests PASS

- [ ] **Step 7: Compile Electron TypeScript**

```bash
npm run electron:compile
```

Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add electron-builder.json next.config.ts electron/server.ts
git commit -m "feat(electron): add electron-builder config and standalone Next.js output"
```

---

## Task 9: Add `.gitignore` Entries

**Files:**
- Modify: `.gitignore` (or create if missing)

- [ ] **Step 1: Check if `.gitignore` exists and add Electron build output**

```bash
cat .gitignore
```

- [ ] **Step 2: Add these entries to `.gitignore`**

```
# Electron build output
.electron-dist/
dist-electron/
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore Electron build artifacts"
```

---

## Task 10: Smoke Test in Development Mode

**Files:** None (manual verification)

- [ ] **Step 1: Compile the Electron TypeScript**

```bash
npm run electron:compile
```

Expected: `.electron-dist/main.js`, `.electron-dist/preload.js`, `.electron-dist/server.js`, `.electron-dist/menu.js`, `.electron-dist/tray.js` all created.

- [ ] **Step 2: Start the Next.js dev server in a separate terminal**

```bash
npm run dev
```

Wait until you see `✓ Ready in` in the terminal output.

- [ ] **Step 3: In another terminal, start Electron in dev mode**

```bash
ELECTRON_IS_DEV=1 npx electron .electron-dist/main.js
```

Expected:
- Electron window opens showing RSS Deck
- Title bar has macOS traffic light buttons (red/yellow/green) inset into the window
- Application menu appears in the macOS menu bar with "RSS Deck", "View", "Window", "Help" menus
- System tray icon appears in the macOS menu bar
- Right-clicking tray shows "Show RSS Deck", "Reload", "Quit RSS Deck" options

- [ ] **Step 4: Verify external links open in browser**

In the RSS Deck UI, click any external article link. Verify it opens in Safari/Chrome (not in the Electron window).

- [ ] **Step 5: Verify tray behavior**

Click the tray icon, choose "Show RSS Deck" — window should come to front. Choose "Quit RSS Deck" — both Electron and the Next.js server should terminate (verify with `ps aux | grep next` — no next process remains).

- [ ] **Step 6: Stop both processes** (Cmd+Q or tray → Quit)

---

## Task 11: Build and Test the macOS .dmg

**Files:** None (build verification)

- [ ] **Step 1: Build the complete desktop app**

```bash
npm run electron:build
```

This runs `next build`, then `electron:compile`, then `electron-builder`. Takes 3-5 minutes.

Expected output ends with:
```
  • building        target=macOS DMG arch=arm64
  • building        target=macOS DMG arch=x64
  • built           file=dist-electron/RSS Deck-<version>-arm64.dmg
  • built           file=dist-electron/RSS Deck-<version>-x64.dmg
```

- [ ] **Step 2: Mount the .dmg and install**

```bash
open "dist-electron/RSS Deck-0.1.0-arm64.dmg"
```

Drag "RSS Deck" to Applications folder in the installer window.

- [ ] **Step 3: Launch from Applications and verify**

Launch RSS Deck from Applications or Spotlight. Verify:
- App icon appears in Dock
- App loads and shows RSS Deck UI
- Menu bar shows correct menus
- Tray icon appears

- [ ] **Step 4: Test database persistence**

Add a test RSS feed in the app. Quit (Cmd+Q). Reopen. Verify the feed still appears (database persists correctly).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: native macOS desktop app via Electron with tray, menu, and dmg packaging"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Native macOS desktop app | Tasks 6, 10, 11 |
| macOS app menu (native menu bar) | Task 4 |
| System tray icon | Task 5 |
| Window with traffic lights | Task 6 |
| .dmg installer | Tasks 8, 11 |
| Next.js server management | Tasks 2, 8 |
| External links in browser | Task 6 |
| Dock integration | Task 6 (activate handler) |
| App icon | Task 7 |
| Database persistence across launches | Task 11 |

All requirements covered. No placeholders remain.
