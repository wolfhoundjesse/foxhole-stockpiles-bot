export type StorageLocation = {
  locationName: string
  storageType: StorageType
}

export type Stockpile = StorageLocation & {
  id: string
  code: string
  stockpileName: string
  createdBy: string // discord user id
  createdAt: string
  updatedBy?: string // discord user id
  updatedAt?: string
}

export type StorageType = 'Storage Depot' | 'Seaport'

export type StorageLocationsByRegion = { [region: string]: StorageLocation[] }

export type StockpilesByRegion = { [region: string]: Stockpile[] }

export type StockpilesByGuildId = {
  [guildId: string]: StockpilesByRegion
}
