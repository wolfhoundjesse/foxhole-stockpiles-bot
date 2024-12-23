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
  if (!interaction.guild) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    })
    return false
  }

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
    const missingPermissions = requiredPermissions
      .toArray()
      .filter((perm) => !botMember.permissions.has(perm))

    await interaction.reply({
      content: `I need the following permissions: ${missingPermissions.join(', ')}`,
      ephemeral: true,
    })
    return false
  }

  return true
}
