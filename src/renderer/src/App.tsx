import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type {
  Drive,
  Entry,
  PlatformInfo,
  Settings,
  SortDir,
  SortKey,
  SpecialFolders,
  ViewMode
} from '@shared/types'
import { AddressBar, CommandBar, StatusBar, TabStrip } from './Chrome'
import { ConfirmDialog, DrivePropertiesDialog, PropertiesDialog } from './Dialogs'
import { DriveEmptyView } from './DriveEmptyView'
import { FileView, PreviewPane } from './FileView'
import { HomeView } from './HomeView'
import { NavPane } from './NavPane'
import { ThisPcView } from './ThisPcView'
import { Menu, type MenuItem, type MenuState } from './ui'
import { G } from './icons'
import { t } from './i18n'
import { basename, dirname, formatSize, sortEntries } from './utils'

interface Tab {
  id: string
  history: string[]
  index: number
  path: string
  parent: string | null
  entries: Entry[]
  loading: boolean
  started: boolean
  error: string | null
  selection: string[]
  focus: string | null
  anchor: string | null
  query: string
  results: Entry[] | null
  view: ViewMode
  sortKey: SortKey
  sortDir: SortDir
  noMedia: boolean
}

type DialogState =
  | { kind: 'properties'; path: string }
  | { kind: 'drive'; path: string }
  | { kind: 'delete'; paths: string[] }
  | null

const DEFAULT_SETTINGS: Settings = {
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

let tabSeq = 0

const normalizePath = (path: string): string => path.replace(/[\\/]+$/, '').toLowerCase()
const isVirtualPath = (path: string | undefined): boolean => path === 'thispc:' || path === 'home:'

function createTab(path: string, settings: Settings): Tab {
  return {
    id: `tab-${++tabSeq}`,
    history: [path],
    index: 0,
    path,
    parent: dirname(path),
    entries: [],
    loading: true,
    started: false,
    error: null,
    selection: [],
    focus: null,
    anchor: null,
    query: '',
    results: null,
    view: settings.view,
    sortKey: settings.sortKey,
    sortDir: settings.sortDir,
    noMedia: false
  }
}

const VIEW_LABELS: Record<ViewMode, string> = {
  details: t.details,
  list: t.list,
  tiles: t.tiles,
  icons: t.icons
}

export default function App(): ReactElement {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null)
  const [folders, setFolders] = useState<SpecialFolders | null>(null)
  const [drives, setDrives] = useState<Drive[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeId, setActiveId] = useState('')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [renaming, setRenaming] = useState<{ path: string; value: string } | null>(null)
  const [clipboard, setClipboard] = useState<{ paths: string[]; mode: 'copy' | 'cut' } | null>(null)
  const [osClipboard, setOsClipboard] = useState(false)
  const [addressEditing, setAddressEditing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchToken = useRef(0)
  const showHiddenRef = useRef(settings.showHidden)

  showHiddenRef.current = settings.showHidden

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? null
  const canPaste = !!clipboard || osClipboard

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 4200)
  }, [])

  const errorText = useCallback((error: unknown): string => {
    const text = String((error as Error)?.message ?? error)
    if (text.includes('exists')) return t.exists
    if (text.includes('invalid_name')) return t.invalidName
    if (text.includes('EACCES') || text.includes('EPERM')) return t.accessDenied
    if (text.includes('ENOENT')) return t.notFound
    return text
  }, [])

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }))
    window.api.saveSettings(patch)
  }, [])

  const applyTheme = useCallback((info: PlatformInfo, mode: Settings['theme']) => {
    const dark = mode === 'system' ? info.dark : mode === 'dark'
    const root = document.documentElement
    root.dataset.theme = dark ? 'dark' : 'light'
    root.dataset.platform = info.platform
    root.dataset.mica = info.mica ? 'true' : 'false'
    root.style.setProperty('--accent', info.accent)
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [info, special, driveList, stored] = await Promise.all([
        window.api.platform() as Promise<PlatformInfo>,
        window.api.specialFolders() as Promise<SpecialFolders>,
        window.api.drives() as Promise<Drive[]>,
        window.api.settings() as Promise<Settings>
      ])
      if (!alive) return
      const merged = { ...DEFAULT_SETTINGS, ...stored }
      if (!merged.pinned.length) {
        merged.pinned = [special.desktop, special.downloads, special.documents, special.pictures]
        void window.api.saveSettings({ pinned: merged.pinned })
      }
      setPlatform(info)
      setFolders(special)
      setDrives(driveList)
      setSettings(merged)
      applyTheme(info, merged.theme)
      const params = new URLSearchParams(window.location.search)
      const start = params.get('path') || 'home:'
      const tab = createTab(start, merged)
      setTabs([tab])
      setActiveId(tab.id)
    })()

    const dispose = window.api.onTheme(() => {
      window.api.platform().then((info: PlatformInfo) => {
        if (!alive) return
        setPlatform(info)
        setSettings((current) => {
          applyTheme(info, current.theme)
          return current
        })
      })
    })
    return () => {
      alive = false
      dispose()
    }
  }, [applyTheme])

  useEffect(() => {
    if (platform) applyTheme(platform, settings.theme)
  }, [platform, settings.theme, applyTheme])

  useEffect(() => {
    let alive = true
    const check = async (): Promise<void> => {
      try {
        const files = (await window.api.readClipboardFiles()) as string[]
        if (alive) setOsClipboard(files.length > 0)
      } catch {
        /* clipboard unavailable */
      }
    }
    void check()
    window.addEventListener('focus', check)
    return () => {
      alive = false
      window.removeEventListener('focus', check)
    }
  }, [])

  const updateTab = useCallback((id: string, patch: Partial<Tab> | ((tab: Tab) => Partial<Tab>)) => {
    setTabs((current) =>
      current.map((tab) => (tab.id === id ? { ...tab, ...(typeof patch === 'function' ? patch(tab) : patch) } : tab))
    )
  }, [])

  const loadDir = useCallback(
    async (id: string, target: string, push: boolean): Promise<void> => {
      if (target === 'thispc:' || target === 'home:') {
        setTabs((current) =>
          current.map((tab) => {
            if (tab.id !== id) return tab
            const samePath = tab.history[tab.index] === target
            const history = push && !samePath ? [...tab.history.slice(0, tab.index + 1), target] : tab.history
            return {
              ...tab,
              path: target,
              parent: null,
              entries: [],
              loading: false,
              error: null,
              selection: [],
              focus: null,
              anchor: null,
              query: '',
              results: null,
              noMedia: false,
              history,
              index: push ? history.length - 1 : tab.index
            }
          })
        )
        return
      }
      updateTab(id, { loading: true, error: null, noMedia: false })
      try {
        const listing = await window.api.list(target, showHiddenRef.current)
        setTabs((current) =>
          current.map((tab) => {
            if (tab.id !== id) return tab
            const samePath = tab.history[tab.index] === listing.dir
            const history = push
              ? samePath
                ? tab.history
                : [...tab.history.slice(0, tab.index + 1), listing.dir]
              : tab.history
            return {
              ...tab,
              path: listing.dir,
              parent: listing.parent,
              entries: listing.entries,
              loading: false,
              error: listing.error,
              selection: [],
              focus: null,
              anchor: null,
              query: '',
              results: null,
              noMedia: listing.noMedia ?? false,
              history,
              index: push ? history.length - 1 : tab.index
            }
          })
        )
        patchSettings({ lastPath: listing.dir })
      } catch (error) {
        updateTab(id, { loading: false, error: errorText(error) })
      }
    },
    [patchSettings, updateTab, errorText]
  )

  useEffect(() => {
    if (!activeTab || activeTab.started) return
    updateTab(activeTab.id, { started: true })
    void loadDir(activeTab.id, activeTab.path, false)
  }, [activeTab?.id])

  const navigate = useCallback(
    (id: string, target: string, push = true) => {
      if (!target) return
      if (target === 'network:') {
        notify(t.networkUnavailable)
        return
      }
      setRenaming(null)
      void loadDir(id, target, push)
    },
    [loadDir, notify]
  )

  const refresh = useCallback(() => {
    if (!activeTab) return
    void loadDir(activeTab.id, activeTab.path, false)
  }, [activeTab, loadDir])

  const goBack = useCallback(() => {
    if (!activeTab || activeTab.index <= 0) return
    const target = activeTab.history[activeTab.index - 1]
    updateTab(activeTab.id, { index: activeTab.index - 1 })
    void loadDir(activeTab.id, target, false)
  }, [activeTab, loadDir, updateTab])

  const goForward = useCallback(() => {
    if (!activeTab || activeTab.index >= activeTab.history.length - 1) return
    const target = activeTab.history[activeTab.index + 1]
    updateTab(activeTab.id, { index: activeTab.index + 1 })
    void loadDir(activeTab.id, target, false)
  }, [activeTab, loadDir, updateTab])

  const goUp = useCallback(() => {
    if (!activeTab || isVirtualPath(activeTab.path)) return
    const parent = activeTab.parent ?? dirname(activeTab.path)
    navigate(activeTab.id, normalizePath(parent) === normalizePath(activeTab.path) ? 'thispc:' : parent)
  }, [activeTab, navigate])

  const entries = useMemo(() => {
    if (!activeTab) return []
    const source = activeTab.query && activeTab.results ? activeTab.results : activeTab.entries
    return sortEntries(source, activeTab.sortKey, activeTab.sortDir)
  }, [activeTab])

  const selectedEntries = useMemo(() => {
    if (!activeTab) return []
    const set = new Set(activeTab.selection)
    return entries.filter((entry) => set.has(entry.path))
  }, [entries, activeTab])

  const selectedSize = useMemo(() => {
    if (selectedEntries.length === 0) return null
    const total = selectedEntries.reduce((sum, entry) => sum + (entry.isDir ? 0 : entry.size), 0)
    if (total === 0) return null
    return formatSize(total)
  }, [selectedEntries])

  useEffect(() => {
    if (!activeTab) return
    if (isVirtualPath(activeTab.path) || activeTab.noMedia) {
      setSearching(false)
      return
    }
    const query = activeTab.query.trim()
    const token = ++searchToken.current
    if (!query) {
      if (activeTab.results) updateTab(activeTab.id, { results: null })
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        const found = (await window.api.search(activeTab.path, query, showHiddenRef.current)) as Entry[]
        if (searchToken.current !== token) return
        updateTab(activeTab.id, { results: found })
      } finally {
        if (searchToken.current === token) setSearching(false)
      }
    }, 220)
    return () => window.clearTimeout(timer)
  }, [activeTab?.query, activeTab?.path])

  const openEntry = useCallback(
    async (entry: Entry) => {
      if (!activeTab) return
      if (entry.isDir) {
        navigate(activeTab.id, entry.path)
        return
      }
      const error = await window.api.open(entry.path)
      if (error) {
        notify(errorText(error))
        return
      }
      const recent = [entry.path, ...settings.recent.filter((path) => path !== entry.path)].slice(0, 20)
      patchSettings({ recent })
    },
    [activeTab, navigate, notify, errorText, settings.recent, patchSettings]
  )

  const select = useCallback(
    (entry: Entry, event: React.MouseEvent) => {
      if (!activeTab) return
      const current = new Set(activeTab.selection)
      const isContext = event.type === 'contextmenu'
      if (isContext && current.has(entry.path)) {
        updateTab(activeTab.id, { focus: entry.path })
        return
      }
      let next: Set<string>
      if (event.shiftKey && activeTab.anchor) {
        const paths = entries.map((item) => item.path)
        const from = paths.indexOf(activeTab.anchor)
        const to = paths.indexOf(entry.path)
        next = from >= 0 && to >= 0 ? new Set(paths.slice(Math.min(from, to), Math.max(from, to) + 1)) : new Set([entry.path])
      } else if (event.ctrlKey || event.metaKey) {
        next = new Set(current)
        if (next.has(entry.path)) next.delete(entry.path)
        else next.add(entry.path)
      } else {
        next = new Set([entry.path])
      }
      updateTab(activeTab.id, {
        selection: Array.from(next),
        focus: entry.path,
        anchor: event.shiftKey ? activeTab.anchor : entry.path
      })
    },
    [activeTab, entries, updateTab]
  )

  const startRename = useCallback(() => {
    if (!activeTab || selectedEntries.length !== 1) return
    setRenaming({ path: selectedEntries[0].path, value: selectedEntries[0].name })
  }, [activeTab, selectedEntries])

  const commitRename = useCallback(async () => {
    if (!renaming || !activeTab) return
    const current = renaming
    setRenaming(null)
    if (!current.value.trim() || current.value === basename(current.path)) return
    try {
      const target = (await window.api.rename(current.path, current.value)) as string
      await loadDir(activeTab.id, activeTab.path, false)
      updateTab(activeTab.id, { selection: [target], focus: target })
    } catch (error) {
      notify(errorText(error))
    }
  }, [renaming, activeTab, loadDir, updateTab, notify, errorText])

  const newFolder = useCallback(async () => {
    if (!activeTab || isVirtualPath(activeTab.path) || activeTab.noMedia) return
    const existing = new Set(activeTab.entries.map((entry) => entry.name.toLowerCase()))
    let name = t.newFolder
    let index = 2
    while (existing.has(name.toLowerCase())) name = `${t.newFolder} (${index++})`
    try {
      const path = (await window.api.mkdir(activeTab.path, name)) as string
      await loadDir(activeTab.id, activeTab.path, false)
      setRenaming({ path, value: name })
      updateTab(activeTab.id, { selection: [path], focus: path })
    } catch (error) {
      notify(errorText(error))
    }
  }, [activeTab, loadDir, updateTab, notify, errorText])

  const deletePaths = useCallback(
    async (paths: string[], permanent: boolean) => {
      if (!activeTab || paths.length === 0) return
      if (permanent) {
        setDialog({ kind: 'delete', paths })
        return
      }
      const result = (await window.api.remove(paths, false)) as { failed: string[] }
      if (result.failed.length) notify(t.accessDenied)
      await loadDir(activeTab.id, activeTab.path, false)
    },
    [activeTab, loadDir, notify]
  )

  const deleteSelection = useCallback(
    (permanent: boolean) => deletePaths([...(activeTab?.selection ?? [])], permanent),
    [activeTab, deletePaths]
  )

  const copyPaths = useCallback((paths: string[], mode: 'copy' | 'cut') => {
    if (paths.length === 0) return
    setClipboard({ paths, mode })
    void window.api.copyFiles(paths)
  }, [])

  const copySelection = useCallback(
    (mode: 'copy' | 'cut') => copyPaths([...(activeTab?.selection ?? [])], mode),
    [activeTab, copyPaths]
  )

  const paste = useCallback(async () => {
    if (!activeTab) return
    let sources = clipboard?.paths ?? []
    let mode: 'copy' | 'move' = clipboard?.mode === 'cut' ? 'move' : 'copy'
    if (sources.length === 0) {
      sources = (await window.api.readClipboardFiles()) as string[]
      mode = 'copy'
    }
    if (sources.length === 0) return
    const result = (await window.api.transfer(sources, activeTab.path, mode)) as {
      copied: number
      failed: string[]
    }
    if (result.failed.length) notify(t.accessDenied)
    if (clipboard?.mode === 'cut') setClipboard(null)
    await loadDir(activeTab.id, activeTab.path, false)
  }, [activeTab, clipboard, loadDir, notify])

  const dropPaths = useCallback(
    async (paths: string[], dest: string, mode: 'copy' | 'move') => {
      if (!activeTab || paths.length === 0) return
      const result = (await window.api.transfer(paths, dest, mode)) as { copied: number; failed: string[] }
      if (result.failed.length) notify(t.accessDenied)
      await loadDir(activeTab.id, activeTab.path, false)
    },
    [activeTab, loadDir, notify]
  )

  const togglePin = useCallback(
    (path: string) => {
      const pinned = settings.pinned.includes(path)
        ? settings.pinned.filter((item) => item !== path)
        : [...settings.pinned, path]
      patchSettings({ pinned })
    },
    [settings.pinned, patchSettings]
  )

  const toggleFavorite = useCallback(
    (path: string) => {
      const favorites = settings.favorites.includes(path)
        ? settings.favorites.filter((item) => item !== path)
        : [...settings.favorites, path]
      patchSettings({ favorites })
    },
    [settings.favorites, patchSettings]
  )

  const showMenuAt = useCallback((event: React.MouseEvent, items: MenuItem[], minWidth = 220) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, items, minWidth })
  }, [])

  const showMenuBelow = useCallback((event: React.MouseEvent, items: MenuItem[], minWidth = 220) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    setMenu({ x: rect.left, y: rect.bottom + 4, items, minWidth })
  }, [])

  const viewItems = useCallback(
    (): MenuItem[] => [
      ...(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => ({
        id: mode,
        label: VIEW_LABELS[mode],
        checked: activeTab?.view === mode,
        icon:
          mode === 'details' ? (
            <G.tableView />
          ) : mode === 'list' ? (
            <G.listView />
          ) : mode === 'tiles' ? (
            <G.view />
          ) : (
            <G.detailsView />
          ),
        onClick: () => {
          if (!activeTab) return
          updateTab(activeTab.id, { view: mode })
          patchSettings({ view: mode })
        }
      })),
      { separator: true },
      {
        id: 'preview',
        label: t.preview,
        checked: settings.showPreview,
        icon: <G.preview />,
        onClick: () => patchSettings({ showPreview: !settings.showPreview })
      },
      {
        id: 'hidden',
        label: t.hiddenItems,
        checked: settings.showHidden,
        onClick: () => {
          const next = !settings.showHidden
          patchSettings({ showHidden: next })
          if (activeTab) void loadDir(activeTab.id, activeTab.path, false)
        }
      }
    ],
    [activeTab, settings.showPreview, settings.showHidden, updateTab, patchSettings, loadDir]
  )

  const sortMenu = useCallback(
    (): MenuItem[] => [
      { id: 'name', label: t.name, checked: activeTab?.sortKey === 'name', onClick: () => setSort('name') },
      { id: 'mtime', label: t.dateModified, checked: activeTab?.sortKey === 'mtime', onClick: () => setSort('mtime') },
      { id: 'type', label: t.type, checked: activeTab?.sortKey === 'type', onClick: () => setSort('type') },
      { id: 'size', label: t.size, checked: activeTab?.sortKey === 'size', onClick: () => setSort('size') },
      { separator: true },
      {
        id: 'asc',
        label: t.ascending,
        checked: activeTab?.sortDir === 'asc',
        onClick: () => setSortDir('asc')
      },
      {
        id: 'desc',
        label: t.descending,
        checked: activeTab?.sortDir === 'desc',
        onClick: () => setSortDir('desc')
      }
    ],
    [activeTab]
  )

  const setSort = useCallback(
    (key: SortKey) => {
      if (!activeTab) return
      updateTab(activeTab.id, { sortKey: key })
      patchSettings({ sortKey: key })
    },
    [activeTab, updateTab, patchSettings]
  )

  const setSortDir = useCallback(
    (dir: SortDir) => {
      if (!activeTab) return
      updateTab(activeTab.id, { sortDir: dir })
      patchSettings({ sortDir: dir })
    },
    [activeTab, updateTab, patchSettings]
  )

  const entryMenu = useCallback(
    (event: React.MouseEvent, entry: Entry | null): void => {
      if (!activeTab) return
      const targets = entry ? (activeTab.selection.includes(entry.path) ? activeTab.selection : [entry.path]) : []
      if (!entry) {
        showMenuAt(event, [
          { id: 'newfolder', label: t.newFolder, icon: <G.add />, onClick: newFolder },
          { id: 'paste', label: t.paste, icon: <G.paste />, disabled: !clipboard, onClick: paste },
          { separator: true },
          { id: 'refresh', label: t.refresh, icon: <G.refresh />, onClick: refresh },
          { separator: true },
          { id: 'view', label: t.view, icon: <G.view />, submenu: viewItems() },
          { id: 'sort', label: t.sort, icon: <G.sort />, submenu: sortMenu() },
          { separator: true },
          {
            id: 'props',
            label: t.properties,
            icon: <G.info />,
            onClick: () =>
              setDialog(
                drives.some((drive) => normalizePath(drive.path) === normalizePath(activeTab.path))
                  ? { kind: 'drive', path: activeTab.path }
                  : { kind: 'properties', path: activeTab.path }
              )
          }
        ])
        return
      }
      const single = targets.length === 1
      const isPinned = settings.pinned.includes(entry.path)
      const isFavorite = settings.favorites.includes(entry.path)
      showMenuAt(event, [
        {
          id: 'open',
          label: t.open,
          icon: <G.open />,
          disabled: !single,
          onClick: () => openEntry(entry)
        },
        ...(entry.isDir
          ? []
          : [
              {
                id: 'openwith',
                label: t.openWith,
                icon: <G.open />,
                onClick: () => window.api.openWith(entry.path)
              }
            ]),
        { separator: true },
        { id: 'cut', label: t.cut, icon: <G.cut />, shortcut: 'Ctrl+X', onClick: () => copyPaths(targets, 'cut') },
        { id: 'copy', label: t.copy, icon: <G.copy />, shortcut: 'Ctrl+C', onClick: () => copyPaths(targets, 'copy') },
        { id: 'paste', label: t.paste, icon: <G.paste />, shortcut: 'Ctrl+V', disabled: !canPaste, onClick: paste },
        { separator: true },
        {
          id: 'rename',
          label: t.rename,
          icon: <G.rename />,
          shortcut: 'F2',
          disabled: !single,
          onClick: () => setRenaming({ path: entry.path, value: entry.name })
        },
        {
          id: 'delete',
          label: t.delete,
          icon: <G.delete />,
          shortcut: 'Suppr',
          danger: true,
          onClick: () => void deletePaths(targets, false)
        },
        { separator: true },
        {
          id: 'pin',
          label: isPinned ? t.unpin : t.pin,
          icon: isPinned ? <G.unpin /> : <G.pin />,
          onClick: () => togglePin(entry.path)
        },
        {
          id: 'favorite',
          label: isFavorite ? t.removeFavorite : t.addFavorite,
          icon: <G.star />,
          disabled: !single,
          onClick: () => toggleFavorite(entry.path)
        },
        {
          id: 'copypath',
          label: t.copyPath,
          icon: <G.copyPath />,
          onClick: () => {
            void navigator.clipboard.writeText(entry.path)
            notify(t.pathCopied)
          }
        },
        { separator: true },
        {
          id: 'props',
          label: t.properties,
          icon: <G.info />,
          disabled: !single,
          onClick: () => setDialog({ kind: 'properties', path: entry.path })
        }
      ])
    },
    [
      activeTab,
      canPaste,
      clipboard,
      copyPaths,
      deletePaths,
      newFolder,
      openEntry,
      paste,
      refresh,
      settings.pinned,
      settings.favorites,
      showMenuAt,
      sortMenu,
      startRename,
      togglePin,
      toggleFavorite,
      viewItems,
      notify,
      drives
    ]
  )

  const selectAll = useCallback(() => {
    if (!activeTab) return
    updateTab(activeTab.id, { selection: entries.map((entry) => entry.path) })
  }, [activeTab, entries, updateTab])

  const commandAction = useCallback(
    (action: string, event: React.MouseEvent) => {
      switch (action) {
        case 'new':
          showMenuBelow(event, [
            { id: 'folder', label: t.newFolder, icon: <G.folder />, onClick: newFolder },
            {
              id: 'window',
              label: t.newWindow,
              icon: <G.newWindow />,
              onClick: () => window.api.newWindow(isVirtualPath(activeTab?.path) ? undefined : activeTab?.path)
            }
          ])
          break
        case 'cut':
          copySelection('cut')
          break
        case 'copy':
          copySelection('copy')
          break
        case 'paste':
          void paste()
          break
        case 'rename':
          startRename()
          break
        case 'delete':
          void deleteSelection(false)
          break
        case 'sort':
          showMenuBelow(event, sortMenu())
          break
        case 'view':
          showMenuBelow(event, viewItems())
          break
        case 'more':
          showMenuBelow(event, [
            { id: 'selectall', label: t.selectAll, shortcut: 'Ctrl+A', onClick: selectAll },
            { id: 'hidden', label: t.hiddenItems, checked: settings.showHidden, onClick: () => {
              patchSettings({ showHidden: !settings.showHidden })
              if (activeTab) void loadDir(activeTab.id, activeTab.path, false)
            } },
            { separator: true },
            {
              id: 'props',
              label: t.properties,
              icon: <G.info />,
              onClick: () => {
                if (!activeTab) return
                setDialog(
                  drives.some((drive) => normalizePath(drive.path) === normalizePath(activeTab.path))
                    ? { kind: 'drive', path: activeTab.path }
                    : { kind: 'properties', path: activeTab.path }
                )
              }
            },
            {
              id: 'new',
              label: t.newWindow,
              icon: <G.newWindow />,
              onClick: () => window.api.newWindow(isVirtualPath(activeTab?.path) ? undefined : activeTab?.path)
            }
          ])
          break
        default:
          break
      }
    },
    [activeTab, deleteSelection, newFolder, paste, showMenuBelow, sortMenu, startRename, viewItems, copySelection, settings.showHidden, patchSettings, loadDir, selectAll, drives]
  )

  const closeTab = useCallback(
    (id: string) => {
      setTabs((current) => {
        if (current.length === 1) {
          window.close()
          return current
        }
        const index = current.findIndex((tab) => tab.id === id)
        const next = current.filter((tab) => tab.id !== id)
        if (id === activeId) {
          const fallback = next[Math.max(0, index - 1)]
          setActiveId(fallback.id)
        }
        return next
      })
    },
    [activeId]
  )

  const newTab = useCallback(
    (path?: string) => {
      const target = path ?? activeTab?.path ?? folders?.home ?? '/'
      const tab = createTab(target, settings)
      setTabs((current) => [...current, tab])
      setActiveId(tab.id)
    },
    [activeTab, folders, settings, loadDir]
  )

  useEffect(() => {
    if (!activeTab) return
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const mod = event.ctrlKey || event.metaKey

      if (event.key === 'Escape') {
        if (menu) setMenu(null)
        else if (renaming) setRenaming(null)
        else if (addressEditing) setAddressEditing(false)
        else updateTab(activeTab.id, { selection: [], focus: null })
        return
      }
      if (mod && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        setAddressEditing(true)
        return
      }
      if (typing) return
      if (mod && event.key.toLowerCase() === 't') {
        event.preventDefault()
        newTab()
        return
      }
      if (mod && event.key.toLowerCase() === 'w') {
        event.preventDefault()
        closeTab(activeTab.id)
        return
      }
      if (mod && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (mod && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        selectAll()
        return
      }
      if (mod && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copySelection('copy')
        return
      }
      if (mod && event.key.toLowerCase() === 'x') {
        event.preventDefault()
        copySelection('cut')
        return
      }
      if (mod && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        void paste()
        return
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        void newFolder()
        return
      }
      if (event.key === 'F5') {
        event.preventDefault()
        refresh()
        return
      }
      if (event.key === 'F2') {
        event.preventDefault()
        startRename()
        return
      }
      if (event.key === 'Delete') {
        event.preventDefault()
        void deleteSelection(event.shiftKey)
        return
      }
      if (event.key === 'Backspace' || (event.altKey && event.key === 'ArrowUp')) {
        event.preventDefault()
        goUp()
        return
      }
      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault()
        goBack()
        return
      }
      if (event.altKey && event.key === 'ArrowRight') {
        event.preventDefault()
        goForward()
        return
      }
      if (event.altKey && event.key === 'Enter') {
        event.preventDefault()
        setDialog({ kind: 'properties', path: selectedEntries[0]?.path ?? activeTab.path })
        return
      }
      if (event.key === 'Enter') {
        const focused = entries.find((entry) => entry.path === activeTab.focus)
        if (focused) {
          event.preventDefault()
          void openEntry(focused)
        }
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (entries.length === 0) return
        event.preventDefault()
        const index = entries.findIndex((entry) => entry.path === activeTab.focus)
        const nextIndex = Math.max(0, Math.min(entries.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
        const next = entries[index < 0 ? 0 : nextIndex]
        updateTab(activeTab.id, { selection: [next.path], focus: next.path, anchor: next.path })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    activeTab,
    addressEditing,
    clipboard,
    closeTab,
    copySelection,
    deleteSelection,
    entries,
    goBack,
    goForward,
    goUp,
    menu,
    newFolder,
    newTab,
    openEntry,
    paste,
    refresh,
    renaming,
    selectAll,
    startRename,
    updateTab
  ])

  const navContext = useCallback(
    (event: React.MouseEvent, target: { kind: 'pin' | 'drive' | 'userfolder'; path: string }) => {
      const pinned = settings.pinned.includes(target.path)
      showMenuAt(event, [
        {
          id: 'open',
          label: t.open,
          icon: <G.open />,
          onClick: () => activeTab && navigate(activeTab.id, target.path)
        },
        {
          id: 'newtab',
          label: t.openInNewTab,
          icon: <G.newWindow />,
          onClick: () => newTab(target.path)
        },
        { separator: true },
        ...(target.kind === 'drive'
          ? []
          : [
              {
                id: 'pin',
                label: pinned ? t.unpin : t.pin,
                icon: pinned ? <G.unpin /> : <G.pin />,
                onClick: () => togglePin(target.path)
              }
            ]),
        {
          id: 'props',
          label: t.properties,
          icon: <G.info />,
          onClick: () =>
            setDialog(
              target.kind === 'drive'
                ? { kind: 'drive', path: target.path }
                : { kind: 'properties', path: target.path }
            )
        }
      ])
    },
    [activeTab, navigate, newTab, settings.pinned, showMenuAt, togglePin]
  )

  const driveContext = useCallback(
    (event: React.MouseEvent, drive: Drive) => {
      showMenuAt(event, [
        {
          id: 'open',
          label: t.open,
          icon: <G.open />,
          onClick: () => activeTab && navigate(activeTab.id, drive.path)
        },
        {
          id: 'newtab',
          label: t.openInNewTab,
          icon: <G.newWindow />,
          onClick: () => newTab(drive.path)
        },
        { separator: true },
        {
          id: 'props',
          label: t.properties,
          icon: <G.info />,
          onClick: () => setDialog({ kind: 'drive', path: drive.path })
        }
      ])
    },
    [activeTab, navigate, newTab, showMenuAt]
  )

  if (!platform || !activeTab) {
    return <div className="boot" />
  }

  const isThisPc = activeTab.path === 'thispc:'
  const isHome = activeTab.path === 'home:'
  const tabsInfo = tabs.map((tab) => ({
    id: tab.id,
    label:
      tab.path === 'thispc:'
        ? t.thisPc
        : tab.path === 'home:'
          ? t.home
          : basename(tab.path) || tab.path,
    path: tab.path
  }))
  const previewEntry = settings.showPreview && selectedEntries.length === 1 ? selectedEntries[0] : null

  return (
    <div className="app">
      <header className="titlebar">
        <TabStrip
          tabs={tabsInfo}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={closeTab}
          onNew={() => newTab()}
          onContext={(event, id) =>
            showMenuAt(event, [
              { id: 'new', label: t.newTab, icon: <G.add />, onClick: () => newTab() },
              { id: 'dup', label: t.duplicateTab, icon: <G.copy />, onClick: () => {
                const tab = tabs.find((item) => item.id === id)
                if (tab) newTab(tab.path)
              } },
              { separator: true },
              { id: 'close', label: t.closeTab, icon: <G.close />, onClick: () => closeTab(id) },
              { id: 'others', label: t.closeOthers, onClick: () => {
                setTabs((current) => {
                  const keep = current.find((tab) => tab.id === id)
                  if (keep) setActiveId(keep.id)
                  return keep ? [keep] : current
                })
              } }
            ])
          }
        />
      </header>

      <CommandBar
        hasSelection={activeTab.selection.length > 0}
        canPaste={canPaste}
        onAction={commandAction}
      />

      <AddressBar
        path={activeTab.path}
        editing={addressEditing}
        query={activeTab.query}
        canBack={activeTab.index > 0}
        canForward={activeTab.index < activeTab.history.length - 1}
        onBack={goBack}
        onForward={goForward}
        onUp={goUp}
        onRefresh={refresh}
        onNavigate={(target) => navigate(activeTab.id, target)}
        onEditingChange={setAddressEditing}
        onQuery={(value) => updateTab(activeTab.id, { query: value })}
        searchRef={searchRef}
      />

      <div className="main">
        <NavPane
          folders={folders}
          drives={drives}
          pinned={settings.pinned}
          currentPath={activeTab.path}
          onNavigate={(target) => navigate(activeTab.id, target)}
          onContext={navContext}
        />
        <section className="content">
          {isHome ? (
            <HomeView
              folders={folders}
              pinned={settings.pinned}
              favorites={settings.favorites}
              onOpen={openEntry}
              onRemoveFavorite={toggleFavorite}
            />
          ) : isThisPc ? (
            <ThisPcView
              drives={drives}
              folders={folders}
              onOpen={(target) => navigate(activeTab.id, target)}
              onDriveContext={driveContext}
            />
          ) : activeTab.noMedia ? (
            <DriveEmptyView path={activeTab.path} onRefresh={refresh} />
          ) : (
            <FileView
              entries={entries}
              view={activeTab.view}
              sortKey={activeTab.sortKey}
              sortDir={activeTab.sortDir}
              selection={new Set(activeTab.selection)}
              focusPath={activeTab.focus}
              renaming={renaming}
              searchMode={!!activeTab.query}
              iconSize={settings.iconSize}
              loading={activeTab.loading}
              error={activeTab.error}
              currentDir={activeTab.path}
              onSelect={select}
              onOpen={openEntry}
              onContext={entryMenu}
              onSort={(key) => {
                if (key === activeTab.sortKey) setSortDir(activeTab.sortDir === 'asc' ? 'desc' : 'asc')
                else setSort(key)
              }}
              onRenameCommit={() => void commitRename()}
              onRenameCancel={() => setRenaming(null)}
              onRenameChange={(value) => setRenaming((current) => (current ? { ...current, value } : current))}
              onDropPaths={(paths, dest, mode) => void dropPaths(paths, dest, mode)}
            />
          )}
          {settings.showPreview && !isThisPc && !isHome && !activeTab.noMedia && (
            <PreviewPane entry={previewEntry} onClose={() => patchSettings({ showPreview: false })} />
          )}
        </section>
      </div>

      <StatusBar
        visible={isHome || activeTab.noMedia ? -1 : isThisPc ? drives.length : entries.length}
        selected={activeTab.selection.length}
        sizeLabel={selectedSize}
        searching={searching || !!activeTab.query}
        searchingProgress={searching}
      />

      <Menu state={menu} onClose={() => setMenu(null)} />

      {dialog?.kind === 'properties' && (
        <PropertiesDialog path={dialog.path} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'drive' && (
        <DrivePropertiesDialog path={dialog.path} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={t.confirmDeleteTitle}
          body={t.confirmDeleteBody}
          confirmLabel={t.delete}
          danger
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const paths = dialog.paths
            setDialog(null)
            if (!activeTab) return
            const result = (await window.api.remove(paths, true)) as { failed: string[] }
            if (result.failed.length) notify(t.accessDenied)
            await loadDir(activeTab.id, activeTab.path, false)
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
