import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { Discord, Guard, Slash, SlashOption, SelectMenuComponent, ModalComponent } from 'discordx'
import { Command, EditStockpileIds } from '../models/constants'
import { StockpileDataService } from '../services/stockpile-data-service'
import { FactionColors } from '../models'
import { checkBotPermissions } from '../utils/permissions'
import { PermissionGuard } from '../guards/PermissionGuard'

@Discord()
@Guard(PermissionGuard)
export class EditStockpile {
  private stockpileDataService = new StockpileDataService()
  private hex: { [userId: string]: string } = {}
  private stockpileId: { [userId: string]: string } = {}

  @Slash({ description: 'Edit an existing stockpile', name: Command.EditStockpile })
  async editStockpile(interaction: CommandInteraction): Promise<void> {
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
          value: `${hex}:${stockpile.id}`,
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
        .setCustomId(EditStockpileIds.StockpileSelect)
        .setPlaceholder('Select a stockpile to edit')
        .addOptions(stockpileOptions)

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

      await interaction.reply({
        content: 'Please select the stockpile you want to edit:',
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

  @SelectMenuComponent({ id: EditStockpileIds.StockpileSelect })
  async handleStockpileSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    const [hex, stockpileId] = interaction.values[0].split(':')
    this.hex[interaction.user.id] = hex
    this.stockpileId[interaction.user.id] = stockpileId
    const { guildId } = interaction

    if (!guildId || !interaction.channelId) {
      await interaction.reply({
        content: 'This command can only be used in a server channel.',
        ephemeral: true,
      })
      return
    }

    const stockpile = await this.stockpileDataService.getStockpileById(
      guildId,
      hex,
      stockpileId,
      interaction.channelId,
    )

    if (!stockpile) {
      await interaction.reply({
        content: 'Stockpile not found. Please try again.',
        ephemeral: true,
      })
      return
    }

    const modal = new ModalBuilder()
      .setCustomId(`${EditStockpileIds.StockpileEditModal}`)
      .setTitle('Edit Stockpile')

    const codeInput = new TextInputBuilder()
      .setCustomId(EditStockpileIds.StockpileCodeInput)
      .setLabel('Stockpile Code')
      .setStyle(TextInputStyle.Short)
      .setValue(stockpile.code)
      .setMaxLength(6)
      .setMinLength(6)
      .setRequired(true)

    const nameInput = new TextInputBuilder()
      .setCustomId(EditStockpileIds.StockpileNameInput)
      .setLabel('Stockpile Name')
      .setStyle(TextInputStyle.Short)
      .setValue(stockpile.stockpileName)
      .setRequired(true)

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput)
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)

    modal.addComponents(firstActionRow, secondActionRow)

    await interaction.showModal(modal)
  }

  @ModalComponent({ id: EditStockpileIds.StockpileEditModal })
  async handleStockpileEdit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    const { guildId, user } = interaction

    if (!guildId || !interaction.channelId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      })
      return
    }

    const code = interaction.fields.getTextInputValue(EditStockpileIds.StockpileCodeInput)
    const name = interaction.fields.getTextInputValue(EditStockpileIds.StockpileNameInput)

    const success = await this.stockpileDataService.editStockpile(
      guildId,
      this.hex[interaction.user.id],
      this.stockpileId[interaction.user.id],
      interaction.channelId,
      code,
      name,
      user.id,
    )

    if (!success) {
      await interaction.reply({
        content: `> 🚫 **Error:** A stockpile with the name "**${name}**" already exists in this location.\n> \n> ✏️ Please try editing again with a different name.`,
        ephemeral: true,
      })
      return
    }

    delete this.hex[interaction.user.id]
    delete this.stockpileId[interaction.user.id]

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

  private async createStockpilesEmbed(guildId: string): Promise<EmbedBuilder> {
    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(guildId)
    const embedTitle = await this.stockpileDataService.getEmbedTitle()
    const faction = await this.stockpileDataService.getFactionByGuildId(guildId)
    const color = FactionColors[faction]

    if (!stockpiles) {
      return new EmbedBuilder()
        .setTitle(embedTitle)
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
      .setTitle(embedTitle)
      .setColor(color)
      .addFields(stockpileFields)
      .setTimestamp()
  }
}
