import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
void require

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

type DirectoryEntry = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: number
}

type DirectorySnapshot = {
  path: string
  entries: DirectoryEntry[]
  exists: boolean
  error?: string
}

function resolveTargetPath(targetPath?: string) {
  const home = app.getPath('home')
  if (!targetPath) return home

  const expanded =
    targetPath === '~' || targetPath.startsWith('~/') || targetPath.startsWith('~\\')
      ? path.join(home, targetPath.slice(2))
      : targetPath

  return path.resolve(expanded)
}

ipcMain.handle('fs:list', async (_event, targetPath?: string): Promise<DirectorySnapshot> => {
  const resolvedPath = resolveTargetPath(targetPath)

  try {
    const stat = await fs.stat(resolvedPath)

    if (!stat.isDirectory()) {
      return {
        path: resolvedPath,
        entries: [],
        exists: false,
        error: 'Target path is not a directory',
      }
    }

    const dirents = await fs.readdir(resolvedPath, { withFileTypes: true })
    const entries: DirectoryEntry[] = await Promise.all(
      dirents.map(async (dirent) => {
        const entryPath = path.join(resolvedPath, dirent.name)
        const entryStat = await fs.stat(entryPath)
        return {
          name: dirent.name,
          path: entryPath,
          isDirectory: dirent.isDirectory(),
          size: dirent.isDirectory() ? 0 : entryStat.size,
          modified: entryStat.mtimeMs,
        }
      }),
    )

    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

    return {
      path: resolvedPath,
      entries,
      exists: true,
    }
  } catch (error) {
    return {
      path: resolvedPath,
      entries: [],
      exists: false,
      error: error instanceof Error ? error.message : 'Unable to read directory',
    }
  }
})
