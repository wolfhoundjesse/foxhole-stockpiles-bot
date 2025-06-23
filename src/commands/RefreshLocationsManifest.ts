import { Discord, Guard, Slash } from 'discordx';
import { CommandInteraction, MessageFlags } from 'discord.js';
import { StockpileDataService } from '../services/stockpile-data-service.js';
import { checkBotPermissions } from '../utils/permissions.js';
import { Command } from '../models';
import { PermissionGuard } from '../guards/PermissionGuard';

@Discord()
@Guard(PermissionGuard)
export class RefreshLocationsManifest {
  public stockpileDataService = new StockpileDataService();

  @Slash({
    name: Command.RefreshManifest,
    description: 'Manually refresh the locations manifest'
  })
  async refreshManifest(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;
    try {
      await this.stockpileDataService.updateLocationsManifest(true);
      await interaction.reply({
        content: 'Locations manifest has been refreshed successfully.',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error refreshing locations manifest:', error);
      await interaction.reply({
        content:
          'An error occurred while refreshing the locations manifest. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
}
