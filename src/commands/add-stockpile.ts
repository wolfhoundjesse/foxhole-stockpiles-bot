import {
  ActionRowBuilder,
  ComponentType,
  MessageActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type CommandInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { Discord, ModalComponent, SelectMenuComponent, Slash } from "discordx";

@Discord()
export class AddStockpile {
  @Slash({ description: "Add a stockpile", name: "add-stockpile" })
  async addStockpile(interaction: CommandInteraction) {
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

    const hexRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        hexSelectMenu
      );
    const stockpileRow =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        stockpileMenu
      );

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

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
      stockpileCodeInputComponent
    );
    modal.addComponents(actionRow);

    collector.on("collect", (interaction) => {});

    collector.on("end", async (collected) => {
      await interaction.showModal(modal);
      console.log("Collected", collected.entries());
    });
  }

  @SelectMenuComponent({ id: "hex-menu" })
  async handleHexSelect(interaction: StringSelectMenuInteraction) {
    await interaction.deferReply();
  }

  @SelectMenuComponent({ id: "stockpile-menu" })
  async handleStockpileSelect(interaction: StringSelectMenuInteraction) {
    await interaction.deferReply();
  }

  // @SelectMenuComponent({ id: "hex-menu" })
  // async handleHexSelect(interaction: StringSelectMenuInteraction) {
  //   console.log("Handling hex select");
  //   const hexValue = interaction.values?.[0];
  //   console.log("Hex value", hexValue);

  //   if (!hexValue) {
  //     return interaction.followUp("No hex selected");
  //   }

  //   const stockpileMenu = new StringSelectMenuBuilder()
  //     .addOptions([{ label: "Kirknel Seaport", value: "ks" }])
  //     .setCustomId("stockpile-menu")
  //     .setPlaceholder("Select a stockpile");

  //   const actionRow =
  //     new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
  //       stockpileMenu
  //     );

  //   // await interaction.deferReply();

  //   interaction.reply({
  //     components: [actionRow],
  //     content: "Select a stockpile",
  //     ephemeral: true,
  //   });
  // }

  // @SelectMenuComponent({ id: "stockpile-menu" })
  // async handleStockpileSelect(interaction: StringSelectMenuInteraction) {
  //   console.log("Handling stockpile select");
  //   // await interaction.deferReply();
  //   // interaction.followUp("Blah blah blah");
  //   const stockpileValue = interaction.values?.[0];
  //   console.log("Stockpile value", stockpileValue);
  //   const modal = new ModalBuilder()
  //     .setTitle("Enter Stockpile Code")
  //     .setCustomId("stockpile-code");
  //   const stockpileCodeInputComponent = new TextInputBuilder()
  //     .setCustomId("stockpile-code-input")
  //     .setPlaceholder("Enter stockpile code")
  //     .setStyle(TextInputStyle.Short);
  //   const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
  //     stockpileCodeInputComponent
  //   );
  //   modal.addComponents(actionRow);
  //   // interaction.showModal(modal);
  // }

  // @ModalComponent({ id: "stockpile-code" })
  // async handleModal(interaction: ModalSubmitInteraction) {
  //   await interaction.reply("Stockpile asdfasdfadded");
  //   return;
  // }
}
