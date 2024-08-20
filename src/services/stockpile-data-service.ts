import path from 'node:path'
import { Collection } from 'discord.js'
import {
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

  constructor() {
    this.updateLocationsManifest()
  }

  public async updateLocationsManifest(manual = false): Promise<void> {
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
        const name = mapTextItems
          .filter((item) => item.hex === mapItem.hex)
          .sort((a, z) => {
            const distanceA = this.getDistance(a, mapItem)
            const distanceZ = this.getDistance(z, mapItem)
            return distanceA - distanceZ
          })
          .at(0)?.text as string
        const storageType = mapItem.iconType === 33 ? 'Storage Depot' : 'Seaport'

        return { name, storageType }
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

  public async getStockpileLocations() {
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

  public async addStockpile(guildId: string | null, location: string, code?: string) {
    await this.stockpilesByGuildIdDb.read()

    if (!guildId || !code) return
    const hex = location.split(':')[0]
    const locationName = location.split(':')[1].split(' - ')[0].trim()
    const storageType = location.split(':')[1].split(' - ')[1] as StorageType
    const stockpile = { name: locationName, storageType, code }

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

  public async changeStockpileCode() {}

  public async removeStockpile() {}

  private getDistance(point1: { x: number; y: number }, point2: { x: number; y: number }) {
    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2))
  }

  private sanitizeMapName(mapName: string): string {
    return mapName === 'MarbanHollow'
      ? mapName.replace(/([a-z])([A-Z])/g, '$1 $2')
      : mapName.slice(0, -3).replace(/([a-z])([A-Z])/g, '$1 $2')
  }
}
