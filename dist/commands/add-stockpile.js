var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { ActionRowBuilder, ComponentType, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, } from "discord.js";
import { Discord, SelectMenuComponent, Slash } from "discordx";
let AddStockpile = class AddStockpile {
    async addStockpile(interaction) {
        const hexSelectMenu = new StringSelectMenuBuilder()
            .setCustomId("hex-menu")
            .setPlaceholder("Select a hex")
            .addOptions([
            { label: "Viper Pit", value: "vp" },
            { label: "Marban Hollow", value: "mh" },
            { label: "Great Warden Dam", value: "gwd" },
        ]);
        const stockpileMenu = new StringSelectMenuBuilder()
            .addOptions([{ label: "Kirknel Seaport", value: "ks" }])
            .setCustomId("stockpile-menu")
            .setPlaceholder("Select a stockpile");
        const hexRow = new ActionRowBuilder().addComponents(hexSelectMenu);
        const stockpileRow = new ActionRowBuilder().addComponents(stockpileMenu);
        const message = await interaction.reply({
            components: [hexRow, stockpileRow],
            fetchReply: true,
            ephemeral: true,
        });
        const collector = (await message).createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            maxComponents: 3,
        });
        const modal = new ModalBuilder()
            .setTitle("Enter Stockpile Code")
            .setCustomId("stockpile-code");
        const stockpileCodeInputComponent = new TextInputBuilder()
            .setCustomId("stockpile-code-input")
            .setLabel("Enter stockpile code")
            .setStyle(TextInputStyle.Short);
        const actionRow = new ActionRowBuilder().addComponents(stockpileCodeInputComponent);
        modal.addComponents(actionRow);
        collector.on("collect", (interaction) => { });
        collector.on("end", async (collected) => {
            await interaction.showModal(modal);
            console.log("Collected", collected.entries());
        });
    }
    async handleHexSelect(interaction) {
        await interaction.deferReply();
    }
    async handleStockpileSelect(interaction) {
        await interaction.deferReply();
    }
};
__decorate([
    Slash({ description: "Add a stockpile", name: "add-stockpile" })
], AddStockpile.prototype, "addStockpile", null);
__decorate([
    SelectMenuComponent({ id: "hex-menu" })
], AddStockpile.prototype, "handleHexSelect", null);
__decorate([
    SelectMenuComponent({ id: "stockpile-menu" })
], AddStockpile.prototype, "handleStockpileSelect", null);
AddStockpile = __decorate([
    Discord()
], AddStockpile);
export { AddStockpile };
