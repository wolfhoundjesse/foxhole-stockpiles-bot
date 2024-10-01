import { Discord, Slash, SelectMenuComponent, ModalComponent } from 'discordx'
import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type CommandInteraction,
} from 'discord.js'
import { StockpileDataService } from '../services/stockpile-data-service.js'
import { Stockpile, StockpilesByGuildId, StorageType } from '../models'

@Discord()
export class DeleteStockpile {
  public stockpileDataService = new StockpileDataService()
  private selectedHex: string = ''
  private selectedLocation: string = ''

  @Slash({ description: 'Delete a stockpile', name: 'delete-stockpile' })
  async deleteStockpile(interaction: CommandInteraction) {
    const stockpilesByGuidId = await this.stockpileDataService.getStockpilesByGuildId(
      interaction.guildId,
    )

    if (!stockpilesByGuidId) {
      await interaction.reply({ content: 'No stockpiles found', ephemeral: true })
      return
    }

    const hexSelectMenu = new StringSelectMenuBuilder()
      .setCustomId('delete/stockpile-menu')
      .setPlaceholder('Stockpile')
      .addOptions(
        Object.entries(stockpilesByGuidId).flatMap(([hex, stockpiles]) =>
          stockpiles.map((stockpile) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`${hex}`)
              .setValue(stockpile.id)
              .setDescription(
                `${stockpile.locationName} - ${stockpile.storageType} - ${stockpile.stockpileName} - ${stockpile.code}`,
              ),
          ),
        ),
      )

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(hexSelectMenu)

    await interaction.reply({ components: [row], ephemeral: true })
  }

  @SelectMenuComponent({ id: 'delete/stockpile-menu' })
  async deleteStockpileMenu(interaction: StringSelectMenuInteraction) {
    const stockpileId = interaction.values[0]
    if (!interaction.guildId) return
    await this.stockpileDataService.deleteStockpile(interaction.guildId, stockpileId)
    await interaction.reply({ content: 'Stockpile deleted', ephemeral: true })
  }
}
