'use strict';

const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ Вошёл как ${client.user.tag}`);
    console.log(`📡 Серверов: ${client.guilds.cache.size}`);

    const activities = [
      { name: '/play', type: ActivityType.Listening },
      { name: `${client.guilds.cache.size} серверов`, type: ActivityType.Watching },
      { name: 'музыку 🎵', type: ActivityType.Playing },
    ];

    let i = 0;
    const setActivity = () => {
      client.user.setActivity(activities[i % activities.length]);
      i++;
    };

    setActivity();
    setInterval(setActivity, 30_000);
  },
};
