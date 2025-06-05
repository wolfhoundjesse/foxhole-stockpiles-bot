import { PermissionFlagsBits } from 'discord.js'
import { Command } from './constants'

export const CommandPermissions = {
  [Command.ArchiveChannel]: {
    defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
    botPermissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
    ],
  },
  [Command.SetWarArchive]: {
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    botPermissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
  },
  [Command.Help]: {
    defaultMemberPermissions: null, // Available to everyone
    botPermissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ],
  },
  [Command.AddStockpile]: {
    defaultMemberPermissions: null,
    botPermissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ],
  },
  [Command.EditStockpile]: {
    defaultMemberPermissions: null,
    botPermissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ],
  },
  [Command.DeleteStockpile]: {
    defaultMemberPermissions: null,
    botPermissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ],
  },
  [Command.SelectFaction]: {
    defaultMemberPermissions: null,
    botPermissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
  },
  [Command.RefreshManifest]: {
    defaultMemberPermissions: null,
    botPermissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
  },
  [Command.ResetStockpiles]: {
    defaultMemberPermissions: null,
    botPermissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ],
  },
  [Command.CleanupMessages]: {
    defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
    botPermissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageMessages,
    ],
  },
  [Command.PostWarMessage]: {
    defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
    botPermissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
  },
  [Command.RegisterWarChannel]: {
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    botPermissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
  },
  [Command.ResetStockpileTimer]: {
    defaultMemberPermissions: null,
    botPermissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
    ],
  },
} as const
