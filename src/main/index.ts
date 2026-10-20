import {
  BrowserWindow,
  ClipboardItem,
  Menu,
  app,
  clipboard,
  ipcMain,
  nativeImage,
  nativeTheme,
  shell,
  systemPreferences
} from 'electron'
import { existsSync, promises as fsp } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { release } from 'node:os'
import { CH, type PlatformInfo } from '../shared/types'
import {
  driveUsage,
  fileIcon,
  fileInfo,
  fileThumbnail,
  listDir,
  listDrives,
  makeFolder,
  readImageFile,
  readTextFile,
  recentEntries,
  removeEntries,
  renameEntry,
  searchTree,
  specialFolders,
  statPaths,
  transfer
} from './fsops'
import { readSettings, writeSettings } from './store'

const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'

function micaSupported(): boolean {
  if (!isWindows) return false
  const build = Number(release().split('.')[2] || 0)
  return build >= 22621
}

function accentColor(): string {
  try {
    const raw = systemPreferences.getAccentColor()
    return raw ? `#${raw.slice(0, 6)}` : '#0067c0'
  } catch {
    return '#0067c0'
  }
}

function platformInfo(): PlatformInfo {
  return {
    platform: process.platform as PlatformInfo['platform'],
    accent: accentColor(),
    dark: nativeTheme.shouldUseDarkColors,
    mica: micaSupported(),
    separator: sep,
    version: app.getVersion()
  }
}

function titleBarColors(): { color: string; symbolColor: string } {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#00000000', symbolColor: '#ffffff' }
    : { color: '#00000000', symbolColor: '#191919' }
}

function createWindow(startPath?: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#00000000',
    titleBarStyle: 'hidden',
    titleBarOverlay: isMac ? false : { ...titleBarColors(), height: 48 },
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: isMac ? 'under-window' : undefined,
    visualEffectState: isMac ? 'active' : undefined,
    backgroundMaterial: micaSupported() ? 'mica' : 'none',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  window.once('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    const url = startPath ? `${devUrl}?path=${encodeURIComponent(startPath)}` : devUrl
    window.loadURL(url)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: startPath ? { path: startPath } : {}
    })
  }

  nativeTheme.on('updated', () => {
    if (window.isDestroyed()) return
    if (!isMac) window.setTitleBarOverlay({ ...titleBarColors(), height: 48 })
    window.webContents.send('theme:updated', platformInfo())
  })

  return window
}

app.whenReady().then(async () => {
  if (isWindows) app.setAppUserModelId('com.duval.fluentexplorer')

  if (isMac) {
    app.dock?.setIcon(join(__dirname, '../../resources/icon.png'))
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: 'appMenu' },
        { role: 'editMenu' },
        {
          label: 'Affichage',
          submenu: [
            { role: 'reload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
          ]
        },
        { role: 'windowMenu' }
      ])
    )
  } else {
    Menu.setApplicationMenu(null)
  }

  const settings = await readSettings()
  const argvPath = process.argv.find((a) => a.startsWith('--path='))?.slice(7)
  const candidate = argvPath || settings.lastPath || app.getPath('home')
  const start = existsSync(candidate) ? candidate : app.getPath('home')
  createWindow(start)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})

ipcMain.handle(CH.list, (_event, dir: string, showHidden: boolean) => listDir(dir, showHidden))
ipcMain.handle(CH.search, (_event, dir: string, query: string, showHidden: boolean) =>
  searchTree(dir, query, showHidden)
)
ipcMain.handle(CH.mkdir, (_event, parent: string, name: string) => makeFolder(parent, name))
ipcMain.handle(CH.rename, (_event, path: string, name: string) => renameEntry(path, name))
ipcMain.handle(CH.remove, (_event, paths: string[], permanent: boolean) => removeEntries(paths, permanent))
ipcMain.handle(CH.transfer, (_event, sources: string[], dest: string, mode: 'copy' | 'move') =>
  transfer(sources, dest, mode)
)
ipcMain.handle(CH.info, (_event, path: string) => fileInfo(path))
ipcMain.handle(CH.readText, (_event, path: string) => readTextFile(path))
ipcMain.handle(CH.readImage, (_event, path: string) => readImageFile(path))
ipcMain.handle(CH.thumbnail, (_event, path: string, width: number) => fileThumbnail(path, width))
ipcMain.handle(CH.icon, (_event, path: string, size: 'small' | 'large') => fileIcon(path, size))
ipcMain.handle(CH.exists, async (_event, path: string) => existsSync(path))
ipcMain.handle(CH.home, () => specialFolders())
ipcMain.handle(CH.drives, () => listDrives())
ipcMain.handle(CH.recent, () => recentEntries())
ipcMain.handle(CH.statPaths, (_event, paths: string[]) => statPaths(paths))
ipcMain.handle(CH.driveUsage, (_event, path: string) => driveUsage(path))
ipcMain.handle(CH.platform, () => platformInfo())
ipcMain.handle(CH.settingsGet, () => readSettings())
ipcMain.handle(CH.settingsSet, (_event, patch) => writeSettings(patch))

ipcMain.handle(CH.open, async (_event, path: string) => {
  const error = await shell.openPath(path)
  return error || null
})

ipcMain.handle(CH.openWith, async (_event, path: string) => {
  try {
    if (isWindows) {
      const { spawn } = await import('node:child_process')
      spawn('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', path], { detached: true, stdio: 'ignore' }).unref()
      return null
    }
    if (isMac) {
      const { spawn } = await import('node:child_process')
      spawn('open', ['-R', path], { detached: true, stdio: 'ignore' }).unref()
      return null
    }
    const error = await shell.openPath(path)
    return error || null
  } catch (error) {
    return String(error)
  }
})

ipcMain.handle(CH.reveal, (_event, path: string) => shell.showItemInFolder(path))
ipcMain.handle(CH.revealPath, (_event, path: string) => shell.openPath(path))

function parseClipboardPaths(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    let candidate = line
    if (line.startsWith('file://')) {
      try {
        candidate = fileURLToPath(line)
      } catch {
        continue
      }
    }
    if (existsSync(candidate)) out.push(candidate)
  }
  return out
}

ipcMain.handle(CH.copyFiles, async (_event, paths: string[]) => {
  const list = paths.map((p) => resolve(p))
  const uris = list.map((p) => pathToFileURL(p).href).join('\r\n')
  const text = list.join('\r\n')
  try {
    await clipboard.write([
      new ClipboardItem({
        'text/uri-list': new Blob([uris], { type: 'text/uri-list' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })
    ])
  } catch {
    await clipboard.writeText(text)
  }
  return true
})

ipcMain.handle(CH.readClipboardFiles, async () => {
  try {
    const items = await clipboard.read()
    for (const item of items) {
      if (!item.types.includes('text/uri-list')) continue
      const payload = await item.getType('text/uri-list')
      if (payload instanceof Blob) {
        const found = parseClipboardPaths(await payload.text())
        if (found.length) return found
      }
    }
  } catch {
    /* fall through to plain text */
  }
  try {
    return parseClipboardPaths(await clipboard.readText())
  } catch {
    return []
  }
})

ipcMain.handle(CH.newWindow, (_event, path?: string) => {
  createWindow(path)
  return true
})

ipcMain.handle(CH.setTitleBar, (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (window && !isMac) window.setTitleBarOverlay({ ...titleBarColors(), height: 48 })
  return true
})

ipcMain.on(CH.dragOut, (event, path: string) => {
  try {
    const icon = nativeImage.createFromPath(path)
    if (icon.isEmpty()) return
    event.sender.startDrag({ file: path, icon })
  } catch {
    /* dragging out is best effort */
  }
})

ipcMain.handle('devtools', (event) => {
  event.sender.openDevTools({ mode: 'detach' })
})

ipcMain.handle('path:sep', () => sep)
ipcMain.handle('fs:open-path', (_event, path: string) => fsp.realpath(path).catch(() => path))
