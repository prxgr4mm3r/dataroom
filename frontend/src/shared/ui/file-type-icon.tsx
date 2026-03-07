import {
  IconDatabase,
  IconFile,
  IconFileCode,
  IconFileMusic,
  IconFileText,
  IconFileTypeCsv,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconFileTypePpt,
  IconFileTypeTxt,
  IconFileTypeXls,
  IconFileTypeXml,
  IconFileTypeZip,
  IconMarkdown,
  IconPhoto,
  IconVideo,
} from '@tabler/icons-react'

import type { FileTypeIconKey } from '@/shared/lib/file/file-type-presentation'

type FileTypeIconProps = {
  iconKey: FileTypeIconKey
  size?: number
  color?: string
}

export const FileTypeIcon = ({ iconKey, size = 16, color }: FileTypeIconProps) => {
  const resolvedColor = (() => {
    if (color) {
      return color
    }

    // Keep folder icons blue in the UI and shift file-type colors away from blue
    // so folders are visually distinct at a glance.
    if (iconKey === 'pdf') return '#d92d20'
    if (iconKey === 'word') return '#1d4ed8'
    if (iconKey === 'excel') return '#16a34a'
    if (iconKey === 'csv') return '#15803d'
    if (iconKey === 'powerpoint') return '#ea580c'
    if (iconKey === 'image') return '#16a34a'
    if (iconKey === 'video') return '#9333ea'
    if (iconKey === 'audio') return '#0d9488'
    if (iconKey === 'archive') return '#a16207'
    if (iconKey === 'json') return '#0f766e'
    if (iconKey === 'xml') return '#0ea5a4'
    if (iconKey === 'yaml') return '#b45309'
    if (iconKey === 'sql') return '#6d28d9'
    if (iconKey === 'code') return '#4c1d95'
    if (iconKey === 'text') return '#64748b'
    if (iconKey === 'markdown') return '#475569'

    return '#667085'
  })()

  if (iconKey === 'pdf') {
    return <IconFileTypePdf size={size} color={resolvedColor} />
  }
  if (iconKey === 'word') {
    return <IconFileTypeDocx size={size} color={resolvedColor} />
  }
  if (iconKey === 'excel') {
    return <IconFileTypeXls size={size} color={resolvedColor} />
  }
  if (iconKey === 'csv') {
    return <IconFileTypeCsv size={size} color={resolvedColor} />
  }
  if (iconKey === 'powerpoint') {
    return <IconFileTypePpt size={size} color={resolvedColor} />
  }
  if (iconKey === 'text') {
    return <IconFileTypeTxt size={size} color={resolvedColor} />
  }
  if (iconKey === 'markdown') {
    return <IconMarkdown size={size} color={resolvedColor} />
  }
  if (iconKey === 'image') {
    return <IconPhoto size={size} color={resolvedColor} />
  }
  if (iconKey === 'video') {
    return <IconVideo size={size} color={resolvedColor} />
  }
  if (iconKey === 'audio') {
    return <IconFileMusic size={size} color={resolvedColor} />
  }
  if (iconKey === 'archive') {
    return <IconFileTypeZip size={size} color={resolvedColor} />
  }
  if (iconKey === 'json') {
    return <IconFileCode size={size} color={resolvedColor} />
  }
  if (iconKey === 'xml') {
    return <IconFileTypeXml size={size} color={resolvedColor} />
  }
  if (iconKey === 'yaml') {
    return <IconFileText size={size} color={resolvedColor} />
  }
  if (iconKey === 'sql') {
    return <IconDatabase size={size} color={resolvedColor} />
  }
  if (iconKey === 'code') {
    return <IconFileCode size={size} color={resolvedColor} />
  }

  return <IconFile size={size} color={resolvedColor} />
}
