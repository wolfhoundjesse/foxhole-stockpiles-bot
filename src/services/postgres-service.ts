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
  async getLocationsManifest(): Promise<LocationsManifest | null> {
    const result = await this.pool.query(`
      SELECT 
        war_number,
        is_resistance_phase,
        colonial_locations as "COLONIALS",
        warden_locations as "WARDENS",
        updated_at
      FROM locations_manifest
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (!result.rows[0]) return null

    return {
      warNumber: result.rows[0].war_number,
      isResistancePhase: result.rows[0].is_resistance_phase,
      COLONIALS: result.rows[0].COLONIALS,
      WARDENS: result.rows[0].WARDENS,
      updatedAt: result.rows[0].updated_at.toISOString(),
    }
  }

  async saveLocationsManifest(manifest: LocationsManifest): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO locations_manifest (
        war_number,
        is_resistance_phase,
        colonial_locations,
        warden_locations
      ) VALUES ($1, $2, $3, $4)
      `,
      [manifest.warNumber, manifest.isResistancePhase, manifest.COLONIALS, manifest.WARDENS],
    )
  }

  // Stockpiles
  async getStockpilesByGuildId(): Promise<StockpilesByGuildId> {
    const query = `
      SELECT 
        g.guild_id,
        s.hex,
        COALESCE(json_agg(
          json_build_object(
            'id', s.id,
            'channelId', s.channel_id,
            'locationName', s.location_name,
            'code', s.code,
            'stockpileName', s.stockpile_name,
            'storageType', s.storage_type,
            'createdBy', s.created_by,
            'createdAt', s.created_at,
            'updatedBy', s.updated_by,
            'updatedAt', s.updated_at
          )
        ) FILTER (WHERE s.id IS NOT NULL), '[]') as stockpiles
      FROM guilds g
      LEFT JOIN stockpiles s ON s.guild_id = g.guild_id
      GROUP BY g.guild_id, s.hex
    `
    const result = await this.pool.query(query)

    return result.rows.reduce((acc, row) => {
      if (!acc[row.guild_id]) {
        acc[row.guild_id] = {}
      }
      if (row.hex && row.stockpiles.length > 0) {
        acc[row.guild_id][row.hex] = row.stockpiles
      }
      return acc
    }, {} as StockpilesByGuildId)
  }

  async saveStockpilesByGuildId(data: StockpilesByGuildId): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Delete existing stockpiles
      await client.query('DELETE FROM stockpiles')

      for (const [guildId, regions] of Object.entries(data)) {
        // Ensure guild exists
        await client.query(
          `
          INSERT INTO guilds (guild_id, faction)
          VALUES ($1, 'NONE')  -- Default faction, can be updated later
          ON CONFLICT (guild_id) DO NOTHING
        `,
          [guildId],
        )

        for (const [hex, stockpiles] of Object.entries(regions)) {
          for (const stockpile of stockpiles) {
            const query = `
              INSERT INTO stockpiles (
                id,
                guild_id,
                channel_id,
                hex,
                location_name,
                code,
                stockpile_name,
                storage_type,
                created_by,
                created_at,
                updated_by,
                updated_at
              ) VALUES (
                COALESCE($1, gen_random_uuid()),
                $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
              )
            `
            await client.query(query, [
              stockpile.id,
              guildId,
              stockpile.channelId,
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

      // Instead of DELETE FROM guilds, use ON CONFLICT for each row
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
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

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

  async resetStockpilesByGuildId(guildId: string): Promise<void> {
    const query = `
      DELETE FROM stockpiles
      WHERE guild_id = $1
    `
    await this.pool.query(query, [guildId])
  }

  // Add these methods for more efficient single-stockpile operations
  async addStockpile(
    id: string,
    guildId: string,
    hex: string,
    locationName: string,
    code: string,
    stockpileName: string,
    storageType: string,
    createdBy: string,
    createdAt: string,
    channelId: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO stockpiles (
        id, guild_id, hex, location_name, code,
        stockpile_name, storage_type, created_by,
        created_at, channel_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        guildId,
        hex,
        locationName,
        code,
        stockpileName,
        storageType,
        createdBy,
        createdAt,
        channelId,
      ],
    )
  }

  async updateSingleStockpile(stockpile: Stockpile): Promise<void> {
    await this.pool.query(
      `UPDATE stockpiles 
       SET code = $1,
           stockpile_name = $2,
           updated_by = $3,
           updated_at = $4
       WHERE id = $5`,
      [
        stockpile.code,
        stockpile.stockpileName,
        stockpile.updatedBy,
        stockpile.updatedAt,
        stockpile.id,
      ],
    )
  }

  async getStockpileById(
    guildId: string,
    hex: string,
    id: string,
    channelId: string,
  ): Promise<Stockpile | null> {
    const result = await this.pool.query(
      `SELECT * FROM stockpiles 
       WHERE guild_id = $1 AND hex = $2 AND id = $3 AND channel_id = $4`,
      [guildId, hex, id, channelId],
    )
    return result.rows[0]
      ? {
          id: result.rows[0].id,
          locationName: result.rows[0].location_name,
          code: result.rows[0].code,
          stockpileName: result.rows[0].stockpile_name,
          storageType: result.rows[0].storage_type,
          createdBy: result.rows[0].created_by,
          createdAt: result.rows[0].created_at,
          updatedBy: result.rows[0].updated_by,
          updatedAt: result.rows[0].updated_at,
          channelId: result.rows[0].channel_id,
        }
      : null
  }

  async registerWarMessageChannel(guildId: string, channelId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO war_message_channels (guild_id, channel_id)
       VALUES ($1, $2)
       ON CONFLICT (guild_id, channel_id) DO NOTHING`,
      [guildId, channelId],
    )
  }

  async getWarMessageChannels(guildId: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT channel_id FROM war_message_channels WHERE guild_id = $1',
      [guildId],
    )
    return result.rows.map((row) => row.channel_id)
  }

  async setWarArchiveChannel(guildId: string, channelId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO war_archive_channels (guild_id, channel_id)
     VALUES ($1, $2)
     ON CONFLICT (guild_id) DO UPDATE SET channel_id = $2`,
      [guildId, channelId],
    )
  }

  async getWarArchiveChannel(guildId: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT channel_id FROM war_archive_channels WHERE guild_id = $1',
      [guildId],
    )
    return result.rows[0]?.channel_id || null
  }
}
