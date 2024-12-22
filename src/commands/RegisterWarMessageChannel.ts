import { Discord, Slash } from 'discordx'
import { CommandInteraction } from 'discord.js'
import { Command } from '../models/constants'
import { checkBotPermissions } from '../utils/permissions'
import { PostgresService } from '../services/postgres-service'
import { Logger } from '../utils/logger'

@Discord()
export class RegisterWarMessageChannel {
  private readonly dataAccessService = new PostgresService()

  @Slash({
    name: Command.RegisterWarChannel,
    description: 'Register this channel for war start messages',
  })
  async register(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return

    try {
      const guildId = interaction.guildId
      const channelId = interaction.channelId

      if (!guildId) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        })
        return
      }

      await this.dataAccessService.registerWarMessageChannel(guildId, channelId)

      await interaction.reply({
        content: 'This channel has been registered for war start messages!',
        ephemeral: true,
      })
    } catch (error) {
      Logger.error('RegisterWarMessageChannel', 'Failed to register channel', error)
      await interaction.reply({
        content: 'Failed to register channel. Please try again later.',
        ephemeral: true,
      })
    }
  }
}
