import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DeleteResult, DirectoryEntry, RenameResult } from './vite-env'
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
  Settings: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
      <path d="M19.4 15a1.8 1.8 0 00.36 1.98l.05.05a2 2 0 01-2.83 2.83l-.05-.05a1.8 1.8 0 00-1.98-.36 1.8 1.8 0 00-1.08 1.64V21a2 2 0 01-4 0v-.1a1.8 1.8 0 00-1.08-1.64 1.8 1.8 0 00-1.98.36l-.05.05a2 2 0 01-2.83-2.83l.05-.05a1.8 1.8 0 00.36-1.98 1.8 1.8 0 00-1.64-1.08H3a2 2 0 010-4h.1a1.8 1.8 0 001.64-1.08 1.8 1.8 0 00-.36-1.98l-.05-.05a2 2 0 012.83-2.83l.05.05a1.8 1.8 0 001.98.36h.02A1.8 1.8 0 009 4.1V4a2 2 0 114 0v.1a1.8 1.8 0 001.08 1.64h.02a1.8 1.8 0 001.98-.36l.05-.05a2 2 0 112.83 2.83l-.05.05a1.8 1.8 0 00-.36 1.98v.02a1.8 1.8 0 001.64 1.08H21a2 2 0 010 4h-.1a1.8 1.8 0 00-1.64 1.08z" />
    </svg>
  ),
  Tools: () => (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M9 3l2 2-2 2-2-2 2-2zM14 8l2 2-9 9-2-2 9-9z" />
      <path d="M16 5l3 3-2 2-3-3z" />
      <path d="M11 4l9 9" />
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
  const [deleteKeyword, setDeleteKeyword] = useState('')
  const [deleteRecursive, setDeleteRecursive] = useState(true)
  const [deletePreview, setDeletePreview] = useState<DeleteResult | null>(null)
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

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

  const handleRename = useCallback(async () => {
    if (!currentPath) {
      setRenameStatus('请先选择路径')
      return
    }
    if (!renameFind.trim()) {
      setRenameStatus('请输入要替换的关键字')
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
      setRenameStatus(`重命名失败：${result.error}`)
      return
    }

    setRenameStatus(`完成：成功 ${result.renamed}，失败 ${result.failed}，跳过 ${result.skipped}`)
    loadDirectory(currentPath, false)
  }, [currentPath, loadDirectory, renameFind, renameRecursive, renameReplace])

  const runDelete = useCallback(
    async (dryRun: boolean) => {
      if (!currentPath) {
        setDeleteStatus('请先选择路径')
        return
      }
      if (!deleteKeyword.trim()) {
        setDeleteStatus('请输入要匹配的关键字')
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
        setDeleteStatus(`操作失败：${result.error}`)
        return
      }

      if (dryRun) {
        setDeletePreview(result)
        setDeleteStatus(`预览：匹配 ${result.matched} 个，预计删除 ${result.matched - result.failed} 个`)
      } else {
        setDeletePreview(null)
        setDeleteStatus(`删除完成：成功 ${result.deleted}，失败 ${result.failed}`)
        loadDirectory(currentPath, false)
      }
    },
    [currentPath, deleteKeyword, deleteRecursive, loadDirectory],
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
        <button
          className="settings-toggle"
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-label="过滤设置"
        >
          <Icon.Settings />
        </button>
        <button
          className="tool-toggle"
          type="button"
          onClick={() => setShowTools((v) => !v)}
          aria-label="工具面板"
        >
          <Icon.Tools />
        </button>
      </header>

      {showFilters && (
        <section className="filter-panel">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={hideHidden}
              onChange={(event) => setHideHidden(event.target.checked)}
            />
            <span>隐藏以 "." 开头的文件</span>
          </label>
          <div className="filter-input">
            <span>忽略后缀（逗号分隔）：</span>
            <input
              value={ignoreInput}
              onChange={(event) => setIgnoreInput(event.target.value)}
              placeholder=".exe,.app"
            />
          </div>
          <div className="columns-group">
            <span className="group-label">显示字段：</span>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showType}
                onChange={(event) => setShowType(event.target.checked)}
              />
              <span>类型</span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showModified}
                onChange={(event) => setShowModified(event.target.checked)}
              />
              <span>修改时间</span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showSize}
                onChange={(event) => setShowSize(event.target.checked)}
              />
              <span>大小</span>
            </label>
          </div>
        </section>
      )}

      {showTools && (
        <section className="tool-card">
          <div className="tool-header">批量重命名</div>
          <div className="tool-grid">
            <label className="tool-field">
              <span>旧关键字</span>
              <input
                value={renameFind}
                onChange={(event) => setRenameFind(event.target.value)}
                placeholder="例如：old"
              />
            </label>
            <label className="tool-field">
              <span>新关键字</span>
              <input
                value={renameReplace}
                onChange={(event) => setRenameReplace(event.target.value)}
                placeholder="例如：new"
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={renameRecursive}
                onChange={(event) => setRenameRecursive(event.target.checked)}
              />
              <span>递归子目录</span>
            </label>
            <button
              type="button"
              className="primary-btn"
              onClick={handleRename}
              disabled={renameLoading}
            >
              {renameLoading ? '处理中...' : '开始重命名'}
            </button>
          </div>
          {renameStatus && <div className="status">{renameStatus}</div>}
        </section>
      )}

      {showTools && (
        <section className="tool-card">
          <div className="tool-header">批量删除（名称含关键字）</div>
          <div className="tool-grid">
            <label className="tool-field">
              <span>关键字</span>
              <input
                value={deleteKeyword}
                onChange={(event) => setDeleteKeyword(event.target.value)}
                placeholder="例如：temp"
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={deleteRecursive}
                onChange={(event) => setDeleteRecursive(event.target.checked)}
              />
              <span>递归子目录</span>
            </label>
            <div className="tool-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => runDelete(true)}
                disabled={deleteLoading}
              >
                {deleteLoading ? '预览中...' : '预览匹配'}
              </button>
              <button
                type="button"
                className="danger-btn"
                onClick={() => runDelete(false)}
                disabled={deleteLoading}
              >
                {deleteLoading ? '处理中...' : '确认删除'}
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
                <div className="preview-more">前 10 条上方显示，剩余 {deletePreview.details.length - 10} 条按流式打印</div>
              )}
            </div>
          )}
        </section>
      )}

      {error && <div className="status status-error">{error}</div>}
      {!error && loading && <div className="status">加载中...</div>}

      <div className="list">
        <div className="list-header" style={{ gridTemplateColumns }}>
          <button
            type="button"
            className="header-btn"
            onClick={() => toggleSort('name')}
            aria-label="按名称排序"
          >
            名称
            {sortField === 'name' && <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
          </button>
          {showType && <span>类型</span>}
          {showModified && (
            <button
              type="button"
              className="header-btn"
              onClick={() => toggleSort('modified')}
              aria-label="按修改时间排序"
            >
              修改时间
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
              aria-label="按大小排序"
            >
              大小
              {sortField === 'size' && <span className="sort-arrow">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
            </button>
          )}
        </div>
        <div className="list-body">
          {visibleEntries.length === 0 && (
            <div className="empty">{entries.length === 0 ? '空目录' : '无匹配文件'}</div>
          )}
          {visibleEntries.map((entry) => (
            <button
              key={entry.path}
              className="list-row"
              style={{ gridTemplateColumns }}
              onDoubleClick={() => openEntry(entry)}
              title={entry.path}
            >
              <span className="name">
                <span className="glyph">{entry.isDirectory ? '📁' : '📄'}</span>
                {entry.name}
              </span>
              {showType && <span>{entry.isDirectory ? '文件夹' : '文件'}</span>}
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
