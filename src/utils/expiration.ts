export function formatExpirationTime(expiresAt: string): string {
  const now = new Date()
  const expiration = new Date(expiresAt)
  const hoursRemaining = Math.max(0, (expiration.getTime() - now.getTime()) / (1000 * 60 * 60))

  if (hoursRemaining <= 0) {
    return 'EXPIRED'
  }

  const days = Math.floor(hoursRemaining / 24)
  const hours = Math.floor(hoursRemaining % 24)
  const minutes = Math.floor((hoursRemaining - Math.floor(hoursRemaining)) * 60)

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)

  return parts.length > 0 ? `${parts.join(' ')} remaining` : 'Less than 1m remaining'
}

export function getExpirationStatus(expiresAt: string): string {
  const now = new Date()
  const expiration = new Date(expiresAt)
  const hoursRemaining = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hoursRemaining <= 0) {
    return '⚠️ **EXPIRED** - Please reset the timer or delete this stockpile'
  }

  if (hoursRemaining <= 8) {
    return `⚠️ **${formatExpirationTime(expiresAt)}** - Stockpile is running low on time!`
  }

  return `⏰ ${formatExpirationTime(expiresAt)}`
}

export function formatStockpileWithExpiration(stockpile: {
  locationName: string
  storageType: string
  stockpileName: string
  code: string
  expiresAt: string
}): string {
  const expirationStatus = getExpirationStatus(stockpile.expiresAt)
  return `${stockpile.locationName} - ${stockpile.storageType} - ${stockpile.stockpileName} - ${stockpile.code}\n${expirationStatus}`
}
