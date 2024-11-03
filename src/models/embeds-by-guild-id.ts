// src/models/embeds-by-guild-id.ts
export type ServerConfig = {
  channelId: string
  embeddedMessageId: string
  allowedRoles?: string[] // Optional: roles that can manage stockpiles
}

export type EmbedsByGuildId = {
  [guildId: string]: ServerConfig
}
