import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ConfigSnapshot,
  DeleteResult,
  DirectoryEntry,
  RenameResult,
  ResolvedAppConfig,
} from './vite-env'
import './App.css'

const Icon = {
  Back: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M19 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H19v-2z" />
    </svg>
  ),
  Forward: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 13h11.17l-5.59 5.59L12 20l8-8-8-8-1.41 1.41L16.17 11H5v2z" />
    </svg>
  ),
  Up: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
    </svg>
  ),
  Refresh: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  ),
  Settings: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  ),
  Tools: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
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
  const [configStatus, setConfigStatus] = useState<string | null>(null)
  const [configSaving, setConfigSaving] = useState(false)
  const firstLoadRef = useRef(true)
  const [hideHidden, setHideHidden] = useState(true)
  const [ignoreInput, setIgnoreInput] = useState('exe,app')
  const [showFilters, setShowFilters] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [sortField, setSortField] = useState<'name' | 'modified' | 'size'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [rainbowSpeed, setRainbowSpeed] = useState(8)
  const [rainbowDirection, setRainbowDirection] = useState<'normal' | 'reverse'>('normal')
  const [showType, setShowType] = useState(true)
  const [showModified, setShowModified] = useState(true)
  const [showSize, setShowSize] = useState(true)
  const [renameFind, setRenameFind] = useState('')
  const [renameReplace, setRenameReplace] = useState('')
  const [renameRecursive, setRenameRecursive] = useState(true)
  const [renameStatus, setRenameStatus] = useState<string | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)
  const [deleteKeyword, setDeleteKeyword] = useState('')
  const [deleteRecursive, setDeleteRecursive] = useState(true)
  const [deletePreview, setDeletePreview] = useState<DeleteResult | null>(null)
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
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

  const ignoreSuffixes = useMemo(() => {
    return ignoreInput
      .split(/[,\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .map((item) => (item.startsWith('.') ? item : `.${item}`))
  }, [ignoreInput])

  const ignoreSuffixesRaw = useMemo(() => {
    return ignoreInput
      .split(/[,\s]+/)
      .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean)
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
    if (showType) parts.push('0.9fr')
    if (showModified) parts.push('1.2fr')
    if (showSize) parts.push('0.6fr')
    return parts.join(' ')
  }, [showType, showModified, showSize])

  const applyConfig = useCallback((config: ResolvedAppConfig) => {
    setHideHidden(config.hideHidden)
    setIgnoreInput(
      config.ignoreSuffixes
        .map((item) => item.replace(/^\./, ''))
        .filter(Boolean)
        .join(','),
    )
    setShowType(config.columns.showType)
    setShowModified(config.columns.showModified)
    setShowSize(config.columns.showSize)
    setSortField(config.sort.field)
    setSortOrder(config.sort.order)
    setRainbowSpeed(config.rainbow.speed)
    setRainbowDirection(config.rainbow.direction)
    setRenameRecursive(config.tools.rename.recursive)
    setDeleteRecursive(config.tools.delete.recursive)
  }, [])
  useEffect(() => {
    document.documentElement.style.setProperty('--rainbow-duration', `${rainbowSpeed}s`)
    document.documentElement.style.setProperty('--rainbow-direction', rainbowDirection)
  }, [rainbowSpeed, rainbowDirection])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.style.setProperty('--columns', gridTemplateColumns)
    }
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
      setPathInput(response.path)
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
      setConfigStatus(null)
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

  const handleSaveConfig = useCallback(async () => {
    setConfigSaving(true)
    setConfigStatus(null)
    try {
      const payload: ConfigSnapshot['config'] & { startPath?: string } = {
        startPath: pathInput.trim() || undefined,
        hideHidden,
        ignoreSuffixes: ignoreSuffixesRaw,
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
          speed: rainbowSpeed,
          direction: rainbowDirection,
        },
        tools: {
          rename: { recursive: renameRecursive },
          delete: { recursive: deleteRecursive },
        },
      }

      const snapshot = (await window.electronAPI.saveConfig(payload)) as ConfigSnapshot
      setConfigMeta({ path: snapshot.path, exists: snapshot.exists })
      setConfigError(snapshot.error ?? null)
      applyConfig(snapshot.config)
      setConfigStatus(snapshot.error ? `保存失败：${snapshot.error}` : '保存成功')
    } catch (error) {
      setConfigStatus(error instanceof Error ? `保存失败：${error.message}` : '保存失败')
    } finally {
      setConfigSaving(false)
    }
  }, [
    applyConfig,
    deleteRecursive,
    hideHidden,
    ignoreSuffixesRaw,
    pathInput,
    rainbowDirection,
    rainbowSpeed,
    renameRecursive,
    showModified,
    showSize,
    showType,
    sortField,
    sortOrder,
  ])

  useEffect(() => {
    if (firstLoadRef.current) {
      loadConfig(true)
    }
  }, [loadConfig])

  useEffect(() => {
    const rootEl = document.getElementById('root')
    const listEl = listRef.current
    const cleanups: Array<() => void> = []

    const attachVisibility = (el: HTMLElement | null) => {
      if (!el) return
      let hideTimer: number | undefined
      const show = () => {
        el.classList.add('show-scrollbar')
        if (hideTimer) window.clearTimeout(hideTimer)
        hideTimer = window.setTimeout(() => {
          el.classList.remove('show-scrollbar')
        }, 800)
      }
      el.addEventListener('scroll', show, { passive: true })
      cleanups.push(() => {
        el.removeEventListener('scroll', show)
        if (hideTimer) window.clearTimeout(hideTimer)
        el.classList.remove('show-scrollbar')
      })
    }

    attachVisibility(rootEl)
    attachVisibility(listEl)

    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [])

  useEffect(() => {
    const rootEl = document.getElementById('root')
    const listBodyEl = listRef.current?.querySelector('.list-body') as HTMLElement | null
    const cleanups: Array<() => void> = []

    const attachVisibility = (el: HTMLElement | null) => {
      if (!el) return
      let hideTimer: number | undefined
      const show = () => {
        el.classList.add('show-scrollbar')
        if (hideTimer) window.clearTimeout(hideTimer)
        hideTimer = window.setTimeout(() => {
          el.classList.remove('show-scrollbar')
        }, 800)
      }
      el.addEventListener('scroll', show, { passive: true })
      cleanups.push(() => {
        el.removeEventListener('scroll', show)
        if (hideTimer) window.clearTimeout(hideTimer)
        el.classList.remove('show-scrollbar')
      })
    }

    attachVisibility(rootEl)
    attachVisibility(listBodyEl)

    return () => {
      cleanups.forEach((fn) => fn())
    }
  }, [])

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

  const handleRename = useCallback(async () => {
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
    const result = (await window.electronAPI.renameBulk({
      rootPath: currentPath,
      findText: renameFind,
      replaceText: renameReplace,
      recursive: renameRecursive,
    })) as RenameResult
    setRenameLoading(false)

    if (result.error) {
      setRenameStatus(`Rename failed: ${result.error}`)
      return
    }

    setRenameStatus(`Done: success ${result.renamed}, failed ${result.failed}, skipped ${result.skipped}`)
    loadDirectory(currentPath, false)
  }, [currentPath, loadDirectory, renameFind, renameRecursive, renameReplace])

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

  return (
    <div className={`app-shell${isMac ? ' mac' : ''}`}>
      <header className="toolbar">
        <div className="nav-group">
          <button onClick={goBack} disabled={!canGoBack} aria-label="Back">
            <Icon.Back />
          </button>
          <button onClick={goForward} disabled={!canGoForward} aria-label="Forward">
            <Icon.Forward />
          </button>
          <button onClick={goUp} disabled={!canGoUp} aria-label="Up">
            <Icon.Up />
          </button>
          <button onClick={refresh} disabled={!currentPath} aria-label="Refresh">
            <Icon.Refresh />
          </button>
        </div>
        <form className="path-form" onSubmit={handleSubmit}>
          <input
            value={pathInput}
            onChange={(event) => setPathInput(event.target.value)}
            placeholder="Enter path or paste directory"
          />
          <button type="submit" disabled={!pathInput}>
            Go
          </button>
        </form>
        <button
          className="settings-toggle"
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Filter settings"
        >
          <Icon.Settings />
        </button>
        <button
          className="tool-toggle"
          type="button"
          onClick={() => setShowTools((v) => !v)}
          aria-label="Tools panel"
        >
          <Icon.Tools />
        </button>
      </header>

      <section className="config-bar">
        <div className="config-info">
          <span className={`config-dot ${configMeta?.exists ? 'ok' : 'warn'}`} aria-hidden />
          <span className="config-label">配置文件</span>
          <span className="config-path">{configMeta?.path ?? '加载中...'}</span>
          {configError && <span className="config-status error">{configError}</span>}
          {!configError && configMeta && !configMeta.exists && (
            <span className="config-status warn">未找到，使用默认值</span>
          )}
        </div>
        <div className="config-actions">
          <button
            type="button"
            className="primary-btn config-btn"
            onClick={handleSaveConfig}
            disabled={configLoading || configSaving}
          >
            {configSaving ? '保存中...' : '保存配置'}
          </button>
          <button
            type="button"
            className="secondary-btn config-btn"
            onClick={() => loadConfig(false)}
            disabled={configLoading || configSaving}
          >
            {configLoading ? '重载中...' : '重载配置'}
          </button>
          {configStatus && (
            <span className={`config-status ${configStatus.includes('失败') ? 'error' : 'success'}`}>
              {configStatus}
            </span>
          )}
          <span className="config-hint">修改根目录 app.config.yaml 后保存或重载</span>
        </div>
      </section>

      {showFilters && (
        <section className="filter-panel">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={hideHidden}
              onChange={(event) => setHideHidden(event.target.checked)}
            />
            <span>Hide files starting with "."</span>
          </label>
          <div className="filter-input">
            <span>忽略文件后缀（逗号/空格分隔，无需加点）:</span>
            <input
              value={ignoreInput}
              onChange={(event) => setIgnoreInput(event.target.value)}
              placeholder="exe,app"
            />
          </div>
          <div className="columns-group">
            <span className="group-label">Visible columns:</span>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showType}
                onChange={(event) => setShowType(event.target.checked)}
              />
              <span>Type</span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showModified}
                onChange={(event) => setShowModified(event.target.checked)}
              />
              <span>Modified</span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showSize}
                onChange={(event) => setShowSize(event.target.checked)}
              />
              <span>Size</span>
            </label>
          </div>
          <label className="rainbow-control">
            <span className="group-label">彩虹边框速度 (秒/圈)</span>
            <input
              className="rainbow-slider"
              type="range"
              min={2}
              max={20}
              step={0.5}
              value={rainbowSpeed}
              aria-label="彩虹边框速度"
              onChange={(event) => setRainbowSpeed(Number(event.target.value))}
            />
            <span className="rainbow-speed-value">{rainbowSpeed.toFixed(1)}s</span>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={rainbowDirection === 'reverse'}
              onChange={(event) => setRainbowDirection(event.target.checked ? 'reverse' : 'normal')}
            />
            <span>逆时针流动</span>
          </label>
        </section>
      )}

      {showTools && (
        <section className="tool-card">
          <div className="tool-header">Bulk rename</div>
          <div className="tool-grid">
            <label className="tool-field">
              <span>Find text</span>
              <input
                value={renameFind}
                onChange={(event) => setRenameFind(event.target.value)}
                placeholder="e.g. old"
              />
            </label>
            <label className="tool-field">
              <span>Replace with</span>
              <input
                value={renameReplace}
                onChange={(event) => setRenameReplace(event.target.value)}
                placeholder="e.g. new"
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={renameRecursive}
                onChange={(event) => setRenameRecursive(event.target.checked)}
              />
              <span>Include subdirectories</span>
            </label>
            <button
              type="button"
              className="primary-btn"
              onClick={handleRename}
              disabled={renameLoading}
            >
              {renameLoading ? 'Renaming...' : 'Start rename'}
            </button>
          </div>
          {renameStatus && <div className="status">{renameStatus}</div>}
        </section>
      )}

      {showTools && (
        <section className="tool-card">
          <div className="tool-header">Bulk delete (name contains keyword)</div>
          <div className="tool-grid">
            <label className="tool-field">
              <span>Keyword</span>
              <input
                value={deleteKeyword}
                onChange={(event) => setDeleteKeyword(event.target.value)}
                placeholder="e.g. temp"
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={deleteRecursive}
                onChange={(event) => setDeleteRecursive(event.target.checked)}
              />
              <span>Include subdirectories</span>
            </label>
            <div className="tool-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => runDelete(true)}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Previewing...' : 'Preview matches'}
              </button>
              <button
                type="button"
                className="danger-btn"
                onClick={() => runDelete(false)}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Confirm delete'}
              </button>
            </div>
          </div>
          {deleteStatus && <div className="status">{deleteStatus}</div>}
          {deletePreview && deletePreview.details.length > 0 && (
            <div className="preview-list">
              {deletePreview.details.slice(0, 10).map((item) => (
                <div key={item.path} className="preview-row">
                  <span className="glyph">{item.isDirectory ? '📁' : '📄'}</span>
                  <span className="preview-path">{item.path}</span>
                </div>
              ))}
              {deletePreview.details.length > 10 && (
                <div className="preview-stream">
                  {deletePreview.details
                    .slice(10)
                    .map((item) => `${item.isDirectory ? '[DIR] ' : '[FILE] '}${item.path}`)
                    .join('\n')}
                </div>
              )}
              {deletePreview.details.length > 10 && (
                <div className="preview-more">
                  First 10 shown above, remaining {deletePreview.details.length - 10} streamed below
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {error && <div className="status status-error">{error}</div>}
      {!error && loading && <div className="status">Loading...</div>}

      <div className="list" ref={listRef}>
        <div className="list-header">
          <button
            type="button"
            className="header-btn"
            onClick={() => toggleSort('name')}
            aria-label="Sort by name"
          >
            Name
            {sortField === 'name' && <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
          </button>
          {showType && <span>Type</span>}
          {showModified && (
            <button
              type="button"
              className="header-btn"
              onClick={() => toggleSort('modified')}
              aria-label="Sort by modified time"
            >
              Modified
              {sortField === 'modified' && (
                <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
          )}
          {showSize && (
            <button
              type="button"
              className="header-btn size-column"
              onClick={() => toggleSort('size')}
              aria-label="Sort by size"
            >
              Size
              {sortField === 'size' && <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
            </button>
          )}
        </div>
        <div className="list-body">
          {visibleEntries.length === 0 && (
            <div className="empty">{entries.length === 0 ? 'Empty directory' : 'No matching files'}</div>
          )}
          {visibleEntries.map((entry) => (
            <button key={entry.path} className="list-row" onDoubleClick={() => openEntry(entry)} title={entry.path}>
              <span className="name">
                <span className="glyph">{entry.isDirectory ? '📁' : '📄'}</span>
                {entry.name}
              </span>
              {showType && <span>{entry.isDirectory ? 'Folder' : 'File'}</span>}
              {showModified && <span>{formatDate(entry.modified)}</span>}
              {showSize && (
                <span className="size-column">{entry.isDirectory ? '-' : formatSize(entry.size)}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App