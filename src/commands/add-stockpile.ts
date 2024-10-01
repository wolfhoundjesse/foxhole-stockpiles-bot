import {
  ActionRowBuilder,
  APISelectMenuOption,
  APIStringSelectComponent,
  Collection,
  ComponentType,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type CommandInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { Discord, ModalComponent, SelectMenuComponent, Slash } from 'discordx'
import { StockpileDataService } from '../services/stockpile-data-service.js'
import { Stockpile } from '../models/stockpile.js'

@Discord()
export class AddStockpile {
  public stockpileDataService = new StockpileDataService()

  @Slash({ description: 'Add a stockpile', name: 'add-stockpile' })
  async addStockpile(interaction: CommandInteraction) {
    const storageLocationsByRegion = await this.stockpileDataService.getStorageLocationsByRegion()
    const hexSelectMenu = new StringSelectMenuBuilder()
      .setCustomId('add/hex-menu')
      .setPlaceholder('Region/Hex')
      .addOptions(
        Object.keys(storageLocationsByRegion).map((key) => {
          return new StringSelectMenuOptionBuilder().setLabel(key).setValue(key)
        }),
      )

    const stockpileMenu = new StringSelectMenuBuilder()
      .setCustomId('add/stockpile-menu')
      .setPlaceholder('Select a stockpile')
      .addOptions([{ label: "It's Disabled", value: "And Doesn't Matter" }])
      .setDisabled(true)

    const hexRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(hexSelectMenu)
    const stockpileRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      stockpileMenu.setDisabled(true),
    )

    await interaction.reply({
      components: [hexRow, stockpileRow],
      fetchReply: true,
      ephemeral: true,
    })
  }

  @SelectMenuComponent({ id: 'add/hex-menu' })
  async handleHexSelect(interaction: StringSelectMenuInteraction) {
    const hexValue = interaction.values[0]
    const updatedHexMenu = new StringSelectMenuBuilder()
      .setCustomId('add/hex-menu')
      .setPlaceholder('Select a hex')
      .setDisabled(true)
      .setOptions([{ label: hexValue, value: hexValue, default: true }])

    const hexRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(updatedHexMenu)

    const storageLocationsByRegion = await this.stockpileDataService.getStorageLocationsByRegion()

    if (!storageLocationsByRegion) {
      await interaction.update({
        components: [hexRow],
        fetchReply: true,
      })
      return
    }
    const stockpileOptions = Object.keys(storageLocationsByRegion)
      .filter((hex) => hex === hexValue)
      .map((hex) => {
        return storageLocationsByRegion[hex].map((stockpile) => {
          const location = `${stockpile.locationName} - ${stockpile.storageType}`
          return new StringSelectMenuOptionBuilder()
            .setLabel(location)
            .setValue(`${hex}: ${location}`)
        })
      })
      .flat()

    const stockpileMenu = new StringSelectMenuBuilder()
      .setCustomId('add/stockpile-menu')
      .setPlaceholder('Select a stockpile')
      .addOptions(stockpileOptions)

    const stockpileRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      stockpileMenu,
    )
    await interaction.update({
      components: [hexRow, stockpileRow],
      fetchReply: true,
    })
  }

  @SelectMenuComponent({ id: 'add/stockpile-menu' })
  async handleStockpileSelect(interaction: StringSelectMenuInteraction) {
    const location = interaction.values[0]

    const modal = new ModalBuilder()
      .setTitle('Enter Stockpile Code')
      .setCustomId('add/stockpile-code')

    const stockpileCodeInputComponent = new TextInputBuilder()
      .setCustomId('add/stockpile-code-input')
      .setLabel('Enter stockpile code')
      .setStyle(TextInputStyle.Short)
      .setMinLength(6)
      .setMaxLength(6)
      .setRequired(true)

    const stockpileIdInputComponent = new TextInputBuilder()
      .setCustomId('add/stockpile-id-input')
      .setLabel(`Enter stockpile ID (default is ${process.env.DEFAULT_STOCKPILE_ID})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)

    const codeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      stockpileCodeInputComponent,
    )
    const idRow = new ActionRowBuilder<TextInputBuilder>().addComponents(stockpileIdInputComponent)
    modal.addComponents(codeRow, idRow)
    interaction.showModal(modal)

    const submission = await interaction.awaitModalSubmit({
      time: 60000,
      filter: (i) => i.user.id === interaction.user.id,
    })
    const stockpileCode = submission.fields.fields.get('add/stockpile-code-input')?.value
    const stockpileId =
      submission.fields.fields.get('add/stockpile-id-input')?.value ||
      process.env.DEFAULT_STOCKPILE_ID
    if (!stockpileCode || !stockpileId) {
      throw new Error('Stockpile code is required') // Unconfigured DEFAULT_STOCKPILE_ID is handled elsewhere
    }

    await this.stockpileDataService.addStockpile(
      interaction.guildId,
      location,
      stockpileCode,
      stockpileId,
      interaction.user.id,
    )
  }

  @ModalComponent({ id: 'add/stockpile-code' })
  async handleStockpileCodeModal(interaction: ModalSubmitInteraction) {
    if (!interaction?.guildId || !interaction?.channelId) return
    await interaction.deferReply()

    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(interaction.guildId)

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

    const stockpilesEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('Stockpiles')
      .addFields(stockpileFields)
      .setTimestamp()

    const embeddedMessage = await this.stockpileDataService.getEmbeddedMessageId(
      interaction.guildId,
    )
    if (!embeddedMessage) {
      const message = await interaction.channel?.send({ embeds: [stockpilesEmbed] })
      if (!message) return
      await this.stockpileDataService.saveEmbeddedMessageId(
        interaction.guildId,
        interaction.channelId,
        message.id,
      )
    } else {
      const msg = await interaction.channel?.messages.fetch(embeddedMessage.embeddedMessageId)
      if (!msg) return
      const stockpilesEmbed = EmbedBuilder.from(msg?.embeds[0])
        .setColor(0x00ff00)
        .setTitle('Stockpiles')
        .addFields(stockpileFields)
        .setTimestamp()

      await msg?.edit({ embeds: [stockpilesEmbed] })
    }
  }
}
