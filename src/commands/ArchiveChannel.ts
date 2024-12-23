import { Discord, Slash, SlashOption } from 'discordx'
import {
  CommandInteraction,
  TextChannel,
  PermissionFlagsBits,
  ApplicationCommandOptionType,
  PermissionsBitField,
} from 'discord.js'
import { Command } from '../models/constants'
import { checkBotPermissions } from '../utils/permissions'
import { PostgresService } from '../services/postgres-service'
import { Logger } from '../utils/logger'

@Discord()
export class ArchiveChannel {
  private readonly dataAccessService = new PostgresService()

  private async checkChannelPermissions(
    channel: TextChannel,
    isArchiveChannel: boolean,
  ): Promise<{ hasPermissions: boolean; missingPermissions: string[] }> {
    const requiredPermissions = new PermissionsBitField([
      PermissionFlagsBits.ViewChannel,
      isArchiveChannel ? PermissionFlagsBits.SendMessages : PermissionFlagsBits.ReadMessageHistory,
    ])

    const botMember = channel.guild.members.cache.get(channel.client.user.id)
    if (!botMember) {
      return { hasPermissions: false, missingPermissions: ['Bot member not found'] }
    }

    const missingPermissions = []
    for (const permission of requiredPermissions) {
      if (!channel.permissionsFor(botMember)?.has(permission)) {
        missingPermissions.push(PermissionsBitField.Flags[permission])
      }
    }

    return {
      hasPermissions: missingPermissions.length === 0,
      missingPermissions,
    }
  }

  @Slash({
    name: Command.ArchiveChannel,
    description: 'Archive this channel to the war archive channel',
  })
  async archive(
    interaction: CommandInteraction,
    @SlashOption({
      name: 'war_number',
      description: 'The war number to archive under',
      required: true,
      type: ApplicationCommandOptionType.Integer,
    })
    warNumber: number,
  ): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return

    try {
      // Check if user has manage messages permission
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({
          content: 'You need manage messages permission to use this command.',
          ephemeral: true,
        })
        return
      }

      const guildId = interaction.guildId
      if (!guildId) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        })
        return
      }

      // Get the archive channel
      const archiveChannelId = await this.dataAccessService.getWarArchiveChannel(guildId)
      if (!archiveChannelId) {
        await interaction.reply({
          content: 'No war archive channel has been set. Use /set-war-archive first.',
          ephemeral: true,
        })
        return
      }

      const archiveChannel = await interaction.guild?.channels.fetch(archiveChannelId)
      if (!archiveChannel || !(archiveChannel instanceof TextChannel)) {
        await interaction.reply({
          content: 'Could not find the war archive channel.',
          ephemeral: true,
        })
        return
      }

      // Check source channel permissions
      const sourceChannel = interaction.channel as TextChannel
      const sourcePermissions = await this.checkChannelPermissions(sourceChannel, false)
      if (!sourcePermissions.hasPermissions) {
        await interaction.reply({
          content: `Missing permissions in source channel: ${sourcePermissions.missingPermissions.join(', ')}`,
          ephemeral: true,
        })
        return
      }

      // Check archive channel permissions
      const archivePermissions = await this.checkChannelPermissions(archiveChannel, true)
      if (!archivePermissions.hasPermissions) {
        await interaction.reply({
          content: `Missing permissions in archive channel: ${archivePermissions.missingPermissions.join(', ')}`,
          ephemeral: true,
        })
        return
      }

      await interaction.deferReply({ ephemeral: true })

      // Add war number header
      await archiveChannel.send(`========== War ${warNumber} ==========`)

      // Fetch and archive messages
      let lastId: string | undefined
      let messageCount = 0

      while (true) {
        const messages = await sourceChannel.messages.fetch({
          limit: 100,
          before: lastId,
        })

        if (messages.size === 0) break

        const formattedMessages: string[] = []
        messages.forEach((message) => {
          const timestamp = message.createdAt.toISOString()
          const content = `[${timestamp}] ${message.author.username}: ${message.content}`
          formattedMessages.push(content)
          messageCount++
        })

        // Send messages in chunks to avoid Discord's message length limit
        const messageChunks = this.chunkArray(formattedMessages.reverse(), 1900)
        for (const chunk of messageChunks) {
          await archiveChannel.send('```\n' + chunk.join('\n') + '\n```')
        }

        lastId = messages.last()?.id
      }

      await interaction.followUp({
        content: `Successfully archived ${messageCount} messages!`,
        ephemeral: true,
      })
    } catch (error) {
      Logger.error('ArchiveChannel', 'Failed to archive channel', error)
      await interaction.followUp({
        content: 'Failed to archive channel. Please try again later.',
        ephemeral: true,
      })
    }
  }

  private chunkArray(array: string[], size: number): string[][] {
    const chunks: string[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}
