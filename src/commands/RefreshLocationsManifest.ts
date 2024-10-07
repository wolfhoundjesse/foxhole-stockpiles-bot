import { Discord, Slash } from 'discordx'
import { CommandInteraction } from 'discord.js'
import { StockpileDataService } from '../services/stockpile-data-service.js'

@Discord()
export class RefreshLocationsManifest {
  public stockpileDataService = new StockpileDataService()

  @Slash({
    name: 'refresh-manifest',
    description: 'Manually refresh the locations manifest',
  })
  async refreshManifest(interaction: CommandInteraction): Promise<void> {
    try {
      await this.stockpileDataService.updateLocationsManifest(true)
      await interaction.reply({
        content: 'Locations manifest has been refreshed successfully.',
        ephemeral: true,
      })
    } catch (error) {
      console.error('Error refreshing locations manifest:', error)
      await interaction.reply({
        content:
          'An error occurred while refreshing the locations manifest. Please try again later.',
        ephemeral: true,
      })
    }
  }
}
