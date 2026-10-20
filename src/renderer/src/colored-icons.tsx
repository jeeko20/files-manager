import { useId, type ReactElement, type ReactNode } from 'react'

export type FolderVariant =
  | 'plain'
  | 'documents'
  | 'downloads'
  | 'pictures'
  | 'music'
  | 'videos'

function Folder({ variant, children }: { variant: FolderVariant; children?: ReactNode }): ReactElement {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="color-icon folder-color" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`back${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD882" />
          <stop offset="1" stopColor="#F4A51C" />
        </linearGradient>
        <linearGradient id={`front${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE9AE" />
          <stop offset="1" stopColor="#FFBE3D" />
        </linearGradient>
        <linearGradient id={`page${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E8EEF7" />
        </linearGradient>
      </defs>
      <path
        d="M2.5 8.5A2.5 2.5 0 0 1 5 6h6.4c.8 0 1.5.3 2 .9l1.6 1.6H27a2.5 2.5 0 0 1 2.5 2.5v13.5A2.5 2.5 0 0 1 27 27H5a2.5 2.5 0 0 1-2.5-2.5z"
        fill={`url(#back${uid})`}
      />
      <path
        d="M2.5 12.6h27V24.5A2.5 2.5 0 0 1 27 27H5a2.5 2.5 0 0 1-2.5-2.5z"
        fill={`url(#front${uid})`}
      />
      <path d="M4 13.5h24" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="1" strokeLinecap="round" />

      {variant === 'documents' && (
        <g>
          <path
            d="M13.5 15.2h7.2l3.3 3.3v8.1a1 1 0 0 1-1 1h-9.5a1 1 0 0 1-1-1V16.2a1 1 0 0 1 1-1z"
            fill={`url(#page${uid})`}
            stroke="#C9D4E4"
            strokeWidth=".7"
          />
          <path d="M20.7 15.2v3.3h3.3" fill="#DCE5F2" stroke="#C9D4E4" strokeWidth=".7" />
          <path d="M15.3 20h7M15.3 22.2h7M15.3 24.4h4.6" stroke="#4F8DF7" strokeWidth="1.1" strokeLinecap="round" />
        </g>
      )}

      {variant === 'downloads' && (
        <g>
          <circle cx="22" cy="21.6" r="6.4" fill="#2FB344" stroke="#FFFFFF" strokeWidth="1.2" />
          <path d="M22 18v5.1M19.6 21l2.4 2.5 2.4-2.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      )}

      {variant === 'pictures' && (
        <g>
          <rect x="13" y="15.5" width="12.4" height="9.6" rx="1.4" fill="#F4F8FF" stroke="#C9D4E4" strokeWidth=".7" />
          <path d="M13.6 23.6l3.6-3.9 2.4 2.5 1.8-1.9 4 4.1v.5a1 1 0 0 1-1 1H14.6a1 1 0 0 1-1-1z" fill="#5DBB63" />
          <circle cx="22.6" cy="18.6" r="1.5" fill="#FFC53D" />
          <path d="M13.6 23.6l3.6-3.9 2.4 2.5 1.8-1.9 4 4.1" stroke="#3E9E4D" strokeWidth=".5" fill="none" />
        </g>
      )}

      {variant === 'music' && (
        <g>
          <path d="M20.4 15.5v8.2" stroke="#E4572E" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M20.4 15.5c1.8.4 3 1.3 3.4 2.8" stroke="#E4572E" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <ellipse cx="18.5" cy="23.9" rx="2.4" ry="1.9" fill="#E4572E" transform="rotate(-18 18.5 23.9)" />
        </g>
      )}

      {variant === 'videos' && (
        <g>
          <rect x="13.4" y="15.8" width="11.6" height="9" rx="1.8" fill="#7C5CF0" />
          <path d="M18.2 18.2v4.2l3.9-2.1z" fill="#FFFFFF" />
        </g>
      )}

      {children}
    </svg>
  )
}

export function FolderColor({ variant = 'plain' }: { variant?: FolderVariant }): ReactElement {
  return <Folder variant={variant} />
}

export function DesktopIcon(): ReactElement {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="color-icon" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`mon${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FC5FF" />
          <stop offset="1" stopColor="#3E7BDB" />
        </linearGradient>
      </defs>
      <rect x="2.6" y="5.6" width="26.8" height="17.2" rx="2.4" fill="#465A75" />
      <rect x="4.4" y="7.4" width="23.2" height="13.6" rx="1.4" fill={`url(#mon${uid})`} />
      <path d="M7 9.6h6.4v4.2H7z" fill="#FFFFFF" fillOpacity=".85" />
      <path d="M7.7 17.4h17.6v2.6H7.7z" fill="#FFFFFF" fillOpacity=".35" />
      <path d="M13 23.2h6l.7 3.2h-7.4z" fill="#465A75" />
      <rect x="10.6" y="26.2" width="10.8" height="1.9" rx=".95" fill="#465A75" />
    </svg>
  )
}

export function HomeIcon(): ReactElement {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="color-icon" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`roof${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#69A9FF" />
          <stop offset="1" stopColor="#2F6BD8" />
        </linearGradient>
      </defs>
      <path d="M16 3.6L2.8 14.4h4.1v12.9h18.2V14.4h4.1z" fill={`url(#roof${uid})`} />
      <path d="M8.6 13.6h14.8v13h-14.8z" fill="#F4F7FC" />
      <path d="M12.9 18.6h6.2v8h-6.2z" fill="#8B5E3C" />
      <circle cx="17.9" cy="22.6" r=".8" fill="#FFD37A" />
      <path d="M16 3.6L2.8 14.4h4.1L16 7.5l9.1 6.9h4.1z" fill="#FFFFFF" fillOpacity=".28" />
    </svg>
  )
}

export function GalleryIcon(): ReactElement {
  return (
    <svg className="color-icon" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="7" width="19" height="14" rx="2" fill="#F5B32B" transform="rotate(-6 12.5 14)" />
      <rect x="8" y="9.5" width="21" height="15.5" rx="2" fill="#FFFFFF" stroke="#C9D4E4" />
      <path d="M9 22.5l6.2-6.4 4 4.2 2.8-3 5 5.2v.4a1.4 1.4 0 0 1-1.4 1.4H10.4A1.4 1.4 0 0 1 9 22.5z" fill="#5DBB63" />
      <circle cx="23.4" cy="14.4" r="2.1" fill="#FFC53D" />
    </svg>
  )
}

export function ThisPcIcon(): ReactElement {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className="color-icon" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`pc${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7FB8FF" />
          <stop offset="1" stopColor="#3568C9" />
        </linearGradient>
      </defs>
      <rect x="2.4" y="5" width="27.2" height="18" rx="2.6" fill="#465A75" />
      <rect x="4.2" y="6.8" width="23.6" height="14.4" rx="1.5" fill={`url(#pc${uid})`} />
      <rect x="8" y="10.4" width="16" height="7.4" rx="2.4" fill="#FFFFFF" fillOpacity=".92" />
      <rect x="9.4" y="11.8" width="13.2" height="3.1" rx="1.55" fill="#7EA6E8" />
      <circle cx="10.9" cy="16.2" r=".85" fill="#38C172" />
      <path d="M13.4 23h5.2l.7 3.4h-6.6z" fill="#465A75" />
      <rect x="10.4" y="26.1" width="11.2" height="2" rx="1" fill="#465A75" />
    </svg>
  )
}

export function DriveIcon(): ReactElement {
  return (
    <svg className="color-icon" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2.8" y="7.4" width="26.4" height="17.2" rx="3" fill="#DDE5F1" stroke="#B7C4D6" />
      <rect x="2.8" y="16.8" width="26.4" height="7.8" rx="3" fill="#C3D0E2" />
      <circle cx="24.6" cy="20.7" r="1.4" fill="#38C172" />
      <rect x="6.4" y="12.2" width="12.8" height="2.4" rx="1.2" fill="#9FB2CB" />
      <rect x="6.4" y="16.4" width="7.2" height="1.8" rx=".9" fill="#B7C4D6" />
    </svg>
  )
}

export function NetworkIcon(): ReactElement {
  return (
    <svg className="color-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="#2F7BE0" />
      <path d="M4 16h24M16 4c3.4 3.6 5.2 7.6 5.2 12S19.4 24.4 16 28c-3.4-3.6-5.2-7.6-5.2-12S12.6 7.6 16 4z" fill="none" stroke="#FFFFFF" strokeWidth="1.4" strokeOpacity=".85" />
      <ellipse cx="16" cy="16" rx="7.6" ry="12" fill="none" stroke="#FFFFFF" strokeWidth="1.1" strokeOpacity=".55" />
      <path d="M4.6 11.6h22.8M4.6 20.4h22.8" stroke="#FFFFFF" strokeWidth="1" strokeOpacity=".5" />
    </svg>
  )
}

export function DiscIcon(): ReactElement {
  return (
    <svg className="color-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="#CBD7E7" stroke="#A9B8CC" />
      <path d="M16 3a13 13 0 0 1 10.4 5.2l-7.2 4.4A5.4 5.4 0 0 0 16 10.6z" fill="#9FD3F5" />
      <path d="M27.8 12.6A13 13 0 0 1 16 29l-.1-8.4a5.4 5.4 0 0 0 5.6-3.6z" fill="#E7C7F2" opacity=".75" />
      <circle cx="16" cy="16" r="5.6" fill="#EFF3F9" stroke="#A9B8CC" />
      <circle cx="16" cy="16" r="2.4" fill="#DCE5F1" stroke="#C3D0E2" />
    </svg>
  )
}

export function UsbIcon(): ReactElement {
  return (
    <svg className="color-icon" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="8" width="26" height="16" rx="3" fill="#E3EAF4" stroke="#B7C4D6" />
      <rect x="12" y="10.5" width="12" height="11" rx="1.6" fill="#FFFFFF" stroke="#C9D4E4" />
      <path d="M18 12.6v5.2M18 12.6l-1.8 1.8M18 12.6l1.8 1.8" stroke="#2F7BE0" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="18" cy="18.6" r="1.2" fill="#2F7BE0" />
    </svg>
  )
}

export function OneDriveIcon(): ReactElement {
  return (
    <svg className="color-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9.4 23.6a5.5 5.5 0 0 1-.5-11 7.4 7.4 0 0 1 13.9-2.1 5.6 5.6 0 0 1 1.6 11.1z" fill="#2F7BE0" />
      <path d="M9.6 21.9a4 4 0 0 1-.4-8 6.2 6.2 0 0 1 11.8-1.8" fill="none" stroke="#63A6FF" strokeWidth="1.2" />
    </svg>
  )
}

export function folderVariantForPath(path: string): FolderVariant {
  const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop()?.toLowerCase() ?? ''
  if (name === 'documents' || name === 'mes documents') return 'documents'
  if (name === 'downloads' || name === 'téléchargements') return 'downloads'
  if (name === 'pictures' || name === 'images') return 'pictures'
  if (name === 'music' || name === 'musique') return 'music'
  if (name === 'videos' || name === 'vidéos') return 'videos'
  return 'plain'
}
