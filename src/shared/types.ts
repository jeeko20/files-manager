export type ViewMode = 'details' | 'list' | 'tiles' | 'icons'
export type SortKey = 'name' | 'mtime' | 'type' | 'size'
export type SortDir = 'asc' | 'desc'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface Entry {
  name: string
  path: string
  isDir: boolean
  isSymlink: boolean
  size: number
  mtime: number
  btime: number
  ext: string
  hidden: boolean
}

export interface DirListing {
  dir: string
  entries: Entry[]
  parent: string | null
  error: string | null
  noMedia?: boolean
}

export interface Drive {
  path: string
  name: string
  label: string | null
  filesystem?: string | null
  total: number | null
  free: number | null
  kind: 'drive' | 'volume' | 'root' | 'network' | 'cloud' | 'optical'
}

export interface DriveUsage {
  path: string
  name: string
  label: string | null
  filesystem: string | null
  total: number | null
  free: number | null
  used: number | null
  kind: Drive['kind']
}

export interface SpecialFolders {
  home: string
  desktop: string
  documents: string
  downloads: string
  pictures: string
  music: string
  videos: string
}

export interface Settings {
  pinned: string[]
  favorites: string[]
  recent: string[]
  view: ViewMode
  sortKey: SortKey
  sortDir: SortDir
  showHidden: boolean
  showPreview: boolean
  showDetailsPane: boolean
  theme: ThemeMode
  lastPath: string | null
  iconSize: number
}

export interface SearchHit {
  entry: Entry
  rel: string
}

export interface FileInfo {
  path: string
  name: string
  isDir: boolean
  size: number
  mtime: number
  btime: number
  atime: number
  mode: number
  readable: boolean
  writable: boolean
  target: string | null
  dir: string
  ext: string
  hidden: boolean
  sizeOnDisk: number
  contents: {
    files: number
    folders: number
    size: number
    truncated: boolean
  } | null
}

export interface PlatformInfo {
  platform: 'win32' | 'darwin' | 'linux'
  accent: string
  dark: boolean
  mica: boolean
  separator: string
  version: string
}

export const CH = {
  list: 'fs:list',
  search: 'fs:search',
  mkdir: 'fs:mkdir',
  rename: 'fs:rename',
  remove: 'fs:remove',
  transfer: 'fs:transfer',
  info: 'fs:info',
  readText: 'fs:read-text',
  readImage: 'fs:read-image',
  thumbnail: 'fs:thumbnail',
  exists: 'fs:exists',
  home: 'app:special-folders',
  drives: 'app:drives',
  recent: 'app:recent',
  statPaths: 'fs:stat-paths',
  driveUsage: 'app:drive-usage',
  icon: 'app:icon',
  platform: 'app:platform',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  open: 'shell:open',
  openWith: 'shell:open-with',
  reveal: 'shell:reveal',
  copyFiles: 'clipboard:write-files',
  readClipboardFiles: 'clipboard:read-files',
  newWindow: 'win:new-window',
  setTitleBar: 'win:titlebar-theme',
  dragOut: 'shell:drag-out',
  revealPath: 'shell:show-item'
} as const

export const isImageExt = (ext: string): boolean =>
  ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg', '.avif', '.tif', '.tiff'].includes(
    ext.toLowerCase()
  )

export const isTextExt = (ext: string): boolean =>
  [
    '.txt', '.md', '.markdown', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.scss',
    '.html', '.htm', '.xml', '.yml', '.yaml', '.ini', '.cfg', '.conf', '.log', '.csv', '.ps1', '.bat',
    '.cmd', '.sh', '.py', '.rb', '.go', '.rs', '.c', '.h', '.cpp', '.hpp', '.java', '.kt', '.cs', '.sql',
    '.toml', '.env', '.gitignore', '.svg'
  ].includes(ext.toLowerCase())
