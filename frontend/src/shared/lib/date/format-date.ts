export const formatDate = (isoDate: string | null | undefined): string => {
  if (!isoDate) {
    return '-'
  }
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
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
