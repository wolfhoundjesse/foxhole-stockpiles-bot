import type { GuardFunction } from 'discordx';
import { CommandInteraction, MessageFlags, PermissionsBitField } from 'discord.js';
import { CommandPermissions } from '../models/permissions';
import { getPermissionString } from '../utils/types';

export const PermissionGuard: GuardFunction<CommandInteraction> = async (
  interaction,
  client,
  next,
  guardData
) => {
  const commandName = interaction.commandName as keyof typeof CommandPermissions;
  const permissions = CommandPermissions[commandName];

  if (!permissions) {
    return next();
  }

  // Check if user has required permissions
  if (
    permissions.defaultMemberPermissions &&
    !interaction.memberPermissions?.has(permissions.defaultMemberPermissions)
  ) {
    await interaction.reply({
      content: 'You do not have permission to use this command.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // Check if bot has required permissions
  const botMember = interaction.guild?.members.cache.get(client.user?.id ?? '');
  if (!botMember) return;

  const missingPermissions = permissions.botPermissions.filter(
    permission => !botMember.permissions.has(permission)
  );

  if (missingPermissions.length > 0) {
    const permissionNames = missingPermissions.map(getPermissionString).join(', ');

    await interaction.reply({
      content: `I need the following permissions: ${permissionNames}`,
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  return next();
};
