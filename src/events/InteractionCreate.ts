import { Client, On, type ArgsOf } from 'discordx'
import { Discord } from 'discordx'
import {
  AddStockpileIds,
  EditStockpileIds,
  DeleteStockpileIds,
  SelectFactionIds,
  ResetStockpileTimerIds,
  Command,
} from '../models/constants'
import { AddStockpile } from '../commands/AddStockpile'
import { EditStockpile } from '../commands/EditStockpile'
import { DeleteStockpile } from '../commands/DeleteStockpile'
import { ResetStockpileTimer } from '../commands/ResetStockpileTimer'

@Discord()
export class InteractionCreate {
  private addStockpile = new AddStockpile()
  private editStockpile = new EditStockpile()
  private deleteStockpile = new DeleteStockpile()
  private resetStockpileTimer = new ResetStockpileTimer()

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
      } else if (interaction.customId === ResetStockpileTimerIds.StockpileSelect) {
        await client.executeInteraction(interaction)
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === AddStockpileIds.StockpileDetails) {
        await client.executeInteraction(interaction)
      } else if (interaction.customId.startsWith(EditStockpileIds.StockpileEditModal)) {
        await client.executeInteraction(interaction)
      }
    } else if (interaction.isButton()) {
      if (interaction.customId === 'add-stockpile') {
        try {
          await this.addStockpile.addStockpile(interaction)
        } catch (error) {
          console.error(error)
          await interaction.reply({
            content: 'An error occurred while executing the command.',
            ephemeral: true,
          })
        }
      } else if (interaction.customId === 'edit-stockpile') {
        try {
          await this.editStockpile.editStockpile(interaction)
        } catch (error) {
          console.error(error)
          await interaction.reply({
            content: 'An error occurred while executing the command.',
            ephemeral: true,
          })
        }
      } else if (interaction.customId === 'delete-stockpile') {
        try {
          await this.deleteStockpile.deleteStockpile(interaction)
        } catch (error) {
          console.error(error)
          await interaction.reply({
            content: 'An error occurred while executing the command.',
            ephemeral: true,
          })
        }
      } else if (interaction.customId === 'reset-stockpile-timer') {
        try {
          await this.resetStockpileTimer.resetStockpileTimer(interaction)
        } catch (error) {
          console.error(error)
          await interaction.reply({
            content: 'An error occurred while executing the command.',
            ephemeral: true,
          })
        }
      } else if (
        interaction.customId === SelectFactionIds.WardenButton ||
        interaction.customId === SelectFactionIds.ColonialButton
      ) {
        await client.executeInteraction(interaction)
      } else if (
        interaction.customId === DeleteStockpileIds.ConfirmButton ||
        interaction.customId === DeleteStockpileIds.CancelButton
      ) {
        await client.executeInteraction(interaction)
      } else if (interaction.customId === 'war_current' || interaction.customId === 'war_next') {
        await client.executeInteraction(interaction)
      }
    }
  }
}
