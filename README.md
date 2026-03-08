# 🎵 Discord Music Bot

Полнофункциональный Discord музыкальный бот с поддержкой YouTube, Spotify, SoundCloud и множеством фишек.

---

## ✨ Возможности

| Фича | Описание |
|------|----------|
| 🎵 Multi-source | YouTube, Spotify, SoundCloud, поисковые запросы |
| 📋 Очередь | Полноценная система очереди с пагинацией |
| 🔂 Повтор | Три режима: выкл / трек / вся очередь |
| 🔀 Shuffle | Перемешать очередь случайным образом |
| 🎛️ Фильтры | Bass Boost, Nightcore, Vaporwave, 8D, Karaoke, Echo, Tremolo, Vibrato, Flanger, Normalizer |
| 🔊 Громкость | 1–200% (выше 100% через FFmpeg) |
| ⏩ Seek | Перемотка к нужной позиции |
| 🦘 Jump | Прыжок к любому треку в очереди |
| ↕️ Move | Перемещение треков в очереди |
| ⏮️ Back | Вернуться к предыдущему треку |
| 🔍 Search | Интерактивный поиск с выпадающим меню |
| 🎧 Autocomplete | Автодополнение при вводе `/play` |
| 🕹️ Кнопки | Интерактивные кнопки управления в Now Playing |
| 💤 Inactivity | Автоотключение при бездействии |

---

## 🚀 Установка

### 1. Требования
- **Node.js v18+** — [nodejs.org](https://nodejs.org)
- **FFmpeg** — должен быть установлен в системе:
  - Windows: `winget install ffmpeg` или через [ffmpeg.org](https://ffmpeg.org/download.html)
  - Linux: `sudo apt install ffmpeg`
  - macOS: `brew install ffmpeg`

### 2. Клонирование и установка зависимостей

```bash
git clone <repo>
cd discord-music-bot
npm install
```

### 3. Создание Discord приложения

1. Перейдите на [discord.com/developers/applications](https://discord.com/developers/applications)
2. Нажмите **New Application**, введите название
3. Перейдите в **Bot** → **Add Bot**
4. Скопируйте **Token** (это `DISCORD_TOKEN`)
5. Перейдите в **OAuth2** → скопируйте **Application ID** (это `CLIENT_ID`)
6. В **Bot** → включите **Server Members Intent** и **Message Content Intent**

### 4. Приглашение бота на сервер

Перейдите по ссылке (замените `YOUR_CLIENT_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot+applications.commands
```

### 5. Настройка `.env`

```bash
cp .env.example .env
```

Откройте `.env` и заполните:

```env
DISCORD_TOKEN=ваш_токен_бота
CLIENT_ID=ваш_client_id

# Опционально для Spotify:
SPOTIFY_CLIENT_ID=ваш_spotify_client_id
SPOTIFY_CLIENT_SECRET=ваш_spotify_client_secret
```

#### Получение Spotify credentials (опционально):
1. Перейдите на [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Создайте приложение
3. Скопируйте Client ID и Client Secret

### 6. Регистрация команд

```bash
npm run deploy
```

### 7. Запуск бота

```bash
npm start
```

---

## 📋 Команды

### 🎵 Воспроизведение
| Команда | Описание |
|---------|----------|
| `/play <запрос>` | Воспроизвести трек или плейлист (YouTube/Spotify/SoundCloud/поиск) |
| `/search <запрос>` | Найти треки и выбрать из списка |
| `/pause` | Пауза |
| `/resume` | Продолжить |
| `/stop` | Остановить и очистить очередь |
| `/skip [кол-во]` | Пропустить трек(и) |
| `/back` | Предыдущий трек |
| `/seek <время>` | Перемотать (пример: `1:30` или `90`) |
| `/disconnect` | Отключить бота |

### 📋 Управление очередью
| Команда | Описание |
|---------|----------|
| `/queue [страница]` | Показать очередь |
| `/nowplaying` | Текущий трек с кнопками управления |
| `/shuffle` | Перемешать очередь |
| `/loop <режим>` | Режим повтора: `off` / `track` / `queue` |
| `/jump <позиция>` | Перейти к треку в очереди |
| `/remove <позиция>` | Удалить трек из очереди |
| `/move <откуда> <куда>` | Переместить трек |
| `/clear` | Очистить очередь (оставить текущий) |

### 🎛️ Настройки
| Команда | Описание |
|---------|----------|
| `/volume <1-200>` | Установить громкость |
| `/filter <фильтр>` | Включить/выключить фильтр |
| `/filters` | Показать все фильтры |
| `/resetfilters` | Сбросить все фильтры |

### 🎛️ Доступные фильтры
| Фильтр | Эффект |
|--------|--------|
| `bassboost` | 🔊 Усиление низких частот |
| `nightcore` | 🌙 Ускорение + повышение тона |
| `vaporwave` | 🌊 Замедление + понижение тона |
| `eightd` | 🎧 Объёмный 8D звук |
| `karaoke` | 🎤 Подавление вокала |
| `echo` | 🔁 Эхо-эффект |
| `tremolo` | 〰️ Амплитудный тремоло |
| `vibrato` | 🎵 Вибрато |
| `normalizer` | 📊 Нормализация громкости |
| `flanger` | 🌀 Фленджер эффект |

---

## 🔧 Переменные окружения

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `DISCORD_TOKEN` | ✅ | Токен Discord бота |
| `CLIENT_ID` | ✅ | ID приложения Discord |
| `SPOTIFY_CLIENT_ID` | ❌ | Spotify Client ID |
| `SPOTIFY_CLIENT_SECRET` | ❌ | Spotify Client Secret |
| `DEFAULT_VOLUME` | ❌ | Стандартная громкость (1-200, по умолч. 80) |
| `MAX_QUEUE_SIZE` | ❌ | Макс. треков в очереди (0 = безлимит) |
| `INACTIVITY_TIMEOUT` | ❌ | Минут до автоотключения (0 = никогда) |

---

## 🐛 Устранение неполадок

**Бот не воспроизводит звук:**
- Убедитесь что FFmpeg установлен: `ffmpeg -version`
- Проверьте что у бота есть права на подключение и говорение в канале

**Ошибки при установке `@discordjs/opus`:**
```bash
npm install @discordjs/opus --build-from-source
# или используйте альтернативу:
npm install opusscript
```

**Spotify не работает:**
- Убедитесь что SPOTIFY_CLIENT_ID и SPOTIFY_CLIENT_SECRET указаны в .env
- Без Spotify credentials бот всё равно найдёт трек через YouTube

**Команды не появляются:**
- Запустите `npm run deploy` для регистрации команд
- Команды могут появляться с задержкой до 1 часа (глобальные)
