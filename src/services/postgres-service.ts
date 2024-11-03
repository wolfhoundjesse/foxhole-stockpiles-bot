import { Pool } from 'pg'
import type {
  LocationsManifest,
  StockpilesByGuildId,
  FactionsByGuildId,
  EmbedsByGuildId,
  Stockpile,
} from '../models'

export class PostgresService {
  private pool: Pool

  constructor() {
    this.pool = new Pool({
      // These would come from environment variables
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_DATABASE,
      password: process.env.POSTGRES_PASSWORD,
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
    })
  }

  // Locations Manifest
  async getLocationsManifest(): Promise<LocationsManifest> {
    const query = `
      SELECT war_number, updated_at, colonial_locations, warden_locations
      FROM locations_manifest
      ORDER BY updated_at DESC
      LIMIT 1
    `
    const result = await this.pool.query(query)
    if (!result.rows[0]) {
      return {
        warNumber: 0,
        updatedAt: '',
        COLONIALS: {},
        WARDENS: {},
      }
    }

    return {
      warNumber: result.rows[0].war_number,
      updatedAt: result.rows[0].updated_at,
      COLONIALS: result.rows[0].colonial_locations,
      WARDENS: result.rows[0].warden_locations,
    }
  }

  async saveLocationsManifest(data: LocationsManifest): Promise<void> {
    const query = `
      INSERT INTO locations_manifest (
        war_number,
        updated_at,
        colonial_locations,
        warden_locations
      ) VALUES ($1, $2, $3, $4)
    `
    await this.pool.query(query, [data.warNumber, data.updatedAt, data.COLONIALS, data.WARDENS])
  }

  // Stockpiles
  async getStockpilesByGuildId(): Promise<StockpilesByGuildId> {
    const query = `
      SELECT 
        g.guild_id,
        r.hex,
        json_agg(
          json_build_object(
            'id', s.id,
            'locationName', s.location_name,
            'code', s.code,
            'stockpileName', s.stockpile_name,
            'storageType', s.storage_type,
            'createdBy', s.created_by,
            'createdAt', s.created_at,
            'updatedBy', s.updated_by,
            'updatedAt', s.updated_at
          )
        ) as stockpiles
      FROM guilds g
      LEFT JOIN regions r ON true
      LEFT JOIN stockpiles s ON s.guild_id = g.guild_id AND s.region_hex = r.hex
      GROUP BY g.guild_id, r.hex
    `
    const result = await this.pool.query(query)

    // Transform the flat results into the nested structure expected
    return result.rows.reduce((acc, row) => {
      if (!acc[row.guild_id]) {
        acc[row.guild_id] = {}
      }
      if (row.stockpiles[0] !== null) {
        acc[row.guild_id][row.hex] = row.stockpiles
      }
      return acc
    }, {} as StockpilesByGuildId)
  }

  async saveStockpilesByGuildId(data: StockpilesByGuildId): Promise<void> {
    // Begin transaction
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Clear existing stockpiles
      await client.query('DELETE FROM stockpiles')

      // Insert new stockpiles
      for (const [guildId, regions] of Object.entries(data)) {
        for (const [hex, stockpiles] of Object.entries(regions)) {
          for (const stockpile of stockpiles) {
            const query = `
              INSERT INTO stockpiles (
                id,
                guild_id,
                region_hex,
                location_name,
                code,
                stockpile_name,
                storage_type,
                created_by,
                created_at,
                updated_by,
                updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `
            await client.query(query, [
              stockpile.id,
              guildId,
              hex,
              stockpile.locationName,
              stockpile.code,
              stockpile.stockpileName,
              stockpile.storageType,
              stockpile.createdBy,
              stockpile.createdAt,
              stockpile.updatedBy,
              stockpile.updatedAt,
            ])
          }
        }
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  // Factions
  async getFactionsByGuildId(): Promise<FactionsByGuildId> {
    const query = `
      SELECT guild_id, faction
      FROM guilds
    `
    const result = await this.pool.query(query)

    // Transform rows into the expected dictionary structure
    return result.rows.reduce((acc, row) => {
      acc[row.guild_id] = row.faction
      return acc
    }, {} as FactionsByGuildId)
  }

  async saveFactionsByGuildId(data: FactionsByGuildId): Promise<void> {
    // Begin transaction
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Clear existing factions
      await client.query('DELETE FROM guilds')

      // Insert new factions
      for (const [guildId, faction] of Object.entries(data)) {
        const query = `
          INSERT INTO guilds (guild_id, faction)
          VALUES ($1, $2)
          ON CONFLICT (guild_id) DO UPDATE
          SET faction = EXCLUDED.faction
        `
        await client.query(query, [guildId, faction])
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  // Embeds
  async getEmbedsByGuildId(): Promise<EmbedsByGuildId> {
    const query = `
      SELECT guild_id, channel_id, message_id
      FROM embedded_messages
    `
    const result = await this.pool.query(query)

    // Transform rows into the expected structure
    return result.rows.reduce((acc, row) => {
      acc[row.guild_id] = {
        channelId: row.channel_id,
        embeddedMessageId: row.message_id,
      }
      return acc
    }, {} as EmbedsByGuildId)
  }

  async saveEmbedsByGuildId(data: EmbedsByGuildId): Promise<void> {
    // Begin transaction
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Clear existing embeds
      await client.query('DELETE FROM embedded_messages')

      // Insert new embeds
      for (const [guildId, embed] of Object.entries(data)) {
        const query = `
          INSERT INTO embedded_messages (guild_id, channel_id, message_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (guild_id) DO UPDATE
          SET 
            channel_id = EXCLUDED.channel_id,
            message_id = EXCLUDED.message_id
        `
        await client.query(query, [guildId, embed.channelId, embed.embeddedMessageId])
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}
