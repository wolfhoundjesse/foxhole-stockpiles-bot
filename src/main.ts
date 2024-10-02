import 'dotenv/config'

import { dirname, importx } from '@discordx/importer'
import { IntentsBitField } from 'discord.js'
import { Client } from 'discordx'

async function run() {
  const client = new Client({
    // Discord intents
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMembers,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.GuildMessageReactions,
      IntentsBitField.Flags.GuildVoiceStates,
    ],

    botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],

    // Debug logs are disabled in silent mode
    silent: false,

    // Configuration for @SimpleCommand
    simpleCommand: {
      prefix: '!',
    },
  })

  client.once('ready', async () => {
    await client.initApplicationCommands()
    console.log('Bot started')
  })

  await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`)

  // Let's start the bot
  if (!process.env.BOT_TOKEN) {
    throw Error('Could not find BOT_TOKEN in your environment')
  }

  // Log in with your bot token
  client.login(process.env.BOT_TOKEN)
}

run()
