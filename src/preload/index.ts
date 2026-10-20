import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { CH, type Entry, type FileInfo, type SearchHit, type Settings } from '../shared/types'

const api = {
  list: (dir: string, showHidden: boolean) => ipcRenderer.invoke(CH.list, dir, showHidden),
  search: (dir: string, query: string, showHidden: boolean) =>
    ipcRenderer.invoke(CH.search, dir, query, showHidden),
  mkdir: (parent: string, name: string) => ipcRenderer.invoke(CH.mkdir, parent, name),
  rename: (path: string, name: string) => ipcRenderer.invoke(CH.rename, path, name),
  remove: (paths: string[], permanent: boolean) => ipcRenderer.invoke(CH.remove, paths, permanent),
  transfer: (sources: string[], dest: string, mode: 'copy' | 'move') =>
    ipcRenderer.invoke(CH.transfer, sources, dest, mode),
  info: (path: string) => ipcRenderer.invoke(CH.info, path),
  readText: (path: string) => ipcRenderer.invoke(CH.readText, path),
  readImage: (path: string) => ipcRenderer.invoke(CH.readImage, path),
  thumbnail: (path: string, width: number) => ipcRenderer.invoke(CH.thumbnail, path, width),
  icon: (path: string, size: 'small' | 'large') => ipcRenderer.invoke(CH.icon, path, size),
  exists: (path: string) => ipcRenderer.invoke(CH.exists, path),
  specialFolders: () => ipcRenderer.invoke(CH.home),
  drives: () => ipcRenderer.invoke(CH.drives),
  recent: () => ipcRenderer.invoke(CH.recent),
  statPaths: (paths: string[]) => ipcRenderer.invoke(CH.statPaths, paths),
  driveUsage: (path: string) => ipcRenderer.invoke(CH.driveUsage, path),
  platform: () => ipcRenderer.invoke(CH.platform),
  settings: () => ipcRenderer.invoke(CH.settingsGet),
  saveSettings: (patch: Partial<Settings>) => ipcRenderer.invoke(CH.settingsSet, patch),
  open: (path: string) => ipcRenderer.invoke(CH.open, path),
  openWith: (path: string) => ipcRenderer.invoke(CH.openWith, path),
  reveal: (path: string) => ipcRenderer.invoke(CH.reveal, path),
  copyFiles: (paths: string[]) => ipcRenderer.invoke(CH.copyFiles, paths),
  readClipboardFiles: () => ipcRenderer.invoke(CH.readClipboardFiles),
  newWindow: (path?: string) => ipcRenderer.invoke(CH.newWindow, path),
  refreshTitleBar: () => ipcRenderer.invoke(CH.setTitleBar),
  dragOut: (path: string) => ipcRenderer.send(CH.dragOut, path),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  onTheme: (handler: () => void) => {
    const listener = (): void => handler()
    ipcRenderer.on('theme:updated', listener)
    return () => ipcRenderer.removeListener('theme:updated', listener)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
