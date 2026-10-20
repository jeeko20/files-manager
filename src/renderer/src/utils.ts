import type { Drive, Entry, SortDir, SortKey } from '@shared/types'
import { t } from './i18n'

export function formatSize(bytes: number, dir?: boolean): string {
  if (dir) return ''
  if (bytes < 1024) return `${bytes} octet${bytes > 1 ? 's' : ''}`
  const units = ['Ko', 'Mo', 'Go', 'To', 'Po']
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[index]}`
}

export function formatDate(ms: number): string {
  if (!ms) return ''
  const date = new Date(ms)
  const now = new Date()
  const sameYear = date.getFullYear() === now.getFullYear()
  const datePart = date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: sameYear ? undefined : 'numeric'
  })
  const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

export function formatFullDate(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function sortEntries(entries: Entry[], key: SortKey, dir: SortDir): Entry[] {
  const factor = dir === 'asc' ? 1 : -1
  const sorted = [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    switch (key) {
      case 'mtime':
        return (a.mtime - b.mtime) * factor
      case 'size':
        return (a.size - b.size) * factor
      case 'type':
        return collator.compare(a.ext || '', b.ext || '') * factor || collator.compare(a.name, b.name)
      default:
        return collator.compare(a.name, b.name) * factor
    }
  })
  return sorted
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || path
}

export function dirname(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (index <= 0) return path
  return path.slice(0, index) || '/'
}

export function joinPath(parent: string, name: string): string {
  const sep = parent.includes('\\') ? '\\' : '/'
  return parent.endsWith(sep) ? parent + name : parent + sep + name
}

export function isSubPath(parent: string, child: string): boolean {
  const normalizedParent = parent.replace(/[\\/]+$/, '').toLowerCase()
  const normalizedChild = child.replace(/[\\/]+$/, '').toLowerCase()
  return normalizedChild.startsWith(normalizedParent + (parent.includes('\\') ? '\\' : '/'))
}

export function driveDisplayName(drive: Drive | { name: string; label: string | null; kind: Drive['kind'] }): string {
  if (/^[A-Za-z]:$/.test(drive.name)) {
    const letter = drive.name.slice(0, 1)
    if (drive.label) return `${drive.label} (${letter}:)`
    return `${drive.kind === 'optical' ? t.opticalDrive : t.drive} (${letter}:)`
  }
  if (drive.name === '/') return drive.label || drive.name
  return drive.name || drive.label || ''
}
