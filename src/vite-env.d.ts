/// <reference types="vite/client" />

export type DirectoryEntry = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: number
}

export type DirectorySnapshot = {
  path: string
  entries: DirectoryEntry[]
  exists: boolean
  error?: string
}

export type RenameRequest = {
  rootPath?: string
  findText: string
  replaceText: string
  recursive?: boolean
  dryRun?: boolean
}

export type RenameResult = {
  root: string
  renamed: number
  skipped: number
  failed: number
  details: Array<{
    from: string
    to?: string
    error?: string
  }>
  error?: string
}

export type DeleteRequest = {
  rootPath?: string
  keyword: string
  recursive?: boolean
  dryRun?: boolean
}

export type DeleteResult = {
  root: string
  matched: number
  deleted: number
  failed: number
  details: Array<{
    path: string
    isDirectory: boolean
    deleted?: boolean
    error?: string
  }>
  error?: string
}

export type SearchRequest = {
  keyword: string
  directory?: string
  limit?: number
  includeHidden?: boolean
  ignoreSuffixes?: string[]
}

export type SearchResult = {
  platform: NodeJS.Platform
  engine: 'spotlight' | 'everything' | 'node' | 'unsupported'
  entries: DirectoryEntry[]
  error?: string
}

export type AppConfigInput = {
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

export type ResolvedAppConfig = {
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

export type ConfigSnapshot = {
  path: string
  exists: boolean
  config: ResolvedAppConfig
  error?: string
}

declare global {
  interface Window {
    electronAPI: {
      listDirectory: (targetPath?: string) => Promise<DirectorySnapshot>
      getConfig: () => Promise<ConfigSnapshot>
      saveConfig: (config: AppConfigInput) => Promise<ConfigSnapshot>
      renameBulk: (payload: RenameRequest) => Promise<RenameResult>
      deleteBulk: (payload: DeleteRequest) => Promise<DeleteResult>
      searchFiles: (payload: SearchRequest) => Promise<SearchResult>
    }
    ipcRenderer: Pick<
      typeof import('electron').ipcRenderer,
      'on' | 'off' | 'send' | 'invoke'
    >
  }
}