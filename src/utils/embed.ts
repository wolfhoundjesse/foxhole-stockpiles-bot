import { EmbedBuilder } from 'discord.js'

export const addHelpTip = (embed: EmbedBuilder): EmbedBuilder => {
  return embed.setFooter({
    text: 'Tip: Use /help to see all available commands',
    iconURL: 'https://cdn.discordapp.com/emojis/1039235852619710565.webp?size=96&quality=lossless',
  })
}
