import { Discord, Guard, Slash } from 'discordx';
import { CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { StockpileDataService } from '../../services/stockpile-data-service';
import { Command, FactionColors } from '../../models';
import { checkBotPermissions } from '../../utils/permissions';
import { PermissionGuard } from '../../guards/PermissionGuard';
import { addHelpTip } from '../../utils/embed';
import { formatStockpileWithExpiration } from '../../utils/expiration';

@Discord()
@Guard(PermissionGuard)
export class ResetStockpilesCommand {
  private stockpileDataService = new StockpileDataService();

  @Slash({
    name: Command.ResetStockpiles,
    description: 'Reset all stockpiles for this server'
  })
  async resetStockpiles(interaction: CommandInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;

    // Defer reply as ephemeral since this might take a moment
    await interaction.deferReply({ ephemeral: true });

    try {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply('This command can only be used in a server.');
        return;
      }

      // Reset stockpiles for this guild
      await this.stockpileDataService.resetStockpilesByGuildId(guildId);

      // Create and update embed
      const { embed, components } = await this.createStockpilesEmbed(guildId);
      const embedByGuildId = await this.stockpileDataService.getEmbedsByGuildId(guildId);
      const embeddedMessageExists = Boolean(embedByGuildId.embeddedMessageId);

      if (embeddedMessageExists && interaction.channel) {
        const message = await interaction.channel.messages.fetch(embedByGuildId.embeddedMessageId);
        await message.edit({ embeds: [embed], components });
      }

      await interaction.editReply('All stockpiles have been reset for this server.');
    } catch (error) {
      console.error('Error resetting stockpiles:', error);
      await interaction.editReply('An error occurred while resetting stockpiles.');
    }
  }

  private async createStockpilesEmbed(
    guildId: string
  ): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(guildId);
    const embedTitle = await this.stockpileDataService.getEmbedTitle();
    const faction = await this.stockpileDataService.getFactionByGuildId(guildId);
    const color = FactionColors[faction];

    if (!stockpiles || Object.keys(stockpiles).length === 0) {
      return addHelpTip(
        new EmbedBuilder()
          .setTitle(embedTitle)
          .setColor(color)
          .addFields([{ name: 'No stockpiles', value: 'No stockpiles', inline: true }])
          .setTimestamp()
      );
    }

    const stockpileFields = Object.keys(stockpiles).map(hex => {
      return {
        name: hex,
        value:
          stockpiles[hex].map(stockpile => formatStockpileWithExpiration(stockpile)).join('\n\n') ||
          'No stockpiles'
      };
    });

    return addHelpTip(
      new EmbedBuilder()
        .setTitle(embedTitle)
        .setColor(color)
        .addFields(stockpileFields)
        .setTimestamp()
    );
  }
}
