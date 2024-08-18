import { time } from "console";
import { ComponentType, Message, MessageComponentType } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class Example {
  @On()
  messageDelete([message]: ArgsOf<"messageDelete">, client: Client): void {
    console.log("Message Deleted", client.user?.username, message.content);
  }

  @On({ event: "interactionCreate" })
  async onInteractionCreate(
    [interaction]: ArgsOf<"interactionCreate">,
    client: Client
  ) {
    if (interaction.isStringSelectMenu()) {
      const message = await interaction.reply("Select a hex");
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        maxComponents: 2,
      });
      collector.on("collect", (interaction) => {
        console.log("Collected", interaction.values);
      });
    }
    client.executeInteraction(interaction);
  }

  @On({ event: "messageCreate" })
  onMessageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    client.executeCommand(message);
  }
}
