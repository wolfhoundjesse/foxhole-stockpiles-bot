import type { Client, TextChannel } from 'discord.js'
import { StockpileDataService } from './stockpile-data-service'
import { Logger } from '../utils/logger'
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js'
import { FactionColors } from '../models'
import { addHelpTip } from '../utils/embed'
import { formatStockpileWithExpiration } from '../utils/expiration'

/**
 * Service to manage periodic embed updates for stockpile timers
 * Uses one interval per guild to efficiently update all stockpiles
 */
export class EmbedUpdateService {
  private static instance: EmbedUpdateService
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private readonly UPDATE_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
  private client: Client | null = null
  private stockpileDataService = new StockpileDataService()

  private constructor() {}

  static getInstance(): EmbedUpdateService {
    if (!EmbedUpdateService.instance) {
      EmbedUpdateService.instance = new EmbedUpdateService()
    }
    return EmbedUpdateService.instance
  }

  /**
   * Initialize the service with the Discord client
   */
  setClient(client: Client): void {
    this.client = client
  }

  /**
   * Start a timer for a guild to update its stockpile embed
   */
  async startTimer(guildId: string): Promise<void> {
    // Stop existing timer if it exists
    this.stopTimer(guildId)

    // Create new timer
    const timer = setInterval(async () => {
      await this.updateGuildEmbed(guildId)
    }, this.UPDATE_INTERVAL_MS)

    this.timers.set(guildId, timer)
    Logger.debug(`Started embed update timer for guild ${guildId}`)
  }

  /**
   * Stop the timer for a guild
   */
  stopTimer(guildId: string): void {
    const timer = this.timers.get(guildId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(guildId)
      Logger.debug(`Stopped embed update timer for guild ${guildId}`)
    }
  }

  /**
   * Restart the timer for a guild (useful when stockpiles are modified)
   */
  async restartTimer(guildId: string): Promise<void> {
    await this.startTimer(guildId)
  }

  /**
   * Update the embed for a specific guild
   */
  private async updateGuildEmbed(guildId: string): Promise<void> {
    if (!this.client) {
      Logger.error('Discord client not initialized in EmbedUpdateService')
      return
    }

    try {
      // Get the embed message info
      const embedInfo = await this.stockpileDataService.getEmbedsByGuildId(guildId)
      if (!embedInfo.embeddedMessageId || !embedInfo.channelId) {
        Logger.debug(`No embedded message found for guild ${guildId}, stopping timer`)
        this.stopTimer(guildId)
        return
      }

      // Get stockpiles for this guild
      const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(guildId)
      if (!stockpiles || Object.keys(stockpiles).length === 0) {
        Logger.debug(`No stockpiles found for guild ${guildId}, stopping timer`)
        this.stopTimer(guildId)
        return
      }

      // Fetch the channel and message
      const channel = await this.client.channels.fetch(embedInfo.channelId)
      if (!channel || !channel.isTextBased()) {
        Logger.error(`Channel ${embedInfo.channelId} not found or not text-based`)
        this.stopTimer(guildId)
        return
      }

      const textChannel = channel as TextChannel
      const message = await textChannel.messages.fetch(embedInfo.embeddedMessageId)
      if (!message) {
        Logger.error(`Message ${embedInfo.embeddedMessageId} not found`)
        this.stopTimer(guildId)
        return
      }

      // Create updated embed
      const { embed, components } = await this.createStockpilesEmbed(guildId)

      // Update the message
      await message.edit({ embeds: [embed], components })
      Logger.success(`Updated embed for guild ${guildId}`)
    } catch (error) {
      Logger.error(`Error updating embed for guild ${guildId}:`, error)
      // Don't stop timer on transient errors - might recover
    }
  }

  /**
   * Initialize timers for all guilds that have stockpiles
   */
  async initializeAllTimers(): Promise<void> {
    if (!this.client) {
      Logger.error('Discord client not initialized, cannot initialize timers')
      return
    }

    try {
      // Get all guilds the bot is in
      const guilds = this.client.guilds.cache

      for (const [guildId, guild] of guilds) {
        // Check if this guild has stockpiles
        const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(guildId)
        if (stockpiles && Object.keys(stockpiles).length > 0) {
          await this.startTimer(guildId)
        }
      }

      Logger.success(`Initialized embed update timers for ${this.timers.size} guilds`)
    } catch (error) {
      Logger.error('Error initializing timers:', error)
    }
  }

  /**
   * Create the stockpiles embed (same as in command files)
   */
  private async createStockpilesEmbed(
    guildId: string
  ): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(guildId)
    const embedTitle = await this.stockpileDataService.getEmbedTitle()
    const faction = await this.stockpileDataService.getFactionByGuildId(guildId)
    const color = FactionColors[faction]

    if (!stockpiles || Object.keys(stockpiles).length === 0) {
      return addHelpTip(
        new EmbedBuilder()
          .setTitle(embedTitle)
          .setColor(color)
          .addFields([{ name: 'No stockpiles', value: 'No stockpiles', inline: true }])
          .setTimestamp()
      )
    }

    const stockpileFields = Object.keys(stockpiles)
      .sort()
      .map(hex => {
        return {
          name: hex,
          value:
            stockpiles[hex].map(stockpile => formatStockpileWithExpiration(stockpile)).join('\n\n') ||
            'No stockpiles'
        }
      })

    return addHelpTip(
      new EmbedBuilder()
        .setTitle(embedTitle)
        .setColor(color)
        .addFields(stockpileFields)
        .setTimestamp()
    )
  }

  /**
   * Stop all timers (useful for graceful shutdown)
   */
  stopAllTimers(): void {
    for (const guildId of this.timers.keys()) {
      this.stopTimer(guildId)
    }
    Logger.debug('Stopped all embed update timers')
  }
}
