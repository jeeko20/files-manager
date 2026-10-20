import { app, nativeImage, shell } from 'electron'
import { execFileSync } from 'node:child_process'
import { promises as fsp, existsSync, statfsSync } from 'node:fs'
import { basename, dirname, extname, join, parse, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSettings } from './store'
import type { DirListing, Drive, DriveUsage, Entry, FileInfo, SpecialFolders } from '../shared/types'

const HIDDEN_NAMES = new Set([
  '$recycle.bin',
  'system volume information',
  'desktop.ini',
  'thumbs.db',
  'ehthumbs.db',
  'ehthumbs_vista.db',
  '.ds_store',
  'application data',
  'appdata',
  'cookies',
  'local settings',
  'my documents',
  'my music',
  'my pictures',
  'my videos',
  'nethood',
  'printhood',
  'recent',
  'sendto',
  'start menu',
  'templates',
  'menu démarrer',
  'mes documents',
  'modèles',
  'documents récents',
  "voisinage d'impression",
  'voisinage réseau',
  'intelgraphicsprofiles',
  'ntuser.ini',
  '.git'
])

function hiddenName(name: string): boolean {
  const lower = name.toLowerCase()
  const dotHidden = process.platform !== 'win32' && name.startsWith('.')
  return dotHidden || lower.startsWith('ntuser.dat') || HIDDEN_NAMES.has(lower)
}

function toEntry(dir: string, name: string, st: import('node:fs').Stats, isSymlink: boolean): Entry {
  return {
    name,
    path: join(dir, name),
    isDir: st.isDirectory(),
    isSymlink,
    size: st.size,
    mtime: st.mtimeMs,
    btime: st.birthtimeMs,
    ext: st.isDirectory() ? '' : extname(name).toLowerCase(),
    hidden: hiddenName(name)
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (cursor < items.length) {
      const index = cursor++
      out[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return out
}

export async function listDir(dir: string, showHidden: boolean): Promise<DirListing> {
  const absolute = resolve(dir)
  try {
    const dirents = await fsp.readdir(absolute, { withFileTypes: true })
    const entries = await mapLimit(dirents, 64, async (dirent) => {
      const full = join(absolute, dirent.name)
      try {
        const link = await fsp.lstat(full)
        let st = link
        if (link.isSymbolicLink()) {
          try {
            st = await fsp.stat(full)
          } catch {
            st = link
          }
        }
        return toEntry(absolute, dirent.name, st, link.isSymbolicLink())
      } catch {
        return null
      }
    })
    const visible = entries.filter((e): e is Entry => !!e && (showHidden || !e.hidden))
    const root = parse(absolute).root
    const parent = absolute === root ? null : dirname(absolute)
    return { dir: absolute, entries: visible, parent, error: null }
  } catch (error) {
    return {
      dir: absolute,
      entries: [],
      parent: dirname(absolute) === absolute ? null : dirname(absolute),
      error: (error as NodeJS.ErrnoException).code || String(error)
    }
  }
}

const SEARCH_SKIP = new Set(['node_modules', '.git', '.cache', '$Recycle.Bin', 'System Volume Information'])

export async function searchTree(
  dir: string,
  query: string,
  showHidden: boolean,
  limit = 1500
): Promise<Entry[]> {
  const needle = query.toLowerCase()
  const results: Entry[] = []
  const started = Date.now()
  let visited = 0
  const queue: string[] = [resolve(dir)]
  while (queue.length && results.length < limit) {
    if (Date.now() - started > 12_000) break
    const current = queue.shift()!
    let dirents
    try {
      dirents = await fsp.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const dirent of dirents) {
      if (++visited > 120_000) return results
      const hidden = hiddenName(dirent.name)
      if (hidden && !showHidden) continue
      const full = join(current, dirent.name)
      if (dirent.name.toLowerCase().includes(needle)) {
        try {
          const st = await fsp.lstat(full)
          results.push(toEntry(current, dirent.name, st, dirent.isSymbolicLink()))
        } catch {
          /* unreadable entry */
        }
        if (results.length >= limit) break
      }
      if (dirent.isDirectory() && !dirent.isSymbolicLink() && !SEARCH_SKIP.has(dirent.name)) {
        queue.push(full)
      }
    }
  }
  return results
}

export async function makeFolder(parent: string, name: string): Promise<string> {
  const target = join(parent, name)
  await fsp.mkdir(target)
  return target
}

export async function renameEntry(path: string, name: string): Promise<string> {
  if (!name.trim() || /[\\/:*?"<>|]/.test(name)) throw new Error('invalid_name')
  const target = join(dirname(path), name.trim())
  if (target === path) return path
  if (existsSync(target)) throw new Error('exists')
  await fsp.rename(path, target)
  return target
}

export async function removeEntries(paths: string[], permanent: boolean): Promise<{ failed: string[] }> {
  const failed: string[] = []
  for (const p of paths) {
    try {
      if (permanent) await fsp.rm(p, { recursive: true, force: true, maxRetries: 2 })
      else await (await import('electron')).shell.trashItem(p)
    } catch {
      failed.push(p)
    }
  }
  return { failed }
}

export function uniqueName(dir: string, name: string): string {
  let target = join(dir, name)
  if (!existsSync(target)) return target
  const { name: stem, ext } = parse(name)
  for (let i = 2; i < 10_000; i++) {
    target = join(dir, `${stem} (${i})${ext}`)
    if (!existsSync(target)) return target
  }
  return join(dir, `${stem} (${Date.now()})${ext}`)
}

export async function transfer(
  sources: string[],
  destDir: string,
  mode: 'copy' | 'move'
): Promise<{ copied: number; failed: string[] }> {
  let copied = 0
  const failed: string[] = []
  for (const source of sources) {
    const target = uniqueName(destDir, basename(source))
    try {
      if (mode === 'move') {
        try {
          await fsp.rename(source, target)
        } catch {
          await fsp.cp(source, target, { recursive: true, errorOnExist: false, force: false })
          await fsp.rm(source, { recursive: true, force: true })
        }
      } else {
        await fsp.cp(source, target, { recursive: true, errorOnExist: false, force: false })
      }
      copied++
    } catch {
      failed.push(source)
    }
  }
  return { copied, failed }
}

export async function fileInfo(path: string): Promise<FileInfo> {
  const st = await fsp.lstat(path)
  let target: string | null = null
  if (st.isSymbolicLink()) {
    try {
      target = await fsp.readlink(path)
    } catch {
      target = null
    }
  }
  const isDir = st.isDirectory()
  const blocks = (st as unknown as { blocks?: number }).blocks
  const sizeOnDisk = blocks && blocks > 0 ? blocks * 512 : Math.ceil(st.size / 4096) * 4096
  return {
    path,
    name: basename(path),
    isDir,
    size: st.size,
    mtime: st.mtimeMs,
    btime: st.birthtimeMs,
    atime: st.atimeMs,
    mode: st.mode,
    readable: !!(st.mode & 0o400 || process.platform === 'win32'),
    writable: !!(st.mode & 0o200 || process.platform === 'win32'),
    target,
    dir: dirname(path),
    ext: isDir ? '' : extname(path).toLowerCase(),
    hidden: hiddenName(basename(path)),
    sizeOnDisk,
    contents: isDir ? await folderSummary(path) : null
  }
}

async function folderSummary(
  root: string,
  maxEntries = 20000,
  maxMs = 1500
): Promise<{ files: number; folders: number; size: number; truncated: boolean }> {
  let files = 0
  let folders = 0
  let size = 0
  let seen = 0
  let truncated = false
  const startedAt = Date.now()
  const stack: string[] = [root]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let items
    try {
      items = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const item of items) {
      if (++seen > maxEntries || Date.now() - startedAt > maxMs) {
        truncated = true
        break
      }
      if (item.isDirectory()) {
        folders++
        stack.push(join(dir, item.name))
      } else if (item.isFile()) {
        files++
        try {
          size += (await fsp.stat(join(dir, item.name))).size
        } catch {
          /* unreadable entry */
        }
      }
    }
    if (truncated) break
  }
  return { files, folders, size, truncated }
}

export function specialFolders(): SpecialFolders {
  const safe = (key: Parameters<typeof app.getPath>[0], fallback: string): string => {
    try {
      return app.getPath(key)
    } catch {
      return fallback
    }
  }
  const home = app.getPath('home')
  return {
    home,
    desktop: safe('desktop', join(home, 'Desktop')),
    documents: safe('documents', join(home, 'Documents')),
    downloads: safe('downloads', join(home, 'Downloads')),
    pictures: safe('pictures', join(home, 'Pictures')),
    music: safe('music', join(home, 'Music')),
    videos: safe('videos', join(home, 'Videos'))
  }
}

function capacity(path: string): { total: number | null; free: number | null } {
  try {
    const stats = statfsSync(path)
    return { total: stats.bsize * stats.blocks, free: stats.bsize * stats.bavail }
  } catch {
    return { total: null, free: null }
  }
}

interface WinDisk {
  Name?: string
  VolumeLabel?: string | null
  DriveFormat?: string | null
  DriveType?: number | string
}

let winDiskCache: WinDisk[] | null = null

const WIN_DRIVE_TYPES: Record<string, number> = {
  NoRootDirectory: 1,
  Removable: 2,
  Fixed: 3,
  Network: 4,
  CdRom: 5,
  Ram: 6
}

function windowsDisks(): WinDisk[] {
  try {
    const script =
      "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; " +
      '[System.IO.DriveInfo]::GetDrives() | Select-Object Name,VolumeLabel,DriveFormat,DriveType | ConvertTo-Json -Compress'
    const out = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true
    })
    const parsed = JSON.parse(out.trim() || '[]')
    const list = Array.isArray(parsed) ? parsed : [parsed]
    return list.filter((disk): disk is WinDisk => !!disk && typeof disk === 'object')
  } catch {
    return []
  }
}

function windowsDisksCached(): WinDisk[] {
  if (!winDiskCache) winDiskCache = windowsDisks()
  return winDiskCache
}

function diskType(disk: WinDisk): number {
  if (typeof disk.DriveType === 'number') return disk.DriveType
  return WIN_DRIVE_TYPES[String(disk.DriveType)] ?? 0
}

function winDiskFor(path: string): WinDisk | null {
  const letter = path.slice(0, 2).toUpperCase()
  return windowsDisksCached().find((disk) => (disk.Name ?? '').slice(0, 2).toUpperCase() === letter) ?? null
}

export async function listDrives(): Promise<Drive[]> {
  if (process.platform === 'win32') {
    const drives: Drive[] = []
    for (const disk of windowsDisksCached()) {
      const type = diskType(disk)
      if (type !== 2 && type !== 3 && type !== 5) continue
      const name = (disk.Name ?? '').trim()
      if (!name) continue
      const root = name.endsWith('\\') ? name : `${name}\\`
      drives.push({
        path: root,
        name: root.slice(0, 2),
        label: disk.VolumeLabel?.trim() || null,
        filesystem: disk.DriveFormat?.trim() || null,
        ...(type === 5 ? { total: null, free: null } : capacity(root)),
        kind: type === 5 ? 'optical' : 'drive'
      })
    }
    if (drives.length > 0) return drives
    for (let code = 65; code <= 90; code++) {
      const letter = String.fromCharCode(code)
      const root = `${letter}:\\`
      if (!existsSync(root)) continue
      drives.push({ path: root, name: `${letter}:`, label: null, ...capacity(root), kind: 'drive' })
    }
    return drives
  }
  if (process.platform === 'darwin') {
    const drives: Drive[] = [
      { path: '/', name: 'Macintosh HD', label: null, ...capacity('/'), kind: 'root' }
    ]
    try {
      const volumes = await fsp.readdir('/Volumes')
      for (const v of volumes) {
        const volumePath = join('/Volumes', v)
        drives.push({
          path: volumePath,
          name: v,
          label: v,
          ...capacity(volumePath),
          kind: 'volume'
        })
      }
    } catch {
      /* no volumes */
    }
    return drives
  }
  const drives: Drive[] = [
    { path: '/', name: '/', label: 'Système', ...capacity('/'), kind: 'root' }
  ]
  try {
    const mounts = await fsp.readFile('/proc/mounts', 'utf8')
    const seen = new Set(['/'])
    for (const line of mounts.split('\n')) {
      const [device, mountPoint, fstype] = line.split(' ')
      if (!mountPoint || !fstype) continue
      if (!['ext4', 'ext3', 'btrfs', 'xfs', 'zfs', 'vfat', 'exfat', 'ntfs', 'ntfs3', 'fuse', 'cifs', 'nfs', 'nfs4'].some((t) => fstype.startsWith(t))) continue
      const decoded = mountPoint.replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      if (decoded.startsWith('/snap') || decoded.startsWith('/sys') || decoded.startsWith('/proc')) continue
      if (seen.has(decoded)) continue
      seen.add(decoded)
      drives.push({
        path: decoded,
        name: basename(decoded) || decoded,
        label: device,
        ...capacity(decoded),
        kind: 'volume'
      })
    }
  } catch {
    /* no procfs */
  }
  return drives
}

const FS_MAGICS: Record<number, string> = {
  0xef53: 'ext4',
  0x58465342: 'XFS',
  0x9123683e: 'Btrfs',
  0x01021994: 'tmpfs',
  0x794c7630: 'overlay',
  0x65735546: 'FUSE',
  0x6969: 'NFS',
  0x4d44: 'FAT',
  0xff534d42: 'CIFS',
  0x2fc12fc1: 'ZFS'
}

function volumeInfo(path: string): { label: string | null; filesystem: string | null } {
  try {
    if (process.platform === 'win32') {
      const disk = winDiskFor(path)
      return {
        label: disk?.VolumeLabel?.trim() || null,
        filesystem: disk?.DriveFormat?.trim() || null
      }
    }
    if (process.platform === 'darwin') {
      const out = execFileSync('diskutil', ['info', path], { encoding: 'utf8', timeout: 2500 })
      const labelMatch = out.match(/Volume Name:\s*([^\r\n]*)/i)
      const fsMatch = out.match(/Type \(Bundle\):\s*([^\r\n]*)/i)
      return {
        label: labelMatch?.[1]?.trim() || null,
        filesystem: fsMatch?.[1]?.trim().toUpperCase() || null
      }
    }
    return { label: null, filesystem: FS_MAGICS[statfsSync(path).type] ?? null }
  } catch {
    return { label: null, filesystem: null }
  }
}

async function entryFromPath(path: string): Promise<Entry | null> {
  try {
    const st = await fsp.stat(path)
    if (!st.isFile() && !st.isDirectory()) return null
    const isDir = st.isDirectory()
    return {
      name: basename(path),
      path,
      isDir,
      isSymlink: false,
      size: isDir ? 0 : st.size,
      mtime: st.mtimeMs,
      btime: st.birthtimeMs,
      ext: isDir ? '' : extname(path).toLowerCase(),
      hidden: false
    }
  } catch {
    return null
  }
}

async function windowsRecent(limit: number): Promise<Entry[]> {
  let recentDir: string
  try {
    recentDir = app.getPath('recent')
  } catch {
    return []
  }
  let names: string[]
  try {
    names = await fsp.readdir(recentDir)
  } catch {
    return []
  }
  const shortcuts: { path: string; time: number }[] = []
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.lnk')) continue
    const full = join(recentDir, name)
    try {
      const st = await fsp.stat(full)
      shortcuts.push({ path: full, time: st.mtimeMs })
    } catch {
      /* ignore unreadable shortcut */
    }
  }
  shortcuts.sort((a, b) => b.time - a.time)
  const out: Entry[] = []
  for (const shortcut of shortcuts.slice(0, 80)) {
    if (out.length >= limit) break
    try {
      const link = shell.readShortcutLink(shortcut.path)
      if (!link.target) continue
      const entry = await entryFromPath(link.target)
      if (entry) out.push(entry)
    } catch {
      /* ignore broken shortcut */
    }
  }
  return out
}

async function linuxRecent(limit: number): Promise<Entry[]> {
  const dataHome = process.env['XDG_DATA_HOME'] || join(app.getPath('home'), '.local', 'share')
  let xml: string
  try {
    xml = await fsp.readFile(join(dataHome, 'recently-used.xbel'), 'utf8')
  } catch {
    return []
  }
  const items: { path: string; time: number }[] = []
  for (const tag of xml.match(/<bookmark\b[^>]*>/g) ?? []) {
    const href = tag.match(/href="([^"]*)"/)?.[1]
    if (!href || !href.startsWith('file://')) continue
    const modified = tag.match(/modified="([^"]*)"/)?.[1] ?? ''
    try {
      items.push({ path: fileURLToPath(href), time: modified ? Date.parse(modified) : 0 })
    } catch {
      /* ignore malformed uri */
    }
  }
  items.sort((a, b) => b.time - a.time)
  const out: Entry[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (out.length >= limit) break
    if (seen.has(item.path)) continue
    seen.add(item.path)
    const entry = await entryFromPath(item.path)
    if (entry) out.push(entry)
  }
  return out
}

export async function recentEntries(limit = 12): Promise<Entry[]> {
  const tracked: string[] = []
  try {
    tracked.push(...((await readSettings()).recent ?? []))
  } catch {
    /* settings unavailable */
  }
  const system =
    process.platform === 'win32'
      ? await windowsRecent(limit)
      : process.platform === 'linux'
        ? await linuxRecent(limit)
        : []
  const out: Entry[] = []
  const seen = new Set<string>()
  const add = (entry: Entry | null): void => {
    if (!entry) return
    const key = process.platform === 'win32' ? entry.path.toLowerCase() : entry.path
    if (seen.has(key)) return
    seen.add(key)
    out.push(entry)
  }
  for (const path of tracked) {
    if (out.length >= limit) break
    add(await entryFromPath(path))
  }
  for (const entry of system) {
    if (out.length >= limit) break
    add(entry)
  }
  return out.slice(0, limit)
}

export async function statPaths(paths: string[]): Promise<Entry[]> {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const path of paths.slice(0, 200)) {
    const key = process.platform === 'win32' ? path.toLowerCase() : path
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(path)
  }
  const out = await Promise.all(unique.map((path) => entryFromPath(path)))
  return out.filter((entry): entry is Entry => entry !== null)
}

export async function driveUsage(path: string): Promise<DriveUsage> {
  const cap = capacity(path)
  const info = volumeInfo(path)
  const disk = process.platform === 'win32' ? winDiskFor(path) : null
  const kind: Drive['kind'] =
    process.platform === 'win32'
      ? disk && diskType(disk) === 5
        ? 'optical'
        : 'drive'
      : path === '/'
        ? 'root'
        : 'volume'
  return {
    path,
    name: process.platform === 'win32' ? path.slice(0, 2) : basename(path) || path,
    label: info.label,
    filesystem: info.filesystem,
    total: cap.total,
    free: cap.free,
    used: cap.total != null && cap.free != null ? cap.total - cap.free : null,
    kind
  }
}

const iconCache = new Map<string, string | null>()

export async function fileIcon(path: string, size: 'small' | 'large'): Promise<string | null> {
  let isDir = false
  let ext = extname(path).toLowerCase()
  try {
    const st = await fsp.stat(path)
    isDir = st.isDirectory()
    if (isDir) ext = ''
  } catch {
    /* fall back to the extension heuristic */
  }
  const key = `${isDir ? 'dir' : ['.exe', '.lnk', '.app', '.ico', '.url', '.desktop'].includes(ext) ? path : ext}|${size}`
  const hit = iconCache.get(key)
  if (hit !== undefined) return hit
  let value: string | null = null
  try {
    const image = await app.getFileIcon(path, { size })
    if (!image.isEmpty()) value = image.toDataURL()
  } catch {
    value = null
  }
  iconCache.set(key, value)
  return value
}

const thumbCache = new Map<string, string | null>()

export async function fileThumbnail(path: string, width = 160): Promise<string | null> {
  const key = `${path}|${width}`
  const hit = thumbCache.get(key)
  if (hit !== undefined) return hit
  let value: string | null = null
  try {
    const image = await nativeImage.createThumbnailFromPath(path, { width, height: width })
    if (!image.isEmpty()) value = image.toDataURL()
  } catch {
    value = null
  }
  if (thumbCache.size > 400) thumbCache.clear()
  thumbCache.set(key, value)
  return value
}

export async function readTextFile(path: string, maxBytes = 128 * 1024): Promise<string | null> {
  const st = await fsp.stat(path)
  if (st.size > 8 * 1024 * 1024) return null
  const handle = await fsp.open(path, 'r')
  try {
    const buffer = Buffer.alloc(Math.min(st.size, maxBytes))
    await handle.read(buffer, 0, buffer.length, 0)
    return buffer.toString('utf8').replace(/\u0000/g, '')
  } finally {
    await handle.close()
  }
}

export async function readImageFile(path: string): Promise<string | null> {
  const st = await fsp.stat(path)
  if (st.size > 24 * 1024 * 1024) return null
  const data = await fsp.readFile(path)
  return `data:image/${extname(path).slice(1).toLowerCase()};base64,${data.toString('base64')}`
}

export const pathSeparator = sep
