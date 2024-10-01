import { Discord, Slash, SelectMenuComponent, ModalComponent } from 'discordx'
import {
  ActionRowBuilder,
  Embed,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  Routes,
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
export class EditStockpile {
  public stockpileDataService = new StockpileDataService()
  private selectedHex: string = ''
  private selectedLocation: string = ''

  @Slash({ description: 'Edit a stockpile', name: 'edit-stockpile' })
  async editStockpile(interaction: CommandInteraction) {
    //. get a list of stockpiles by guild ID
    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(interaction.guildId)

    if (!stockpiles) {
      await interaction.reply({ content: 'No stockpiles found', ephemeral: true })
      return
    }

    const hexSelectMenu = new StringSelectMenuBuilder()
      .setCustomId('edit/hex-menu')
      .setPlaceholder('Stockpile')
      .addOptions(
        Object.keys(stockpiles).map((key) => {
          return new StringSelectMenuOptionBuilder().setLabel(key).setValue(key)
        }),
      )

    const stockpileMenu = new StringSelectMenuBuilder()
      .setCustomId('edit/stockpile-menu')
      .setPlaceholder('Select a stockpile')
      .addOptions([{ label: "It's Disabled", value: "And Doesn't Matter" }])
      .setDisabled(true)

    const hexRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(hexSelectMenu)
    const stockpileRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      stockpileMenu.setDisabled(true),
    )

    await interaction.reply({
      components: [hexRow, stockpileRow],
      ephemeral: true,
      fetchReply: true,
    })
  }

  @SelectMenuComponent({ id: 'edit/hex-menu' })
  async handleHexSelect(interaction: StringSelectMenuInteraction) {
    this.selectedHex = interaction.values[0]
    const updatedHexMenu = new StringSelectMenuBuilder()
      .setCustomId('edit/hex-menu')
      .setPlaceholder('Select a hex')
      .setDisabled(true)
      .setOptions([{ label: this.selectedHex, value: this.selectedHex, default: true }])

    const hexRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(updatedHexMenu)

    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(interaction.guildId)

    if (!stockpiles) {
      await interaction.update({
        components: [hexRow],
        fetchReply: true,
      })
      return
    }

    const stockpilesByHex = stockpiles[this.selectedHex]

    if (!stockpilesByHex) {
      await interaction.update({
        components: [hexRow],
        fetchReply: true,
      })
      return
    }

    const stockpileOptions = stockpilesByHex.map(
      ({ id, locationName, storageType, stockpileName, code }) => {
        return new StringSelectMenuOptionBuilder()
          .setLabel(`${locationName} - ${storageType} - ${stockpileName}`)
          .setValue(id)
      },
    )

    const stockpileMenu = new StringSelectMenuBuilder()
      .setCustomId('edit/stockpile-menu')
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

  @SelectMenuComponent({ id: 'edit/stockpile-menu' })
  async handleStockpileSelect(interaction: StringSelectMenuInteraction) {
    if (!interaction.guildId) return
    const selectedStockpile = await this.stockpileDataService.getStockpileById(
      interaction.guildId,
      this.selectedHex,
      interaction.values[0],
    )

    const modal = new ModalBuilder()
      .setTitle('Enter Stockpile Code')
      .setCustomId('edit/stockpile-code')

    const stockpileCodeInputComponent = new TextInputBuilder()
      .setCustomId('edit/stockpile-code-input')
      .setLabel('Update stockpile code')
      .setStyle(TextInputStyle.Short)
      .setMinLength(6)
      .setMaxLength(6)
      .setRequired(true)
      .setValue(selectedStockpile.code)

    const stockpileIdInputComponent = new TextInputBuilder()
      .setCustomId('edit/stockpile-id-input')
      .setLabel(`Update stockpile ID (default is ${process.env.DEFAULT_STOCKPILE_ID})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)

    if (selectedStockpile.stockpileName !== process.env.DEFAULT_STOCKPILE_ID) {
      stockpileIdInputComponent.setValue(selectedStockpile.stockpileName)
    }

    const codeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      stockpileCodeInputComponent,
    )
    const idRow = new ActionRowBuilder<TextInputBuilder>().addComponents(stockpileIdInputComponent)
    modal.addComponents(codeRow, idRow)

    await interaction.showModal(modal)

    const submission = await interaction.awaitModalSubmit({
      time: 60000,
      filter: (i) => i.user.id === interaction.user.id,
    })
    const updatedCode = submission.fields.getTextInputValue('edit/stockpile-code-input')
    const updatedStockpileId =
      submission.fields.getTextInputValue('edit/stockpile-id-input') ||
      process.env.DEFAULT_STOCKPILE_ID

    if (!updatedCode || !updatedStockpileId) {
      throw new Error('Stockpile code is required')
    }

    await this.stockpileDataService.editStockpile(
      interaction.guildId,
      this.selectedHex,
      selectedStockpile.id,
      updatedCode,
      updatedStockpileId,
      interaction.user.id,
    )
  }

  @ModalComponent({ id: 'edit/stockpile-code' })
  async handleCodeModal(interaction: ModalSubmitInteraction) {
    if (!interaction?.guildId) return
    // const msg = await interaction.channel?.messages.fetch(
    //   this.stockpileDataService.embeddedMessageId,
    // )
    // console.log('msg', msg)
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

    const embeddedMessage = await this.stockpileDataService.getEmbeddedMessageId(
      interaction.guildId,
    )
    if (!embeddedMessage) {
      throw new Error('No embedded message found')
    }
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
