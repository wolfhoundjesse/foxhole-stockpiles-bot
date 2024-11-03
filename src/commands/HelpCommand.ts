import { CommandInteraction, EmbedBuilder } from 'discord.js'
import { Discord, Slash } from 'discordx'
import { Command } from '../models/constants'
import { checkBotPermissions } from '../utils/permissions'

@Discord()
export class HelpCommand {
  @Slash({ description: 'Display information about available commands', name: Command.Help })
  async help(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return

    const embed = new EmbedBuilder()
      .setTitle('📖 Foxhole Stockpiles Bot - Help')
      .setColor('#5865F2')
      .setDescription('Here are all the available commands:')
      .addFields([
        {
          name: '/select-faction',
          value:
            'Select your faction (Wardens or Colonials). Must be set before using other commands.',
        },
        {
          name: '/add-stockpile',
          value: 'Add a new stockpile to the database.',
        },
        {
          name: '/edit-stockpile',
          value: "Edit an existing stockpile's code or name.",
        },
        {
          name: '/delete-stockpile',
          value: 'Delete an existing stockpile from the database.',
        },
        {
          name: '/refresh-manifest',
          value: 'Manually refresh the locations manifest (updates available storage locations).',
        },
        {
          name: '/help',
          value: 'Display this help message.',
        },
      ])
      .setFooter({
        text: 'For more detailed information, visit our documentation or contact support.',
      })
      .setTimestamp()

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    })
  }
}
