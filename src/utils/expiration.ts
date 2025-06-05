export function formatExpirationTime(expiresAt: string): string {
  const now = new Date()
  const expiration = new Date(expiresAt)
  const hoursRemaining = Math.max(0, (expiration.getTime() - now.getTime()) / (1000 * 60 * 60))

  if (hoursRemaining <= 0) {
    return 'EXPIRED'
  }

  const hours = Math.floor(hoursRemaining)
  const minutes = Math.floor((hoursRemaining - hours) * 60)
  return `${hours}h ${minutes}m remaining`
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
