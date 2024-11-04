import { Discord, Slash } from 'discordx'
import { CommandInteraction } from 'discord.js'
import { StockpileDataService } from '../services/stockpile-data-service'
import { Command } from '../models'

@Discord()
export class ResetStockpilesCommand {
  constructor(private stockpileDataService: StockpileDataService) {}

  @Slash({
    name: Command.ResetStockpiles,
    description: 'Reset all stockpiles for this server',
  })
  async resetStockpiles(interaction: CommandInteraction): Promise<void> {
    // Defer reply since this might take a moment
    await interaction.deferReply()

    try {
      // Get the guild ID from the interaction
      const guildId = interaction.guildId
      if (!guildId) {
        await interaction.editReply('This command can only be used in a server.')
        return
      }

      // Reset stockpiles for this guild
      await this.stockpileDataService.resetStockpilesByGuildId(guildId)

      await interaction.editReply('All stockpiles have been reset for this server.')
    } catch (error) {
      console.error('Error resetting stockpiles:', error)
      await interaction.editReply('An error occurred while resetting stockpiles.')
    }
  }
}
