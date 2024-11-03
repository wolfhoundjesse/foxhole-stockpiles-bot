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
  return true
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

  // Log the bot's permissions and guild information
  console.log('=== Bot Permissions Check ===')
  console.log(`Guild: ${interaction.guild.name} (${interaction.guild.id})`)
  console.log('Current Bot Permissions:', botMember.permissions.toArray())
  console.log('Required Permissions:', requiredPermissions.toArray())

  const hasPermissions = botMember.permissions.has(requiredPermissions)

  if (!hasPermissions) {
    console.log('Permission check failed!')
    await interaction.reply({
      content:
        'I need the following permissions: View Channels, Send Messages, Embed Links, Read Message History, and Manage Messages',
      ephemeral: true,
    })
    return false
  }

  console.log('Permission check passed!')
  return true
}
