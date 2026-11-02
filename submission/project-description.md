# Emote Echo

**Give chat a voice.**

## Inspiration

Twitch communities react together through emotes, but that energy is usually visual. I wanted viewers' reactions to become something the whole stream could hear, while giving streamers control over what their community sounds like.

## What it does

Emote Echo turns bursts of chat emotes into short, layered soundscapes. When the community sends 100 emote uses within a rolling 15-second window, the most frequent emotes shape a shared audio moment. A browser overlay shows progress toward the next storm.

Streamers can preview sounds, choose synth presets, upload custom audio, adjust individual and master volume, and change the threshold, window and cooldown. New native channel emotes appear when they are first seen in chat. A simulator makes the app easy to try without an active audience.

## How it was built

The app uses Node.js, Twitch OAuth and EventSub over WebSockets, Server-Sent Events to synchronize the studio and overlay, and the Web Audio API to synthesize and mix sounds locally. It runs without external dependencies or a paid audio service. A local recorder combines real screen footage with the app's audio.

## How OpenAI Codex was used

I defined the idea and interaction rules, then used Codex to help build the application. Codex helped implement the rolling-window trigger, sound mixer, studio, OBS overlay, Twitch connection, recording helper and automated tests. It also helped inspect the browser interface and write setup instructions.

## Challenges

The main challenges were making the time window roll continuously, preventing the same emotes from triggering twice, mixing several sounds into one short event, and ensuring simulated messages never contribute to live Twitch progress. Another challenge was keeping authorization local and avoiding credentials in shared files.

## What's next

Shareable sound packs, additional original synth presets, optional limits per viewer, and support for third-party emote providers.

---
Live Twitch input was verified on November 1, 2026: native emotes were received through EventSub, a 100-use burst triggered a soundscape, and the Web Audio visualizer showed the resulting audio signal.
