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

declare global {
  interface Window {
    electronAPI: {
      listDirectory: (targetPath?: string) => Promise<DirectorySnapshot>
    }
    ipcRenderer: Pick<
      typeof import('electron').ipcRenderer,
      'on' | 'off' | 'send' | 'invoke'
    >
  }
}