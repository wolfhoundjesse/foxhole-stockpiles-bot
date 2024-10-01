import { Client, On, type ArgsOf } from 'discordx'
import { Discord } from 'discordx'
import { AddStockpileIds } from '../models/constants'

@Discord()
export class InteractionCreate {
  @On({ event: 'interactionCreate' })
  async onInteractionCreate([interaction]: ArgsOf<'interactionCreate'>, client: Client) {
    if (interaction.isCommand()) {
      try {
        await client.executeInteraction(interaction)
      } catch (error) {
        console.error(error)
        await interaction.reply({
          content: 'An error occurred while executing the command.',
          ephemeral: true,
        })
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === AddStockpileIds.HexMenu) {
        await client.executeInteraction(interaction)
      } else if (interaction.customId === AddStockpileIds.StockpileMenu) {
        await client.executeInteraction(interaction)
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === AddStockpileIds.StockpileCode) {
        await client.executeInteraction(interaction)
      }
    }
  }
}
