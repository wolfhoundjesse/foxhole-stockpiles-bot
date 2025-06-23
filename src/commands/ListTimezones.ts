import { CommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { Discord, Guard, Slash } from 'discordx';
import { Command } from '../models/constants';
import { PermissionGuard } from '../guards/PermissionGuard';
import { PostgresService } from '../services/postgres-service';

@Discord()
@Guard(PermissionGuard)
export class ListTimezonesCommand {
  private postgresService = new PostgresService();

  @Slash({
    name: 'list-timezones',
    description: 'List all users and their timezones'
  })
  async listTimezones(interaction: CommandInteraction): Promise<void> {
    try {
      const timezones = await this.postgresService.getAllTimezones();

      if (timezones.length === 0) {
        await interaction.reply({
          content: 'No users have registered their timezones yet.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🌍 User Timezones')
        .setColor('#0099ff')
        .setDescription('Here are all registered timezones and their users:')
        .setTimestamp();

      // Group users by timezone
      for (const timezoneData of timezones) {
        const users = await this.postgresService.getUsersByTimezone(timezoneData.timezone);

        if (users.length > 0) {
          // Fetch usernames for all users in this timezone
          const userList = await Promise.all(
            users.map(async user => {
              const displayName = user.displayName ? ` (${user.displayName})` : '';

              try {
                // Fetch the user from Discord
                const discordUser = await interaction.client.users.fetch(user.userId);
                return `• ${discordUser.username}${displayName}`;
              } catch (error) {
                // If we can't fetch the user (they might have left the server), show their ID
                console.warn(`Could not fetch user ${user.userId}:`, error);
                return `• Unknown User (${user.userId})${displayName}`;
              }
            })
          );

          const currentTime = this.getCurrentTime(timezoneData.timezone);
          const timezoneLabel = this.formatTimezoneLabel(timezoneData.timezone);

          embed.addFields({
            name: `${timezoneLabel} - ${currentTime}`,
            value: userList.join('\n'),
            inline: false
          });
        }
      }

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error listing timezones:', error);
      await interaction.reply({
        content: 'An error occurred while fetching timezone information.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  private formatTimezoneLabel(timezone: string): string {
    const parts = timezone.split('/');
    if (parts.length === 1) return timezone;

    const city = parts[parts.length - 1].replace(/_/g, ' ');
    const region = parts[0];
    return `${city} (${region})`;
  }

  private getCurrentTime(timezone: string): string {
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return 'Unable to get current time';
    }
  }
}
