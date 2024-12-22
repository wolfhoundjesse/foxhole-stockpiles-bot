import { Discord, Slash } from 'discordx'
import { CommandInteraction } from 'discord.js'
import { Command } from '../models/constants'
import { checkBotPermissions } from '../utils/permissions'
import { StockpileDataService } from '../services/stockpile-data-service'
import { PostgresService } from '../services/postgres-service'
import { Logger } from '../utils/logger'

@Discord()
export class PostWarMessage {
  private stockpileService = new StockpileDataService()
  private dataAccessService = new PostgresService()

  @Slash({
    name: Command.PostWarMessage,
    description: 'Post a war start message in registered channels',
  })
  async post(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return

    try {
      await interaction.deferReply({ ephemeral: true })

      const warNumber = await this.stockpileService.getWarNumber()
      const message = `======== War ${warNumber} ========`

      const channels = await this.dataAccessService.getWarMessageChannels(interaction.guildId!)

      if (channels.length === 0) {
        await interaction.editReply('No channels are registered for war messages.')
        return
      }

      let successCount = 0
      for (const channelId of channels) {
        try {
          const channel = await interaction.guild?.channels.fetch(channelId)
          if (channel?.isTextBased()) {
            await channel.send(message)
            successCount++
          }
        } catch (error) {
          Logger.error('PostWarMessage', `Failed to post to channel ${channelId}`, error)
        }
      }

      await interaction.editReply(
        `Posted war message to ${successCount} of ${channels.length} channels.`,
      )
    } catch (error) {
      Logger.error('PostWarMessage', 'Failed to post war message', error)
      await interaction.editReply('Failed to post war message. Please try again later.')
    }
  }
}
