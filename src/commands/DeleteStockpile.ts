import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
} from 'discord.js'
import { Discord, Guard, Slash, SelectMenuComponent, ButtonComponent } from 'discordx'
import { Command, DeleteStockpileIds } from '../models/constants'
import { StockpileDataService } from '../services/stockpile-data-service'
import { FactionColors } from '../models'
import { checkBotPermissions } from '../utils/permissions'
import { PermissionGuard } from '../guards/PermissionGuard'
import { addHelpTip } from '../utils/embed'
import { formatStockpileWithExpiration } from '../utils/expiration'

@Discord()
@Guard(PermissionGuard)
export class DeleteStockpile {
  private stockpileDataService = new StockpileDataService()
  private stockpileToDelete: { [userId: string]: string } = {}

  @Slash({ description: 'Delete an existing stockpile', name: Command.DeleteStockpile })
  async deleteStockpile(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
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
          label: `${hex} - ${stockpile.locationName} - ${stockpile.storageType} - ${stockpile.stockpileName}`,
          value: stockpile.id,
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
        .setCustomId(DeleteStockpileIds.StockpileSelect)
        .setPlaceholder('Select a stockpile to delete')
        .addOptions(stockpileOptions)

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

      await interaction.reply({
        content: 'Please select the stockpile you want to delete:',
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

  @SelectMenuComponent({ id: DeleteStockpileIds.StockpileSelect })
  async handleStockpileSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    const stockpileId = interaction.values[0]
    this.stockpileToDelete[interaction.user.id] = stockpileId

    const confirmButton = new ButtonBuilder()
      .setCustomId(DeleteStockpileIds.ConfirmButton)
      .setLabel('Confirm Delete')
      .setStyle(ButtonStyle.Danger)

    const cancelButton = new ButtonBuilder()
      .setCustomId(DeleteStockpileIds.CancelButton)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton)

    await interaction.update({
      content: 'Are you sure you want to delete this stockpile?',
      components: [row],
    })
  }

  @ButtonComponent({ id: DeleteStockpileIds.ConfirmButton })
  async handleConfirmDelete(interaction: ButtonInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    const { guildId } = interaction

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      })
      return
    }

    const stockpileId = this.stockpileToDelete[interaction.user.id]
    if (!stockpileId) {
      await interaction.reply({
        content: 'No stockpile selected for deletion.',
        ephemeral: true,
      })
      return
    }

    try {
      const { deletedStockpile, deletedFromHex } = await this.stockpileDataService.deleteStockpile(
        guildId,
        stockpileId,
      )
      delete this.stockpileToDelete[interaction.user.id]

      if (!deletedStockpile) {
        await interaction.update({
          content: 'The selected stockpile could not be found. It may have already been deleted.',
          components: [],
        })
        return
      }

      const { embed, components } = await this.createStockpilesEmbed(guildId)
      const embedByGuildId = await this.stockpileDataService.getEmbedsByGuildId(guildId)
      const embeddedMessageExists = Boolean(embedByGuildId.embeddedMessageId)

      if (embeddedMessageExists) {
        const channel = interaction.channel
        if (channel) {
          const message = await channel.messages.fetch(embedByGuildId.embeddedMessageId)
          await message.edit({ embeds: [embed], components })
        }
      }

      let content = `Stockpile "${deletedStockpile.stockpileName}" has been deleted successfully from ${deletedFromHex}.`
      if (!(deletedFromHex in (await this.stockpileDataService.getStockpilesByGuildId(guildId)))) {
        content += ` The ${deletedFromHex} region has been removed as it no longer contains any stockpiles.`
      }

      await interaction.update({
        content,
        components: [],
      })
    } catch (error) {
      console.error('Error deleting stockpile:', error)
      await interaction.reply({
        content: 'An error occurred while deleting the stockpile. Please try again later.',
        ephemeral: true,
      })
    }
  }

  @ButtonComponent({ id: DeleteStockpileIds.CancelButton })
  async handleCancelDelete(interaction: ButtonInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    delete this.stockpileToDelete[interaction.user.id]
    await interaction.update({
      content: 'Stockpile deletion cancelled.',
      components: [],
    })
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
            .map((stockpile) => formatStockpileWithExpiration(stockpile))
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
}
