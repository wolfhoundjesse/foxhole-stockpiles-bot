var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { ActionRowBuilder, EmbedBuilder, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, } from 'discord.js';
import { Discord, ModalComponent, SelectMenuComponent, Slash } from 'discordx';
import { StockpileDataService } from '../services/stockpile-data-service.js';
let AddStockpile = class AddStockpile {
    stockpileDataService = new StockpileDataService();
    async addStockpile(interaction) {
        const stockpileLocations = await this.stockpileDataService.getStockpileLocations();
        const hexSelectMenu = new StringSelectMenuBuilder()
            .setCustomId('hex-menu')
            .setPlaceholder('Region/Hex')
            .addOptions(Object.keys(stockpileLocations).map((key) => {
            return new StringSelectMenuOptionBuilder().setLabel(key).setValue(key);
        }));
        const stockpileMenu = new StringSelectMenuBuilder()
            .setCustomId('stockpile-menu')
            .setPlaceholder('Select a stockpile')
            .addOptions([{ label: "It's Disabled", value: "And Doesn't Matter" }])
            .setDisabled(true);
        const hexRow = new ActionRowBuilder().addComponents(hexSelectMenu);
        const stockpileRow = new ActionRowBuilder().addComponents(stockpileMenu.setDisabled(true));
        await interaction.reply({
            components: [hexRow, stockpileRow],
            fetchReply: true,
            ephemeral: true,
        });
    }
    async handleHexSelect(interaction) {
        const hexValue = interaction.values[0];
        const updatedHexMenu = new StringSelectMenuBuilder()
            .setCustomId('hex-menu')
            .setPlaceholder('Select a hex')
            .setDisabled(true)
            .setOptions([{ label: hexValue, value: hexValue, default: true }]);
        const hexRow = new ActionRowBuilder().addComponents(updatedHexMenu);
        const stockpileLocations = await this.stockpileDataService.getStockpileLocations();
        if (!stockpileLocations) {
            await interaction.update({
                components: [hexRow],
                fetchReply: true,
            });
            return;
        }
        const stockpileOptions = Object.keys(stockpileLocations)
            .filter((hex) => hex === hexValue)
            .map((hex) => {
            return stockpileLocations[hex].map((stockpile) => {
                const location = `${stockpile.name} - ${stockpile.storageType}`;
                return new StringSelectMenuOptionBuilder()
                    .setLabel(location)
                    .setValue(`${hex}: ${location}`);
            });
        })
            .flat();
        const stockpileMenu = new StringSelectMenuBuilder()
            .setCustomId('stockpile-menu')
            .setPlaceholder('Select a stockpile')
            .addOptions(stockpileOptions);
        const stockpileRow = new ActionRowBuilder().addComponents(stockpileMenu);
        await interaction.update({
            components: [hexRow, stockpileRow],
            fetchReply: true,
        });
    }
    async handleStockpileSelect(interaction) {
        const location = interaction.values[0];
        const modal = new ModalBuilder().setTitle('Enter Stockpile Code').setCustomId('stockpile-code');
        const stockpileCodeInputComponent = new TextInputBuilder()
            .setCustomId('stockpile-code-input')
            .setLabel('Enter stockpile code')
            .setStyle(TextInputStyle.Short)
            .setMinLength(6)
            .setMaxLength(6);
        const actionRow = new ActionRowBuilder().addComponents(stockpileCodeInputComponent);
        modal.addComponents(actionRow);
        interaction.showModal(modal);
        const submission = await interaction.awaitModalSubmit({
            time: 60000,
            filter: (i) => i.user.id === interaction.user.id,
        });
        const stockpileCode = submission.fields.fields.get('stockpile-code-input')?.value;
        await this.stockpileDataService.addStockpile(interaction.guildId, location, stockpileCode);
    }
    async handleStockpileCodeModal(interaction) {
        if (!interaction?.guildId)
            return;
        const stockpiles = await this.stockpileDataService.getStockpilesByGuildId(interaction.guildId);
        if (!stockpiles) {
            await interaction.reply({
                content: 'No stockpiles have been added',
                ephemeral: true,
                fetchReply: true,
            });
            return;
        }
        const stockpileFields = Object.keys(stockpiles).map((hex) => {
            return {
                name: hex,
                value: stockpiles[hex]
                    .map((stockpile) => `${stockpile.name} - ${stockpile.storageType} - ${stockpile.code}`)
                    .join('\n'),
            };
        });
        const stockpilesEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('Stockpiles')
            .addFields(stockpileFields)
            .setTimestamp();
        await interaction.channel?.send({ embeds: [stockpilesEmbed] });
        await interaction.reply({
            content: 'Stockpile added',
            ephemeral: true,
            fetchReply: true,
        });
    }
};
__decorate([
    Slash({ description: 'Add a stockpile', name: 'add-stockpile' })
], AddStockpile.prototype, "addStockpile", null);
__decorate([
    SelectMenuComponent({ id: 'hex-menu' })
], AddStockpile.prototype, "handleHexSelect", null);
__decorate([
    SelectMenuComponent({ id: 'stockpile-menu' })
], AddStockpile.prototype, "handleStockpileSelect", null);
__decorate([
    ModalComponent({ id: 'stockpile-code' })
], AddStockpile.prototype, "handleStockpileCodeModal", null);
AddStockpile = __decorate([
    Discord()
], AddStockpile);
export { AddStockpile };
