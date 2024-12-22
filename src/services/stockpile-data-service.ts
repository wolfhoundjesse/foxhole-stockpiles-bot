import { differenceInMinutes } from 'date-fns'
import { Discord } from 'discordx'
import { v4 as uuidv4 } from 'uuid'
import type {
  FactionType,
  MapItem,
  MapTextItem,
  Stockpile,
  StorageLocation,
  StorageLocationsByRegion,
  StorageType,
} from '../models'
import { Faction } from '../models'
import { JsonFileService } from './json-file-service'
import { PostgresService } from './postgres-service'
import { Logger } from '../utils/logger'

type EmbedsByGuildId = {
  [guildId: string]: {
    channelId: string
    embeddedMessageId: string
  }
}

/**
 * {
    "warId": "780e27e5-07e1-4885-8e5d-815aadf0d647",
    "warNumber": 117,
    "winner": "WARDENS",
    "conquestStartTime": 1726419602524,
    "conquestEndTime": 1730693991589,
    "resistanceStartTime": 1730694891615,
    "requiredVictoryTowns": 31
}
 */

@Discord()
export class StockpileDataService {
  private mapNamesUrl = 'https://war-service-live.foxholeservices.com/api/worldconquest/maps'
  private dynamicMapUrl = (map: string) =>
    `https://war-service-live.foxholeservices.com/api/worldconquest/maps/${map}/dynamic/public`
  private staticMapUrl = (map: string) =>
    `https://war-service-live.foxholeservices.com/api/worldconquest/maps/${map}/static`
  private warDataUrl = 'https://war-service-live.foxholeservices.com/api/worldconquest/war'

  // private readonly dataAccessService: JsonFileService
  private readonly dataAccessService: PostgresService

  constructor() {
    // this.dataAccessService = new JsonFileService()
    this.dataAccessService = new PostgresService()
    this.updateLocationsManifest()
  }

  public async updateLocationsManifest(manual = false): Promise<void> {
    Logger.debug('StockpileDataService', `Updating locations manifest (manual: ${manual})`)
    const manifest = await this.dataAccessService.getLocationsManifest()
    const lastUpdate = new Date(manifest?.updatedAt || 0)
    if (!manual && differenceInMinutes(new Date(), lastUpdate) < 15) {
      Logger.debug('StockpileDataService', 'Skipping update - within 15 minute cooldown')
      return
    }
    if (manual && differenceInMinutes(new Date(), lastUpdate) < 1) {
      Logger.debug('StockpileDataService', 'Skipping manual update - within 1 minute cooldown')
      return
    }
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

    await this.dataAccessService.saveLocationsManifest({
      isResistancePhase: warData?.winner?.length > 0 && warData?.resistanceStartTime > 0,
      warNumber: warData.warNumber,
      updatedAt: new Date().toISOString(),
      COLONIALS: colonialStorageLocations,
      WARDENS: wardenStorageLocations,
    })
    Logger.success('StockpileDataService', 'Successfully updated locations manifest')
  }

  public async setFactionByGuildId(guildId: string, faction: FactionType) {
    const factionsByGuildId = await this.dataAccessService.getFactionsByGuildId()
    factionsByGuildId[guildId] = faction
    await this.dataAccessService.saveFactionsByGuildId(factionsByGuildId)
  }

  public async getFactionByGuildId(guildId: string) {
    const factionsByGuildId = await this.dataAccessService.getFactionsByGuildId()
    return factionsByGuildId[guildId] || Faction.None
  }

  public async getWarNumber() {
    const manifest = await this.dataAccessService.getLocationsManifest()
    return manifest?.warNumber || 0
  }

  public async isResistancePhase() {
    const manifest = await this.dataAccessService.getLocationsManifest()
    return manifest?.isResistancePhase || false
  }

  public async getStorageLocationsByRegion(
    faction: Exclude<FactionType, 'NONE'>,
  ): Promise<StorageLocationsByRegion> {
    const manifest = await this.dataAccessService.getLocationsManifest()
    if (!manifest) {
      await this.updateLocationsManifest()
      // Get the manifest again after updating
      const updatedManifest = await this.dataAccessService.getLocationsManifest()
      if (!updatedManifest) {
        // If we still don't have a manifest, return an empty object
        return {}
      }
      return updatedManifest[faction]
    }
    return manifest[faction]
  }

  public async broadcastManifestChanges() {}

  public async getStockpilesByGuildId(guildId: string | null) {
    if (!guildId) return {}
    const stockpilesByGuildId = await this.dataAccessService.getStockpilesByGuildId()
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
    const stockpilesByGuildId = await this.dataAccessService.getStockpilesByGuildId()

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
    channelId: string,
  ): Promise<boolean> {
    if (!guildId || !code) {
      Logger.error('StockpileDataService', 'Failed to add stockpile - missing guildId or code')
      return false
    }

    const hex = location.split(':')[0]
    const locationName = location.split(':')[1].split(' - ')[0].trim()
    const storageType = location.split(':')[1].split(' - ')[1] as StorageType

    Logger.debug('StockpileDataService', `Adding stockpile for guild ${guildId}`, {
      hex,
      locationName,
      stockpileName,
      storageType,
    })

    // Check for duplicate stockpile
    const isDuplicate = await this.isDuplicateStockpile(guildId, hex, locationName, stockpileName)
    if (isDuplicate) {
      Logger.error('StockpileDataService', 'Failed to add stockpile - duplicate found')
      return false
    }

    const stockpile = {
      id: uuidv4(),
      locationName,
      code,
      stockpileName,
      storageType,
      createdBy,
      createdAt: new Date().toISOString(),
      channelId,
    }

    await this.dataAccessService.addStockpile(
      stockpile.id,
      guildId,
      hex,
      stockpile.locationName,
      stockpile.code,
      stockpile.stockpileName,
      stockpile.storageType,
      stockpile.createdBy,
      stockpile.createdAt,
      channelId,
    )
    Logger.success('StockpileDataService', `Successfully added stockpile ${stockpileName}`)
    return true
  }

  public async getStockpileById(
    guildId: string,
    hex: string,
    stockpileId: string,
    channelId: string,
  ) {
    const stockpilesByGuildId = await this.dataAccessService.getStockpilesByGuildId()
    return stockpilesByGuildId[guildId][hex].find(
      (stockpile) => stockpile.id === stockpileId && stockpile.channelId === channelId,
    ) as Stockpile
  }

  public async editStockpile(
    guildId: string | null,
    hex: string,
    id: string,
    channelId: string,
    code: string,
    stockpileName: string,
    createdBy: string,
  ): Promise<boolean> {
    if (!guildId || !code) return false

    const currentStockpile = await this.getStockpileById(guildId, hex, id, channelId)

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
    const stockpilesByGuildId = await this.dataAccessService.getStockpilesByGuildId()
    stockpilesByGuildId[guildId][hex] = stockpilesByGuildId[guildId][hex].map((stockpile) =>
      stockpile.id === id ? updatedStockpile : stockpile,
    )
    await this.dataAccessService.saveStockpilesByGuildId(stockpilesByGuildId)
    return true // Indicate successful edit
  }

  public async deleteStockpile(
    guildId: string,
    id: string,
  ): Promise<{ deletedStockpile: Stockpile | null; deletedFromHex: string }> {
    Logger.debug(
      'StockpileDataService',
      `Attempting to delete stockpile ${id} from guild ${guildId}`,
    )
    const stockpilesByGuildId = await this.dataAccessService.getStockpilesByGuildId()

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

    await this.dataAccessService.saveStockpilesByGuildId(stockpilesByGuildId)

    if (deletedStockpile) {
      Logger.success('StockpileDataService', `Successfully deleted stockpile ${id}`)
    } else {
      Logger.error('StockpileDataService', `Failed to find stockpile ${id} for deletion`)
    }

    return { deletedStockpile, deletedFromHex }
  }

  private getDistance(point1: { x: number; y: number }, point2: { x: number; y: number }) {
    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2))
  }

  private sanitizeMapName(mapName: string): string {
    if (mapName === 'MooringCountyHex') return 'The Moors'
    return mapName === 'MarbanHollow'
      ? mapName.replace(/([a-z])([A-Z])/g, '$1 $2')
      : mapName.slice(0, -3).replace(/([a-z])([A-Z])/g, '$1 $2')
  }

  public async saveEmbeddedMessageId(
    guildId: string,
    channelId: string,
    embeddedMessageId: string,
  ) {
    const embedsByGuildId = await this.dataAccessService.getEmbedsByGuildId()
    embedsByGuildId[guildId] = { channelId, embeddedMessageId }
    await this.dataAccessService.saveEmbedsByGuildId(embedsByGuildId)
    return
  }

  public async getEmbedsByGuildId(guildId: string) {
    const embedsByGuildId = await this.dataAccessService.getEmbedsByGuildId()
    return embedsByGuildId[guildId] || {}
  }

  public async resetStockpilesByGuildId(guildId: string): Promise<void> {
    Logger.debug('StockpileDataService', `Resetting stockpiles for guild ${guildId}`)
    const stockpilesByGuildId = await this.dataAccessService.getStockpilesByGuildId()
    if (stockpilesByGuildId[guildId]) {
      delete stockpilesByGuildId[guildId]
      await this.dataAccessService.saveStockpilesByGuildId(stockpilesByGuildId)
      Logger.success('StockpileDataService', `Successfully reset stockpiles for guild ${guildId}`)
    } else {
      Logger.debug('StockpileDataService', `No stockpiles found for guild ${guildId}`)
    }
  }

  public async getEmbedTitle(): Promise<string> {
    const warNumber = await this.getWarNumber()
    const isResistance = await this.isResistancePhase()

    return isResistance
      ? `War ${warNumber} - Resistance Phase`
      : `War ${warNumber} - Conquest Phase`
  }

  public async cleanupChannelMessages(channel: any, embedId: string) {
    try {
      // Fetch messages after the embed
      const messages = await channel.messages.fetch({ after: embedId })

      // Bulk delete messages if they're less than 14 days old
      if (messages.size > 0) {
        await channel.bulkDelete(messages).catch((error: any) => {
          // If bulk delete fails (messages > 14 days old), delete them one by one
          messages.forEach(async (message: any) => {
            await message.delete().catch(() => {
              Logger.error('StockpileDataService', `Failed to delete message ${message.id}`)
            })
          })
        })
        Logger.success('StockpileDataService', `Cleaned up ${messages.size} messages`)
      }
    } catch (error) {
      Logger.error('StockpileDataService', 'Failed to cleanup messages', error)
    }
  }
}
