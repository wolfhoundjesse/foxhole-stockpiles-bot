export type StorageLocation = {
  storageType: StorageType
  name: string
}

export type Stockpile = StorageLocation & {
  code: string
}

export type StorageType = 'Storage Depot' | 'Seaport'

export type StorageLocationsByRegion = { [region: string]: StorageLocation[] }

export type StockpilesByRegion = { [region: string]: Stockpile[] }

export type StockpilesByGuildId = {
  [guildId: string]: StockpilesByRegion
}
