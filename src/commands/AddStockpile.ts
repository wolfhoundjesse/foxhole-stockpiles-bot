import { Discord, ModalComponent, SelectMenuComponent, Slash, SlashOption } from 'discordx'
import {
  CommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { StockpileDataService } from '../services/stockpile-data-service'
import { Command, AddStockpileIds } from '../models/constants'

@Discord()
export class AddStockpile {
  public stockpileDataService = new StockpileDataService()

  @Slash({ description: 'Add a stockpile', name: Command.AddStockpile })
  async addStockpile(interaction: CommandInteraction): Promise<void> {
    const storageLocationsByRegion = await this.stockpileDataService.getStorageLocationsByRegion()

    const hexSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(AddStockpileIds.HexMenu)
      .setPlaceholder('Region/Hex')
      .addOptions(
        Object.keys(storageLocationsByRegion).map((key) => {
          return new StringSelectMenuOptionBuilder().setLabel(key).setValue(key)
        }),
      )

    const stockpileMenu = new StringSelectMenuBuilder()
      .setCustomId(AddStockpileIds.StockpileMenu)
      .setPlaceholder('Select a stockpile')
      .addOptions({
        label: 'Add Stockpile',
        value: 'add-stockpile',
        description: 'Add a stockpile to the database',
      })
      .setDisabled(true) // initially disabled

    const hexRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(hexSelectMenu)
    const stockpileRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      stockpileMenu,
    )

    await interaction.reply({
      content: 'Select a region/hex to add a stockpile to.',
      components: [hexRow, stockpileRow],
      ephemeral: true,
    })
  }

  @SelectMenuComponent({ id: AddStockpileIds.HexMenu })
  async handleLocationSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const selectedHex = interaction.values[0] // Get selected location
    const storageLocationsByRegion = await this.stockpileDataService.getStorageLocationsByRegion()
    const updatedHexMenu = new StringSelectMenuBuilder()
      .setCustomId(AddStockpileIds.HexMenu)
      .setPlaceholder('Select a hex')
      .setDisabled(true)
      .setOptions([{ label: selectedHex, value: selectedHex, default: true }])

    const hexRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(updatedHexMenu)

    const stockpileOptions = Object.keys(storageLocationsByRegion)
      .filter((hex) => hex === selectedHex)
      .map((hex) => {
        return storageLocationsByRegion[hex].map((stockpile) => {
          const location = `${stockpile.locationName} - ${stockpile.storageType}`
          return new StringSelectMenuOptionBuilder()
            .setLabel(location)
            .setValue(`${hex}: ${location}`)
        })
      })
      .flat()

    // Enable the sublocation menu after location selection
    const stockpileMenu = new StringSelectMenuBuilder()
      .setCustomId(AddStockpileIds.StockpileMenu)
      .setPlaceholder('Select a stockpile')
      .setDisabled(false)
      .addOptions(stockpileOptions)

    const stockpileRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      stockpileMenu,
    )

    await interaction.update({
      content: 'Please select a storage location.',
      components: [hexRow, stockpileRow],
    })
  }

  // Handle sublocation selection (sublocation_select)
  @SelectMenuComponent({ id: AddStockpileIds.StockpileMenu })
  async handleSublocationSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const selectedStorageLocation = interaction.values[0] // Get selected sublocation

    // Present a modal to the user for stockpile code and name
    const modal = new ModalBuilder()
      .setTitle('Enter Stockpile Details')
      .setCustomId(AddStockpileIds.StockpileDetails)

    const stockpileCodeInput = new TextInputBuilder()
      .setCustomId(AddStockpileIds.StockpileCodeInput)
      .setLabel('Stockpile Code (6 digits)')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(6)
      .setMinLength(6)
      .setRequired(true)

    const stockpileNameInput = new TextInputBuilder()
      .setCustomId(AddStockpileIds.StockpileNameInput)
      .setLabel(`Name (optional, default is ${process.env.DEFAULT_STOCKPILE_NAME})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)

    const codeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(stockpileCodeInput)
    const nameRow = new ActionRowBuilder<TextInputBuilder>().addComponents(stockpileNameInput)
    modal.addComponents(codeRow, nameRow)

    await interaction.showModal(modal)
  }

  // Handle modal submission (stockpile_modal)
  @ModalComponent({ id: AddStockpileIds.StockpileDetails })
  async handleStockpileModal(interaction: ModalSubmitInteraction): Promise<void> {
    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(interaction.guildId)
    const warNumber = 117

    if (!stockpiles) {
      throw new Error('No stockpiles found')
    }

    const stockpileFields = Object.keys(stockpiles).map((hex) => {
      return {
        name: hex,
        value: stockpiles[hex]
          .map(
            (stockpile) =>
              `${stockpile.locationName} - ${stockpile.storageType} - ${stockpile.stockpileName} - ${stockpile.code}`,
          )
          .join('\n'),
      }
    })

    // Create an embed with the stockpile details
    const embed = new EmbedBuilder()
      .setTitle(`Stockpiles for war ${warNumber} (updated ${new Date().toLocaleString()})`)
      .setColor(0x00ff00)
      .setFields(stockpileFields)
      .setTimestamp()

    await interaction.reply({ embeds: [embed], ephemeral: false })
  }
}
