import {
  CommandInteraction,
  GuildMember,
  PermissionsBitField,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
} from 'discord.js'

export async function checkBotPermissions(
  interaction:
    | CommandInteraction
    | StringSelectMenuInteraction
    | ModalSubmitInteraction
    | ButtonInteraction,
): Promise<boolean> {
  if (!interaction.guild) return false

  const botMember = interaction.guild.members.cache.get(interaction.client.user.id)
  if (!botMember) return false

  const requiredPermissions = new PermissionsBitField([
    'ViewChannel',
    'SendMessages',
    'EmbedLinks',
    'ReadMessageHistory',
    'ManageMessages',
  ])

  const hasPermissions = botMember.permissions.has(requiredPermissions)

  if (!hasPermissions) {
    await interaction.reply({
      content:
        'I need the following permissions: View Channels, Send Messages, Embed Links, Read Message History, and Manage Messages',
      ephemeral: true,
    })
    return false
  }

  return true
}
