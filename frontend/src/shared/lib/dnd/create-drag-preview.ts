type CreateDragPreviewParams = {
  title: string
  count: number
  subtitle: string
}

type DragPreview = {
  element: HTMLDivElement
  cleanup: () => void
}

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1)}...`
}

export const createDragPreview = ({
  title,
  count,
  subtitle,
}: CreateDragPreviewParams): DragPreview | null => {
  if (typeof document === 'undefined') {
    return null
  }

  const isDarkTheme = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark'

  const palette = isDarkTheme
    ? {
        border: '#32445a',
        background: 'linear-gradient(180deg, #182335 0%, #131d2e 100%)',
        shadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
        badgeBackground: '#2f6fed',
        badgeText: '#ffffff',
        title: '#e4ebf6',
        subtitle: '#a4b3c8',
      }
    : {
        border: '#cbd5e1',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        shadow: '0 12px 28px rgba(15, 23, 42, 0.2)',
        badgeBackground: '#2f6fed',
        badgeText: '#ffffff',
        title: '#0f172a',
        subtitle: '#475569',
      }

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '-9999px'
  container.style.pointerEvents = 'none'
  container.style.zIndex = '2147483647'
  container.style.display = 'flex'
  container.style.alignItems = 'center'
  container.style.gap = '10px'
  container.style.padding = '8px 10px'
  container.style.borderRadius = '12px'
  container.style.border = `1px solid ${palette.border}`
  container.style.background = palette.background
  container.style.boxShadow = palette.shadow
  container.style.minWidth = '220px'
  container.style.maxWidth = '320px'
  container.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

  const badge = document.createElement('span')
  badge.style.display = 'inline-flex'
  badge.style.alignItems = 'center'
  badge.style.justifyContent = 'center'
  badge.style.width = '22px'
  badge.style.height = '22px'
  badge.style.borderRadius = '999px'
  badge.style.backgroundColor = palette.badgeBackground
  badge.style.color = palette.badgeText
  badge.style.fontSize = '11px'
  badge.style.fontWeight = '700'
  badge.textContent = count > 99 ? '99+' : String(Math.max(1, count))

  const textWrap = document.createElement('div')
  textWrap.style.display = 'flex'
  textWrap.style.flexDirection = 'column'
  textWrap.style.minWidth = '0'
  textWrap.style.gap = '2px'

  const titleNode = document.createElement('span')
  titleNode.style.fontSize = '13px'
  titleNode.style.fontWeight = '600'
  titleNode.style.color = palette.title
  titleNode.style.whiteSpace = 'nowrap'
  titleNode.style.overflow = 'hidden'
  titleNode.style.textOverflow = 'ellipsis'
  titleNode.textContent = truncate(title, 44)

  const subtitleNode = document.createElement('span')
  subtitleNode.style.fontSize = '11px'
  subtitleNode.style.color = palette.subtitle
  subtitleNode.textContent = subtitle

  textWrap.appendChild(titleNode)
  textWrap.appendChild(subtitleNode)
  container.appendChild(badge)
  container.appendChild(textWrap)

  document.body.appendChild(container)

  return {
    element: container,
    cleanup: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container)
      }
    },
  }
}
