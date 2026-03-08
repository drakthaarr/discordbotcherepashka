'use strict';

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const path = require('path');
const fs   = require('fs');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('❌ Укажите DISCORD_TOKEN и CLIENT_ID в .env файле!');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const module = require(path.join(commandsPath, file));

  // Default export
  if (module.data) commands.push(module.data.toJSON());

  // Named exports
  for (const val of Object.values(module)) {
    if (val && typeof val === 'object' && val.data && val !== module) {
      commands.push(val.data.toJSON());
    }
  }
}

// Deduplicate by name
const seen = new Set();
const unique = commands.filter(c => {
  if (seen.has(c.name)) return false;
  seen.add(c.name);
  return true;
});

console.log(`📦 Регистрирую ${unique.length} команд...`);

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: unique },
    );
    console.log(`✅ Успешно зарегистрировано ${data.length} команд!`);
    unique.forEach(c => console.log(`  /${c.name}`));
  } catch (err) {
    console.error('❌ Ошибка регистрации команд:', err.message);
  }
})();
