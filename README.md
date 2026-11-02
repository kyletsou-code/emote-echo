# Emote Echo

**Give chat a voice.** A local streaming tool that turns bursts of native Twitch emotes into short, customizable soundscapes. Built with OpenAI Codex for the Codex x TwitchCon Hackathon.

## Run

Requires **Node.js 22 or newer**. No npm dependencies, paid services, or AI API keys are needed.

```sh
npm start
```

Or run `node server.mjs`. On this Mac, double-click `Launch.command` to use an installed Node or Codex's bundled runtime.

- Studio: http://localhost:4317
- Sound library and Twitch connection: http://localhost:4317/settings
- Transparent OBS overlay: http://localhost:4317/overlay

Keep the server running. Ctrl+C stops it. `PORT` changes its port; use the default for the callback below. The server binds only to this computer.

## First demo: no account required

Click **Enable sound**, then **Start a wave**. The simulator sends 120 emote occurrences over 12 seconds and triggers near 10 seconds. Individual emote pads send one or ten occurrences. Reset clears the session, keeping sound settings.

## Connect real Twitch chat

1. Open the Twitch card in settings and click **Connect with Twitch**. Emote Echo's registered public Client ID is already provided.
2. Approve the single `user:read:chat` permission. The app listens to the signed-in account's own channel.
3. The studio switches to **Twitch live**. Native emotes sent in your channel enter the counter. New channel emotes appear in the sound library automatically.
4. Use the source selector to switch between live input and the simulator. Switching clears the session so test emotes never count toward a live storm.

Each user authorizes their own Twitch account, and their access token returns to their own computer. Localhost works because Twitch redirects the user's browser to the app running on that same computer. The public Client ID identifies this application; it is not an access token or secret.

If you want to register a separate development copy or use another callback, create an app at https://dev.twitch.tv/console/apps with Public client type, Broadcaster Suite category and `http://localhost:4317/twitch/callback` as the redirect URL, then override the Client ID in settings. Twitch requires a verified account with two-factor authentication for app registration.

The EventSub client handles duplicate messages, reconnect requests, interrupted connections, keepalives, and hourly token validation. Tokens stay in server memory and are excluded from snapshots, logs and saved settings. Restarting the server requires reconnecting. Disconnect forgets authorization locally. Third-party emote providers such as 7TV, BTTV and FFZ are outside the current scope.

## Trigger rules and sounds

- Default: **100 fresh occurrences in a rolling 15-second window**, across all emotes.
- Every actual occurrence counts, including repetitions in a message. Plain-text names are ignored in Twitch live mode.
- Exactly 15-second-old events expire. A triggered use cannot trigger twice.
- The main meter shows fresh uses; its caption also shows total uses still inside the window.
- The default 8-second cooldown prevents overlapping storms. New uses collected during cooldown still expire normally.
- Pause output prevents triggers and audio. Resume may trigger immediately if enough valid uses remain.
- Up to four most frequent audible emote types are mixed using weighted volume, gentle panning and compression.
- Each emote supports preview, six synth presets, volume adjustment and a custom clip. Accepted files: WAV, MP3, OGG, WebM or M4A, up to 5 MB and 10 seconds. A storm uses at most the first four seconds. Browser format support varies.
- A voice at zero volume is silent, but its emote uses still contribute to the threshold.

Built-in sounds are synthesized locally. Original drawn faces are offline stand-ins; live emotes use their Twitch CDN images. Settings, the emote catalogue and uploads save under `.local/`, which is excluded from Git. Session totals are in memory. `EMOTE_DATA_DIR` selects an isolated data directory for tests.

## OBS

Add a Browser Source with `http://localhost:4317/overlay`, width 1920 and height 1080. Enable **Control audio via OBS**. The page is transparent, with a lower-left progress widget. Configure monitoring in OBS as needed.

In a normal browser, click Enable sound once. OBS normally permits Browser Source audio automatically. Disable studio monitoring when the overlay is also playing to avoid double audio. Newly opened overlays do not replay past storms.

## Record a demo

Expand **Record your hackathon demo** in the studio. Click **Choose window**, select a capture source and check the live preview. Then click **Start recording** to capture actual footage. The app's audio is mixed directly into the recording. Stop to download `emote-echo-demo.webm`. Recording stops automatically at 2 minutes 55 seconds. Nothing is uploaded automatically.

Keep the recording studio tab open; use another tab for settings, Twitch chat or Codex. The recorder captures app audio, not microphone narration. Screen sharing and MediaRecorder support are required; use Chrome or Edge if the in-app browser lacks them. See `submission/demo-script.md` for the shot list.

## Tests

```sh
npm test
```

Checks cover the rolling-window boundary, cooldowns, one-use scoring, pause/reset, real emote-fragment parsing, custom emotes, reconnect URL validation, subscription setup, duplicate delivery, missing permissions and token exclusion from public state. Mocked tests do not establish a live connection; live verification requires Twitch authorization.

## Files

- `server.mjs`: local HTTP/SSE server, simulator, OAuth callback, settings and uploads.
- `lib/engine.mjs`: rolling window and trigger rules.
- `lib/twitch.mjs`: read-only Twitch EventSub client and emote parser.
- `public/app.js`: studio, sound library and synchronized overlay.
- `public/audio.js`: Web Audio instruments, custom clips and mixer.
- `public/recorder.js`: local screen recording with app audio.
- `test/`: automated behavior checks.
- `submission/`: project description, demo script and build session ID.

## How Codex was used

The creator proposed the idea, threshold behavior and streamer-editable sounds. Codex helped implement the server, studio, overlay, sound mixer, simulator, Twitch integration, recording helper, tests and documentation. The main build chat is identified in `submission/codex-session-id.txt`.

## References

- https://dev.twitch.tv/docs/authentication/register-app/
- https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
- https://dev.twitch.tv/docs/chat/authenticating/
- https://dev.twitch.tv/docs/eventsub/handling-websocket-events/
- https://dev.twitch.tv/docs/authentication/validate-tokens/

This application is designed to run locally, not as a public server.
