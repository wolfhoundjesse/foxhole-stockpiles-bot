import {
  ActionRowBuilder,
  CommandInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonInteraction,
} from 'discord.js'
import { Discord, Guard, Slash, SelectMenuComponent } from 'discordx'
import { Command, ResetStockpileTimerIds } from '../models/constants'
import { StockpileDataService } from '../services/stockpile-data-service'
import { FactionColors } from '../models'
import { checkBotPermissions } from '../utils/permissions'
import { PermissionGuard } from '../guards/PermissionGuard'
import { addHelpTip } from '../utils/embed'

@Discord()
@Guard(PermissionGuard)
export class ResetStockpileTimer {
  private stockpileDataService = new StockpileDataService()

  @Slash({
    description: 'Reset the expiration timer for a stockpile',
    name: Command.ResetStockpileTimer,
  })
  async resetStockpileTimer(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    const { guildId } = interaction

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      })
      return
    }

    try {
      const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(guildId)
      const stockpileOptions = Object.entries(stockpiles).flatMap(([hex, stockpileList]) =>
        stockpileList.map((stockpile) => ({
          label: `${hex} - ${stockpile.locationName} - ${stockpile.stockpileName}`,
          value: stockpile.id,
          description: `Expires: ${this.formatExpirationTime(stockpile.expiresAt)}`,
        })),
      )

      if (stockpileOptions.length === 0) {
        await interaction.reply({
          content: 'No stockpiles found for this server.',
          ephemeral: true,
        })
        return
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(ResetStockpileTimerIds.StockpileSelect)
        .setPlaceholder('Select a stockpile to reset timer')
        .addOptions(stockpileOptions)

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

      await interaction.reply({
        content: 'Please select the stockpile you want to reset the timer for:',
        components: [row],
        ephemeral: true,
      })
    } catch (error) {
      console.error('Error fetching stockpiles:', error)
      await interaction.reply({
        content: 'An error occurred while fetching stockpiles. Please try again later.',
        ephemeral: true,
      })
    }
  }

  @SelectMenuComponent({ id: ResetStockpileTimerIds.StockpileSelect })
  async handleStockpileSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return

    try {
      const guildId = interaction.guildId
      if (!guildId) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        })
        return
      }

      const selectedStockpile = interaction.values[0]
      const [stockpileId, stockpileName] = selectedStockpile.split('|')

      // Reset the timer for this stockpile
      await this.stockpileDataService.resetStockpileTimer(guildId, stockpileId)

      // Update the interaction to remove the select menu
      await interaction.update({
        content: 'Stockpile timer has been reset to 50 hours.',
        components: [],
      })

      // Create and update embed
      const { embed, components } = await this.createStockpilesEmbed(guildId)
      const embedByGuildId = await this.stockpileDataService.getEmbedsByGuildId(guildId)
      const embeddedMessageExists = Boolean(embedByGuildId.embeddedMessageId)

      if (embeddedMessageExists && interaction.channel?.isTextBased()) {
        try {
          const message = await interaction.channel.messages.fetch(embedByGuildId.embeddedMessageId)
          await message.edit({ embeds: [embed], components })
        } catch (error) {
          // If we can't access the message, create a new one
          await this.stockpileDataService.saveEmbeddedMessageId(guildId, '', '')
          const newMessage = await interaction.followUp({
            embeds: [embed],
            components,
            fetchReply: true,
          })
          if (newMessage && 'id' in newMessage) {
            await this.stockpileDataService.saveEmbeddedMessageId(
              guildId,
              interaction.channelId,
              newMessage.id,
            )
          }
        }
      }
    } catch (error) {
      console.error('Error resetting stockpile timer:', error)
      await interaction.reply({
        content: 'An error occurred while resetting the stockpile timer.',
        ephemeral: true,
      })
    }
  }

  private async createStockpilesEmbed(
    guildId: string,
  ): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(guildId)
    const embedTitle = await this.stockpileDataService.getEmbedTitle()
    const faction = await this.stockpileDataService.getFactionByGuildId(guildId)
    const color = FactionColors[faction]

    if (!stockpiles) {
      return addHelpTip(
        new EmbedBuilder()
          .setTitle(embedTitle)
          .setColor(color)
          .addFields([{ name: 'No stockpiles', value: 'No stockpiles', inline: true }])
          .setTimestamp(),
      )
    }

    const stockpileFields = Object.keys(stockpiles).map((hex) => {
      return {
        name: hex,
        value:
          stockpiles[hex]
            .map((stockpile) => {
              const expirationStatus = this.getExpirationStatus(stockpile.expiresAt)
              return `${stockpile.locationName} - ${stockpile.storageType} - ${stockpile.stockpileName} - ${stockpile.code}\n${expirationStatus}`
            })
            .join('\n\n') || 'No stockpiles',
      }
    })

    return addHelpTip(
      new EmbedBuilder()
        .setTitle(embedTitle)
        .setColor(color)
        .addFields(stockpileFields)
        .setTimestamp(),
    )
  }

  private formatExpirationTime(expiresAt: string): string {
    const now = new Date()
    const expiration = new Date(expiresAt)
    const hoursRemaining = Math.max(0, (expiration.getTime() - now.getTime()) / (1000 * 60 * 60))

    if (hoursRemaining <= 0) {
      return 'EXPIRED'
    }

    const hours = Math.floor(hoursRemaining)
    const minutes = Math.floor((hoursRemaining - hours) * 60)
    return `${hours}h ${minutes}m remaining`
  }

  private getExpirationStatus(expiresAt: string): string {
    const now = new Date()
    const expiration = new Date(expiresAt)
    const hoursRemaining = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursRemaining <= 0) {
      return '⚠️ **EXPIRED** - Please reset the timer or delete this stockpile'
    }

    if (hoursRemaining <= 8) {
      return `⚠️ **${this.formatExpirationTime(expiresAt)}** - Stockpile is running low on time!`
    }

    return `⏰ ${this.formatExpirationTime(expiresAt)}`
  }
}
