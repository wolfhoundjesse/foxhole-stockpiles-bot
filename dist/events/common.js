var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { ComponentType } from "discord.js";
import { Discord, On } from "discordx";
let Example = class Example {
    messageDelete([message], client) {
        console.log("Message Deleted", client.user?.username, message.content);
    }
    async onInteractionCreate([interaction], client) {
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
    onMessageCreate([message], client) {
        client.executeCommand(message);
    }
};
__decorate([
    On()
], Example.prototype, "messageDelete", null);
__decorate([
    On({ event: "interactionCreate" })
], Example.prototype, "onInteractionCreate", null);
__decorate([
    On({ event: "messageCreate" })
], Example.prototype, "onMessageCreate", null);
Example = __decorate([
    Discord()
], Example);
export { Example };
