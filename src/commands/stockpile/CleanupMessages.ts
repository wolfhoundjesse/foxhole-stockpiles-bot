import { Discord, Guard, Slash } from 'discordx';
import { ApplicationCommandOptionType, CommandInteraction } from 'discord.js';
import { StockpileDataService } from '../../services/stockpile-data-service';
import { Logger } from '../../utils/logger';
import { Command } from '../../models/constants';
import { PermissionGuard } from '../../guards/PermissionGuard';

@Discord()
@Guard(PermissionGuard)
export class CleanupMessages {
  private stockpileService = new StockpileDataService();
  @Slash({
    name: Command.CleanupMessages,
    description: 'Cleans up all messages after the stockpile embed'
  })
  async cleanup(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply('This command can only be used in a server.');
        return;
      }

      // Get the embed info for this guild
      const embedInfo = await this.stockpileService.getEmbedsByGuildId(guildId);
      if (!embedInfo?.channelId || !embedInfo?.embeddedMessageId) {
        await interaction.editReply('No stockpile embed found for this server.');
        return;
      }

      // Get the channel
      const channel = await interaction.guild?.channels.fetch(embedInfo.channelId);
      if (!channel?.isTextBased()) {
        await interaction.editReply('Could not find the stockpile channel.');
        return;
      }

      // Clean up the messages
      await this.stockpileService.cleanupChannelMessages(channel, embedInfo.embeddedMessageId);

      await interaction.editReply('Successfully cleaned up messages!');
    } catch (error) {
      Logger.error('CleanupCommand', 'Failed to cleanup messages', error);
      await interaction.editReply('Failed to cleanup messages. Please try again later.');
    }
  }
}
