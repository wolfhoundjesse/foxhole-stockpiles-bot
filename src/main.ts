import 'dotenv/config'

import { dirname, importx } from '@discordx/importer'
import { IntentsBitField } from 'discord.js'
import { Client } from 'discordx'
import { EmbedUpdateService } from './services/embed-update-service'

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

    // Initialize embed update service
    const embedUpdateService = EmbedUpdateService.getInstance()
    embedUpdateService.setClient(client)
    await embedUpdateService.initializeAllTimers()
  })

  await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`)

  // Let's start the bot
  if (!process.env.BOT_TOKEN) {
    throw Error('Could not find BOT_TOKEN in your environment')
  }

  // Log in with your bot token
  await client.login(process.env.BOT_TOKEN)

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down gracefully...')
    const embedUpdateService = EmbedUpdateService.getInstance()
    embedUpdateService.stopAllTimers()
    client.destroy()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...')
    const embedUpdateService = EmbedUpdateService.getInstance()
    embedUpdateService.stopAllTimers()
    client.destroy()
    process.exit(0)
  })
}

run()
