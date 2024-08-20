import { dirname, importx } from "@discordx/importer";
import { IntentsBitField } from "discord.js";
import { ArgsOf, Client, Discord, Once } from "discordx";

@Discord()
class FSB {
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

  @Once({ event: "ready" })
  async onReady([...args]: ArgsOf<"ready">, bot: Client) {
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
}

new FSB().start();
