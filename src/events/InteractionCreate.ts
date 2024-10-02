import { Client, On, type ArgsOf } from 'discordx'
import { Discord } from 'discordx'
import {
  AddStockpileIds,
  EditStockpileIds,
  DeleteStockpileIds,
  SelectFactionIds,
} from '../models/constants'

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
      } else if (interaction.customId === EditStockpileIds.StockpileSelect) {
        await client.executeInteraction(interaction)
      } else if (interaction.customId === DeleteStockpileIds.StockpileSelect) {
        await client.executeInteraction(interaction)
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === AddStockpileIds.StockpileDetails) {
        await client.executeInteraction(interaction)
      } else if (interaction.customId.startsWith(EditStockpileIds.StockpileEditModal)) {
        await client.executeInteraction(interaction)
      }
    } else if (interaction.isButton()) {
      // Handle faction selection buttons
      if (
        interaction.customId === SelectFactionIds.WardenButton ||
        interaction.customId === SelectFactionIds.ColonialButton
      ) {
        await client.executeInteraction(interaction)
      } else if (
        interaction.customId === DeleteStockpileIds.ConfirmButton ||
        interaction.customId === DeleteStockpileIds.CancelButton
      ) {
        await client.executeInteraction(interaction)
      }
    }
  }
}
