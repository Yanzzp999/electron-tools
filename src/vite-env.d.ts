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

declare global {
  interface Window {
    electronAPI: {
      listDirectory: (targetPath?: string) => Promise<DirectorySnapshot>
      renameBulk: (payload: RenameRequest) => Promise<RenameResult>
      deleteBulk: (payload: DeleteRequest) => Promise<DeleteResult>
    }
    ipcRenderer: Pick<
      typeof import('electron').ipcRenderer,
      'on' | 'off' | 'send' | 'invoke'
    >
  }
}