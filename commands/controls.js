'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const manager = require('../PlayerManager');
const { COLORS } = require('../MusicPlayer');

// ── Helper ────────────────────────────────────────────────────────────────────
function requirePlayer(interaction) {
  const player = manager.get(interaction.guildId);
  if (!player) throw new Error('Сейчас ничего не воспроизводится.');
  return player;
}

// ── /skip ─────────────────────────────────────────────────────────────────────
const skip = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('⏭️ Пропустить текущий или несколько треков')
    .addIntegerOption(o =>
      o.setName('amount').setDescription('Сколько треков пропустить (по умолчанию 1)').setMinValue(1).setMaxValue(100)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const amount = interaction.options.getInteger('amount') ?? 1;
      const track  = player.getCurrentTrack();
      await player.skip(amount);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.success)
            .setDescription(`⏭️ Пропущено **${amount}** ${amount === 1 ? 'трек' : 'треков'}` + (track ? `: **${track.title}**` : '')),
        ],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /back ─────────────────────────────────────────────────────────────────────
const back = {
  data: new SlashCommandBuilder()
    .setName('back')
    .setDescription('⏮️ Вернуться к предыдущему треку'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const ok = await player.back();
      if (!ok) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription('⚠️ Это первый трек в очереди.')] });
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription('⏮️ Возвращаюсь к предыдущему треку!')] });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /pause ────────────────────────────────────────────────────────────────────
const pause = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('⏸️ Поставить на паузу'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const ok = player.pause();
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(ok ? COLORS.success : COLORS.warning)
            .setDescription(ok ? '⏸️ Воспроизведение приостановлено.' : '⚠️ Уже на паузе.'),
        ],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /resume ───────────────────────────────────────────────────────────────────
const resume = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('▶️ Возобновить воспроизведение'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const ok = player.resume();
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(ok ? COLORS.success : COLORS.warning)
            .setDescription(ok ? '▶️ Воспроизведение возобновлено!' : '⚠️ Не на паузе.'),
        ],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /stop ─────────────────────────────────────────────────────────────────────
const stop = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('⏹️ Остановить музыку и очистить очередь'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      player.stop();
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription('⏹️ Воспроизведение остановлено, очередь очищена.')],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /disconnect ───────────────────────────────────────────────────────────────
const disconnect = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('👋 Отключить бота от голосового канала'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      player.destroy();
      manager.delete(interaction.guildId);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription('👋 Отключился от голосового канала.')],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

module.exports = { skip, back, pause, resume, stop, disconnect };
