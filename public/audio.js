// All default sounds are synthesized locally. Custom clips are decoded once and
// mixed through the same compressor and master gain as the built-in voices.
const palettes = {
  hype: { notes: [261.63, 329.63, 392, 523.25], wave: 'sawtooth', step: .17, duration: .7 },
  chuckle: { notes: [196, 261.63, 196, 311.13, 261.63], wave: 'triangle', step: .16, duration: .28 },
  giggle: { notes: [523.25, 659.25, 783.99, 659.25, 1046.5], wave: 'sine', step: .12, duration: .45 },
  mellow: { notes: [392, 349.23, 311.13, 261.63], wave: 'sine', step: .3, duration: 1.1 },
  hello: { notes: [329.63, 392, 523.25, 392], wave: 'triangle', step: .22, duration: .55 },
  dream: { notes: [130.81, 196, 261.63], wave: 'sine', step: .45, duration: 1.5 },
};

export class SoundPlayer {
  constructor() { this.context = null; this.cache = new Map(); this.active = new Set(); this.generation = 0; }
  create() {
    if (this.context) return this.context;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = .4;
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 12; compressor.ratio.value = 8;
    compressor.attack.value = .003; compressor.release.value = .2;
    this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 128;
    this.master.connect(compressor); compressor.connect(this.analyser); this.analyser.connect(this.context.destination);
    return this.context;
  }
  async unlock() { this.create(); await this.context.resume(); return this.context.state === 'running'; }
  get ready() { return this.context?.state === 'running'; }
  setVolume(percent) { if (this.master) this.master.gain.setTargetAtTime(.4 * percent / 100, this.context.currentTime, .04); }
  stop() {
    this.generation++;
    for (const source of this.active) { try { source.stop(); } catch {} }
    this.active.clear();
  }
  track(source) { this.active.add(source); source.addEventListener('ended', () => this.active.delete(source), { once: true }); }
  async buffer(url) {
    if (!this.cache.has(url)) {
      const pending = fetch(url).then(r => { if (!r.ok) throw new Error('Custom sound is unavailable. Upload it again.'); return r.arrayBuffer(); })
        .then(bytes => this.create().decodeAudioData(bytes)).catch(error => { this.cache.delete(url); throw error; });
      this.cache.set(url, pending);
    }
    return this.cache.get(url);
  }
  async validate(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose an audio file smaller than 5 MB.');
    let decoded;
    try { decoded = await this.create().decodeAudioData(await file.arrayBuffer()); } catch { throw new Error('This file could not be played. Try a WAV or MP3 clip.'); }
    if (decoded.duration > 10) throw new Error('Choose a clip no longer than 10 seconds. Soundscapes use its first 4 seconds.');
    if (decoded.duration <= 0) throw new Error('This audio file is empty.');
  }
  voice(setting, gain, pan, when, customBuffer) {
    const ctx = this.create();
    const channel = ctx.createGain(); channel.gain.value = gain * setting.volume / 100;
    const panner = ctx.createStereoPanner(); panner.pan.value = pan;
    channel.connect(panner); panner.connect(this.master);
    const start = ctx.currentTime + .035 + when;
    if (customBuffer) {
      const source = ctx.createBufferSource(); source.buffer = customBuffer;
      const envelope = ctx.createGain();
      const duration = Math.min(4 - when, customBuffer.duration);
      envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(1, start + .015);
      envelope.gain.setValueAtTime(1, Math.max(start + .015, start + duration - .08));
      envelope.gain.linearRampToValueAtTime(0, start + duration);
      source.connect(envelope); envelope.connect(channel);
      source.start(start, 0, duration); this.track(source);
    } else {
      const sound = palettes[setting.preset] || palettes.hype;
      sound.notes.forEach((note, index) => {
        const oscillator = ctx.createOscillator(), envelope = ctx.createGain(), filter = ctx.createBiquadFilter();
        const at = start + index * sound.step;
        oscillator.type = sound.wave; oscillator.frequency.value = note;
        filter.type = 'lowpass'; filter.frequency.value = sound.wave === 'sawtooth' ? 1800 : 5000;
        envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(.3, at + .025);
        envelope.gain.exponentialRampToValueAtTime(.001, at + sound.duration);
        oscillator.connect(filter); filter.connect(envelope); envelope.connect(channel);
        oscillator.start(at); oscillator.stop(at + sound.duration + .02); this.track(oscillator);
      });
    }
    // Drop disconnected voice graphs after their short envelopes have finished.
    setTimeout(() => { channel.disconnect(); panner.disconnect(); }, 5000);
  }
  async preview(setting, volume) {
    await this.unlock(); this.stop(); this.setVolume(volume);
    const generation = this.generation;
    const clip = setting.custom ? await this.buffer(setting.custom.url) : null;
    if (generation !== this.generation) return;
    this.voice(setting, 1, 0, 0, clip);
  }
  async storm(trigger, config) {
    if (!this.ready || config.muted) return false;
    this.stop();
    const generation = this.generation;
    const voices = trigger.mix.filter(e => config.sounds[e.emoteId].volume > 0).slice(0, 4);
    const clips = await Promise.all(voices.map(e => config.sounds[e.emoteId].custom ? this.buffer(config.sounds[e.emoteId].custom.url).catch(() => null) : null));
    if (generation !== this.generation || config.muted || !this.ready) return false;
    this.setVolume(config.volume);
    const total = voices.reduce((n, e) => n + Math.sqrt(e.count), 0);
    voices.forEach((e, index) => this.voice(config.sounds[e.emoteId], Math.sqrt(e.count) / total,
      voices.length === 1 ? 0 : (index / (voices.length - 1) - .5) * .8, index * .09, clips[index]));
    return true;
  }
  levels() {
    if (!this.analyser || !this.ready) return null;
    const values = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(values); return values;
  }
}
