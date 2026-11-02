# Emote Echo demo — about 2 minutes 40 seconds

Record actual running footage with real Twitch input. The organizer requires a video under three minutes, not a slideshow.

## Prepare

Connect Twitch and verify live emotes reach the studio. Open separate tabs for the recording studio, sound settings, your Twitch chat and the Codex build chat. Keep the original studio tab open. Enable studio sound and avoid a second overlay playing the same audio.

For a small demo channel, temporarily set the threshold to 3 and keep the 15-second window. Explain that the normal target is 100. Restore the default after recording.

Use the studio recorder or an external recorder that captures app audio. The built-in recorder does not include microphone narration; narration can be recorded separately if desired.

## 0:00–0:20 — idea

Show the studio and its live Twitch source.

Suggested narration: This is Emote Echo. It gives Twitch chat a voice. Viewers' emote reactions combine into a short soundscape that the whole stream can hear.

## 0:20–1:00 — real Twitch connection

Show your Twitch chat, send usable native emotes, and return to the studio. Show the counter, usernames, native artwork and trigger. Let the audio play.

Suggested narration: The normal target is 100 emote uses in a rolling 15 seconds. I lowered it to three for this small demonstration. These messages arrive from Twitch through EventSub. The soundscape depends on which emotes the viewers use.

## 1:00–1:35 — customization

In a separate settings tab, change an emote's synth sound or upload an original clip. Return to the recording studio and trigger a second real storm so its mixer records the new sound.

Suggested narration: Streamers can choose a sound for each emote, upload their own clips, adjust volume and tune the trigger settings. The studio and overlay stay synchronized.

## 1:35–2:10 — show Codex

Show this build chat, including the original prompt and implementation work, then a short view of source or tests. Avoid displaying credentials.

Suggested narration: I came up with the idea and used OpenAI Codex to help build the server, sound mixer, interface, Twitch connection and tests. Codex also helped check the browser interface and create run instructions.

## 2:10–2:40 — overlay and close

Show the browser overlay or OBS Browser Source, then return to the studio.

Suggested narration: Emote Echo lets a community create a shared audio moment through something it already does: send emotes. The code and setup instructions are available in the repository.

## Finish

Stop before three minutes. Check both picture and sound. Upload the video to YouTube and add its accessible URL to Devpost. The original instructions request Public; the organizer's final-weekend update also permits Unlisted, but not Private.

Organizer update: https://twitchcon-codex.devpost.com/updates/47341-final-weekend-make-your-project-come-alive
