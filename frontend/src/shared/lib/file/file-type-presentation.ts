import { splitFileName } from './split-file-name'

type KnownFileType = {
  label: string
  iconKey: FileTypeIconKey
}

export type FileTypeIconKey =
  | 'default'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'csv'
  | 'powerpoint'
  | 'text'
  | 'markdown'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'json'
  | 'xml'
  | 'yaml'
  | 'sql'
  | 'code'

export type FileTypePresentation = {
  extension: string | null
  label: string
  iconKey: FileTypeIconKey
}

const extensionToKnownType: Record<string, KnownFileType> = {
  pdf: { label: 'PDF Document', iconKey: 'pdf' },
  doc: { label: 'Word Document', iconKey: 'word' },
  docx: { label: 'Word Document', iconKey: 'word' },
  xls: { label: 'Excel Spreadsheet', iconKey: 'excel' },
  xlsx: { label: 'Excel Spreadsheet', iconKey: 'excel' },
  csv: { label: 'CSV File', iconKey: 'csv' },
  ppt: { label: 'PowerPoint Presentation', iconKey: 'powerpoint' },
  pptx: { label: 'PowerPoint Presentation', iconKey: 'powerpoint' },
  txt: { label: 'Text File', iconKey: 'text' },
  md: { label: 'Markdown File', iconKey: 'markdown' },
  rtf: { label: 'Rich Text Document', iconKey: 'text' },
  jpg: { label: 'Image File', iconKey: 'image' },
  jpeg: { label: 'Image File', iconKey: 'image' },
  png: { label: 'Image File', iconKey: 'image' },
  webp: { label: 'Image File', iconKey: 'image' },
  gif: { label: 'Image File', iconKey: 'image' },
  bmp: { label: 'Image File', iconKey: 'image' },
  svg: { label: 'Image File', iconKey: 'image' },
  tif: { label: 'Image File', iconKey: 'image' },
  tiff: { label: 'Image File', iconKey: 'image' },
  mp4: { label: 'Video File', iconKey: 'video' },
  mov: { label: 'Video File', iconKey: 'video' },
  avi: { label: 'Video File', iconKey: 'video' },
  mkv: { label: 'Video File', iconKey: 'video' },
  webm: { label: 'Video File', iconKey: 'video' },
  mp3: { label: 'Audio File', iconKey: 'audio' },
  wav: { label: 'Audio File', iconKey: 'audio' },
  ogg: { label: 'Audio File', iconKey: 'audio' },
  m4a: { label: 'Audio File', iconKey: 'audio' },
  flac: { label: 'Audio File', iconKey: 'audio' },
  aac: { label: 'Audio File', iconKey: 'audio' },
  zip: { label: 'Archive File', iconKey: 'archive' },
  rar: { label: 'Archive File', iconKey: 'archive' },
  '7z': { label: 'Archive File', iconKey: 'archive' },
  tar: { label: 'Archive File', iconKey: 'archive' },
  gz: { label: 'Archive File', iconKey: 'archive' },
  json: { label: 'JSON File', iconKey: 'json' },
  xml: { label: 'XML File', iconKey: 'xml' },
  yml: { label: 'YAML File', iconKey: 'yaml' },
  yaml: { label: 'YAML File', iconKey: 'yaml' },
  sql: { label: 'SQL Script', iconKey: 'sql' },
  js: { label: 'Source Code File', iconKey: 'code' },
  ts: { label: 'Source Code File', iconKey: 'code' },
  jsx: { label: 'Source Code File', iconKey: 'code' },
  tsx: { label: 'Source Code File', iconKey: 'code' },
  py: { label: 'Source Code File', iconKey: 'code' },
  java: { label: 'Source Code File', iconKey: 'code' },
  go: { label: 'Source Code File', iconKey: 'code' },
  rs: { label: 'Source Code File', iconKey: 'code' },
  php: { label: 'Source Code File', iconKey: 'code' },
  sh: { label: 'Source Code File', iconKey: 'code' },
  html: { label: 'Source Code File', iconKey: 'code' },
  css: { label: 'Source Code File', iconKey: 'code' },
}

const resolveByMimeType = (mimeType: string): KnownFileType | null => {
  const normalizedMime = mimeType.toLowerCase()

  if (normalizedMime === 'application/pdf') {
    return { label: 'PDF Document', iconKey: 'pdf' }
  }
  if (
    normalizedMime === 'application/msword' ||
    normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { label: 'Word Document', iconKey: 'word' }
  }
  if (
    normalizedMime === 'application/vnd.ms-excel' ||
    normalizedMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return { label: 'Excel Spreadsheet', iconKey: 'excel' }
  }
  if (normalizedMime === 'text/csv') {
    return { label: 'CSV File', iconKey: 'csv' }
  }
  if (
    normalizedMime === 'application/vnd.ms-powerpoint' ||
    normalizedMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return { label: 'PowerPoint Presentation', iconKey: 'powerpoint' }
  }
  if (normalizedMime.startsWith('image/')) {
    return { label: 'Image File', iconKey: 'image' }
  }
  if (normalizedMime.startsWith('video/')) {
    return { label: 'Video File', iconKey: 'video' }
  }
  if (normalizedMime.startsWith('audio/')) {
    return { label: 'Audio File', iconKey: 'audio' }
  }
  if (
    normalizedMime === 'application/zip' ||
    normalizedMime === 'application/x-zip-compressed' ||
    normalizedMime === 'application/x-rar-compressed' ||
    normalizedMime === 'application/x-7z-compressed' ||
    normalizedMime === 'application/x-tar' ||
    normalizedMime === 'application/gzip'
  ) {
    return { label: 'Archive File', iconKey: 'archive' }
  }
  if (normalizedMime === 'application/json' || normalizedMime.endsWith('+json')) {
    return { label: 'JSON File', iconKey: 'json' }
  }
  if (normalizedMime === 'application/xml' || normalizedMime === 'text/xml' || normalizedMime.endsWith('+xml')) {
    return { label: 'XML File', iconKey: 'xml' }
  }
  if (
    normalizedMime === 'application/yaml' ||
    normalizedMime === 'text/yaml' ||
    normalizedMime === 'application/x-yaml'
  ) {
    return { label: 'YAML File', iconKey: 'yaml' }
  }
  if (normalizedMime === 'application/sql' || normalizedMime === 'text/sql') {
    return { label: 'SQL Script', iconKey: 'sql' }
  }
  if (
    normalizedMime.startsWith('text/') ||
    normalizedMime.includes('javascript') ||
    normalizedMime.includes('typescript') ||
    normalizedMime.includes('python') ||
    normalizedMime.includes('java') ||
    normalizedMime.includes('php')
  ) {
    return { label: 'Source Code File', iconKey: 'code' }
  }

  return null
}

export const getFileTypePresentation = (fileName: string, mimeType: string | null | undefined): FileTypePresentation => {
  const { extension } = splitFileName(fileName)
  const normalizedExtension = extension ? extension.slice(1).toLowerCase() : null

  if (normalizedExtension && extensionToKnownType[normalizedExtension]) {
    const knownType = extensionToKnownType[normalizedExtension]
    return {
      extension: normalizedExtension,
      label: knownType.label,
      iconKey: knownType.iconKey,
    }
  }

  if (mimeType) {
    const knownByMimeType = resolveByMimeType(mimeType)
    if (knownByMimeType) {
      return {
        extension: normalizedExtension,
        label: knownByMimeType.label,
        iconKey: knownByMimeType.iconKey,
      }
    }
  }

  if (normalizedExtension) {
    return {
      extension: normalizedExtension,
      label: normalizedExtension,
      iconKey: 'default',
    }
  }

  return {
    extension: null,
    label: 'Text',
    iconKey: 'default',
  }
}
