export type EmbedsByGuildId = {
  [guildId: string]: {
    channelId: string
    embeddedMessageId: string
  }
}
