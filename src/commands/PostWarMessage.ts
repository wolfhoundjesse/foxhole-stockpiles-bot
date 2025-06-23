import { Discord, Guard, Slash, ButtonComponent } from 'discordx';
import {
  CommandInteraction,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import { Command } from '../models/constants';
import { checkBotPermissions } from '../utils/permissions';
import { StockpileDataService } from '../services/stockpile-data-service';
import { PostgresService } from '../services/postgres-service';
import { Logger } from '../utils/logger';
import { PermissionGuard } from '../guards/PermissionGuard';

@Discord()
@Guard(PermissionGuard)
export class PostWarMessage {
  private stockpileService = new StockpileDataService();
  private dataAccessService = new PostgresService();
  private warSelectionCache = new Map<string, number>(); // Store user's war number selection

  @Slash({
    name: Command.PostWarMessage,
    description: 'Post a war start message in registered channels'
  })
  async post(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;

    try {
      const warNumber = await this.stockpileService.getWarNumber();

      const currentWarButton = new ButtonBuilder()
        .setCustomId('war_current')
        .setLabel(`Current War (${warNumber})`)
        .setStyle(ButtonStyle.Primary);

      const nextWarButton = new ButtonBuilder()
        .setCustomId('war_next')
        .setLabel(`Next War (${warNumber + 1})`)
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        currentWarButton,
        nextWarButton
      );

      await interaction.reply({
        content: 'Which war number should be used in the message?',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      Logger.error('PostWarMessage', 'Failed to post war message', error);
      await interaction.reply({
        content: 'Failed to post war message. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @ButtonComponent({ id: 'war_current' })
  async handleCurrentWar(interaction: ButtonInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;
    const warNumber = await this.stockpileService.getWarNumber();
    await this.postWarMessage(interaction, warNumber);
  }

  @ButtonComponent({ id: 'war_next' })
  async handleNextWar(interaction: ButtonInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;
    const warNumber = await this.stockpileService.getWarNumber();
    await this.postWarMessage(interaction, warNumber + 1);
  }

  private async postWarMessage(interaction: ButtonInteraction, warNumber: number): Promise<void> {
    try {
      await interaction.deferUpdate();

      const message = `======== War ${warNumber} ========`;
      const channels = await this.dataAccessService.getWarMessageChannels(interaction.guildId!);

      if (channels.length === 0) {
        await interaction.editReply({
          content: 'No channels are registered for war messages.',
          components: []
        });
        return;
      }

      let successCount = 0;
      for (const channelId of channels) {
        try {
          const channel = await interaction.guild?.channels.fetch(channelId);
          if (channel?.isTextBased()) {
            await channel.send(message);
            successCount++;
          }
        } catch (error) {
          Logger.error('PostWarMessage', `Failed to post to channel ${channelId}`, error);
        }
      }

      await interaction.editReply({
        content: `Posted war message to ${successCount} of ${channels.length} channels.`,
        components: []
      });
    } catch (error) {
      Logger.error('PostWarMessage', 'Failed to post war message', error);
      await interaction.editReply({
        content: 'Failed to post war message. Please try again later.',
        components: []
      });
    }
  }
}
