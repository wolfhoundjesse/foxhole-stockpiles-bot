import { CommandInteraction, EmbedBuilder } from 'discord.js'
import { Discord, Guard, Slash } from 'discordx'
import { Command } from '../models/constants'
import { checkBotPermissions } from '../utils/permissions'
import { PermissionGuard } from '../guards/PermissionGuard'

@Discord()
@Guard(PermissionGuard)
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
          name: '/reset-stockpiles',
          value: 'Reset all stockpiles for this server.',
        },
        {
          name: '/cleanup-messages',
          value: 'Clean up all messages after the stockpile embed.',
        },
        {
          name: '/register-war-channel',
          value: 'Register this channel for war start messages.',
        },
        {
          name: '/deregister-war-channel',
          value: 'Deregister this channel from war start messages.',
        },
        {
          name: '/post-war-message',
          value: 'Post a war start message in registered channels.',
        },
        {
          name: '/set-war-archive',
          value: 'Set this channel as the war archive channel.',
        },
        {
          name: '/archive-channel',
          value: 'Archive this channel to the war archive channel.',
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
