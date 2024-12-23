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
export default class ArchiveChannel {
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
      missingPermissions: missingPermissions.map((permission) => permission.toString()),
    }
  }

  @Slash({
    description: 'Archive this channel to the war archive channel',
    name: Command.ArchiveChannel,
  })
  async execute(
    @SlashOption({
      description: 'The war number to archive under',
      name: 'war_number',
      required: true,
      type: ApplicationCommandOptionType.Integer,
    })
    warNumber: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true })

      if (!(await checkBotPermissions(interaction))) return

      // Check if user has manage messages permission
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        await interaction.editReply({
          content: 'You need manage messages permission to use this command.',
        })
        return
      }

      const guildId = interaction.guildId
      if (!guildId) {
        await interaction.editReply({
          content: 'This command can only be used in a server.',
        })
        return
      }

      // Get the archive channel
      const archiveChannelId = await this.dataAccessService.getWarArchiveChannel(guildId)
      if (!archiveChannelId) {
        await interaction.editReply({
          content: 'No war archive channel has been set. Use /set-war-archive first.',
        })
        return
      }

      const archiveChannel = await interaction.guild?.channels.fetch(archiveChannelId)
      if (!archiveChannel || !(archiveChannel instanceof TextChannel)) {
        await interaction.editReply({
          content: 'Could not find the war archive channel.',
        })
        return
      }

      // Check source channel permissions
      const sourceChannel = interaction.channel as TextChannel
      const sourcePermissions = await this.checkChannelPermissions(sourceChannel, false)
      if (!sourcePermissions.hasPermissions) {
        await interaction.editReply({
          content: `Missing permissions in source channel: ${sourcePermissions.missingPermissions.join(', ')}`,
        })
        return
      }

      // Check archive channel permissions
      const archivePermissions = await this.checkChannelPermissions(archiveChannel, true)
      if (!archivePermissions.hasPermissions) {
        await interaction.editReply({
          content: `Missing permissions in archive channel: ${archivePermissions.missingPermissions.join(', ')}`,
        })
        return
      }

      await interaction.editReply({
        content: 'Starting archive process...',
      })

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

      await interaction.editReply({
        content: `Successfully archived ${messageCount} messages!`,
      })
    } catch (error) {
      Logger.error('ArchiveChannel', 'Failed to archive channel', error)
      try {
        await interaction.editReply({
          content: 'Failed to archive channel. Please try again later.',
        })
      } catch (e) {
        Logger.error('ArchiveChannel', 'Failed to send error message', e)
      }
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
