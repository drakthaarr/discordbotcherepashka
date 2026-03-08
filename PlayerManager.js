'use strict';

const { MusicPlayer } = require('./MusicPlayer');

/**
 * Singleton that holds one MusicPlayer per guild.
 */
class PlayerManager {
  constructor() {
    /** @type {Map<string, MusicPlayer>} */
    this._players = new Map();
  }

  /**
   * Get existing player or create a new one for the guild.
   * @param {import('discord.js').Interaction} interaction
   */
  async getOrCreate(interaction) {
    const guildId = interaction.guildId;

    if (this._players.has(guildId)) {
      return this._players.get(guildId);
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      throw new Error('Вы должны находиться в голосовом канале!');
    }

    const player = new MusicPlayer({
      guildId,
      textChannel:     interaction.channel,
      voiceChannel,
      adapterCreator:  interaction.guild.voiceAdapterCreator,
    });

    await player.connect();
    this._players.set(guildId, player);

    // Auto-clean when bot is forcibly disconnected
    player.connection?.on?.('stateChange', (_, next) => {
      if (next.status === 'destroyed') {
        this._players.delete(guildId);
      }
    });

    return player;
  }

  get(guildId) {
    return this._players.get(guildId) ?? null;
  }

  delete(guildId) {
    const p = this._players.get(guildId);
    if (p) { p.destroy(); this._players.delete(guildId); }
  }
}

module.exports = new PlayerManager(); // export singleton
