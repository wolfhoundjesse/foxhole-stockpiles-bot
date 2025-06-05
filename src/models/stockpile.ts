export type StorageLocation = {
  locationName: string
  storageType: StorageType
}

export type Stockpile = {
  id: string
  guildId: string
  hex: string
  locationName: string
  code: string
  stockpileName: string
  storageType: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  expiresAt: string
  channelId: string
}

export type StorageType = 'Storage Depot' | 'Seaport'

export type StorageLocationsByRegion = { [region: string]: StorageLocation[] }

export type StockpilesByRegion = { [region: string]: Stockpile[] }

export type StockpilesByGuildId = {
  [guildId: string]: StockpilesByRegion
}
