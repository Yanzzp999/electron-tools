import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ConfigSnapshot,
  DeleteResult,
  DirectoryEntry,
  RenameResult,
  ResolvedAppConfig,
  SearchResult,
  AppConfigInput,
} from './vite-env'
import './App.css'

const RAINBOW_MIN_RPS = 0.075
const RAINBOW_MAX_RPS = 4
const RAINBOW_SLIDER_MIN = 0
const RAINBOW_SLIDER_MAX = 100
const RAINBOW_BORDER_MIN = 1
const RAINBOW_BORDER_MAX = 20
const RAINBOW_BRIGHTNESS_MIN = 0.1
const RAINBOW_BRIGHTNESS_MAX = 1

function sliderToRps(value: number) {
  const clamped = Math.min(RAINBOW_SLIDER_MAX, Math.max(RAINBOW_SLIDER_MIN, value))
  const t = (clamped - RAINBOW_SLIDER_MIN) / (RAINBOW_SLIDER_MAX - RAINBOW_SLIDER_MIN)
  return RAINBOW_MIN_RPS * Math.pow(RAINBOW_MAX_RPS / RAINBOW_MIN_RPS, t)
}

function rpsToSlider(rps: number) {
  const clamped = Math.min(RAINBOW_MAX_RPS, Math.max(RAINBOW_MIN_RPS, rps))
  const t = Math.log(clamped / RAINBOW_MIN_RPS) / Math.log(RAINBOW_MAX_RPS / RAINBOW_MIN_RPS)
  return RAINBOW_SLIDER_MIN + t * (RAINBOW_SLIDER_MAX - RAINBOW_SLIDER_MIN)
}

function formatRps(rps: number) {
  if (rps >= 10) return rps.toFixed(0)
  if (rps >= 1) return rps.toFixed(1)
  return rps.toFixed(2)
}

const Icon = {
  Back: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
  ),
  Forward: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
    </svg>
  ),
  Up: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
    </svg>
  ),
  Refresh: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  ),
  Settings: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  ),
  Tools: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
    </svg>
  ),
  Search: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  ),
  Home: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ),
  Desktop: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M20 3H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h6v2H8v2h8v-2h-2v-2h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H4V5h16v10z" />
    </svg>
  ),
  Folder: () => (
    <svg className="icon" style={{ fill: '#90caf9' }} viewBox="0 0 24 24">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  ),
  File: () => (
    <svg className="icon" style={{ fill: '#e0e0e0' }} viewBox="0 0 24 24">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  ),
  Trash: () => (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  ),
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function formatSize(size: number) {
  if (size === 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function parentPath(path: string) {
  if (!path) return ''
  const trimmed = path.replace(/[/\\]+$/, '')
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (lastSlash <= 0) return trimmed
  return trimmed.slice(0, lastSlash)
}

function App() {
  const [pathInput, setPathInput] = useState('')
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const historyIndexRef = useRef(-1)
  const [configMeta, setConfigMeta] = useState<{ path: string; exists: boolean } | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [savedStartPath, setSavedStartPath] = useState('')
  const firstLoadRef = useRef(true)
  const [hideHidden, setHideHidden] = useState(true)
  const [ignoreInput, setIgnoreInput] = useState('.exe,.app')
  const [showFilters, setShowFilters] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [sortField, setSortField] = useState<'name' | 'modified' | 'size'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showType, setShowType] = useState(true)
  const [showModified, setShowModified] = useState(true)
  const [showSize, setShowSize] = useState(true)
  const [renameFind, setRenameFind] = useState('')
  const [renameReplace, setRenameReplace] = useState('')
  const [renameRecursive, setRenameRecursive] = useState(true)
  const [renameStatus, setRenameStatus] = useState<string | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)
  const [renamePreview, setRenamePreview] = useState<RenameResult | null>(null)
  const [deleteKeyword, setDeleteKeyword] = useState('')
  const [deleteRecursive, setDeleteRecursive] = useState(true)
  const [deletePreview, setDeletePreview] = useState<DeleteResult | null>(null)
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchScope, setSearchScope] = useState('')
  const [searchResults, setSearchResults] = useState<DirectoryEntry[]>([])
  const [searchStatus, setSearchStatus] = useState<string | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Copy feedback
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)



  // Sidebar resizing
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // Limit sidebar width between 150px and 500px or window width - 200
      const newWidth = Math.max(150, Math.min(e.clientX, 500))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Rainbow settings
  const [rainbowSpeedSlider, setRainbowSpeedSlider] = useState(8)
  const [rainbowBorderWidth, setRainbowBorderWidth] = useState(3)
  const [rainbowBrightness, setRainbowBrightness] = useState(0.92)
  const [rainbowDirection, setRainbowDirection] = useState<'normal' | 'reverse'>('normal')

  // New state for modal tools
  const [activeTool, setActiveTool] = useState<'rename' | 'delete' | 'search' | null>(null)

  const isMac = useMemo(() => navigator.platform.includes('Mac'), [])
  const listRef = useRef<HTMLDivElement | null>(null)

  const toggleSort = useCallback(
    (field: 'name' | 'modified' | 'size') => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortOrder('asc')
      }
    },
    [sortField],
  )

  const currentPath = useMemo(() => history[historyIndex] ?? '', [history, historyIndex])
  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex >= 0 && historyIndex < history.length - 1
  const canGoUp = !!parentPath(currentPath) && parentPath(currentPath) !== currentPath

  useEffect(() => {
    if (!searchScope && currentPath) {
      setSearchScope(currentPath)
    }
  }, [currentPath, searchScope])

  const ignoreSuffixes = useMemo(() => {
    return ignoreInput
      .split(/[,\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .map((item) => (item.startsWith('.') ? item : `.${item}`))
  }, [ignoreInput])

  const visibleEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (hideHidden && entry.name.startsWith('.')) return false
      const lowerName = entry.name.toLowerCase()
      if (ignoreSuffixes.some((sfx) => lowerName.endsWith(sfx))) return false
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1

      const direction = sortOrder === 'asc' ? 1 : -1
      if (sortField === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * direction
      }
      if (sortField === 'modified') {
        return (a.modified - b.modified) * direction
      }
      return (a.size - b.size) * direction
    })

    return sorted
  }, [entries, hideHidden, ignoreSuffixes, sortField, sortOrder])

  const gridTemplateColumns = useMemo(() => {
    const parts = ['2fr']
    if (showType) parts.push('1fr')
    if (showModified) parts.push('1.5fr')
    if (showSize) parts.push('1fr')
    return parts.join(' ')
  }, [showType, showModified, showSize])

  const applyConfig = useCallback((config: ResolvedAppConfig) => {
    setHideHidden(config.hideHidden)
    setIgnoreInput(config.ignoreSuffixes.join(','))
    setShowType(config.columns.showType)
    setShowModified(config.columns.showModified)
    setShowSize(config.columns.showSize)
    setSortField(config.sort.field)
    setSortOrder(config.sort.order)
    setSortField(config.sort.field)
    setSortOrder(config.sort.order)
    setRenameRecursive(config.tools.rename.recursive)
    setDeleteRecursive(config.tools.delete.recursive)
    setSavedStartPath(config.startPath || '')
    // Add safe check for rainbow config if it exists in type, otherwise default
    if (config.rainbow) {
      setRainbowSpeedSlider(rpsToSlider(sliderToRps(config.rainbow.speed)))
      setRainbowDirection(config.rainbow.direction)
      setRainbowBorderWidth(config.rainbow.width)
      setRainbowBrightness(config.rainbow.brightness)
    }
  }, [])

  const saveCurrentConfig = useCallback(async () => {
    const config: AppConfigInput = {
      startPath: savedStartPath,
      hideHidden,
      ignoreSuffixes: ignoreInput,
      columns: {
        showType,
        showModified,
        showSize,
      },
      sort: {
        field: sortField,
        order: sortOrder,
      },
      rainbow: {
        speed: rainbowSpeedSlider,
        direction: rainbowDirection,
        width: rainbowBorderWidth,
        brightness: rainbowBrightness,
      },
      tools: {
        rename: { recursive: renameRecursive },
        delete: { recursive: deleteRecursive },
      },
    }

    try {
      await window.electronAPI.saveConfig(config)
    } catch (error) {
      console.error('Failed to save config:', error)
      // Optional: show error toast
    }
  }, [
    savedStartPath,
    hideHidden,
    ignoreInput,
    showType,
    showModified,
    showSize,
    sortField,
    sortOrder,
    rainbowSpeedSlider,
    rainbowDirection,
    rainbowBorderWidth,
    rainbowBrightness,
    renameRecursive,
    deleteRecursive,
  ])

  const rainbowRps = useMemo(() => sliderToRps(rainbowSpeedSlider), [rainbowSpeedSlider])

  const rainbowSpeedLabel = useMemo(() => formatRps(rainbowRps), [rainbowRps])
  const rainbowBrightnessLabel = useMemo(() => rainbowBrightness.toFixed(2), [rainbowBrightness])

  useEffect(() => {
    const duration = rainbowRps > 0 ? 1 / rainbowRps : 10
    document.documentElement.style.setProperty('--rainbow-duration', `${duration}s`)
    document.documentElement.style.setProperty('--rainbow-direction', rainbowDirection)
    document.documentElement.style.setProperty('--rainbow-border-width', `${rainbowBorderWidth}px`)
    document.documentElement.style.setProperty('--rainbow-border-opacity', `${rainbowBrightness}`)
    document.documentElement.style.setProperty('--rainbow-border-glow', `${(0.18 * rainbowBrightness).toFixed(3)}`)
  }, [rainbowBorderWidth, rainbowBrightness, rainbowDirection, rainbowRps])

  useEffect(() => {
    document.documentElement.style.setProperty('--columns', gridTemplateColumns)
  }, [gridTemplateColumns])

  const loadDirectory = useCallback(
    async (targetPath?: string, pushHistory = true) => {
      setLoading(true)
      const response = await window.electronAPI.listDirectory(targetPath)
      setLoading(false)

      if (!response.exists) {
        setError(response.error ?? 'Unable to open directory')
        return
      }

      setEntries(response.entries)
      setPathInput('')
      setError(null)

      if (pushHistory) {
        setHistory((prev) => {
          const trimmed = prev.slice(0, historyIndexRef.current + 1)
          const updated = [...trimmed, response.path]
          historyIndexRef.current = updated.length - 1
          setHistoryIndex(historyIndexRef.current)
          return updated
        })
      }
    },
    [],
  )

  const loadConfig = useCallback(
    async (applyStartPath: boolean) => {
      setConfigLoading(true)
      try {
        const snapshot = (await window.electronAPI.getConfig()) as ConfigSnapshot
        setConfigMeta({ path: snapshot.path, exists: snapshot.exists })
        setConfigError(snapshot.error ?? null)
        applyConfig(snapshot.config)

        if (applyStartPath) {
          await loadDirectory(snapshot.config.startPath || undefined, true)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '加载配置失败'
        setConfigError(message)
        if (applyStartPath) {
          await loadDirectory(undefined, true)
        }
      } finally {
        setConfigLoading(false)
        firstLoadRef.current = false
      }
    },
    [applyConfig, loadDirectory],
  )

  useEffect(() => {
    if (firstLoadRef.current) {
      loadConfig(true)
    }
  }, [loadConfig])

  const goBack = useCallback(() => {
    if (!canGoBack) return
    const target = history[historyIndexRef.current - 1]
    historyIndexRef.current -= 1
    setHistoryIndex(historyIndexRef.current)
    loadDirectory(target, false)
  }, [canGoBack, history, loadDirectory])

  const goForward = useCallback(() => {
    if (!canGoForward) return
    const target = history[historyIndexRef.current + 1]
    historyIndexRef.current += 1
    setHistoryIndex(historyIndexRef.current)
    loadDirectory(target, false)
  }, [canGoForward, history, loadDirectory])

  const goUp = useCallback(() => {
    if (!canGoUp) return
    loadDirectory(parentPath(currentPath), true)
  }, [canGoUp, currentPath, loadDirectory])

  const refresh = useCallback(() => {
    if (!currentPath) return
    loadDirectory(currentPath, false)
  }, [currentPath, loadDirectory])

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      const nextPath = pathInput.trim()
      if (nextPath) {
        loadDirectory(nextPath, true)
      }
    },
    [pathInput, loadDirectory],
  )

  const openEntry = useCallback(
    (entry: DirectoryEntry) => {
      if (entry.isDirectory) {
        loadDirectory(entry.path, true)
      }
    },
    [loadDirectory],
  )

  const runRename = useCallback(
    async (dryRun: boolean) => {
      if (!currentPath) {
        setRenameStatus('Select a path first')
        return
      }
      if (!renameFind.trim()) {
        setRenameStatus('Enter text to replace')
        return
      }

      setRenameLoading(true)
      setRenameStatus(null)

      try {
        const result = (await window.electronAPI.renameBulk({
          rootPath: currentPath,
          findText: renameFind,
          replaceText: renameReplace,
          recursive: renameRecursive,
          dryRun,
        })) as RenameResult

        if (result.error) {
          setRenameStatus(`Rename failed: ${result.error}`)
          return
        }

        if (dryRun) {
          setRenamePreview(result)
          setRenameStatus(`Preview: will rename ${result.renamed}, failed ${result.failed}, skipped ${result.skipped}`)
        } else {
          setRenamePreview(null)
          setRenameStatus(`Done: success ${result.renamed}, failed ${result.failed}, skipped ${result.skipped}`)
          loadDirectory(currentPath, false)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rename failed'
        setRenameStatus(`Rename failed: ${message}`)
      } finally {
        setRenameLoading(false)
      }
    },
    [currentPath, loadDirectory, renameFind, renameRecursive, renameReplace],
  )

  const handleRename = useCallback(() => runRename(false), [runRename])

  const runDelete = useCallback(
    async (dryRun: boolean) => {
      if (!currentPath) {
        setDeleteStatus('Select a path first')
        return
      }
      if (!deleteKeyword.trim()) {
        setDeleteStatus('Enter a keyword to match')
        return
      }

      setDeleteLoading(true)
      setDeleteStatus(null)
      const result = (await window.electronAPI.deleteBulk({
        rootPath: currentPath,
        keyword: deleteKeyword,
        recursive: deleteRecursive,
        dryRun,
      })) as DeleteResult
      setDeleteLoading(false)

      if (result.error) {
        setDeleteStatus(`Operation failed: ${result.error}`)
        return
      }

      if (dryRun) {
        setDeletePreview(result)
        setDeleteStatus(`Preview: matched ${result.matched}, expected to delete ${result.matched - result.failed}`)
      } else {
        setDeletePreview(null)
        setDeleteStatus(`Delete done: success ${result.deleted}, failed ${result.failed}`)
        loadDirectory(currentPath, false)
      }
    },
    [currentPath, deleteKeyword, deleteRecursive, loadDirectory],
  )

  const handleSearch = useCallback(async () => {
    const keyword = searchKeyword.trim()
    const scope = searchScope.trim() || currentPath || undefined

    if (!keyword) {
      setSearchStatus('请输入搜索关键词')
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    setSearchStatus(null)

    try {
      const result = (await window.electronAPI.searchFiles({
        keyword,
        directory: scope,
        limit: 200,
        includeHidden: !hideHidden,
        ignoreSuffixes,
      })) as SearchResult



      if (result.error) {
        setSearchResults([])
        setSearchStatus(`搜索失败：${result.error}`)
        return
      }

      setSearchResults(result.entries)
      const scopeLabel = scope || '默认目录'
      setSearchStatus(`已找到 ${result.entries.length} 项（${result.engine} @ ${result.platform} | 范围：${scopeLabel}）`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '搜索失败'
      setSearchResults([])
      setSearchStatus(`搜索失败：${message}`)

    } finally {
      setSearchLoading(false)
    }
  }, [currentPath, hideHidden, ignoreSuffixes, searchKeyword, searchScope])

  const openSearchResult = useCallback(
    (entry: DirectoryEntry) => {
      if (entry.isDirectory) {
        loadDirectory(entry.path, true)
        return
      }
      const targetDir = parentPath(entry.path)
      if (targetDir) {
        loadDirectory(targetDir, true)
      }
    },
    [loadDirectory],
  )

  const handleCopy = useCallback((text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback('Copied!')
      setTimeout(() => setCopyFeedback(null), 2000)
    })
  }, [])

  // Shortcuts
  const goHome = () => loadDirectory(import.meta.env.VITE_HOME_DIR || '/Users/yanzzp', true) // Fallback or need env? electron usually provides current user home.
  // We can use the history[0] if it started at home, but safe to assume typical paths for "Favorites" mock
  // actually in browser env we can't guess absolute paths easily without electron API.
  // Assuming the user runs this in electron, let's use some "Desktop" "Downloads" guesses based on currentPath if possible
  // or just static text for Demo if logic requires more backend.
  // Update: I'll use text input manipulation or just hardcode some common paths if I knew the user name, but I can use `parentPath` logic effectively.
  // For now, I'll assume standard mac paths relative to the current user home if I can find it.

  // Better approach: Just use standard sidebar items that trigger specific paths if we knew them, 
  // or just Keep "Home" = start path.
  // I will use a simple function to specific paths if I can.
  // Actually, I'll rely on the user manually navigating for now or just generic "Home" taking to initial path?

  const SidebarItem = ({ icon: IconComp, label, path }: { icon: any, label: string, path?: string }) => (
    <button className="sidebar-item" onClick={() => path && loadDirectory(path, true)}>
      <IconComp />
      <span>{label}</span>
    </button>
  )

  return (
    <div className={`app-shell${isMac ? ' mac' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}>
      <nav className="sidebar" ref={sidebarRef}>
        <div className="sidebar-group-label">Favorites</div>
        <SidebarItem icon={Icon.Home} label="Home" path="/Users/yanzzp" />
        <SidebarItem icon={Icon.Desktop} label="Desktop" path="/Users/yanzzp/Desktop" />
        <SidebarItem icon={Icon.Folder} label="Documents" path="/Users/yanzzp/Documents" />
        <SidebarItem icon={Icon.Folder} label="Downloads" path="/Users/yanzzp/Downloads" />
        <SidebarItem icon={Icon.Folder} label="CodeProjects" path="/Users/yanzzp/CodeProjects" />

        <div className="sidebar-group-label" style={{ marginTop: 16 }}>Locations</div>
        <SidebarItem icon={Icon.Desktop} label="Macintosh HD" path="/" />
        <SidebarItem icon={Icon.Folder} label="iCloud Drive" />
      </nav>

      {/* Resizer Handle */}
      <div
        className={`resizer ${isResizing ? 'active' : ''}`}
        onMouseDown={startResizing}
      />

      <main className="main-content">
        <header className="toolbar">
          <div className="nav-controls">
            <button className="icon-btn" onClick={goBack} disabled={!canGoBack} aria-label="Back">
              <Icon.Back />
            </button>
            <button className="icon-btn" onClick={goForward} disabled={!canGoForward} aria-label="Forward">
              <Icon.Forward />
            </button>
            <button className="icon-btn" onClick={goUp} disabled={!canGoUp} aria-label="Up">
              <Icon.Up />
            </button>
            <button className="icon-btn" onClick={refresh} disabled={!currentPath} aria-label="Refresh">
              <Icon.Refresh />
            </button>
          </div>

          <form className="path-bar" onSubmit={handleSubmit}>
            <Icon.Search /> {/* Used as aesthetic icon here or could be search trigger */}
            <input
              className="path-input"
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              placeholder="Search or enter path..."
            />
          </form>

          <div className="nav-controls">
            <button
              className="icon-btn"
              onClick={() => setActiveTool('search')}
              title="Search Files"
            >
              <Icon.Search />
            </button>
            <button
              className="icon-btn"
              onClick={() => setActiveTool('rename')}
              title="Bulk Rename"
            >
              <Icon.Tools />
            </button>
            <button
              className="icon-btn"
              onClick={() => setActiveTool('delete')}
              title="Bulk Delete"
            >
              <Icon.Trash />
            </button>
            <button
              className="icon-btn"
              onClick={() => setShowFilters(true)}
              title="View Settings"
            >
              <Icon.Settings />
            </button>
          </div>
        </header>

        <div className="file-list-container" ref={listRef}>
          <div className="list-header">
            <div className="header-cell" onClick={() => toggleSort('name')}>
              Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>
            {showType && <div className="header-cell">Type</div>}
            {showModified && <div className="header-cell" onClick={() => toggleSort('modified')}>
              Date Modified {sortField === 'modified' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>}
            {showSize && <div className="header-cell" onClick={() => toggleSort('size')}>
              Size {sortField === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
            </div>}
          </div>

          <div className="list-body">
            {visibleEntries.map((entry) => (
              <div
                key={entry.path}
                className="list-row"
                onDoubleClick={() => openEntry(entry)}
                title={entry.path}
              >
                <div className="file-name">
                  <span className="file-icon">{entry.isDirectory ? <Icon.Folder /> : <Icon.File />}</span>
                  {entry.name}
                </div>
                {showType && <div>{entry.isDirectory ? '--' : 'File'}</div>}
                {showModified && <div>{formatDate(entry.modified)}</div>}
                {showSize && <div>{entry.isDirectory ? '--' : formatSize(entry.size)}</div>}
              </div>
            ))}
            {visibleEntries.length === 0 && !loading && (
              <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
                {error || 'Folder is empty'}
              </div>
            )}
          </div>
        </div>

        <div className="status-bar">
          <span>{visibleEntries.length} items</span>
          <span
            onDoubleClick={() => handleCopy(currentPath || configMeta?.path || '')}
            title="Double click to copy path"
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            {copyFeedback || currentPath || configMeta?.path || ''}
          </span>
        </div>
      </main>

      {/* Modals */}
      {showFilters && (
        <div className="modal-overlay" onClick={() => setShowFilters(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">View Options</div>
            <div className="field-group">
              <label>
                <input type="checkbox" checked={hideHidden} onChange={e => setHideHidden(e.target.checked)} />
                Hide dotfiles
              </label>
              <label>
                <input type="checkbox" checked={showType} onChange={e => setShowType(e.target.checked)} />
                Show Type
              </label>
              <label>
                <input type="checkbox" checked={showModified} onChange={e => setShowModified(e.target.checked)} />
                Show Modified
              </label>
              <label>
                <input type="checkbox" checked={showSize} onChange={e => setShowSize(e.target.checked)} />
                Show Size
              </label>

            </div>


            <div className="field-group" style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, fontWeight: 600 }}>Rainbow Border</div>
              <label>
                <span style={{ fontSize: 13, marginRight: 8 }}>Speed: {rainbowSpeedLabel}（圈/秒）</span>
                <input
                  type="range"
                  min={RAINBOW_SLIDER_MIN}
                  max={RAINBOW_SLIDER_MAX}
                  step={1}
                  value={rainbowSpeedSlider}
                  onChange={e => setRainbowSpeedSlider(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#a8c7fa' }}
                  title={`圈速 ≈ ${rainbowSpeedLabel} 圈/秒（非线性：滑块后段加速更快）`}
                />
              </label>
              <label>
                <span style={{ fontSize: 13, marginRight: 8 }}>Width: {rainbowBorderWidth.toFixed(1)} px</span>
                <input
                  type="range"
                  min={RAINBOW_BORDER_MIN}
                  max={RAINBOW_BORDER_MAX}
                  step={0.5}
                  value={rainbowBorderWidth}
                  onChange={e => setRainbowBorderWidth(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#a8c7fa' }}
                  title="调整边框宽度"
                />
              </label>
              <label>
                <span style={{ fontSize: 13, marginRight: 8 }}>Brightness: {rainbowBrightnessLabel}</span>
                <input
                  type="range"
                  min={RAINBOW_BRIGHTNESS_MIN}
                  max={RAINBOW_BRIGHTNESS_MAX}
                  step={0.01}
                  value={rainbowBrightness}
                  onChange={e => setRainbowBrightness(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#a8c7fa' }}
                  title="调整边框亮度"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={rainbowDirection === 'reverse'}
                  onChange={e => setRainbowDirection(e.target.checked ? 'reverse' : 'normal')}
                />
                Reverse Direction
              </label>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  saveCurrentConfig()
                  setShowFilters(false)
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )
      }

      {
        activeTool === 'rename' && (
          <div className="modal-overlay" onClick={() => setActiveTool(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">Bulk Rename</div>
              <div className="field-group">
                <span className="field-label">Find</span>
                <input className="input-field" value={renameFind} onChange={e => setRenameFind(e.target.value)} placeholder="Text to find" />
              </div>
              <div className="field-group">
                <span className="field-label">Replace with</span>
                <input className="input-field" value={renameReplace} onChange={e => setRenameReplace(e.target.value)} placeholder="Replacement" />
              </div>
              <label>
                <input type="checkbox" checked={renameRecursive} onChange={e => setRenameRecursive(e.target.checked)} />
                Recursive
              </label>

              {renameStatus && <div style={{ fontSize: 13, color: '#aaa', marginTop: 8 }}>{renameStatus}</div>}
              {renamePreview && (
                <div style={{ maxHeight: 160, overflow: 'auto', background: '#111', padding: 8, borderRadius: 4, fontSize: 12, border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {renamePreview.details.length === 0 ? (
                    <div style={{ opacity: 0.7 }}>No matches found</div>
                  ) : (
                    <>
                      {renamePreview.details.slice(0, 50).map((d, i) => (
                        <div key={i} style={{ lineHeight: 1.4 }}>
                          <div>{d.from}</div>
                          {d.to && <div style={{ color: '#a8c7fa' }}>→ {d.to}</div>}
                          {d.error && <div style={{ color: '#e57373' }}>⚠ {d.error}</div>}
                        </div>
                      ))}
                      {renamePreview.details.length > 50 && <div>...and more</div>}
                    </>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn-text" onClick={() => setActiveTool(null)}>Cancel</button>
                <button className="btn btn-secondary" onClick={() => runRename(true)} disabled={renameLoading}>
                  Preview
                </button>
                <button className="btn btn-primary" onClick={handleRename} disabled={renameLoading}>
                  {renameLoading ? 'Working...' : 'Rename'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        activeTool === 'delete' && (
          <div className="modal-overlay" onClick={() => setActiveTool(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">Bulk Delete</div>
              <div className="field-group">
                <span className="field-label">Keyword</span>
                <input className="input-field" value={deleteKeyword} onChange={e => setDeleteKeyword(e.target.value)} placeholder="Files containing..." />
              </div>
              <label>
                <input type="checkbox" checked={deleteRecursive} onChange={e => setDeleteRecursive(e.target.checked)} />
                Recursive
              </label>

              {deleteStatus && <div style={{ fontSize: 13, color: '#aaa', marginTop: 8, whiteSpace: 'pre-wrap' }}>{deleteStatus}</div>}

              {deletePreview && deletePreview.details.length > 0 && (
                <div style={{ maxHeight: 150, overflow: 'auto', background: '#111', padding: 8, borderRadius: 4, fontSize: 12 }}>
                  {deletePreview.details.slice(0, 50).map((d, i) => (
                    <div key={i}>{d.path}</div>
                  ))}
                  {deletePreview.details.length > 50 && <div>...and more</div>}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn-text" onClick={() => setActiveTool(null)}>Cancel</button>
                <button className="btn btn-secondary" onClick={() => runDelete(true)} disabled={deleteLoading}>
                  Preview
                </button>
                <button className="btn btn-primary" style={{ backgroundColor: '#e53935' }} onClick={() => runDelete(false)} disabled={deleteLoading}>
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        activeTool === 'search' && (
          <div className="modal-overlay" onClick={() => setActiveTool(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 600 }}>
              <div className="modal-header">Spotlight Search</div>
              <div className="field-group">
                <input className="input-field" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="Search..." autoFocus />
              </div>
              <div className="field-group" style={{ flexDirection: 'row', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setSearchScope(currentPath)}>Current Dir</button>
                <span style={{ fontSize: 12, opacity: 0.7, alignSelf: 'center' }}>Scope: {searchScope || 'Default'}</span>
              </div>

              <div style={{ marginTop: 10, maxHeight: 300, overflow: 'auto' }}>
                {searchResults.map(entry => (
                  <div key={entry.path} className="list-row" onClick={() => openSearchResult(entry)}>
                    <span className="file-icon">{entry.isDirectory ? '📁' : '📄'}</span>
                    {entry.name}
                    <span style={{ opacity: 0.5, marginLeft: 'auto', fontSize: 11 }}>{entry.path}</span>
                  </div>
                ))}
                {searchStatus && <div style={{ padding: 10, textAlign: 'center', opacity: 0.7 }}>{searchStatus}</div>}
              </div>

              <div className="modal-actions">
                <button className="btn btn-text" onClick={() => setActiveTool(null)}>Close</button>
                <button className="btn btn-primary" onClick={handleSearch} disabled={searchLoading}>Search</button>
              </div>
            </div>
          </div>
        )
      }

    </div >
  )
}

export default App