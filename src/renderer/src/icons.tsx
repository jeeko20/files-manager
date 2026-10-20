import type { ComponentType } from 'react'
import {
  AddRegular,
  AppGenericRegular,
  AppsListRegular,
  ArrowClockwiseRegular,
  ArrowDownloadRegular,
  ArrowLeftRegular,
  ArrowRightRegular,
  ArrowSortRegular,
  ArrowUpRegular,
  CheckmarkRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  ClipboardPasteRegular,
  CloudRegular,
  CodeRegular,
  CopyRegular,
  CutRegular,
  DeleteRegular,
  DesktopRegular,
  DesktopMacRegular,
  DismissRegular,
  DocumentCopyRegular,
  DocumentPdfRegular,
  DocumentRegular,
  DocumentTextRegular,
  EyeRegular,
  FolderOpenRegular,
  FolderRegular,
  FolderZipRegular,
  GlobeRegular,
  GridRegular,
  HardDriveRegular,
  HomeRegular,
  ImageMultipleRegular,
  ImageRegular,
  InfoRegular,
  ListRegular,
  MoreHorizontalRegular,
  MusicNote2Regular,
  OpenRegular,
  PinFilled,
  PinOffRegular,
  PinRegular,
  RenameRegular,
  SearchRegular,
  SettingsRegular,
  ShareRegular,
  StarRegular,
  TextBulletListLtrRegular,
  UsbPlugRegular,
  VideoRegular,
  WindowNewRegular
} from '@fluentui/react-icons'
import type { Entry } from '@shared/types'

export const G = {
  back: ArrowLeftRegular,
  forward: ArrowRightRegular,
  up: ArrowUpRegular,
  refresh: ArrowClockwiseRegular,
  search: SearchRegular,
  add: AddRegular,
  more: MoreHorizontalRegular,
  settings: SettingsRegular,
  cut: CutRegular,
  copy: CopyRegular,
  paste: ClipboardPasteRegular,
  rename: RenameRegular,
  delete: DeleteRegular,
  share: ShareRegular,
  sort: ArrowSortRegular,
  view: GridRegular,
  detailsView: AppsListRegular,
  listView: ListRegular,
  tableView: TextBulletListLtrRegular,
  preview: EyeRegular,
  info: InfoRegular,
  open: OpenRegular,
  pin: PinRegular,
  pinned: PinFilled,
  unpin: PinOffRegular,
  newWindow: WindowNewRegular,
  copyPath: DocumentCopyRegular,
  check: CheckmarkRegular,
  close: DismissRegular,
  chevronRight: ChevronRightRegular,
  chevronDown: ChevronDownRegular,
  home: HomeRegular,
  desktop: DesktopRegular,
  mac: DesktopMacRegular,
  download: ArrowDownloadRegular,
  cloud: CloudRegular,
  network: GlobeRegular,
  drive: HardDriveRegular,
  usb: UsbPlugRegular,
  folder: FolderRegular,
  folderOpen: FolderOpenRegular,
  zip: FolderZipRegular,
  image: ImageRegular,
  photos: ImageMultipleRegular,
  video: VideoRegular,
  audio: MusicNote2Regular,
  pdf: DocumentPdfRegular,
  document: DocumentRegular,
  text: DocumentTextRegular,
  code: CodeRegular,
  app: AppGenericRegular,
  star: StarRegular
} as const

const archiveExt = ['.zip', '.7z', '.rar', '.tar', '.gz', '.bz2', '.xz', '.iso']
const audioExt = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma', '.opus']
const videoExt = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.flv', '.m4v']
const imageExt = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg', '.avif', '.tif', '.tiff', '.heic']
const textExt = ['.txt', '.md', '.rtf', '.log', '.csv', '.json', '.yml', '.yaml', '.ini', '.cfg']
const codeExt = [
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.scss', '.html', '.xml', '.py', '.rb',
  '.go', '.rs', '.c', '.h', '.cpp', '.hpp', '.java', '.kt', '.cs', '.sh', '.ps1', '.bat', '.cmd',
  '.sql', '.toml', '.vue', '.svelte'
]
const appExt = ['.exe', '.msi', '.app', '.deb', '.rpm', '.appimage', '.dmg', '.pkg', '.apk']

export function entryGlyph(entry: Entry): ComponentType<{ className?: string }> {
  if (entry.isDir) return entry.isSymlink ? G.folderOpen : G.folder
  const ext = entry.ext
  if (ext === '.pdf') return G.pdf
  if (ext === '.doc' || ext === '.docx' || ext === '.odt') return G.text
  if (imageExt.includes(ext)) return G.image
  if (audioExt.includes(ext)) return G.audio
  if (videoExt.includes(ext)) return G.video
  if (archiveExt.includes(ext)) return G.zip
  if (appExt.includes(ext)) return G.app
  if (codeExt.includes(ext)) return G.code
  if (textExt.includes(ext)) return G.text
  return G.document
}

export function typeLabel(entry: Entry, folderWord: string, fileWord: string): string {
  if (entry.isDir) return folderWord
  const ext = entry.ext.replace('.', '').toUpperCase()
  if (!ext) return fileWord
  const known: Record<string, string> = {
    txt: 'Document texte',
    md: 'Document Markdown',
    pdf: 'Document PDF',
    jpg: 'Image JPEG',
    jpeg: 'Image JPEG',
    png: 'Image PNG',
    gif: 'Image GIF',
    svg: 'Image SVG',
    webp: 'Image WebP',
    mp4: 'Vidéo MP4',
    mkv: 'Vidéo MKV',
    mp3: 'Audio MP3',
    wav: 'Audio WAV',
    zip: 'Dossier compressé',
    rar: 'Archive RAR',
    '7z': 'Archive 7Z',
    exe: 'Application',
    msi: 'Programme d’installation',
    json: 'Fichier JSON',
    js: 'Fichier JavaScript',
    ts: 'Fichier TypeScript',
    html: 'Document HTML',
    css: 'Feuille de style',
    docx: 'Document Word',
    xlsx: 'Feuille de calcul Excel',
    pptx: 'Présentation PowerPoint'
  }
  return known[ext.toLowerCase()] || `Fichier ${ext}`
}
