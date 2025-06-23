import { Discord, Guard, Slash } from 'discordx';
import { CommandInteraction, MessageFlags } from 'discord.js';
import { Command } from '../../models/constants';
import { checkBotPermissions } from '../../utils/permissions';
import { PostgresService } from '../../services/postgres-service';
import { Logger } from '../../utils/logger';
import { PermissionGuard } from '../../guards/PermissionGuard';

@Discord()
@Guard(PermissionGuard)
export class RegisterWarMessageChannel {
  private readonly dataAccessService = new PostgresService();

  @Slash({
    name: Command.RegisterWarChannel,
    description: 'Register this channel for war start messages'
  })
  async register(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;

    try {
      const guildId = interaction.guildId;
      const channelId = interaction.channelId;

      if (!guildId) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await this.dataAccessService.registerWarMessageChannel(guildId, channelId);

      await interaction.reply({
        content: 'This channel has been registered for war start messages!',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      Logger.error('RegisterWarMessageChannel', 'Failed to register channel', error);
      await interaction.reply({
        content: 'Failed to register channel. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  @Slash({
    name: Command.DeregisterWarChannel,
    description: 'Deregister this channel from war start messages'
  })
  async deregister(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;

    try {
      const guildId = interaction.guildId;
      const channelId = interaction.channelId;

      if (!guildId) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await this.dataAccessService.deregisterWarMessageChannel(guildId, channelId);

      await interaction.reply({
        content: 'This channel has been deregistered from war start messages!',
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      Logger.error('RegisterWarMessageChannel', 'Failed to deregister channel', error);
      await interaction.reply({
        content: 'Failed to deregister channel. Please try again later.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
}
