import { app } from 'electron'
import { promises as fsp } from 'node:fs'
import { join } from 'node:path'
import type { Settings } from '../shared/types'

const defaults: Settings = {
  pinned: [],
  favorites: [],
  recent: [],
  view: 'details',
  sortKey: 'name',
  sortDir: 'asc',
  showHidden: false,
  showPreview: false,
  showDetailsPane: true,
  theme: 'system',
  lastPath: null,
  iconSize: 96
}

let cache: Settings | null = null
let file: string | null = null

function settingsFile(): string {
  if (!file) file = join(app.getPath('userData'), 'settings.json')
  return file
}

export async function readSettings(): Promise<Settings> {
  if (cache) return cache
  try {
    const raw = await fsp.readFile(settingsFile(), 'utf8')
    cache = { ...defaults, ...JSON.parse(raw.replace(/^\uFEFF/, '')) }
  } catch {
    cache = { ...defaults }
  }
  return cache!
}

export async function writeSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await readSettings()
  cache = { ...current, ...patch }
  try {
    await fsp.mkdir(app.getPath('userData'), { recursive: true })
    await fsp.writeFile(settingsFile(), JSON.stringify(cache, null, 2), 'utf8')
  } catch {
    /* settings persistence is best effort */
  }
  return cache
}
