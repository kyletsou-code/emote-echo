export const SOUNDS = [
  { id: 'hype', name: 'Hype spark', description: 'Bright, rising synth' },
  { id: 'chuckle', name: 'Little trouble', description: 'Bouncy, cheeky plucks' },
  { id: 'giggle', name: 'Giggle bells', description: 'Quick, sparkling notes' },
  { id: 'mellow', name: 'Sad little piano', description: 'Soft, descending bells' },
  { id: 'hello', name: 'Friendly wave', description: 'Warm, playful melody' },
  { id: 'dream', name: 'Dream cloud', description: 'Slow, floating tones' },
];

export const EMOTES = [
  { id: 'pog', name: 'PogChamp', mood: 'Hype', color: '#b6f47b', sound: 'hype', face: 'surprise' },
  { id: 'kappa', name: 'Kappa', mood: 'Mischief', color: '#b8a1fc', sound: 'chuckle', face: 'smirk' },
  { id: 'lul', name: 'LUL', mood: 'Laughter', color: '#ffcd77', sound: 'giggle', face: 'laugh' },
  { id: 'cry', name: 'BibleThump', mood: 'Feels', color: '#86c6ff', sound: 'mellow', face: 'cry' },
  { id: 'hey', name: 'HeyGuys', mood: 'Hello', color: '#77e0c4', sound: 'hello', face: 'happy' },
  { id: 'sleep', name: 'ResidentSleeper', mood: 'Sleepy', color: '#f1a0c4', sound: 'dream', face: 'sleep' },
];

export const DEFAULT_CONFIG = {
  // This identifies the same public installed application for all users. It is
  // not a secret; each user's OAuth token is obtained separately and stays local.
  twitchClientId: 'p4debcn4m01yk88w500h31bh0sc1wn',
  threshold: 100, windowSeconds: 15, cooldownSeconds: 8, volume: 65, muted: false,
  sounds: Object.fromEntries(EMOTES.map(e => [e.id, { preset: e.sound, volume: 80, custom: null }])),
};

// Count every occurrence, keep a rolling time window, and never spend the same
// occurrence on two soundscapes. The clock is injectable for exact boundary tests.
export class StormEngine {
  constructor(config = structuredClone(DEFAULT_CONFIG), clock = Date.now, emotes = EMOTES) {
    this.config = config;
    this.clock = clock;
    this.emotes = emotes;
    this.reset();
  }
  reset() {
    this.events = [];
    this.sequence = 0;
    this.consumedThrough = 0;
    this.lastTriggerAt = null;
    this.history = [];
    this.totalUses = 0;
    this.totalStorms = 0;
    this.startedAt = this.clock();
  }
  add({ emoteId, count = 1, user = 'you' }, now = this.clock()) {
    if (!this.emotes.some(e => e.id === emoteId)) throw new Error('Unknown emote.');
    if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Count must be 1–1000.');
    this.events.push({ id: ++this.sequence, emoteId, count, user: String(user).slice(0, 32), at: now });
    this.totalUses += count;
    return this.tick(now);
  }
  tick(now = this.clock()) {
    this.events = this.events.filter(e => e.at > now - 60_000);
    const eligible = this.events.filter(e => e.id > this.consumedThrough && e.at > now - this.config.windowSeconds * 1000);
    const count = eligible.reduce((sum, e) => sum + e.count, 0);
    const cooling = this.lastTriggerAt !== null && now - this.lastTriggerAt < this.config.cooldownSeconds * 1000;
    if (count < this.config.threshold || cooling || this.config.muted) return null;
    const mix = this.emotes.map(e => ({ emoteId: e.id, count: eligible.filter(x => x.emoteId === e.id).reduce((sum, x) => sum + x.count, 0) }))
      .filter(e => e.count > 0).sort((a, b) => b.count - a.count);
    const trigger = { id: ++this.totalStorms, at: now, count, mix };
    this.lastTriggerAt = now;
    this.consumedThrough = this.sequence;
    this.history.unshift(trigger);
    this.history = this.history.slice(0, 12);
    return trigger;
  }
  snapshot(now = this.clock()) {
    const recent = this.events.filter(e => e.at > now - this.config.windowSeconds * 1000);
    const eligible = recent.filter(e => e.id > this.consumedThrough);
    const rollingCount = recent.reduce((n, e) => n + e.count, 0);
    const chargeCount = eligible.reduce((n, e) => n + e.count, 0);
    const cooldownRemaining = this.lastTriggerAt === null ? 0 : Math.max(0, this.config.cooldownSeconds * 1000 - (now - this.lastTriggerAt));
    return {
      rollingCount, chargeCount, cooldownRemaining, totalUses: this.totalUses, totalStorms: this.totalStorms,
      startedAt: this.startedAt,
      mix: this.emotes.map(e => ({ emoteId: e.id, count: recent.filter(x => x.emoteId === e.id).reduce((n, x) => n + x.count, 0) })).sort((a,b) => b.count-a.count),
      messages: recent.slice(-35).reverse(),
      history: this.history,
    };
  }
}
