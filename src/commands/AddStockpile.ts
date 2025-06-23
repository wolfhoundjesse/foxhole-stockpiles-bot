import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  CommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { Discord, Guard, ModalComponent, SelectMenuComponent, Slash } from 'discordx';
import { PermissionGuard } from '../guards/PermissionGuard';
import { Faction, FactionColors, type FactionType } from '../models';
import { AddStockpileIds, Command } from '../models/constants';
import { StockpileDataService } from '../services/stockpile-data-service';
import { addHelpTip } from '../utils/embed';
import { formatStockpileWithExpiration } from '../utils/expiration';
import { checkBotPermissions } from '../utils/permissions';

@Discord()
@Guard(PermissionGuard)
export class AddStockpile {
  public stockpileDataService = new StockpileDataService();
  private selectedLocations: { [userId: string]: string } = {};
  private hexPages: { [userId: string]: number } = {};
  private readonly ITEMS_PER_PAGE = 23;

  @Slash({ description: 'Add a stockpile', name: Command.AddStockpile })
  async addStockpile(interaction: CommandInteraction | ButtonInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;
    const faction = await this.getFaction(interaction);
    if (faction === Faction.None) return;

    this.hexPages[interaction.user.id] = 0;

    const storageLocationsByRegion =
      await this.stockpileDataService.getStorageLocationsByRegion(faction);

    const hexSelectMenu = this.createHexSelectMenu(
      Object.keys(storageLocationsByRegion),
      this.hexPages[interaction.user.id],
      interaction.user.id
    );

    const stockpileMenu = new StringSelectMenuBuilder()
      .setCustomId(AddStockpileIds.StockpileMenu)
      .setPlaceholder('Select a stockpile')
      .addOptions({
        label: 'Add Stockpile',
        value: 'add-stockpile',
        description: 'Add a stockpile to the database'
      })
      .setDisabled(true);

    const hexRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(hexSelectMenu);

    const stockpileRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      stockpileMenu
    );

    if (interaction.isButton()) {
      await interaction.reply({
        content: 'Please select a storage location.',
        components: [hexRow, stockpileRow],
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.reply({
        content: 'Please select a storage location.',
        components: [hexRow, stockpileRow],
        flags: MessageFlags.Ephemeral
      });
    }
  }

  private createHexSelectMenu(
    hexes: string[],
    currentPage: number,
    userId: string
  ): StringSelectMenuBuilder {
    const totalPages = Math.ceil(hexes.length / this.ITEMS_PER_PAGE);

    // Ensure currentPage is within valid bounds
    const safeCurrentPage = Math.max(0, Math.min(currentPage, totalPages - 1));

    const startIdx = safeCurrentPage * this.ITEMS_PER_PAGE;
    const pageHexes = hexes.slice(startIdx, startIdx + this.ITEMS_PER_PAGE);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(AddStockpileIds.HexMenu)
      .setPlaceholder(`Region/Hex (Page ${safeCurrentPage + 1}/${totalPages})`);

    if (totalPages > 1) {
      if (safeCurrentPage > 0) {
        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('⬅️ Previous Page')
            .setValue(`prev_page_${userId}`)
        );
      }
      if (safeCurrentPage < totalPages - 1) {
        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('➡️ Next Page')
            .setValue(`next_page_${userId}`)
        );
      }
    }

    menu.addOptions(
      pageHexes.map(hex => new StringSelectMenuOptionBuilder().setLabel(hex).setValue(hex))
    );

    return menu;
  }

  @SelectMenuComponent({ id: AddStockpileIds.HexMenu })
  async handleLocationSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;
    const selectedValue = interaction.values[0];

    if (selectedValue.startsWith('prev_page_') || selectedValue.startsWith('next_page_')) {
      const faction = await this.getFaction(interaction);
      if (faction === Faction.None) return;

      // Ensure the user's page state is initialized
      if (!this.hexPages[interaction.user.id]) {
        this.hexPages[interaction.user.id] = 0;
      }

      const storageLocationsByRegion =
        await this.stockpileDataService.getStorageLocationsByRegion(faction);
      const totalPages = Math.ceil(
        Object.keys(storageLocationsByRegion).length / this.ITEMS_PER_PAGE
      );

      // Update the page number
      if (selectedValue.startsWith('prev_page_')) {
        this.hexPages[interaction.user.id] = Math.max(0, this.hexPages[interaction.user.id] - 1);
      } else {
        this.hexPages[interaction.user.id] = Math.min(
          totalPages - 1,
          this.hexPages[interaction.user.id] + 1
        );
      }

      const hexSelectMenu = this.createHexSelectMenu(
        Object.keys(storageLocationsByRegion),
        this.hexPages[interaction.user.id],
        interaction.user.id
      );

      const stockpileMenu = new StringSelectMenuBuilder()
        .setCustomId(AddStockpileIds.StockpileMenu)
        .setPlaceholder('Select a stockpile')
        .setDisabled(true)
        .addOptions({
          label: 'Add Stockpile',
          value: 'add-stockpile',
          description: 'Add a stockpile to the database'
        });

      const hexRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(hexSelectMenu);
      const stockpileRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        stockpileMenu
      );

      await interaction.update({
        content: 'Please select a storage location.',
        components: [hexRow, stockpileRow]
      });
      return;
    }

    const selectedHex = selectedValue;
    const faction = await this.getFaction(interaction);
    if (faction === Faction.None) {
      return;
    }
    const storageLocationsByRegion =
      await this.stockpileDataService.getStorageLocationsByRegion(faction);
    const updatedHexMenu = new StringSelectMenuBuilder()
      .setCustomId(AddStockpileIds.HexMenu)
      .setPlaceholder('Select a hex')
      .setDisabled(true)
      .setOptions([{ label: selectedHex, value: selectedHex, default: true }]);

    const hexRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(updatedHexMenu);

    const stockpileOptions = Object.keys(storageLocationsByRegion)
      .filter(hex => hex === selectedHex)
      .map(hex => {
        return storageLocationsByRegion[hex].map(stockpile => {
          const location = `${stockpile.locationName} - ${stockpile.storageType}`;
          return new StringSelectMenuOptionBuilder()
            .setLabel(location)
            .setValue(`${hex}: ${location}`);
        });
      })
      .flat();

    // Enable the sublocation menu after location selection
    const stockpileMenu = new StringSelectMenuBuilder()
      .setCustomId(AddStockpileIds.StockpileMenu)
      .setPlaceholder('Select a stockpile')
      .setDisabled(false)
      .addOptions(stockpileOptions);

    const stockpileRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      stockpileMenu
    );

    await interaction.update({
      content: 'Please select a storage location.',
      components: [hexRow, stockpileRow]
    });
  }

  // Handle sublocation selection (sublocation_select)
  @SelectMenuComponent({ id: AddStockpileIds.StockpileMenu })
  async handleSublocationSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;
    const selectedStorageLocation = interaction.values[0]; // Get selected sublocation
    this.selectedLocations[interaction.user.id] = selectedStorageLocation;
    // Present a modal to the user for stockpile code and name
    const modal = new ModalBuilder()
      .setTitle('Enter Stockpile Details')
      .setCustomId(AddStockpileIds.StockpileDetails);

    const stockpileCodeInput = new TextInputBuilder()
      .setCustomId(AddStockpileIds.StockpileCodeInput)
      .setLabel('Stockpile Code (6 digits)')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(6)
      .setMinLength(6)
      .setRequired(true);

    const stockpileNameInput = new TextInputBuilder()
      .setCustomId(AddStockpileIds.StockpileNameInput)
      .setLabel(`Name (optional, default is ${process.env.DEFAULT_STOCKPILE_NAME})`)
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const codeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(stockpileCodeInput);
    const nameRow = new ActionRowBuilder<TextInputBuilder>().addComponents(stockpileNameInput);
    modal.addComponents(codeRow, nameRow);

    await interaction.showModal(modal);
  }

  // Handle modal submission (stockpile_modal)
  @ModalComponent({ id: AddStockpileIds.StockpileDetails })
  async handleStockpileDetails(interaction: ModalSubmitInteraction): Promise<void> {
    if (!(await checkBotPermissions(interaction))) return;
    const guildId = interaction.guildId;
    if (!guildId || !interaction.channelId) {
      await interaction.reply({
        content: 'This command can only be used in a server channel.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const stockpileCode = interaction.fields.getTextInputValue(AddStockpileIds.StockpileCodeInput);
    const stockpileName =
      interaction.fields.getTextInputValue(AddStockpileIds.StockpileNameInput) ||
      (process.env.DEFAULT_STOCKPILE_NAME as string);
    const selectedStorageLocation = this.selectedLocations[interaction.user.id];

    if (!selectedStorageLocation) {
      await interaction.reply({
        content:
          'Error: Could not retrieve the selected storage location. Please try the command again.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Parse the selectedStorageLocation string
    const [hex, locationAndType] = selectedStorageLocation.split(': ');
    const [locationName, storageType] = locationAndType.split(' - ');

    // Add the stockpile to the database
    const success = await this.stockpileDataService.addStockpile(
      guildId,
      hex,
      locationName,
      stockpileCode,
      stockpileName,
      storageType,
      interaction.user.id,
      interaction.channelId
    );

    if (!success) {
      await interaction.reply({
        content: `> 🚫 **Error:** A stockpile with the name "**${stockpileName}**" already exists in this location.\n> \n> ✏️ Please try again with a different name.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    // Remove the stored location after use
    delete this.selectedLocations[interaction.user.id];

    // Create an embed with the stockpile details
    const { embed, components } = await this.createStockpilesEmbed(guildId);
    const embedByGuildId = await this.stockpileDataService.getEmbedsByGuildId(guildId);
    const embeddedMessageExists = Boolean(embedByGuildId.embeddedMessageId);

    if (embeddedMessageExists) {
      const channel = interaction.channel;
      if (channel) {
        try {
          const message = await channel.messages.fetch(embedByGuildId.embeddedMessageId);
          await message.edit({ embeds: [embed], components });
          await interaction.reply({
            content: 'Stockpile list updated.',
            flags: MessageFlags.Ephemeral
          });
        } catch (error) {
          // If we can't access the message, delete the old message ID and create a new one
          console.warn('Could not access existing message, creating new one:', error);
          // Delete the old message ID from the database
          await this.stockpileDataService.saveEmbeddedMessageId(guildId, '', '');
          // Create new message
          const message = await interaction.reply({
            embeds: [embed],
            components,
            fetchReply: true
          });
          // Save the new message ID
          await this.stockpileDataService.saveEmbeddedMessageId(
            guildId,
            interaction.channelId,
            message.id
          );
        }
      }
    } else {
      const message = await interaction.reply({ embeds: [embed], components, fetchReply: true });
      await this.stockpileDataService.saveEmbeddedMessageId(
        guildId,
        interaction.channelId,
        message.id
      );
    }
  }

  private async getFaction(
    interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction
  ): Promise<FactionType> {
    if (!(await checkBotPermissions(interaction))) return Faction.None;
    const guildId = interaction.guildId;
    if (!guildId) {
      if (interaction.isButton() || interaction.isCommand()) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          flags: MessageFlags.Ephemeral
        });
      }
      return Faction.None;
    }
    const faction = await this.stockpileDataService.getFactionByGuildId(guildId);
    if (faction === Faction.None) {
      if (interaction.isButton() || interaction.isCommand()) {
        await interaction.reply({
          content: 'You must select a faction before adding stockpiles. (use /select-faction)',
          flags: MessageFlags.Ephemeral
        });
      }
      return Faction.None;
    }
    return faction;
  }

  private async createStockpilesEmbed(
    guildId: string
  ): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
    const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(guildId);
    const embedTitle = await this.stockpileDataService.getEmbedTitle();
    const faction = await this.stockpileDataService.getFactionByGuildId(guildId);
    const color = FactionColors[faction];

    if (!stockpiles) {
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
