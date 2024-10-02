import { Discord, ModalComponent, SelectMenuComponent, Slash } from 'discordx'
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
import { Faction, FactionColors, type FactionType } from '../models'

@Discord()
export class AddStockpile {
  public stockpileDataService = new StockpileDataService()
  private selectedLocations: { [userId: string]: string } = {}

  @Slash({ description: 'Add a stockpile', name: Command.AddStockpile })
  async addStockpile(interaction: CommandInteraction): Promise<void> {
    const faction = await this.getFaction(interaction)
    if (faction === Faction.None) {
      return
    }
    const storageLocationsByRegion =
      await this.stockpileDataService.getStorageLocationsByRegion(faction)

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
      content: 'Please select a storage location.',
      components: [hexRow, stockpileRow],
      ephemeral: true,
    })
  }

  @SelectMenuComponent({ id: AddStockpileIds.HexMenu })
  async handleLocationSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const selectedHex = interaction.values[0] // Get selected location
    const faction = await this.getFaction(interaction)
    if (faction === Faction.None) {
      return
    }
    const storageLocationsByRegion =
      await this.stockpileDataService.getStorageLocationsByRegion(faction)
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
    this.selectedLocations[interaction.user.id] = selectedStorageLocation
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
  async handleStockpileDetails(interaction: ModalSubmitInteraction): Promise<void> {
    const guildId = interaction.guildId
    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      })
      return
    }

    const stockpileCode = interaction.fields.getTextInputValue(AddStockpileIds.StockpileCodeInput)
    const stockpileName =
      interaction.fields.getTextInputValue(AddStockpileIds.StockpileNameInput) ||
      (process.env.DEFAULT_STOCKPILE_NAME as string)
    const selectedStorageLocation = this.selectedLocations[interaction.user.id]

    if (!selectedStorageLocation) {
      await interaction.reply({
        content:
          'Error: Could not retrieve the selected storage location. Please try the command again.',
        ephemeral: true,
      })
      return
    }

    // Add the stockpile to the database
    const success = await this.stockpileDataService.addStockpile(
      guildId,
      selectedStorageLocation,
      stockpileCode,
      stockpileName,
      interaction.user.id,
    )

    if (!success) {
      await interaction.reply({
        content: `> 🚫 **Error:** A stockpile with the name "**${stockpileName}**" already exists in this location.\n> \n> ✏️ Please try again with a different name.`,
        ephemeral: true,
      })
      return
    }

    // Remove the stored location after use
    delete this.selectedLocations[interaction.user.id]

    // Create an embed with the stockpile details
    const embed = await this.createStockpilesEmbed(guildId)
    const embedByGuildId = await this.stockpileDataService.getEmbedsByGuildId(guildId)
    const embeddedMessageExists = Boolean(embedByGuildId.embeddedMessageId)
    if (embeddedMessageExists) {
      const channel = interaction.channel
      if (channel) {
        const message = await channel.messages.fetch(embedByGuildId.embeddedMessageId)
        await message.edit({ embeds: [embed] })
        await interaction.reply({ content: 'Stockpile list updated.', ephemeral: true })
      }
    }

    if (!embeddedMessageExists) {
      const message = await interaction.reply({
        embeds: [embed],
        fetchReply: true,
      })
      await this.stockpileDataService.saveEmbeddedMessageId(
        guildId,
        interaction.channelId || '',
        message.id,
      )
    }
  }

  private async getFaction(
    interaction: CommandInteraction | StringSelectMenuInteraction,
  ): Promise<FactionType> {
    const guildId = interaction.guildId
    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      })
      return Faction.None
    }
    const faction = await this.stockpileDataService.getFactionByGuildId(guildId)
    if (faction === Faction.None) {
      await interaction.reply({
        content: 'You must select a faction before adding stockpiles. (use /select-faction)',
        ephemeral: true,
      })
      return Faction.None
    }
    return faction
  }

  private async createStockpilesEmbed(guildId: string): Promise<EmbedBuilder> {
    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(guildId)
    const warNumber = await this.stockpileDataService.getWarNumber()
    const faction = await this.stockpileDataService.getFactionByGuildId(guildId)
    const color = FactionColors[faction]

    if (!stockpiles) {
      return new EmbedBuilder()
        .setTitle(`War ${warNumber} Stockpiles`)
        .setColor(color)
        .addFields([{ name: 'No stockpiles', value: 'No stockpiles', inline: true }])
        .setTimestamp()
    }

    const stockpileFields = Object.keys(stockpiles).map((hex) => {
      return {
        name: hex,
        value:
          stockpiles[hex]
            .map(
              (stockpile) =>
                `${stockpile.locationName} - ${stockpile.storageType} - ${stockpile.stockpileName} - ${stockpile.code}`,
            )
            .join('\n') || 'No stockpiles',
      }
    })

    return new EmbedBuilder()
      .setTitle(`War ${warNumber} Stockpiles`)
      .setColor(color)
      .addFields(stockpileFields)
      .setTimestamp()
  }
}
