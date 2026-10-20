import { useState, type ReactElement, type ReactNode } from 'react'
import type { Drive, SpecialFolders } from '@shared/types'
import { G } from './icons'
import {
  DesktopIcon,
  DiscIcon,
  DriveIcon,
  FolderColor,
  GalleryIcon,
  HomeIcon,
  NetworkIcon,
  OneDriveIcon,
  UsbIcon,
  folderVariantForPath
} from './colored-icons'
import { t } from './i18n'
import { basename, driveDisplayName } from './utils'

function Section({
  title,
  children,
  defaultOpen = true,
  onTitle,
  active = false
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  onTitle?: () => void
  active?: boolean
}): ReactElement {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="nav-section">
      <div className="nav-section-head">
        <button
          type="button"
          className="nav-section-toggle"
          aria-label={title}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className={`nav-chevron${open ? ' open' : ''}`}>
            <G.chevronRight />
          </span>
        </button>
        <button
          type="button"
          className={`nav-section-title${active ? ' active' : ''}`}
          onClick={() => (onTitle ? onTitle() : setOpen(!open))}
        >
          {title}
        </button>
      </div>
      {open && <div className="nav-section-body">{children}</div>}
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  onContext,
  subtitle
}: {
  icon: ReactNode
  label: string
  active?: boolean
  onClick: () => void
  onContext?: (event: React.MouseEvent) => void
  subtitle?: string
}): ReactElement {
  return (
    <button
      type="button"
      className={`nav-item${active ? ' active' : ''}${subtitle ? ' with-sub' : ''}`}
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault()
        onContext?.(event)
      }}
      title={label}
    >
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-text">
        <span className="nav-item-label">{label}</span>
        {subtitle && <span className="nav-item-sub">{subtitle}</span>}
      </span>
    </button>
  )
}

export function NavPane({
  folders,
  drives,
  pinned,
  currentPath,
  onNavigate,
  onContext
}: {
  folders: SpecialFolders | null
  drives: Drive[]
  pinned: string[]
  currentPath: string
  onNavigate: (path: string) => void
  onContext: (
    event: React.MouseEvent,
    target: { kind: 'pin' | 'drive' | 'userfolder'; path: string }
  ) => void
}): ReactElement {
  const normalized = currentPath.replace(/[\\/]+$/, '').toLowerCase()
  const isActive = (path: string): boolean => path.replace(/[\\/]+$/, '').toLowerCase() === normalized

  const userFolders = folders
    ? [
        { label: t.documentsNav, path: folders.documents },
        { label: t.downloadsNav, path: folders.downloads },
        { label: t.desktopNav, path: folders.desktop },
        { label: t.picturesNav, path: folders.pictures },
        { label: t.musicNav, path: folders.music },
        { label: t.videosNav, path: folders.videos }
      ]
    : []

  const navFolderIcon = (path: string): ReactElement => {
    const name = basename(path).toLowerCase()
    if (name === 'desktop' || name === 'bureau') return <DesktopIcon />
    if (name === 'onedrive') return <OneDriveIcon />
    return <FolderColor variant={folderVariantForPath(path)} />
  }

  return (
    <nav className="navpane">
      <div className="nav-scroll">
        {folders && (
          <>
            <NavItem icon={<HomeIcon />} label={t.home} active={isActive('home:')} onClick={() => onNavigate('home:')} />
            <NavItem
              icon={<GalleryIcon />}
              label={t.gallery}
              active={isActive(folders.pictures)}
              onClick={() => onNavigate(folders.pictures)}
            />
          </>
        )}

        <Section title={t.quickAccess}>
          {pinned.map((path) => (
            <NavItem
              key={path}
              icon={navFolderIcon(path)}
              label={basename(path)}
              active={isActive(path)}
              onClick={() => onNavigate(path)}
              onContext={(event) => onContext(event, { kind: 'pin', path })}
            />
          ))}
          {pinned.length === 0 && <div className="nav-empty">—</div>}
        </Section>

        <Section title={t.thisPc} onTitle={() => onNavigate('thispc:')} active={isActive('thispc:')}>
          {drives.map((drive) => (
            <NavItem
              key={drive.path}
              icon={
                drive.kind === 'drive' || drive.kind === 'root' ? (
                  <DriveIcon />
                ) : drive.kind === 'optical' ? (
                  <DiscIcon />
                ) : (
                  <UsbIcon />
                )
              }
              label={driveDisplayName(drive)}
              active={isActive(drive.path)}
              onClick={() => onNavigate(drive.path)}
              onContext={(event) => onContext(event, { kind: 'drive', path: drive.path })}
            />
          ))}
          {userFolders
            .filter(
              (item) =>
                !pinned.some(
                  (path) =>
                    path.replace(/[\\/]+$/, '').toLowerCase() ===
                    item.path.replace(/[\\/]+$/, '').toLowerCase()
                )
            )
            .map((item) => (
            <NavItem
              key={item.path}
              icon={navFolderIcon(item.path)}
              label={item.label}
              active={isActive(item.path)}
              onClick={() => onNavigate(item.path)}
              onContext={(event) => onContext(event, { kind: 'userfolder', path: item.path })}
            />
          ))}
        </Section>

        <div className="nav-single">
          <NavItem icon={<NetworkIcon />} label={t.network} onClick={() => onNavigate('network:')} />
        </div>
      </div>
    </nav>
  )
}
