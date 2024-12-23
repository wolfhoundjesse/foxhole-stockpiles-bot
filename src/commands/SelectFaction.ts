import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type CommandInteraction,
  ButtonInteraction,
} from 'discord.js'
import { Discord, Guard, Slash, ButtonComponent } from 'discordx'
import { Command, Faction, SelectFactionIds, type FactionType } from '../models'
import { StockpileDataService } from '../services/stockpile-data-service'
import { checkBotPermissions } from '../utils/permissions'
import { PermissionGuard } from '../guards/PermissionGuard'
@Discord()
@Guard(PermissionGuard)
export class SelectFaction {
  private stockpileDataService = new StockpileDataService()

  @Slash({ description: 'Select a faction', name: Command.SelectFaction })
  async selectFaction(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    const wardenButton = new ButtonBuilder()
      .setCustomId(SelectFactionIds.WardenButton)
      .setLabel('Wardens')
      .setStyle(ButtonStyle.Primary)

    const colonialButton = new ButtonBuilder()
      .setCustomId(SelectFactionIds.ColonialButton)
      .setLabel('Colonials')
      .setStyle(ButtonStyle.Success)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(wardenButton, colonialButton)

    await interaction.reply({
      content: 'Select your faction:',
      components: [row],
      ephemeral: true,
    })
  }

  @ButtonComponent({ id: SelectFactionIds.WardenButton })
  async handleWardenSelection(interaction: ButtonInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    await this.handleFactionSelection(interaction, Faction.Wardens)
  }

  @ButtonComponent({ id: SelectFactionIds.ColonialButton })
  async handleColonialSelection(interaction: ButtonInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    await this.handleFactionSelection(interaction, Faction.Colonials)
  }

  private async handleFactionSelection(
    interaction: ButtonInteraction,
    faction: FactionType,
  ): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return
    const guildId = interaction.guildId
    if (!guildId) {
      console.error('No guild ID found for interaction')
      await interaction.reply({
        content: 'An error occurred while processing your selection.',
        ephemeral: true,
      })
      return
    }

    this.stockpileDataService.setFactionByGuildId(guildId, faction)
    await interaction.update({
      content: `You have selected the ${faction} faction.`,
      components: [],
    })
  }
}
