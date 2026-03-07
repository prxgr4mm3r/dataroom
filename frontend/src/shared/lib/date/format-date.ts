const parseDate = (isoDate: string | null | undefined): Date | null => {
  if (!isoDate) {
    return null
  }

  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

export const formatDate = (isoDate: string | null | undefined): string => {
  const date = parseDate(isoDate)
  if (!date) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const formatDateCompact = (isoDate: string | null | undefined): string => {
  const date = parseDate(isoDate)
  if (!date) {
    return '-'
  }

  const monthDay = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
  }).format(date)

  const time = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return `${monthDay} ${time}`
}
