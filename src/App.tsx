import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DirectoryEntry } from './vite-env'
import './App.css'

const Icon = {
  Back: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M10 7l-5 5 5 5" />
      <path d="M19 12H6" />
    </svg>
  ),
  Forward: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M14 7l5 5-5 5" />
      <path d="M5 12h13" />
    </svg>
  ),
  Up: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  ),
  Refresh: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M3 12a9 9 0 0115-6.364L21 3" />
      <path d="M21 9v-6h-6" />
      <path d="M21 12a9 9 0 01-15 6.364L3 21" />
      <path d="M3 15v6h6" />
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

  const currentPath = useMemo(() => history[historyIndex] ?? '', [history, historyIndex])
  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex >= 0 && historyIndex < history.length - 1
  const canGoUp = !!parentPath(currentPath) && parentPath(currentPath) !== currentPath

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

  useEffect(() => {
    loadDirectory()
  }, [loadDirectory])

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

  return (
    <div className="app-shell">
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
            placeholder="输入路径或粘贴目录地址"
          />
          <button type="submit" disabled={!pathInput}>
            跳转
          </button>
        </form>
      </header>

      {error && <div className="status status-error">{error}</div>}
      {!error && loading && <div className="status">加载中...</div>}

      <div className="list">
        <div className="list-header">
          <span>名称</span>
          <span>类型</span>
          <span>修改时间</span>
          <span className="size-column">大小</span>
        </div>
        <div className="list-body">
          {entries.length === 0 && (
            <div className="empty">空目录</div>
          )}
          {entries.map((entry) => (
            <button
              key={entry.path}
              className="list-row"
              onDoubleClick={() => openEntry(entry)}
              title={entry.path}
            >
              <span className="name">
                <span className="glyph">{entry.isDirectory ? '📁' : '📄'}</span>
                {entry.name}
              </span>
              <span>{entry.isDirectory ? '文件夹' : '文件'}</span>
              <span>{formatDate(entry.modified)}</span>
              <span className="size-column">{entry.isDirectory ? '-' : formatSize(entry.size)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
