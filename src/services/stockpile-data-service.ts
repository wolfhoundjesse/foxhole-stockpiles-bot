import { dirname } from '@discordx/importer'
import { differenceInMinutes } from 'date-fns'
import { Discord } from 'discordx'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import type {
  FactionsByGuildId,
  FactionType,
  LocationsManifest,
  MapItem,
  MapTextItem,
  Stockpile,
  StockpilesByGuildId,
  StorageLocation,
  StorageLocationsByRegion,
  StorageType,
} from '../models'
import { Faction } from '../models'

type EmbedsByGuildId = {
  [guildId: string]: {
    channelId: string
    embeddedMessageId: string
  }
}

@Discord()
export class StockpileDataService {
  private mapNamesUrl = 'https://war-service-live.foxholeservices.com/api/worldconquest/maps'
  private dynamicMapUrl = (map: string) =>
    `https://war-service-live.foxholeservices.com/api/worldconquest/maps/${map}/dynamic/public`
  private staticMapUrl = (map: string) =>
    `https://war-service-live.foxholeservices.com/api/worldconquest/maps/${map}/static`
  private warDataUrl = 'https://war-service-live.foxholeservices.com/api/worldconquest/war'

  private readonly defaultLocationsManifestData: LocationsManifest = {
    warNumber: 0,
    updatedAt: '',
    COLONIALS: {},
    WARDENS: {},
  }
  private readonly locationsManifestAdapter = new JSONFile<LocationsManifest>(
    path.join(dirname(import.meta.url), '..', '..', 'data', 'locations-manifest.json'),
  )
  private readonly locationsManifestDb = new Low<LocationsManifest>(
    this.locationsManifestAdapter,
    this.defaultLocationsManifestData,
  )
  private readonly defaultStockpilesByGuildId: StockpilesByGuildId = {}
  private readonly stockpilesByGuildIdAdapter = new JSONFile<StockpilesByGuildId>(
    path.join(dirname(import.meta.url), '..', '..', 'data', 'stockpiles-by-guild-id.json'),
  )
  private readonly stockpilesByGuildIdDb = new Low<StockpilesByGuildId>(
    this.stockpilesByGuildIdAdapter,
    this.defaultStockpilesByGuildId,
  )
  private readonly embedsByGuildIdAdapter = new JSONFile<EmbedsByGuildId>(
    path.join(dirname(import.meta.url), '..', '..', 'data', 'embeds-by-guild-id.json'),
  )
  private readonly embedsByGuildIdDb = new Low<EmbedsByGuildId>(this.embedsByGuildIdAdapter, {})

  private readonly factionsByGuildIdAdapter = new JSONFile<FactionsByGuildId>(
    path.join(dirname(import.meta.url), '..', '..', 'data', 'factions-by-guild-id.json'),
  )
  private readonly factionsByGuildIdDb = new Low<FactionsByGuildId>(
    this.factionsByGuildIdAdapter,
    {},
  )

  constructor() {
    this.updateLocationsManifest()
  }

  public async updateLocationsManifest(manual = false): Promise<void> {
    await this.locationsManifestDb.read()
    const lastUpdate = new Date(this.locationsManifestDb.data?.updatedAt || 0)
    if (!manual && differenceInMinutes(new Date(), lastUpdate) < 15) return
    if (manual && differenceInMinutes(new Date(), lastUpdate) < 1) return
    let colonialStorageLocations = {} as StorageLocationsByRegion
    let wardenStorageLocations = {} as StorageLocationsByRegion
    const response = await fetch(this.mapNamesUrl)
    const mapNames = await response.json()

    let mapTextItems: MapTextItem[] = []
    let colonialMapItems: (MapItem & { hex: string })[] = []
    let wardenMapItems: (MapItem & { hex: string })[] = []
    // Helper function to fetch and parse JSON
    const fetchJson = async (url: string) => {
      const response = await fetch(url)
      return response.json()
    }

    const warData = await fetchJson(this.warDataUrl)

    for (const mapName of mapNames) {
      const hex = this.sanitizeMapName(mapName)

      // Fetch static and dynamic maps in parallel
      const [staticMap, dynamicMap] = await Promise.all([
        fetchJson(this.staticMapUrl(mapName)),
        fetchJson(this.dynamicMapUrl(mapName)),
      ])

      // Process static map items
      const staticMapTextItems = staticMap.mapTextItems.map((item: MapTextItem) => ({
        ...item,
        hex,
      }))
      mapTextItems.push(...staticMapTextItems)

      // Process colonial dynamic map items
      const colonialDynamicMapItems = dynamicMap.mapItems
        .filter(
          (item: MapItem) =>
            item.teamId === Faction.Colonials && (item.iconType === 33 || item.iconType === 52),
        )
        .map((item: MapItem) => ({
          ...item,
          hex,
        }))
      colonialMapItems.push(...colonialDynamicMapItems)

      // Process warden dynamic map items
      const wardenDynamicMapItems = dynamicMap.mapItems
        .filter(
          (item: MapItem) =>
            item.teamId === Faction.Wardens && (item.iconType === 33 || item.iconType === 52),
        )
        .map((item: MapItem) => ({
          ...item,
          hex,
        }))
      wardenMapItems.push(...wardenDynamicMapItems)

      // Process colonial named locations
      const colonialNamedLocations: StorageLocation[] = colonialDynamicMapItems.map(
        (mapItem: MapItem) => {
          const locationName = mapTextItems
            .filter((item) => item.hex === mapItem.hex)
            .sort((a, z) => {
              const distanceA = this.getDistance(a, mapItem)
              const distanceZ = this.getDistance(z, mapItem)
              return distanceA - distanceZ
            })
            .at(0)?.text as string
          const storageType = mapItem.iconType === 33 ? 'Storage Depot' : 'Seaport'

          return { locationName, storageType }
        },
      )

      if (colonialNamedLocations.length > 0) {
        colonialStorageLocations[hex] = colonialNamedLocations
      }

      const wardenNamedLocations: StorageLocation[] = wardenDynamicMapItems.map(
        (mapItem: MapItem) => {
          const locationName = mapTextItems
            .filter((item) => item.hex === mapItem.hex)
            .sort((a, z) => {
              const distanceA = this.getDistance(a, mapItem)
              const distanceZ = this.getDistance(z, mapItem)
              return distanceA - distanceZ
            })
            .at(0)?.text as string
          const storageType = mapItem.iconType === 33 ? 'Storage Depot' : 'Seaport'

          return { locationName, storageType }
        },
      )

      if (wardenNamedLocations.length > 0) {
        wardenStorageLocations[hex] = wardenNamedLocations
      }
    }

    colonialStorageLocations = Object.fromEntries(
      Object.entries(colonialStorageLocations).sort(([a], [b]) => a.localeCompare(b)),
    )
    wardenStorageLocations = Object.fromEntries(
      Object.entries(wardenStorageLocations).sort(([a], [b]) => a.localeCompare(b)),
    )

    this.locationsManifestDb.data = {
      warNumber: warData.warNumber,
      updatedAt: new Date().toISOString(),
      COLONIALS: colonialStorageLocations,
      WARDENS: wardenStorageLocations,
    }
    await this.locationsManifestDb.write()
  }

  public async setFactionByGuildId(guildId: string, faction: FactionType) {
    await this.factionsByGuildIdDb.read()
    const factionsByGuildId = this.factionsByGuildIdDb.data
    factionsByGuildId[guildId] = faction
    this.factionsByGuildIdDb.data = factionsByGuildId
    await this.factionsByGuildIdDb.write()
    return
  }

  public async getFactionByGuildId(guildId: string) {
    await this.factionsByGuildIdDb.read()
    const factionsByGuildId = this.factionsByGuildIdDb.data
    return factionsByGuildId[guildId] || Faction.None
  }

  public async getWarNumber() {
    await this.locationsManifestDb.read()
    return this.locationsManifestDb.data?.warNumber || 0
  }

  public async getStorageLocationsByRegion(
    faction: Exclude<FactionType, 'NONE'>,
  ): Promise<StorageLocationsByRegion> {
    await this.locationsManifestDb.read()
    if (!this.locationsManifestDb.data) {
      await this.updateLocationsManifest()
    }
    return this.locationsManifestDb.data[faction]
  }

  public async broadcastManifestChanges() {}

  public async getStockpilesByGuildId(guildId: string | null) {
    if (!guildId) return {}
    await this.stockpilesByGuildIdDb.read()
    const stockpilesByGuildId = this.stockpilesByGuildIdDb.data
    if (!stockpilesByGuildId) return {}
    if (!stockpilesByGuildId[guildId]) return {}

    return stockpilesByGuildId[guildId]
  }

  private async isDuplicateStockpile(
    guildId: string,
    hex: string,
    locationName: string,
    stockpileName: string,
    excludeId?: string,
  ): Promise<boolean> {
    await this.stockpilesByGuildIdDb.read()
    const stockpilesByGuildId = this.stockpilesByGuildIdDb.data

    if (!stockpilesByGuildId[guildId] || !stockpilesByGuildId[guildId][hex]) {
      return false
    }

    return stockpilesByGuildId[guildId][hex].some(
      (stockpile) =>
        stockpile.locationName === locationName &&
        stockpile.stockpileName === stockpileName &&
        stockpile.id !== excludeId,
    )
  }

  public async addStockpile(
    guildId: string | null,
    location: string,
    code: string,
    stockpileName: string,
    createdBy: string,
  ): Promise<boolean> {
    await this.stockpilesByGuildIdDb.read()

    if (!guildId || !code) return false
    const hex = location.split(':')[0]
    const locationName = location.split(':')[1].split(' - ')[0].trim()
    const storageType = location.split(':')[1].split(' - ')[1] as StorageType

    // Check for duplicate stockpile
    const isDuplicate = await this.isDuplicateStockpile(guildId, hex, locationName, stockpileName)
    if (isDuplicate) {
      return false // Indicate that a duplicate was found
    }

    const stockpile = {
      id: uuidv4(),
      locationName,
      code,
      stockpileName,
      storageType,
      createdBy,
      createdAt: new Date().toISOString(),
    }

    const stockpilesByGuildId = this.stockpilesByGuildIdDb.data
    if (!stockpilesByGuildId) {
      this.stockpilesByGuildIdDb.data = {
        [guildId]: { [hex]: [stockpile] },
      }
      await this.stockpilesByGuildIdDb.write()
      return true // Indicate successful addition
    }

    const stockpilesByRegion = stockpilesByGuildId[guildId]

    if (!stockpilesByRegion) {
      stockpilesByGuildId[guildId] = { [hex]: [stockpile] }
      this.stockpilesByGuildIdDb.data = stockpilesByGuildId
      await this.stockpilesByGuildIdDb.write()
      return true // Indicate successful addition
    }

    const stockpiles = stockpilesByRegion[hex]

    if (!stockpiles) {
      stockpilesByRegion[hex] = [stockpile]
      stockpilesByGuildId[guildId] = stockpilesByRegion
      this.stockpilesByGuildIdDb.data = stockpilesByGuildId
      await this.stockpilesByGuildIdDb.write()
      return true // Indicate successful addition
    }

    stockpiles.push(stockpile)
    stockpilesByRegion[hex] = stockpiles
    stockpilesByGuildId[guildId] = stockpilesByRegion
    this.stockpilesByGuildIdDb.data = stockpilesByGuildId
    await this.stockpilesByGuildIdDb.write()
    return true // Indicate successful addition
  }

  public async getStockpileById(guildId: string, hex: string, stockpileId: string) {
    await this.stockpilesByGuildIdDb.read()
    const stockpilesByGuildId = this.stockpilesByGuildIdDb.data
    return stockpilesByGuildId[guildId][hex].find(
      (stockpile) => stockpile.id === stockpileId,
    ) as Stockpile
  }

  public async editStockpile(
    guildId: string | null,
    hex: string,
    id: string,
    code: string,
    stockpileName: string,
    createdBy: string,
  ): Promise<boolean> {
    await this.stockpilesByGuildIdDb.read()
    const stockpilesByGuildId = this.stockpilesByGuildIdDb.data
    if (!guildId || !code) return false

    const currentStockpile = stockpilesByGuildId[guildId][hex].find(
      (stockpile) => stockpile.id === id,
    ) as Stockpile

    // Check for duplicate stockpile, excluding the current stockpile being edited
    const isDuplicate = await this.isDuplicateStockpile(
      guildId,
      hex,
      currentStockpile.locationName,
      stockpileName,
      id,
    )
    if (isDuplicate) {
      return false // Indicate that a duplicate was found
    }

    const updatedStockpile = {
      ...currentStockpile,
      code,
      stockpileName,
      updatedBy: createdBy,
      updatedAt: new Date().toISOString(),
    }

    // update the stockpile in the stockpilesByGuildId
    stockpilesByGuildId[guildId][hex] = stockpilesByGuildId[guildId][hex].map((stockpile) =>
      stockpile.id === id ? updatedStockpile : stockpile,
    )
    this.stockpilesByGuildIdDb.data = stockpilesByGuildId
    await this.stockpilesByGuildIdDb.write()
    return true // Indicate successful edit
  }

  public async deleteStockpile(
    guildId: string,
    id: string,
  ): Promise<{ deletedStockpile: Stockpile | null; deletedFromHex: string }> {
    await this.stockpilesByGuildIdDb.read()
    const stockpilesByGuildId = this.stockpilesByGuildIdDb.data

    let deletedStockpile: Stockpile | null = null
    let deletedFromHex = ''

    Object.keys(stockpilesByGuildId[guildId]).forEach((hex) => {
      const filteredStockpiles = stockpilesByGuildId[guildId][hex].filter(
        (stockpile) => stockpile.id !== id,
      )

      if (filteredStockpiles.length < stockpilesByGuildId[guildId][hex].length) {
        deletedStockpile = stockpilesByGuildId[guildId][hex].find((s) => s.id === id) || null
        deletedFromHex = hex

        if (filteredStockpiles.length === 0) {
          // If the region is now empty, remove it
          delete stockpilesByGuildId[guildId][hex]
        } else {
          stockpilesByGuildId[guildId][hex] = filteredStockpiles
        }
      }
    })

    this.stockpilesByGuildIdDb.data = stockpilesByGuildId
    await this.stockpilesByGuildIdDb.write()

    return { deletedStockpile, deletedFromHex }
  }

  private getDistance(point1: { x: number; y: number }, point2: { x: number; y: number }) {
    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2))
  }

  private sanitizeMapName(mapName: string): string {
    return mapName === 'MarbanHollow'
      ? mapName.replace(/([a-z])([A-Z])/g, '$1 $2')
      : mapName.slice(0, -3).replace(/([a-z])([A-Z])/g, '$1 $2')
  }

  public async saveEmbeddedMessageId(
    guildId: string,
    channelId: string,
    embeddedMessageId: string,
  ) {
    await this.embedsByGuildIdDb.read()
    const embedsByGuildId = this.embedsByGuildIdDb.data
    embedsByGuildId[guildId] = { channelId, embeddedMessageId }
    this.embedsByGuildIdDb.data = embedsByGuildId
    await this.embedsByGuildIdDb.write()
    return
  }

  public async getEmbedsByGuildId(guildId: string) {
    await this.embedsByGuildIdDb.read()
    const embedsByGuildId = this.embedsByGuildIdDb.data
    return embedsByGuildId[guildId] || {}
  }
}
