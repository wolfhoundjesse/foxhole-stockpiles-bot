import path from 'node:path'
import { Collection } from 'discord.js'
import type {
  Stockpile,
  MapTextItem,
  MapItem,
  StorageLocation,
  StorageType,
  LocationsManifest,
  StockpilesByGuildId,
  StorageLocationsByRegion,
} from '../models'
import { Discord } from 'discordx'
import { dirname, importx } from '@discordx/importer'
import { Low } from 'lowdb'
import { JSONFile, JSONFilePreset } from 'lowdb/node'
import { differenceInMinutes } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'

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

  private readonly defaultManifestData: LocationsManifest = {
    updatedAt: '',
    storageLocationsByRegion: {},
  }
  private readonly manifestAdapter = new JSONFile<LocationsManifest>(
    path.join(dirname(import.meta.url), '..', '..', 'data', 'locations-manifest.json'),
  )
  private readonly manifestDb = new Low<LocationsManifest>(
    this.manifestAdapter,
    this.defaultManifestData,
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

  constructor() {
    this.updateLocationsManifest()
  }

  public async updateLocationsManifest(manual = false): Promise<void> {
    // this.stockpilesByGuildIdDb.data = {}
    // await this.stockpilesByGuildIdDb.write()
    await this.manifestDb.read()
    const lastUpdate = new Date(this.manifestDb.data?.updatedAt || 0)
    if (!manual && differenceInMinutes(new Date(), lastUpdate) < 15) return
    if (manual && differenceInMinutes(new Date(), lastUpdate) < 1) return
    let storageLocations = {} as StorageLocationsByRegion
    const response = await fetch(this.mapNamesUrl)
    const mapNames = await response.json()

    let mapTextItems: MapTextItem[] = []
    let mapItems: (MapItem & { hex: string })[] = []

    // Helper function to fetch and parse JSON
    const fetchJson = async (url: string) => {
      const response = await fetch(url)
      return response.json()
    }

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

      // Process dynamic map items
      const filteredDynamicMapItems = dynamicMap.mapItems
        .filter(
          (item: MapItem) =>
            item.teamId === 'WARDENS' && (item.iconType === 33 || item.iconType === 52),
        )
        .map((item: MapItem) => ({
          ...item,
          hex,
        }))
      mapItems.push(...filteredDynamicMapItems)

      // Process named locations
      const namedLocations: StorageLocation[] = filteredDynamicMapItems.map((mapItem: MapItem) => {
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
      })

      if (namedLocations.length > 0) {
        storageLocations[hex] = namedLocations
      }
    }

    storageLocations = Object.fromEntries(
      Object.entries(storageLocations).sort(([a], [b]) => a.localeCompare(b)),
    )

    this.manifestDb.data = {
      updatedAt: new Date().toISOString(),
      storageLocationsByRegion: storageLocations,
    }
    await this.manifestDb.write()
  }

  public async getStorageLocationsByRegion() {
    this.manifestDb.read()
    if (!this.manifestDb.data?.storageLocationsByRegion) {
      await this.updateLocationsManifest()
    }
    return this.manifestDb.data?.storageLocationsByRegion
  }

  public async broadcastManifestChanges() {}

  public async getStockpilesByGuildId(guildId: string | null) {
    if (!guildId) return
    await this.stockpilesByGuildIdDb.read()
    const stockpilesByGuildId = this.stockpilesByGuildIdDb.data
    if (!stockpilesByGuildId) return
    if (!stockpilesByGuildId[guildId]) return

    return stockpilesByGuildId[guildId]
  }

  public async addStockpile(
    guildId: string | null,
    location: string,
    code: string,
    stockpileName: string,
    createdBy: string,
  ) {
    await this.stockpilesByGuildIdDb.read()

    if (!guildId || !code) return
    const hex = location.split(':')[0]
    const locationName = location.split(':')[1].split(' - ')[0].trim()
    const storageType = location.split(':')[1].split(' - ')[1] as StorageType
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
      this.stockpilesByGuildIdDb.write()
      return
    }

    const stockpilesByRegion = stockpilesByGuildId[guildId]

    if (!stockpilesByRegion) {
      stockpilesByGuildId[guildId] = { [hex]: [stockpile] }
      this.stockpilesByGuildIdDb.data = stockpilesByGuildId
      this.stockpilesByGuildIdDb.write()
      return
    }

    const stockpiles = stockpilesByRegion[hex]

    if (!stockpiles) {
      stockpilesByRegion[hex] = [stockpile]
      stockpilesByGuildId[guildId] = stockpilesByRegion
      this.stockpilesByGuildIdDb.data = stockpilesByGuildId
      this.stockpilesByGuildIdDb.write()
      return
    }

    stockpiles.push(stockpile)
    stockpilesByRegion[hex] = stockpiles
    stockpilesByGuildId[guildId] = stockpilesByRegion
    this.stockpilesByGuildIdDb.data = stockpilesByGuildId
    this.stockpilesByGuildIdDb.write()
    return
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
    stockpileId = process.env.DEFAULT_STOCKPILE_NAME,
    createdBy: string,
  ) {
    await this.stockpilesByGuildIdDb.read()
    const stockpilesByGuildId = this.stockpilesByGuildIdDb.data
    if (!guildId || !code) return

    const currentStockpile = stockpilesByGuildId[guildId][hex].find(
      (stockpile) => stockpile.id === id,
    ) as Stockpile

    const updatedStockpile = {
      ...currentStockpile,
      code,
      stockpileId,
      updatedBy: createdBy,
      updatedAt: new Date().toISOString(),
    }

    // update the stockpile in the stockpilesByGuildId
    stockpilesByGuildId[guildId][hex] = stockpilesByGuildId[guildId][hex].map((stockpile) =>
      stockpile.id === id ? updatedStockpile : stockpile,
    )
    this.stockpilesByGuildIdDb.data = stockpilesByGuildId
    this.stockpilesByGuildIdDb.write()
    return
  }

  public async deleteStockpile(guildId: string, id: string) {
    await this.stockpilesByGuildIdDb.read()
    const stockpilesByGuildId = this.stockpilesByGuildIdDb.data
    Object.keys(stockpilesByGuildId).forEach((guildId) => {
      Object.keys(stockpilesByGuildId[guildId]).forEach((hex) => {
        stockpilesByGuildId[guildId][hex] = stockpilesByGuildId[guildId][hex].filter(
          (stockpile) => stockpile.id !== id,
        )
      })
    })
    this.stockpilesByGuildIdDb.data = stockpilesByGuildId
    this.stockpilesByGuildIdDb.write()
    return
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
    this.embedsByGuildIdDb.write()
    return
  }

  public async getEmbeddedMessageId(guildId: string) {
    await this.embedsByGuildIdDb.read()
    const embedsByGuildId = this.embedsByGuildIdDb.data
    return embedsByGuildId[guildId]
  }
}
