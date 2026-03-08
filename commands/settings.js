'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const manager = require('../PlayerManager');
const { FILTERS, LOOP_MODES, COLORS } = require('../MusicPlayer');

function requirePlayer(interaction) {
  const player = manager.get(interaction.guildId);
  if (!player) throw new Error('Сейчас ничего не воспроизводится.');
  return player;
}

// ── /loop ─────────────────────────────────────────────────────────────────────
const loop = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('🔁 Установить режим повтора')
    .addStringOption(o =>
      o.setName('mode')
        .setDescription('Режим повтора')
        .setRequired(true)
        .addChoices(
          { name: '➡️  Выключен',      value: LOOP_MODES.OFF },
          { name: '🔂  Повтор трека',   value: LOOP_MODES.TRACK },
          { name: '🔁  Повтор очереди', value: LOOP_MODES.QUEUE },
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const mode   = interaction.options.getString('mode');
      player.setLoop(mode);
      const labels = { off: '➡️ Выключен', track: '🔂 Повтор трека', queue: '🔁 Повтор очереди' };
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription(`Режим повтора: **${labels[mode]}**`)],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /volume ───────────────────────────────────────────────────────────────────
const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('🔊 Установить громкость воспроизведения')
    .addIntegerOption(o =>
      o.setName('value')
        .setDescription('Громкость от 1 до 200 (100 = норма, >100 усиливает через FFmpeg)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(200)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const val    = interaction.options.getInteger('value');
      const set    = player.setVolume(val);

      const bar = buildVolumeBar(set);
      const icon = set <= 33 ? '🔈' : set <= 66 ? '🔉' : set <= 100 ? '🔊' : '📢';

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.success)
            .setDescription(`${icon} Громкость: **${set}%**\n${bar}`)
            .addFields(set > 100 ? [{ name: '⚠️ Внимание', value: 'Громкость выше 100% обрабатывается через FFmpeg и может снизить качество звука.' }] : []),
        ],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /filter ───────────────────────────────────────────────────────────────────
const filter = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('🎛️ Включить или выключить аудио фильтры')
    .addStringOption(o => {
      o.setName('name').setDescription('Фильтр').setRequired(true);
      for (const [key, val] of Object.entries(FILTERS)) {
        o.addChoices({ name: val.label, value: key });
      }
      return o;
    }),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const key    = interaction.options.getString('name');
      const active = await player.toggleFilter(key);
      const label  = FILTERS[key]?.label ?? key;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(active ? COLORS.success : COLORS.warning)
            .setTitle(`🎛️ Фильтр: ${label}`)
            .setDescription(active ? '✅ Включён' : '❌ Выключен')
            .addFields({
              name: 'Активные фильтры',
              value: [...player.activeFilters].map(k => FILTERS[k]?.label).join(', ') || 'нет',
            }),
        ],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /filters ──────────────────────────────────────────────────────────────────
const filters = {
  data: new SlashCommandBuilder()
    .setName('filters')
    .setDescription('🎛️ Показать все доступные фильтры и их статус'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      const lines  = Object.entries(FILTERS).map(([key, val]) => {
        const on = player.activeFilters.has(key);
        return `${on ? '✅' : '⬜'} ${val.label}`;
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.info)
            .setTitle('🎛️ Доступные фильтры')
            .setDescription(lines.join('\n'))
            .setFooter({ text: 'Используйте /filter <название> для включения/выключения' }),
        ],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── /resetfilters ─────────────────────────────────────────────────────────────
const resetfilters = {
  data: new SlashCommandBuilder()
    .setName('resetfilters')
    .setDescription('♻️ Сбросить все активные аудио фильтры'),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const player = requirePlayer(interaction);
      await player.clearFilters();
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.success).setDescription('♻️ Все фильтры сброшены.')],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)] });
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildVolumeBar(vol, length = 20) {
  const pct = Math.min(vol / 200, 1);
  const pos  = Math.round(pct * length);
  return '█'.repeat(pos) + '░'.repeat(length - pos) + ` \`${vol}/200\``;
}

module.exports = { loop, volume, filter, filters, resetfilters };
