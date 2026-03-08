'use strict';

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} = require('discord.js');
const play    = require('play-dl');
const manager = require('../PlayerManager');
const { COLORS } = require('../MusicPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('🔍 Поиск треков и выбор из списка результатов')
    .addStringOption(o =>
      o.setName('query').setDescription('Поисковый запрос').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('source')
        .setDescription('Источник поиска (по умолчанию: YouTube)')
        .addChoices(
          { name: '▶️ YouTube',        value: 'youtube'    },
          { name: '☁️ SoundCloud',     value: 'soundcloud' },
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const query  = interaction.options.getString('query');
    const source = interaction.options.getString('source') ?? 'youtube';

    try {
      let results;

      if (source === 'soundcloud') {
        results = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 10 });
      } else {
        results = await play.search(query, { source: { youtube: 'video' }, limit: 10 });
      }

      if (!results.length) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor(COLORS.warning).setDescription('⚠️ Ничего не найдено.')],
        });
      }

      const options = results.map((r, i) => {
        const title = (r.title ?? r.name ?? 'Unknown').slice(0, 100);
        const dur   = r.durationRaw ?? (r.durationInMs ? formatMs(r.durationInMs) : '?');
        return new StringSelectMenuOptionBuilder()
          .setLabel(`${i + 1}. ${title}`)
          .setDescription(`${r.channel?.name ?? r.user?.name ?? 'Unknown'} • ${dur}`)
          .setValue(r.url);
      });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`search_select_${interaction.user.id}`)
        .setPlaceholder('Выберите трек...')
        .addOptions(options);

      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle(`🔍 Результаты поиска: "${query}"`)
        .setDescription(
          results.map((r, i) => {
            const title = (r.title ?? r.name ?? 'Unknown').slice(0, 60);
            const dur   = r.durationRaw ?? (r.durationInMs ? formatMs(r.durationInMs) : '?');
            const ch    = r.channel?.name ?? r.user?.name ?? 'Unknown';
            return `\`${i + 1}.\` [${title}](${r.url}) — ${ch} \`${dur}\``;
          }).join('\n')
        )
        .setFooter({ text: 'Выберите трек из меню ниже' });

      const msg = await interaction.editReply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)],
      });

      // Collector for selection
      const collector = msg.createMessageComponentCollector({
        filter: i => i.customId === `search_select_${interaction.user.id}` && i.user.id === interaction.user.id,
        time:   60_000,
        max:    1,
      });

      collector.on('collect', async (selectInteraction) => {
        await selectInteraction.deferUpdate();

        const url = selectInteraction.values[0];
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
          await selectInteraction.followUp({
            embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription('❌ Вы должны быть в голосовом канале!')],
            ephemeral: true,
          });
          return;
        }

        try {
          const player = await manager.getOrCreate(interaction);
          const tracks  = await player.addTrack(url, interaction.user);
          const isFirst = player.currentIndex === -1;
          if (isFirst) await player.startPlaying();
          const t = tracks[0];

          await selectInteraction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.success)
                .setTitle(isFirst ? '🎵 Начинаю воспроизведение' : '✅ Добавлено в очередь')
                .setDescription(`**[${t.title}](${t.url})**`)
                .setThumbnail(t.thumbnail)
                .addFields(
                  { name: '⏱️', value: t.durationFmt, inline: true },
                  { name: '📋', value: `#${player.queue.length}`, inline: true },
                ),
            ],
            components: [],
          });
        } catch (err) {
          await selectInteraction.editReply({
            embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${err.message}`)],
            components: [],
          });
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          interaction.editReply({ components: [] }).catch(() => {});
        }
      });

    } catch (e) {
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${e.message}`)],
      });
    }
  },
};

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2,'0')}`;
}
