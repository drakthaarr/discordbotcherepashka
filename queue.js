'use strict';

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const manager = require('../PlayerManager');
const { COLORS } = require('../MusicPlayer');

function requirePlayer(interaction) {
  const player = manager.get(interaction.guildId);
  if (!player) throw new Error('Сейчас ничего не воспроизводится.');
  return player;
}

// ── /nowplaying ───────────────────────────────────────────────────────────────
const nowplaying = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('🎵 Показать информацию о текущем треке'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const embed  = player.getNowPlayingEmbed();
      if (!embed) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription('⚠️ Ничего не воспроизводится.')] });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_back').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_pause').setEmoji('⏸️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /queue ────────────────────────────────────────────────────────────────────
const queue = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('📋 Показать очередь воспроизведения')
    .addIntegerOption(o => o.setName('page').setDescription('Номер страницы').setMinValue(1)),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const page   = interaction.options.getInteger('page') ?? 1;
      const embed  = player.getQueueEmbed(page);

      const totalPages = Math.max(1, Math.ceil(player.queue.length / 10));
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`queue_${page - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
        new ButtonBuilder().setCustomId(`queue_${page + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
      );

      await interaction.editReply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /seek ─────────────────────────────────────────────────────────────────────
const seek = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('⏩ Перемотать к указанному времени')
    .addStringOption(o =>
      o.setName('time').setDescription('Время (например: 1:30 или 90)').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player  = requirePlayer(interaction);
      const timeStr = interaction.options.getString('time');

      let seconds;
      if (timeStr.includes(':')) {
        const parts = timeStr.split(':').map(Number);
        seconds = parts.length === 3
          ? parts[0] * 3600 + parts[1] * 60 + parts[2]
          : parts[0] * 60 + parts[1];
      } else {
        seconds = parseInt(timeStr);
      }

      if (isNaN(seconds) || seconds < 0) throw new Error('Неверный формат времени. Используйте: `1:30` или `90`');

      await player.seek(seconds);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`⏩ Перемотано к \`${timeStr}\``)],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /jump ─────────────────────────────────────────────────────────────────────
const jump = {
  data: new SlashCommandBuilder()
    .setName('jump')
    .setDescription('🦘 Перейти к треку в очереди')
    .addIntegerOption(o =>
      o.setName('position').setDescription('Номер трека в очереди').setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const pos    = interaction.options.getInteger('position') - 1;
      await player.jumpTo(pos);
      const track  = player.getCurrentTrack();
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`🦘 Перешёл к треку **${track?.title ?? pos + 1}**`)],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /remove ───────────────────────────────────────────────────────────────────
const remove = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('🗑️ Удалить трек из очереди')
    .addIntegerOption(o =>
      o.setName('position').setDescription('Номер трека в очереди').setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player  = requirePlayer(interaction);
      const pos     = interaction.options.getInteger('position') - 1;
      const removed = player.remove(pos);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`🗑️ Удалён трек: **${removed.title}**`)],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /move ─────────────────────────────────────────────────────────────────────
const move = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('↕️ Переместить трек в очереди')
    .addIntegerOption(o => o.setName('from').setDescription('Откуда (номер трека)').setRequired(true).setMinValue(1))
    .addIntegerOption(o => o.setName('to').setDescription('Куда (номер позиции)').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const from   = interaction.options.getInteger('from') - 1;
      const to     = interaction.options.getInteger('to') - 1;
      const track  = player.move(from, to);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`↕️ **${track.title}** перемещён на позицию **${to + 1}**`)],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /shuffle ──────────────────────────────────────────────────────────────────
const shuffle = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('🔀 Перемешать очередь'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const ok = player.shuffle();
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(ok ? COLORS.success : COLORS.warning)
            .setDescription(ok ? '🔀 Очередь перемешана!' : '⚠️ В очереди недостаточно треков.'),
        ],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /clear ────────────────────────────────────────────────────────────────────
const clear = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('🧹 Очистить очередь (оставить текущий трек)'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const current = player.getCurrentTrack();
      player.queue = current ? [current] : [];
      player.currentIndex = current ? 0 : -1;
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription('🧹 Очередь очищена!')],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

module.exports = { nowplaying, queue, seek, jump, remove, move, shuffle, clear };
