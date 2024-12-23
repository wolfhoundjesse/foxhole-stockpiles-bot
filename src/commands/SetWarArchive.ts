import { Discord, Slash } from 'discordx'
import { CommandInteraction, PermissionFlagsBits } from 'discord.js'
import { Command } from '../models/constants'
import { checkBotPermissions } from '../utils/permissions'
import { PostgresService } from '../services/postgres-service'
import { Logger } from '../utils/logger'

@Discord()
export class SetWarArchive {
  private readonly dataAccessService = new PostgresService()

  @Slash({
    name: Command.SetWarArchive,
    description: 'Set this channel as the war archive channel',
  })
  async setArchive(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return

    try {
      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: 'You need administrator permissions to use this command.',
          ephemeral: true,
        })
        return
      }

      const guildId = interaction.guildId
      const channelId = interaction.channelId

      if (!guildId) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        })
        return
      }

      await this.dataAccessService.setWarArchiveChannel(guildId, channelId)

      await interaction.reply({
        content: 'This channel has been set as the war archive channel!',
        ephemeral: true,
      })
    } catch (error) {
      Logger.error('SetWarArchive', 'Failed to set archive channel', error)
      await interaction.reply({
        content: 'Failed to set archive channel. Please try again later.',
        ephemeral: true,
      })
    }
  }
}