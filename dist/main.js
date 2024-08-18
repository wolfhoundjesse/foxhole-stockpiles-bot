var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { dirname, importx } from "@discordx/importer";
import { IntentsBitField } from "discord.js";
import { Client, Discord, Once } from "discordx";
let FSB = class FSB {
    bot = new Client({
        botId: "fsb",
        // To use only guild command
        // botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],
        // Discord intents
        intents: [
            IntentsBitField.Flags.Guilds,
            IntentsBitField.Flags.GuildMembers,
            IntentsBitField.Flags.GuildMessages,
            IntentsBitField.Flags.GuildMessageReactions,
            IntentsBitField.Flags.GuildVoiceStates,
        ],
        // Debug logs are disabled in silent mode
        silent: false,
        // Configuration for @SimpleCommand
        simpleCommand: {
            prefix: "!",
        },
    });
    async onReady([...args], bot) {
        // await bot.guilds.fetch();
        // To clear all guild commands, uncomment this line,
        // This is useful when moving from guild commands to global commands
        // It must only be executed once
        //
        // await bot.clearApplicationCommands(...bot.guilds.cache.map((g) => g.id));
        // Synchronize applications commands with Discord
        void bot.initApplicationCommands();
        console.log("Bot started");
    } // Make sure all guilds are cached
    async start() {
        // The following syntax should be used in the commonjs environment
        //
        // await importx(__dirname + "/{events,commands}/**/*.{ts,js}");
        // The following syntax should be used in the ECMAScript environment
        await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`);
        // Let's start the bot
        if (!process.env.BOT_TOKEN) {
            throw Error("Could not find BOT_TOKEN in your environment");
        }
        // Log in with your bot token
        await this.bot.login(process.env.BOT_TOKEN);
        console.log("Bot logged in");
    }
};
__decorate([
    Once({ event: "ready" })
], FSB.prototype, "onReady", null);
FSB = __decorate([
    Discord()
], FSB);
new FSB().start();
