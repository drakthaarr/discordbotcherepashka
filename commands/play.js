'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const manager = require('../PlayerManager');
const { COLORS } = require('../MusicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('▶️ Воспроизвести музыку из YouTube, Spotify, SoundCloud или по поисковому запросу')
    .addStringOption(o =>
      o.setName('query')
        .setDescription('Ссылка (YouTube / Spotify / SoundCloud) или название песни')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    if (!focused || focused.startsWith('http')) return interaction.respond([]);

    const play = require('play-dl');
    try {
      const results = await play.search(focused, { source: { youtube: 'video' }, limit: 5 });
      await interaction.respond(
        results.map(r => ({ name: r.title.slice(0, 100), value: r.url }))
      );
    } catch {
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('query');
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription('❌ Вы должны быть в голосовом канале!')],
      });
    }

    try {
      const player = await manager.getOrCreate(interaction);
      const tracks  = await player.addTrack(query, interaction.user);

      const isFirst = player.currentIndex === -1;
      if (isFirst) await player.startPlaying();

      const single = tracks.length === 1;
      const embed  = new EmbedBuilder().setColor(COLORS.success);

      if (single) {
        const t = tracks[0];
        embed
          .setTitle(isFirst ? '🎵 Начинаю воспроизведение' : '✅ Добавлено в очередь')
          .setDescription(`**[${t.title}](${t.url})**`)
          .setThumbnail(t.thumbnail)
          .addFields(
            { name: '🎤 Канал',   value: t.channel,     inline: true },
            { name: '⏱️ Длина',   value: t.durationFmt, inline: true },
            { name: '📋 Позиция', value: isFirst ? 'Сейчас' : `#${player.queue.length}`, inline: true },
          )
          .setFooter({ text: `Запросил: ${interaction.user.tag}` });
      } else {
        embed
          .setTitle(isFirst ? '🎵 Начинаю воспроизведение плейлиста' : '✅ Плейлист добавлен в очередь')
          .setDescription(`Добавлено **${tracks.length}** треков`)
          .addFields(
            { name: '📋 В очереди', value: `${player.queue.length}`, inline: true },
          )
          .setFooter({ text: `Запросил: ${interaction.user.tag}` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${err.message}`)],
      });
    }
  },
};
