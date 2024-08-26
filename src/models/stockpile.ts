export type StorageLocation = {
  storageType: StorageType
  name: string
}

export type Stockpile = StorageLocation & {
  code: string
  stockpileId: string
  createdBy: string // discord user id
  createdAt: string
}

export type StorageType = 'Storage Depot' | 'Seaport'

export type StorageLocationsByRegion = { [region: string]: StorageLocation[] }

export type StockpilesByRegion = { [region: string]: Stockpile[] }

export type StockpilesByGuildId = {
  [guildId: string]: StockpilesByRegion
}
