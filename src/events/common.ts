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
    // if (interaction.isModalSubmit()) {
    //   console.log(interaction.fields.fields.get("stockpile-code-input"));
    // }
    client.executeInteraction(interaction);
  }

  @On({ event: "messageCreate" })
  onMessageCreate([message]: ArgsOf<"messageCreate">, client: Client) {
    client.executeCommand(message);
  }
}
