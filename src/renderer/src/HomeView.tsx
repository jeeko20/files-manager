import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import type { Entry, SpecialFolders } from '@shared/types'
import { SysIcon } from './FileView'
import { G } from './icons'
import { t } from './i18n'
import { basename, dirname, formatDate } from './utils'

const pathKey = (path: string): string => path.replace(/[\\/]+$/, '').toLowerCase()

const displayDir = (path: string): string =>
  dirname(path).replace(/^([a-z]):/, (_match, drive: string) => `${drive.toUpperCase()}:`)

const folderEntry = (path: string): Entry => ({
  name: basename(path),
  path,
  isDir: true,
  isSymlink: false,
  size: 0,
  mtime: 0,
  btime: 0,
  ext: '',
  hidden: false
})

function HomeSection({
  title,
  children
}: {
  title: string
  children: ReactNode
}): ReactElement {
  return (
    <section className="home-section">
      <h2 className="home-title">{title}</h2>
      {children}
    </section>
  )
}

function FolderTile({
  entry,
  label,
  selected,
  onSelect,
  onOpen,
  onRemove
}: {
  entry: Entry
  label: string
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onRemove?: () => void
}): ReactElement {
  return (
    <div className={`home-tile${selected ? ' selected' : ''}`}>
      <button
        type="button"
        className="home-tile-open"
        onClick={onSelect}
        onDoubleClick={onOpen}
        onKeyDown={(event) => event.key === 'Enter' && onOpen()}
        title={entry.path}
      >
        <span className="home-tile-icon">
          <SysIcon entry={entry} size="large" width={32} />
        </span>
        <span className="home-tile-name">{label}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          className="home-tile-remove"
          title={t.removeFavorite}
          aria-label={t.removeFavorite}
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
        >
          <G.close />
        </button>
      )}
    </div>
  )
}

export function HomeView({
  folders,
  pinned,
  favorites,
  onOpen,
  onRemoveFavorite
}: {
  folders: SpecialFolders | null
  pinned: string[]
  favorites: string[]
  onOpen: (entry: Entry) => void
  onRemoveFavorite: (path: string) => void
}): ReactElement {
  const [resolved, setResolved] = useState<Entry[]>([])
  const [recent, setRecent] = useState<Entry[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const unique = new Map<string, string>()
    for (const path of [...pinned, ...favorites]) {
      if (!unique.has(pathKey(path))) unique.set(pathKey(path), path)
    }
    const paths = Array.from(unique.values())
    if (paths.length === 0) {
      setResolved([])
      return
    }
    ;(window.api.statPaths(paths) as Promise<Entry[]>)
      .then((entries) => {
        if (alive) setResolved(entries)
      })
      .catch(() => {
        if (alive) setResolved([])
      })
    return () => {
      alive = false
    }
  }, [pinned, favorites])

  useEffect(() => {
    let alive = true
    ;(window.api.recent() as Promise<Entry[]>)
      .then((entries) => {
        if (alive) setRecent(entries)
      })
      .catch(() => {
        if (alive) setRecent([])
      })
    return () => {
      alive = false
    }
  }, [])

  const resolvedMap = useMemo(
    () => new Map(resolved.map((entry) => [pathKey(entry.path), entry])),
    [resolved]
  )

  const specialLabels = useMemo(() => {
    const map = new Map<string, string>()
    if (folders) {
      map.set(pathKey(folders.desktop), t.desktopNav)
      map.set(pathKey(folders.documents), t.documentsNav)
      map.set(pathKey(folders.downloads), t.downloadsNav)
      map.set(pathKey(folders.pictures), t.picturesNav)
      map.set(pathKey(folders.music), t.musicNav)
      map.set(pathKey(folders.videos), t.videosNav)
    }
    return map
  }, [folders])

  const quick = useMemo(() => {
    const seen = new Set<string>()
    const out: { entry: Entry; label: string }[] = []
    const add = (entry: Entry, label: string): void => {
      const key = pathKey(entry.path)
      if (seen.has(key)) return
      seen.add(key)
      out.push({ entry, label })
    }
    for (const path of pinned) {
      const entry = resolvedMap.get(pathKey(path))
      if (entry) add(entry, specialLabels.get(pathKey(path)) ?? entry.name)
    }
    if (folders) {
      const specials = [
        { label: t.desktopNav, path: folders.desktop },
        { label: t.documentsNav, path: folders.documents },
        { label: t.downloadsNav, path: folders.downloads },
        { label: t.picturesNav, path: folders.pictures },
        { label: t.musicNav, path: folders.music },
        { label: t.videosNav, path: folders.videos }
      ]
      for (const folder of specials) add(folderEntry(folder.path), folder.label)
    }
    return out
  }, [pinned, resolvedMap, folders, specialLabels])

  const favoriteEntries = useMemo(
    () =>
      favorites
        .map((path) => resolvedMap.get(pathKey(path)))
        .filter((entry): entry is Entry => !!entry),
    [favorites, resolvedMap]
  )

  return (
    <div className="home">
      <HomeSection title={t.quickAccess}>
        <div className="home-grid">
          {quick.map(({ entry, label }) => (
            <FolderTile
              key={entry.path}
              entry={entry}
              label={label}
              selected={selected === entry.path}
              onSelect={() => setSelected(entry.path)}
              onOpen={() => onOpen(entry)}
            />
          ))}
        </div>
      </HomeSection>

      <HomeSection title={t.favorites}>
        {favoriteEntries.length > 0 ? (
          <div className="home-grid">
            {favoriteEntries.map((entry) => (
              <FolderTile
                key={entry.path}
                entry={entry}
                label={entry.name}
                selected={selected === entry.path}
                onSelect={() => setSelected(entry.path)}
                onOpen={() => onOpen(entry)}
                onRemove={() => onRemoveFavorite(entry.path)}
              />
            ))}
          </div>
        ) : (
          <p className="home-empty">{t.noFavorites}</p>
        )}
      </HomeSection>

      <HomeSection title={t.sharedSection}>
        <p className="home-empty">{t.noShared}</p>
      </HomeSection>

      <HomeSection title={t.recentActivity}>
        {recent.length > 0 ? (
          <div className="home-recent-grid">
            {recent.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={`home-recent${selected === entry.path ? ' selected' : ''}`}
                onClick={() => setSelected(entry.path)}
                onDoubleClick={() => onOpen(entry)}
                onKeyDown={(event) => event.key === 'Enter' && onOpen(entry)}
                title={entry.path}
              >
                <span className="home-recent-icon">
                  <SysIcon entry={entry} size="large" width={24} />
                </span>
                <span className="home-recent-body">
                  <span className="home-recent-name">{entry.name}</span>
                  <span className="home-recent-meta">
                    {displayDir(entry.path)} · {formatDate(entry.mtime)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="home-empty">{t.noRecent}</p>
        )}
      </HomeSection>
    </div>
  )
}
