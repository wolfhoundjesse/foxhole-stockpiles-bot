import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

export const addHelpTip = (
  embed: EmbedBuilder,
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } => {
  const addStockpileButton = new ButtonBuilder()
    .setCustomId('add-stockpile')
    .setLabel('Add Stockpile')
    .setStyle(ButtonStyle.Primary)

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(addStockpileButton)

  return {
    embed: embed.setFooter({
      text: 'Tip: Use /help to see all available commands',
      iconURL:
        'https://cdn.discordapp.com/emojis/1039235852619710565.webp?size=96&quality=lossless',
    }),
    components: [row],
  }
}
