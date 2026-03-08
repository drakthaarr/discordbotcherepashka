'use strict';

const { EmbedBuilder } = require('discord.js');
const manager = require('../PlayerManager');
const { COLORS } = require('../MusicPlayer');

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {
    // ── Autocomplete ──────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd?.autocomplete) {
        try { await cmd.autocomplete(interaction); } catch {}
      }
      return;
    }

    // ── Slash commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;

      // Must be in a guild
      if (!interaction.guildId) {
        return interaction.reply({
          content: '❌ Команды работают только на серверах.',
          ephemeral: true,
        });
      }

      try {
        await cmd.execute(interaction, client);
      } catch (err) {
        console.error(`[Command Error] /${interaction.commandName}: ${err.message}`);
        const errEmbed = new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${err.message}`);
        if (interaction.deferred || interaction.replied) {
          interaction.editReply({ embeds: [errEmbed] }).catch(() => {});
        } else {
          interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ── Button interactions ───────────────────────────────────────────────────
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    // ── Queue pagination select ───────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      // handled by collectors in search.js
    }
  },
};

async function handleButton(interaction) {
  await interaction.deferUpdate().catch(() => {});

  const player = manager.get(interaction.guildId);
  if (!player) return;

  try {
    switch (interaction.customId) {
      case 'btn_back':
        await player.back();
        break;
      case 'btn_pause':
        if (!player.pause()) player.resume();
        break;
      case 'btn_skip':
        await player.skip();
        break;
      case 'btn_stop':
        player.stop();
        break;
      case 'btn_shuffle':
        player.shuffle();
        break;
      default:
        // Queue pagination buttons: queue_<page>
        if (interaction.customId.startsWith('queue_')) {
          const page  = parseInt(interaction.customId.split('_')[1]);
          const embed = player.getQueueEmbed(page);
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const totalPages = Math.max(1, Math.ceil(player.queue.length / 10));
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`queue_${page - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
            new ButtonBuilder().setCustomId(`queue_${page + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
          );
          await interaction.editReply({ embeds: [embed], components: totalPages > 1 ? [row] : [] });
          return;
        }
    }

    // Refresh nowplaying embed after button action
    const np = player.getNowPlayingEmbed();
    if (np && interaction.message) {
      await interaction.editReply({ embeds: [np] }).catch(() => {});
    }
  } catch (err) {
    console.error(`[Button Error] ${interaction.customId}: ${err.message}`);
  }
}
