import { Discord, Guard, Slash, SlashOption } from 'discordx';
import {
  CommandInteraction,
  TextChannel,
  PermissionFlagsBits,
  ApplicationCommandOptionType,
  PermissionsBitField
} from 'discord.js';
import { Command } from '../models/constants';
import { checkBotPermissions } from '../utils/permissions';
import { PostgresService } from '../services/postgres-service';
import { Logger } from '../utils/logger';
import { CommandPermissions } from '../models/permissions';
import { PermissionGuard } from '../guards/PermissionGuard';
import { getPermissionString } from '../utils/types';

@Discord()
@Guard(PermissionGuard)
export default class ArchiveChannel {
  private readonly dataAccessService = new PostgresService();

  private async checkChannelPermissions(
    channel: TextChannel,
    isArchiveChannel: boolean
  ): Promise<{ hasPermissions: boolean; missingPermissions: string[] }> {
    const requiredPermissions = new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      isArchiveChannel ? PermissionFlagsBits.SendMessages : PermissionFlagsBits.ReadMessageHistory
    ]);

    const botMember = channel.guild.members.cache.get(channel.client.user.id);
    if (!botMember) {
      return { hasPermissions: false, missingPermissions: ['Bot member not found'] };
    }

    const missingPermissions = [];
    for (const permission of requiredPermissions) {
      if (!channel.permissionsFor(botMember)?.has(permission)) {
        missingPermissions.push(PermissionsBitField.Flags[permission]);
      }
    }

    return {
      hasPermissions: missingPermissions.length === 0,
      missingPermissions: missingPermissions.map(permission => permission.toString())
    };
  }

  @Slash({
    description: 'Archive this channel to the war archive channel',
    name: Command.ArchiveChannel,
    defaultMemberPermissions: CommandPermissions[Command.ArchiveChannel].defaultMemberPermissions
  })
  async execute(
    @SlashOption({
      description: 'The war number to archive under',
      name: 'war_number',
      required: true,
      type: ApplicationCommandOptionType.Integer
    })
    warNumber: number,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });

      if (!(await this.checkCommandPermissions(interaction))) return;

      // Check if user has manage messages permission
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.editReply({
          content: 'You need manage messages permission to use this command.'
        });
        return;
      }

      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply({
          content: 'This command can only be used in a server.'
        });
        return;
      }

      // Get the archive channel
      const archiveChannelId = await this.dataAccessService.getWarArchiveChannel(guildId);
      if (!archiveChannelId) {
        await interaction.editReply({
          content: 'No war archive channel has been set. Use /set-war-archive first.'
        });
        return;
      }

      const archiveChannel = await interaction.guild?.channels.fetch(archiveChannelId);
      if (!archiveChannel || !(archiveChannel instanceof TextChannel)) {
        await interaction.editReply({
          content: 'Could not find the war archive channel.'
        });
        return;
      }

      // Check source channel permissions
      const sourceChannel = interaction.channel as TextChannel;
      const sourcePermissions = await this.checkChannelPermissions(sourceChannel, false);
      if (!sourcePermissions.hasPermissions) {
        await interaction.editReply({
          content: `Missing permissions in source channel: ${sourcePermissions.missingPermissions.join(', ')}`
        });
        return;
      }

      // Check archive channel permissions
      const archivePermissions = await this.checkChannelPermissions(archiveChannel, true);
      if (!archivePermissions.hasPermissions) {
        await interaction.editReply({
          content: `Missing permissions in archive channel: ${archivePermissions.missingPermissions.join(', ')}`
        });
        return;
      }

      await interaction.editReply({
        content: 'Starting archive process...'
      });

      // Add war number header
      await archiveChannel.send(`========== War ${warNumber} ==========`);

      // Fetch and archive messages
      let lastId: string | undefined;
      let messageCount = 0;
      const MAX_MESSAGE_LENGTH = 1800; // Conservative limit for Discord messages

      while (true) {
        const messages = await sourceChannel.messages.fetch({
          limit: 100,
          before: lastId
        });

        if (messages.size === 0) break;

        const formattedMessages: string[] = [];
        for (const message of messages.values()) {
          const timestamp = message.createdAt.toISOString();

          // Process the message content to resolve mentions
          let content = message.content;

          // Replace user mentions with usernames
          const userMentionPattern = /<@!?(\d+)>/g;
          const userMentions = [...content.matchAll(userMentionPattern)];
          for (const mention of userMentions) {
            try {
              const userId = mention[1];
              const user = await interaction.client.users.fetch(userId);
              content = content.replace(mention[0], `@${user.username}`);
            } catch (error) {
              // If we can't fetch the user, leave the mention as is
              Logger.error(
                'ArchiveChannel',
                `Failed to resolve user mention: ${mention[0]}`,
                error
              );
            }
          }

          // Replace channel mentions with channel names
          const channelMentionPattern = /<#(\d+)>/g;
          const channelMentions = [...content.matchAll(channelMentionPattern)];
          for (const mention of channelMentions) {
            try {
              const channelId = mention[1];
              const channel = await interaction.guild?.channels.fetch(channelId);
              content = content.replace(mention[0], `#${channel?.name || 'unknown-channel'}`);
            } catch (error) {
              Logger.error(
                'ArchiveChannel',
                `Failed to resolve channel mention: ${mention[0]}`,
                error
              );
            }
          }

          // Replace role mentions with role names
          const roleMentionPattern = /<@&(\d+)>/g;
          const roleMentions = [...content.matchAll(roleMentionPattern)];
          for (const mention of roleMentions) {
            try {
              const roleId = mention[1];
              const role = await interaction.guild?.roles.fetch(roleId);
              content = content.replace(mention[0], `@${role?.name || 'unknown-role'}`);
            } catch (error) {
              Logger.error(
                'ArchiveChannel',
                `Failed to resolve role mention: ${mention[0]}`,
                error
              );
            }
          }

          // Format the final message
          const formattedMessage = `[${timestamp}] ${message.author.username}: ${content}`;
          formattedMessages.push(formattedMessage);
          messageCount++;
        }

        // Process messages in reverse order (oldest first)
        const reversedMessages = formattedMessages.reverse();
        let currentChunk: string[] = [];
        let currentLength = 0;

        for (const message of reversedMessages) {
          // Calculate new length including the message and a newline
          const messageLength = message.length + 1; // +1 for newline

          // If adding this message would exceed the limit, send the current chunk
          if (currentLength + messageLength > MAX_MESSAGE_LENGTH) {
            if (currentChunk.length > 0) {
              await archiveChannel.send('```\n' + currentChunk.join('\n') + '\n```');
              currentChunk = [];
              currentLength = 0;
            }
          }

          // If the message itself is too long, split it
          if (messageLength > MAX_MESSAGE_LENGTH) {
            const parts = this.splitLongMessage(message, MAX_MESSAGE_LENGTH);
            for (const part of parts) {
              await archiveChannel.send('```\n' + part + '\n```');
            }
          } else {
            currentChunk.push(message);
            currentLength += messageLength;
          }
        }

        // Send any remaining messages
        if (currentChunk.length > 0) {
          await archiveChannel.send('```\n' + currentChunk.join('\n') + '\n```');
        }

        lastId = messages.last()?.id;
      }

      await interaction.editReply({
        content: `Successfully archived ${messageCount} messages!`
      });
    } catch (error) {
      Logger.error('ArchiveChannel', 'Failed to archive channel', error);
      try {
        await interaction.editReply({
          content: 'Failed to archive channel. Please try again later.'
        });
      } catch (e) {
        Logger.error('ArchiveChannel', 'Failed to send error message', e);
      }
    }
  }

  private splitLongMessage(message: string, maxLength: number): string[] {
    const parts: string[] = [];
    let remainingMessage = message;

    while (remainingMessage.length > 0) {
      // Find a good breaking point
      let splitPoint = maxLength;
      if (remainingMessage.length > maxLength) {
        // Try to split at the last space before the limit
        const lastSpace = remainingMessage.lastIndexOf(' ', maxLength);
        if (lastSpace > 0) {
          splitPoint = lastSpace;
        }
      }

      parts.push(remainingMessage.slice(0, splitPoint));
      remainingMessage = remainingMessage.slice(splitPoint).trim();
    }

    return parts;
  }

  private chunkArray(array: string[], size: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async checkCommandPermissions(interaction: CommandInteraction): Promise<boolean> {
    const commandPerms = CommandPermissions[Command.ArchiveChannel].botPermissions;

    if (!interaction.guild) {
      await interaction.editReply({
        content: 'This command can only be used in a server.'
      });
      return false;
    }

    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    if (!botMember) return false;

    const missingPermissions = commandPerms.filter(
      permission => !botMember.permissions.has(permission)
    );

    if (missingPermissions.length > 0) {
      const permissionNames = missingPermissions.map(perm => getPermissionString(perm)).join(', ');

      await interaction.editReply({
        content: `I need the following permissions: ${permissionNames}`
      });
      return false;
    }

    return true;
  }
}
