import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Dirent, Stats } from 'node:fs'
import fs from 'node:fs/promises'
import YAML from 'yaml'

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
const IS_DEV = Boolean(VITE_DEV_SERVER_URL)
const IS_MAC = process.platform === 'darwin'
const CONFIG_FILENAME = 'app.config.yaml'
const CONFIG_PATH = path.join(process.env.APP_ROOT, CONFIG_FILENAME)

type AppConfigInput = {
  startPath?: string
  hideHidden?: boolean
  ignoreSuffixes?: string[] | string
  columns?: {
    showType?: boolean
    showModified?: boolean
    showSize?: boolean
  }
  sort?: {
    field?: 'name' | 'modified' | 'size'
    order?: 'asc' | 'desc'
  }
  rainbow?: {
    speed?: number
    direction?: 'normal' | 'reverse'
  }
  tools?: {
    rename?: { recursive?: boolean }
    delete?: { recursive?: boolean }
  }
}

type ResolvedAppConfig = {
  startPath?: string
  hideHidden: boolean
  ignoreSuffixes: string[]
  columns: {
    showType: boolean
    showModified: boolean
    showSize: boolean
  }
  sort: {
    field: 'name' | 'modified' | 'size'
    order: 'asc' | 'desc'
  }
  rainbow: {
    speed: number
    direction: 'normal' | 'reverse'
  }
  tools: {
    rename: { recursive: boolean }
    delete: { recursive: boolean }
  }
}

type ConfigSnapshot = {
  path: string
  exists: boolean
  config: ResolvedAppConfig
  error?: string
}

const DEFAULT_CONFIG: ResolvedAppConfig = {
  startPath: '',
  hideHidden: true,
  ignoreSuffixes: ['.exe', '.app'],
  columns: {
    showType: true,
    showModified: true,
    showSize: true,
  },
  sort: {
    field: 'name',
    order: 'asc',
  },
  rainbow: {
    speed: 8,
    direction: 'normal',
  },
  tools: {
    rename: { recursive: true },
    delete: { recursive: true },
  },
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const num = Number(value)
  if (Number.isFinite(num)) {
    return Math.min(max, Math.max(min, num))
  }
  return fallback
}

function normalizeIgnoreSuffixes(raw?: string[] | string) {
  if (!raw) return DEFAULT_CONFIG.ignoreSuffixes
  const list = Array.isArray(raw) ? raw : raw.split(/[,\s]+/)
  return list
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith('.') ? item.toLowerCase() : `.${item.toLowerCase()}`))
}

function normalizeConfig(raw?: AppConfigInput): ResolvedAppConfig {
  const columns = raw?.columns ?? {}
  const sort = raw?.sort ?? {}
  const rainbow = raw?.rainbow ?? {}
  const tools = raw?.tools ?? {}

  return {
    startPath: typeof raw?.startPath === 'string' ? raw.startPath : DEFAULT_CONFIG.startPath,
    hideHidden: toBoolean(raw?.hideHidden, DEFAULT_CONFIG.hideHidden),
    ignoreSuffixes: normalizeIgnoreSuffixes(raw?.ignoreSuffixes),
    columns: {
      showType: toBoolean(columns.showType, DEFAULT_CONFIG.columns.showType),
      showModified: toBoolean(columns.showModified, DEFAULT_CONFIG.columns.showModified),
      showSize: toBoolean(columns.showSize, DEFAULT_CONFIG.columns.showSize),
    },
    sort: {
      field: sort.field === 'modified' || sort.field === 'size' ? sort.field : DEFAULT_CONFIG.sort.field,
      order: sort.order === 'desc' ? 'desc' : DEFAULT_CONFIG.sort.order,
    },
    rainbow: {
      speed: clampNumber(rainbow.speed, DEFAULT_CONFIG.rainbow.speed, 1, 60),
      direction: rainbow.direction === 'reverse' ? 'reverse' : DEFAULT_CONFIG.rainbow.direction,
    },
    tools: {
      rename: {
        recursive: toBoolean(tools.rename?.recursive, DEFAULT_CONFIG.tools.rename.recursive),
      },
      delete: {
        recursive: toBoolean(tools.delete?.recursive, DEFAULT_CONFIG.tools.delete.recursive),
      },
    },
  }
}

async function readConfigFile(): Promise<ConfigSnapshot> {
  const fallback = normalizeConfig()

  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
    try {
      const parsed = YAML.parse(raw) as AppConfigInput | null
      return {
        path: CONFIG_PATH,
        exists: true,
        config: normalizeConfig(parsed ?? undefined),
      }
    } catch (error) {
      return {
        path: CONFIG_PATH,
        exists: true,
        config: fallback,
        error: error instanceof Error ? error.message : 'Invalid YAML format',
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {
        path: CONFIG_PATH,
        exists: false,
        config: fallback,
        error: 'Config file not found, using defaults',
      }
    }
    return {
      path: CONFIG_PATH,
      exists: false,
      config: fallback,
      error: error instanceof Error ? error.message : 'Unable to read config file',
    }
  }
}

async function writeConfigFile(payload?: AppConfigInput): Promise<ConfigSnapshot> {
  const normalized = normalizeConfig(payload)
  const storedIgnoreSuffixes = normalized.ignoreSuffixes.map((item) => item.replace(/^\./, '')).filter(Boolean)

  const doc = new YAML.Document()
  doc.contents = doc.createNode({
    startPath: normalized.startPath,
    hideHidden: normalized.hideHidden,
    ignoreSuffixes: storedIgnoreSuffixes,
    columns: normalized.columns,
    sort: normalized.sort,
    rainbow: normalized.rainbow,
    tools: normalized.tools,
  })

  const ignoreNode = doc.get('ignoreSuffixes', true)
  if (ignoreNode instanceof YAML.YAMLSeq) {
    ignoreNode.flow = true
  }

  const yamlText = doc.toString()

  await fs.writeFile(CONFIG_PATH, yamlText, 'utf-8')

  return {
    path: CONFIG_PATH,
    exists: true,
    config: normalized,
  }
}

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    ...(IS_MAC
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: false,
          trafficLightPosition: { x: 12, y: 14 },
        }
      : {}),
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

type RenameRequest = {
  rootPath?: string
  findText: string
  replaceText: string
  recursive?: boolean
}

type RenameDetail = {
  from: string
  to?: string
  error?: string
}

type RenameResult = {
  root: string
  renamed: number
  skipped: number
  failed: number
  details: RenameDetail[]
  error?: string
}

type DeleteRequest = {
  rootPath?: string
  keyword: string
  recursive?: boolean
  dryRun?: boolean
}

type DeleteDetail = {
  path: string
  isDirectory: boolean
  deleted?: boolean
  error?: string
}

type DeleteResult = {
  root: string
  matched: number
  deleted: number
  failed: number
  details: DeleteDetail[]
  error?: string
}

ipcMain.handle('config:get', async (): Promise<ConfigSnapshot> => {
  return readConfigFile()
})

ipcMain.handle('config:save', async (_event, payload: AppConfigInput): Promise<ConfigSnapshot> => {
  try {
    return await writeConfigFile(payload)
  } catch (error) {
    return {
      path: CONFIG_PATH,
      exists: false,
      config: normalizeConfig(),
      error: error instanceof Error ? error.message : 'Unable to save config file',
    }
  }
})

function resolveTargetPath(targetPath?: string) {
  // In dev, default to project root to make testing paths easier; otherwise use user home.
  const baseDir = IS_DEV ? process.env.APP_ROOT ?? app.getPath('home') : app.getPath('home')
  if (!targetPath) return baseDir

  const expanded =
    targetPath === '~' || targetPath.startsWith('~/') || targetPath.startsWith('~\\')
      ? path.join(baseDir, targetPath.slice(2))
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

ipcMain.handle('fs:rename-bulk', async (_event, payload: RenameRequest): Promise<RenameResult> => {
  const rootPath = resolveTargetPath(payload?.rootPath)
  const findText = payload?.findText ?? ''
  const replaceText = payload?.replaceText ?? ''
  const recursive = Boolean(payload?.recursive)

  if (!findText.trim()) {
    return {
      root: rootPath,
      renamed: 0,
      skipped: 0,
      failed: 0,
      details: [],
      error: 'Find text is required',
    }
  }

  let rootStat: Stats
  try {
    rootStat = await fs.stat(rootPath)
  } catch (error) {
    return {
      root: rootPath,
      renamed: 0,
      skipped: 0,
      failed: 0,
      details: [],
      error: error instanceof Error ? error.message : 'Root path not accessible',
    }
  }

  if (!rootStat.isDirectory()) {
    return {
      root: rootPath,
      renamed: 0,
      skipped: 0,
      failed: 0,
      details: [],
      error: 'Root path must be a directory',
    }
  }

  let renamed = 0
  let skipped = 0
  let failed = 0
  const details: RenameDetail[] = []

  const queue: string[] = [rootPath]

  while (queue.length) {
    const current = queue.shift()!
    let dirents: Dirent[]
    try {
      dirents = await fs.readdir(current, { withFileTypes: true })
    } catch (error) {
      failed += 1
      details.push({
        from: current,
        error: error instanceof Error ? error.message : 'Unable to read directory',
      })
      continue
    }

    for (const dirent of dirents) {
      const originalPath = path.join(current, dirent.name)
      let nextPath = originalPath

      const nextName = dirent.name.replace(findText, replaceText)
      const shouldRename = nextName !== dirent.name

      if (shouldRename) {
        const targetPath = path.join(current, nextName)
        try {
          // Avoid collisions
          try {
            await fs.stat(targetPath)
            throw new Error('Target name already exists')
          } catch {
            // ok if not exists
          }
          await fs.rename(originalPath, targetPath)
          renamed += 1
          nextPath = targetPath
          details.push({ from: originalPath, to: targetPath })
        } catch (error) {
          failed += 1
          nextPath = originalPath
          details.push({
            from: originalPath,
            error: error instanceof Error ? error.message : 'Rename failed',
          })
        }
      } else {
        skipped += 1
      }

      if (recursive && dirent.isDirectory()) {
        queue.push(nextPath)
      }
    }
  }

  return {
    root: rootPath,
    renamed,
    skipped,
    failed,
    details,
  }
})

ipcMain.handle('fs:delete-bulk', async (_event, payload: DeleteRequest): Promise<DeleteResult> => {
  const rootPath = resolveTargetPath(payload?.rootPath)
  const keyword = payload?.keyword ?? ''
  const recursive = Boolean(payload?.recursive)
  const dryRun = Boolean(payload?.dryRun)

  if (!keyword.trim()) {
    return {
      root: rootPath,
      matched: 0,
      deleted: 0,
      failed: 0,
      details: [],
      error: 'Keyword is required',
    }
  }

  let rootStat: Stats
  try {
    rootStat = await fs.stat(rootPath)
  } catch (error) {
    return {
      root: rootPath,
      matched: 0,
      deleted: 0,
      failed: 0,
      details: [],
      error: error instanceof Error ? error.message : 'Root path not accessible',
    }
  }

  if (!rootStat.isDirectory()) {
    return {
      root: rootPath,
      matched: 0,
      deleted: 0,
      failed: 0,
      details: [],
      error: 'Root path must be a directory',
    }
  }

  const queue: string[] = [rootPath]
  let matched = 0
  let deleted = 0
  let failed = 0
  const details: DeleteDetail[] = []

  while (queue.length) {
    const current = queue.shift()!
    let dirents: Dirent[]
    try {
      dirents = await fs.readdir(current, { withFileTypes: true })
    } catch (error) {
      failed += 1
      details.push({
        path: current,
        isDirectory: true,
        error: error instanceof Error ? error.message : 'Unable to read directory',
      })
      continue
    }

    for (const dirent of dirents) {
      const itemPath = path.join(current, dirent.name)
      const isDir = dirent.isDirectory()

      const hasKeyword = dirent.name.includes(keyword)
      if (hasKeyword) {
        matched += 1
        if (dryRun) {
          details.push({ path: itemPath, isDirectory: isDir, deleted: false })
        } else {
          try {
            if (isDir) {
              await fs.rm(itemPath, { recursive: true, force: true })
            } else {
              await fs.unlink(itemPath)
            }
            deleted += 1
            details.push({ path: itemPath, isDirectory: isDir, deleted: true })
          } catch (error) {
            failed += 1
            details.push({
              path: itemPath,
              isDirectory: isDir,
              error: error instanceof Error ? error.message : 'Delete failed',
            })
          }
          // skip descending into deleted dir
          if (isDir) continue
        }
      }

      if (recursive && isDir) {
        queue.push(itemPath)
      }
    }
  }

  return {
    root: rootPath,
    matched,
    deleted,
    failed,
    details,
  }
})
