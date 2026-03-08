'use strict';

require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
const fs   = require('fs');

// ── Validate env ──────────────────────────────────────────────────────────────
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN не найден в .env файле!');
  process.exit(1);
}

// ── Play-DL token setup ───────────────────────────────────────────────────────
const play = require('play-dl');

(async () => {
  try {
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      await play.setToken({
        spotify: {
          client_id:     process.env.SPOTIFY_CLIENT_ID,
          client_secret: process.env.SPOTIFY_CLIENT_SECRET,
          refresh_token: process.env.SPOTIFY_REFRESH_TOKEN ?? '',
          market:        'RU',
        },
      });
      console.log('✅ Spotify токен настроен');
    } else {
      console.log('⚠️  Spotify токен не настроен — Spotify ссылки будут искаться через YouTube');
    }
  } catch (e) {
    console.warn('⚠️  Не удалось настроить Spotify:', e.message);
  }
})();

// ── Discord client ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

client.commands = new Collection();

// ── Load commands ──────────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const module = require(path.join(commandsPath, file));

  // Module may export a single command or multiple commands
  const exports = Object.values(module).filter(
    v => v && typeof v === 'object' && v.data && typeof v.execute === 'function'
  );

  // Also handle default export
  if (module.data && typeof module.execute === 'function') {
    client.commands.set(module.data.name, module);
  }

  for (const cmd of exports) {
    client.commands.set(cmd.data.name, cmd);
  }
}

console.log(`📦 Загружено команд: ${client.commands.size}`);

// ── Load events ────────────────────────────────────────────────────────────────
const eventsPath  = path.join(__dirname, 'src', 'events');
const eventFiles  = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ── Global error handling ──────────────────────────────────────────────────────
client.on('error', err => console.error('[Client Error]', err));
process.on('unhandledRejection', err => console.error('[Unhandled Rejection]', err));
process.on('uncaughtException',  err => console.error('[Uncaught Exception]',  err));

// ── Login ──────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('🚀 Бот запускается...'))
  .catch(err => {
    console.error('❌ Не удалось войти в Discord:', err.message);
    process.exit(1);
  });
