'use strict';

const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const play = require('play-dl');
const { EmbedBuilder } = require('discord.js');

// ── Audio filter presets ──────────────────────────────────────────────────────
const FILTERS = {
  bassboost:  { label: '🔊 Bass Boost',   args: 'bass=g=20,dynaudnorm=f=200' },
  nightcore:  { label: '🌙 Nightcore',    args: 'aresample=48000,asetrate=48000*1.25,atempo=1.0' },
  vaporwave:  { label: '🌊 Vaporwave',    args: 'aresample=48000,asetrate=48000*0.8,atempo=1.0' },
  eightd:     { label: '🎧 8D Audio',     args: 'apulsator=hz=0.08' },
  karaoke:    { label: '🎤 Karaoke',      args: 'stereotools=mlev=0.015625' },
  echo:       { label: '🔁 Echo',         args: 'aecho=0.8:0.88:60:0.4' },
  tremolo:    { label: '〰️ Tremolo',      args: 'tremolo=f=3:d=0.5' },
  vibrato:    { label: '🎵 Vibrato',      args: 'vibrato=f=6:d=0.5' },
  normalizer: { label: '📊 Normalizer',   args: 'dynaudnorm=f=200' },
  flanger:    { label: '🌀 Flanger',      args: 'flanger' },
};

const LOOP_MODES = { OFF: 'off', TRACK: 'track', QUEUE: 'queue' };
const COLORS = { primary: 0x5865F2, success: 0x57F287, warning: 0xFEE75C, error: 0xED4245, info: 0x5DADE2 };

// ── MusicPlayer ───────────────────────────────────────────────────────────────
class MusicPlayer {
  constructor({ guildId, textChannel, voiceChannel, adapterCreator }) {
    this.guildId       = guildId;
    this.textChannel   = textChannel;
    this.voiceChannel  = voiceChannel;
    this._adapterCreator = adapterCreator;

    // Queue & state
    this.queue         = [];          // Array of track objects
    this.currentIndex  = -1;         // Index of currently playing track
    this.history       = [];          // Last 10 played tracks
    this.loopMode      = LOOP_MODES.OFF;
    this.volume        = parseInt(process.env.DEFAULT_VOLUME ?? 80);
    this.activeFilters = new Set();
    this.seekPosition  = 0;          // seconds
    this.startedAt     = null;       // Date when current track started
    this.pausedAt      = null;
    this.totalPaused   = 0;          // ms spent paused

    // Discord voice objects
    this.connection    = null;
    this.player        = createAudioPlayer();
    this.resource      = null;
    this._inactivityTimer = null;

    this._setupPlayerEvents();
  }

  // ── Setup ────────────────────────────────────────────────────────────────────
  _setupPlayerEvents() {
    this.player.on(AudioPlayerStatus.Idle, () => this._onTrackEnd());
    this.player.on('error', (err) => {
      console.error(`[Player Error] ${err.message}`);
      this._sendError(`Ошибка воспроизведения: \`${err.message}\``);
      this._onTrackEnd();
    });
  }

  async _onTrackEnd() {
    const current = this.queue[this.currentIndex];
    if (current) this.history.unshift(current);
    if (this.history.length > 10) this.history.pop();

    if (this.loopMode === LOOP_MODES.TRACK && this.currentIndex >= 0) {
      return this._playIndex(this.currentIndex);
    }

    const nextIndex = this.currentIndex + 1;

    if (nextIndex < this.queue.length) {
      this.currentIndex = nextIndex;
      return this._playIndex(this.currentIndex);
    }

    if (this.loopMode === LOOP_MODES.QUEUE && this.queue.length > 0) {
      this.currentIndex = 0;
      return this._playIndex(0);
    }

    // Queue finished
    this.currentIndex = -1;
    this._startInactivityTimer();
    this._sendEmbed(
      new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle('✅ Очередь завершена')
        .setDescription('Все треки воспроизведены. Добавьте новые с помощью `/play`!')
    );
  }

  // ── Connection ───────────────────────────────────────────────────────────────
  async connect() {
    if (this.connection) return;
    this.connection = joinVoiceChannel({
      channelId:      this.voiceChannel.id,
      guildId:        this.guildId,
      adapterCreator: this._adapterCreator,
      selfDeaf:       true,
    });
    this.connection.subscribe(this.player);

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
    } catch {
      this.connection.destroy();
      this.connection = null;
      throw new Error('Не удалось подключиться к голосовому каналу.');
    }

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  disconnect() {
    this.player.stop(true);
    this.connection?.destroy();
    this.connection = null;
    this._clearInactivityTimer();
  }

  // ── Add tracks ───────────────────────────────────────────────────────────────
  async addTrack(query, requestedBy) {
    const tracks = await this._resolve(query, requestedBy);
    if (!tracks.length) throw new Error('Ничего не найдено.');

    const maxSize = parseInt(process.env.MAX_QUEUE_SIZE ?? 0);
    if (maxSize > 0 && this.queue.length + tracks.length > maxSize) {
      throw new Error(`Очередь заполнена (максимум ${maxSize} треков).`);
    }

    this.queue.push(...tracks);
    return tracks;
  }

  async _resolve(query, requestedBy) {
    const trimmed = query.trim();

    // ── Spotify ──
    if (play.is_expired()) await play.refreshToken();

    if (trimmed.includes('spotify.com')) {
      const spotifyData = await play.spotify(trimmed).catch(() => null);
      if (!spotifyData) throw new Error('Не удалось получить данные из Spotify.');

      if (spotifyData.type === 'track') {
        const search = await play.search(`${spotifyData.name} ${spotifyData.artists[0]?.name}`, { limit: 1 });
        if (!search.length) return [];
        return [this._formatYT(search[0], requestedBy, { title: spotifyData.name, thumbnail: spotifyData.thumbnail?.url })];
      }

      // Album or Playlist
      const tracks = spotifyData.type === 'album'
        ? await spotifyData.all_tracks()
        : await spotifyData.all_tracks();

      const results = [];
      for (const t of tracks) {
        const s = await play.search(`${t.name} ${t.artists[0]?.name}`, { limit: 1 }).catch(() => []);
        if (s[0]) results.push(this._formatYT(s[0], requestedBy, { title: t.name, thumbnail: t.thumbnail?.url }));
      }
      return results;
    }

    // ── YouTube Playlist ──
    if (trimmed.includes('youtube.com/playlist') || trimmed.includes('list=')) {
      const playlist = await play.playlist_info(trimmed, { incomplete: true }).catch(() => null);
      if (!playlist) throw new Error('Не удалось загрузить плейлист.');
      const videos = await playlist.all_videos();
      return videos.map(v => this._formatYT(v, requestedBy));
    }

    // ── YouTube Video ──
    if (trimmed.includes('youtube.com/watch') || trimmed.includes('youtu.be/')) {
      const info = await play.video_info(trimmed).catch(() => null);
      if (!info) throw new Error('Видео недоступно.');
      return [this._formatYT(info.video_details, requestedBy)];
    }

    // ── SoundCloud ──
    if (trimmed.includes('soundcloud.com')) {
      const scData = await play.soundcloud(trimmed).catch(() => null);
      if (!scData) throw new Error('Не удалось получить данные из SoundCloud.');

      if (scData.type === 'track') {
        return [this._formatSC(scData, requestedBy)];
      }
      if (scData.type === 'playlist' || scData.type === 'system-playlist') {
        const all = await scData.all_tracks();
        return all.map(t => this._formatSC(t, requestedBy));
      }
    }

    // ── Text Search → YouTube ──
    const results = await play.search(trimmed, { source: { youtube: 'video' }, limit: 1 });
    if (!results.length) throw new Error('Ничего не найдено по запросу.');
    return [this._formatYT(results[0], requestedBy)];
  }

  _formatYT(video, requestedBy, overrides = {}) {
    return {
      id:          video.id,
      title:       overrides.title ?? video.title,
      url:         video.url,
      duration:    video.durationInSec ?? 0,
      durationFmt: video.durationRaw ?? this._fmtDuration(video.durationInSec ?? 0),
      thumbnail:   overrides.thumbnail ?? video.thumbnails?.[0]?.url ?? '',
      channel:     video.channel?.name ?? video.author?.name ?? 'Unknown',
      source:      'youtube',
      requestedBy,
    };
  }

  _formatSC(track, requestedBy) {
    return {
      id:          track.id,
      title:       track.name,
      url:         track.url,
      duration:    Math.floor((track.durationInMs ?? 0) / 1000),
      durationFmt: this._fmtDuration(Math.floor((track.durationInMs ?? 0) / 1000)),
      thumbnail:   track.thumbnail ?? '',
      channel:     track.user?.name ?? 'Unknown',
      source:      'soundcloud',
      requestedBy,
    };
  }

  // ── Playback ─────────────────────────────────────────────────────────────────
  async startPlaying() {
    if (this.currentIndex >= 0) return; // already playing
    if (!this.queue.length) throw new Error('Очередь пуста.');
    this.currentIndex = 0;
    await this._playIndex(0);
  }

  async _playIndex(index, seek = 0) {
    const track = this.queue[index];
    if (!track) return;

    this._clearInactivityTimer();

    try {
      let stream;

      if (track.source === 'soundcloud') {
        const scInfo = await play.soundcloud(track.url);
        stream = await play.stream_from_info(scInfo, { seek });
      } else {
        stream = await play.stream(track.url, { seek, quality: 2 });
      }

      const ffmpegArgs = this._buildFFmpegArgs();

      this.resource = createAudioResource(stream.stream, {
        inputType:      stream.type,
        inlineVolume:   true,
        metadata:       track,
        ...(ffmpegArgs ? { ffmpegArgs: ['-af', ffmpegArgs] } : {}),
      });

      this.resource.volume?.setVolumeLogarithmic(this.volume / 100);
      this.seekPosition = seek;
      this.startedAt    = new Date();
      this.pausedAt     = null;
      this.totalPaused  = 0;

      this.player.play(this.resource);
      await entersState(this.player, AudioPlayerStatus.Playing, 10_000);

      this._sendNowPlaying(track);
    } catch (err) {
      console.error(`[PlayIndex Error] ${err.message}`);
      this._sendError(`Не удалось воспроизвести **${track.title}**: ${err.message}`);
      await this._onTrackEnd();
    }
  }

  // Re-stream current track with updated filters/volume
  async _refreshStream() {
    const index = this.currentIndex;
    if (index < 0) return;
    const elapsed = this._getElapsed();
    await this._playIndex(index, elapsed);
  }

  // ── Controls ─────────────────────────────────────────────────────────────────
  pause() {
    if (this.player.state.status !== AudioPlayerStatus.Playing) return false;
    this.player.pause();
    this.pausedAt = Date.now();
    return true;
  }

  resume() {
    if (this.player.state.status !== AudioPlayerStatus.Paused) return false;
    this.player.unpause();
    if (this.pausedAt) {
      this.totalPaused += Date.now() - this.pausedAt;
      this.pausedAt = null;
    }
    return true;
  }

  async skip(amount = 1) {
    const next = this.currentIndex + amount;
    if (next >= this.queue.length) {
      if (this.loopMode === LOOP_MODES.QUEUE) {
        this.currentIndex = 0;
        await this._playIndex(0);
        return;
      }
      this.stop();
      return;
    }
    this.currentIndex = next;
    await this._playIndex(this.currentIndex);
  }

  async back() {
    if (this.currentIndex <= 0 && this.history.length === 0) return false;
    const prevIndex = Math.max(0, this.currentIndex - 1);
    this.currentIndex = prevIndex;
    await this._playIndex(prevIndex);
    return true;
  }

  async jumpTo(index) {
    if (index < 0 || index >= this.queue.length) throw new Error('Неверный номер трека.');
    this.currentIndex = index;
    await this._playIndex(index);
  }

  stop() {
    this.queue         = [];
    this.currentIndex  = -1;
    this.history       = [];
    this.player.stop(true);
    this._startInactivityTimer();
  }

  async seek(seconds) {
    if (this.currentIndex < 0) throw new Error('Ничего не воспроизводится.');
    const track = this.queue[this.currentIndex];
    if (seconds < 0 || seconds > track.duration) throw new Error('Неверная позиция.');
    await this._playIndex(this.currentIndex, seconds);
  }

  // ── Volume & Filters ─────────────────────────────────────────────────────────
  setVolume(vol) {
    this.volume = Math.max(1, Math.min(200, vol));
    this.resource?.volume?.setVolumeLogarithmic(this.volume / 100);
    return this.volume;
  }

  async toggleFilter(filterKey) {
    if (!FILTERS[filterKey]) throw new Error('Неизвестный фильтр.');

    // Some filters conflict with each other
    const conflicts = {
      nightcore:  ['vaporwave'],
      vaporwave:  ['nightcore'],
    };

    if (conflicts[filterKey]) {
      for (const c of conflicts[filterKey]) this.activeFilters.delete(c);
    }

    if (this.activeFilters.has(filterKey)) {
      this.activeFilters.delete(filterKey);
    } else {
      this.activeFilters.add(filterKey);
    }

    await this._refreshStream();
    return this.activeFilters.has(filterKey);
  }

  async clearFilters() {
    this.activeFilters.clear();
    await this._refreshStream();
  }

  _buildFFmpegArgs() {
    const parts = [];

    // Volume is handled via inlineVolume, but add volume filter for > 100%
    if (this.volume > 100) {
      parts.push(`volume=${(this.volume / 100).toFixed(2)}`);
    }

    for (const key of this.activeFilters) {
      if (FILTERS[key]) parts.push(FILTERS[key].args);
    }

    return parts.join(',');
  }

  // ── Queue Management ─────────────────────────────────────────────────────────
  shuffle() {
    if (this.queue.length < 2) return false;
    const current = this.queue[this.currentIndex];
    const rest     = this.queue.filter((_, i) => i !== this.currentIndex);

    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    this.queue        = current ? [current, ...rest] : rest;
    this.currentIndex = current ? 0 : -1;
    return true;
  }

  remove(index) {
    if (index < 0 || index >= this.queue.length) throw new Error('Неверный номер трека.');
    const removed = this.queue.splice(index, 1)[0];
    if (index < this.currentIndex) this.currentIndex--;
    else if (index === this.currentIndex) {
      this.currentIndex = Math.min(this.currentIndex, this.queue.length - 1);
      this._playIndex(this.currentIndex);
    }
    return removed;
  }

  move(from, to) {
    if (from < 0 || from >= this.queue.length || to < 0 || to >= this.queue.length) {
      throw new Error('Неверный номер трека.');
    }
    const [track] = this.queue.splice(from, 1);
    this.queue.splice(to, 0, track);

    // Adjust currentIndex
    if (from === this.currentIndex) {
      this.currentIndex = to;
    } else if (from < this.currentIndex && to >= this.currentIndex) {
      this.currentIndex--;
    } else if (from > this.currentIndex && to <= this.currentIndex) {
      this.currentIndex++;
    }
    return track;
  }

  setLoop(mode) {
    if (!Object.values(LOOP_MODES).includes(mode)) throw new Error('Неверный режим.');
    this.loopMode = mode;
    return mode;
  }

  // ── Now Playing ──────────────────────────────────────────────────────────────
  _getElapsed() {
    if (!this.startedAt) return 0;
    const now  = Date.now();
    const base = now - this.startedAt.getTime() - this.totalPaused + (this.seekPosition * 1000);
    return Math.floor(base / 1000);
  }

  _progressBar(current, total, length = 20) {
    if (!total) return '─'.repeat(length);
    const pct  = Math.min(current / total, 1);
    const pos  = Math.round(pct * length);
    return '▬'.repeat(pos) + '🔘' + '▬'.repeat(length - pos);
  }

  getCurrentTrack() {
    return this.queue[this.currentIndex] ?? null;
  }

  getNowPlayingEmbed() {
    const track = this.getCurrentTrack();
    if (!track) return null;

    const elapsed = this._getElapsed();
    const loopIcon = { off: '➡️', track: '🔂', queue: '🔁' }[this.loopMode];
    const srcIcon  = { youtube: '▶️ YouTube', soundcloud: '☁️ SoundCloud', spotify: '🟢 Spotify' }[track.source] ?? '🎵';
    const isPaused = this.player.state.status === AudioPlayerStatus.Paused;
    const filters  = [...this.activeFilters].map(k => FILTERS[k]?.label).join(' ') || 'нет';

    return new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle(`${isPaused ? '⏸️' : '🎵'} Сейчас играет`)
      .setDescription(`### [${track.title}](${track.url})`)
      .setThumbnail(track.thumbnail)
      .addFields(
        { name: '🎤 Исполнитель', value: track.channel,                              inline: true  },
        { name: '📡 Источник',    value: srcIcon,                                    inline: true  },
        { name: '🔊 Громкость',   value: `${this.volume}%`,                          inline: true  },
        { name: '⏱️ Прогресс',
          value: `\`${this._fmtDuration(elapsed)}\` ${this._progressBar(elapsed, track.duration)} \`${track.durationFmt}\``,
          inline: false },
        { name: loopIcon + ' Повтор',  value: this._loopLabel(), inline: true },
        { name: '🎛️ Фильтры',    value: filters,                                    inline: true  },
        { name: '📋 Очередь',     value: `${this.currentIndex + 1}/${this.queue.length}`, inline: true },
      )
      .setFooter({ text: `Запросил: ${track.requestedBy}` })
      .setTimestamp();
  }

  getQueueEmbed(page = 1) {
    const perPage  = 10;
    const total    = this.queue.length;
    const pages    = Math.max(1, Math.ceil(total / perPage));
    page = Math.max(1, Math.min(page, pages));

    const start  = (page - 1) * perPage;
    const tracks = this.queue.slice(start, start + perPage);

    const lines = tracks.map((t, i) => {
      const num    = start + i;
      const marker = num === this.currentIndex ? '▶️' : `\`${num + 1}.\``;
      return `${marker} [${t.title}](${t.url}) — \`${t.durationFmt}\` — <@${t.requestedBy.id ?? t.requestedBy}>`;
    });

    const totalDur = this.queue.reduce((a, t) => a + t.duration, 0);

    return new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle('📋 Очередь воспроизведения')
      .setDescription(lines.join('\n') || 'Очередь пуста.')
      .addFields(
        { name: '🎵 Треков',     value: `${total}`,                   inline: true },
        { name: '⏳ Длительность', value: this._fmtDuration(totalDur), inline: true },
        { name: '🔁 Повтор',     value: this._loopLabel(),            inline: true },
      )
      .setFooter({ text: `Страница ${page}/${pages}` });
  }

  // ── Inactivity Timer ─────────────────────────────────────────────────────────
  _startInactivityTimer() {
    const mins = parseInt(process.env.INACTIVITY_TIMEOUT ?? 5);
    if (!mins) return;
    this._clearInactivityTimer();
    this._inactivityTimer = setTimeout(() => {
      this.disconnect();
      this._sendEmbed(
        new EmbedBuilder()
          .setColor(COLORS.warning)
          .setTitle('💤 Отключен')
          .setDescription(`Бот отключился из-за ${mins} минут бездействия.`)
      );
    }, mins * 60 * 1000);
  }

  _clearInactivityTimer() {
    if (this._inactivityTimer) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  _loopLabel() {
    return { off: 'Выкл', track: 'Трек', queue: 'Очередь' }[this.loopMode];
  }

  _fmtDuration(sec) {
    if (!sec || sec < 0) return '∞';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${m}:${String(s).padStart(2,'0')}`;
  }

  _sendNowPlaying(track) {
    const embed = this.getNowPlayingEmbed();
    if (embed) this.textChannel.send({ embeds: [embed] }).catch(() => {});
  }

  _sendEmbed(embed) {
    this.textChannel.send({ embeds: [embed] }).catch(() => {});
  }

  _sendError(msg) {
    this.textChannel.send({
      embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${msg}`)],
    }).catch(() => {});
  }

  destroy() {
    this.disconnect();
  }
}

module.exports = { MusicPlayer, FILTERS, LOOP_MODES, COLORS };
