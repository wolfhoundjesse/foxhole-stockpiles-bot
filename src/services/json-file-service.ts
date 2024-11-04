import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'node:path'
import { dirname } from '@discordx/importer'
import type { LocationsManifest, StockpilesByGuildId, FactionsByGuildId } from '../models'
import type { EmbedsByGuildId } from '../models'

export class JsonFileService {
  private readonly locationsManifestDb: Low<LocationsManifest>
  private readonly stockpilesByGuildIdDb: Low<StockpilesByGuildId>
  private readonly embedsByGuildIdDb: Low<EmbedsByGuildId>
  private readonly factionsByGuildIdDb: Low<FactionsByGuildId>

  constructor() {
    const defaultLocationsManifest: LocationsManifest = {
      warNumber: 0,
      updatedAt: '',
      COLONIALS: {},
      WARDENS: {},
      isResistancePhase: false,
    }

    this.locationsManifestDb = new Low<LocationsManifest>(
      new JSONFile(
        path.join(dirname(import.meta.url), '..', '..', 'data', 'locations-manifest.json'),
      ),
      defaultLocationsManifest,
    )

    this.stockpilesByGuildIdDb = new Low<StockpilesByGuildId>(
      new JSONFile(
        path.join(dirname(import.meta.url), '..', '..', 'data', 'stockpiles-by-guild-id.json'),
      ),
      {},
    )

    this.embedsByGuildIdDb = new Low<EmbedsByGuildId>(
      new JSONFile(
        path.join(dirname(import.meta.url), '..', '..', 'data', 'embeds-by-guild-id.json'),
      ),
      {},
    )

    this.factionsByGuildIdDb = new Low<FactionsByGuildId>(
      new JSONFile(
        path.join(dirname(import.meta.url), '..', '..', 'data', 'factions-by-guild-id.json'),
      ),
      {},
    )
  }

  // Locations Manifest
  async getLocationsManifest(): Promise<LocationsManifest> {
    await this.locationsManifestDb.read()
    return this.locationsManifestDb.data
  }

  async saveLocationsManifest(data: LocationsManifest): Promise<void> {
    this.locationsManifestDb.data = data
    await this.locationsManifestDb.write()
  }

  // Stockpiles
  async getStockpilesByGuildId(): Promise<StockpilesByGuildId> {
    await this.stockpilesByGuildIdDb.read()
    return this.stockpilesByGuildIdDb.data
  }

  async saveStockpilesByGuildId(data: StockpilesByGuildId): Promise<void> {
    this.stockpilesByGuildIdDb.data = data
    await this.stockpilesByGuildIdDb.write()
  }

  async resetStockpilesByGuildId(guildId: string): Promise<void> {
    await this.stockpilesByGuildIdDb.read()
    if (this.stockpilesByGuildIdDb.data[guildId]) {
      delete this.stockpilesByGuildIdDb.data[guildId]
      await this.stockpilesByGuildIdDb.write()
    }
  }

  // Factions
  async getFactionsByGuildId(): Promise<FactionsByGuildId> {
    await this.factionsByGuildIdDb.read()
    return this.factionsByGuildIdDb.data
  }

  async saveFactionsByGuildId(data: FactionsByGuildId): Promise<void> {
    this.factionsByGuildIdDb.data = data
    await this.factionsByGuildIdDb.write()
  }

  // Embeds
  async getEmbedsByGuildId(): Promise<EmbedsByGuildId> {
    await this.embedsByGuildIdDb.read()
    return this.embedsByGuildIdDb.data
  }

  async saveEmbedsByGuildId(data: EmbedsByGuildId): Promise<void> {
    this.embedsByGuildIdDb.data = data
    await this.embedsByGuildIdDb.write()
  }
}
