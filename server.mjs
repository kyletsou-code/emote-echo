import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename, stat, unlink } from 'node:fs/promises';
import { dirname, resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { StormEngine, EMOTES, SOUNDS, DEFAULT_CONFIG } from './lib/engine.mjs';
import { TwitchClient, TWITCH_SCOPE } from './lib/twitch.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = process.env.EMOTE_DATA_DIR || join(ROOT, '.local');
const port = Number(process.env.PORT || 4317);
await mkdir(join(DATA, 'uploads'), { recursive: true });
let config = structuredClone(DEFAULT_CONFIG);
try {
  const saved = JSON.parse(await readFile(join(DATA, 'settings.json'), 'utf8'));
  config = { ...config, ...saved, sounds: { ...config.sounds, ...saved.sounds } };
} catch (error) { if (error.code !== 'ENOENT') console.warn('Saved settings could not be loaded; using defaults.'); }
const emotes = structuredClone(EMOTES);
function registerEmote(native) {
  const match = emotes.find(e => e.nativeId === native.id || e.name === native.name);
  if (match?.nativeId === native.id) return { emote: match, changed: false };
  const hash = [...native.name].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  const preset = /sad|cry|hands/i.test(native.name) ? 'mellow' : /sleep|zzz/i.test(native.name) ? 'dream' : /lul|laugh/i.test(native.name) ? 'giggle' : SOUNDS[hash % SOUNDS.length].id;
  const emote = match || { id: 'twitch_' + native.id, name: native.name, mood: 'Channel emote', color: EMOTES[hash % EMOTES.length].color, sound: preset, face: 'happy' };
  Object.assign(emote, { nativeId: native.id, image: `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(native.id)}/static/dark/2.0` });
  if (!match) emotes.push(emote);
  config.sounds[emote.id] ||= { preset: emote.sound, volume: 80, custom: null };
  return { emote, changed: true };
}
for (const saved of config.emoteCatalog || []) if (/^[a-zA-Z0-9_-]{1,120}$/.test(saved.id) && typeof saved.name === 'string') registerEmote(saved);
const engine = new StormEngine(config, Date.now, emotes);
let simulation = null;
let inputMode = 'test';
let pendingAuthorization = null;
let persistQueue = Promise.resolve();
const clients = new Set();
const twitch = new TwitchClient({
  onState: () => publish(),
  onChat: ({ emotes: incoming, user }) => {
    if (inputMode !== 'twitch') return;
    const mapped = incoming.map(native => ({ ...registerEmote(native), count: native.count }));
    if (mapped.some(x => x.changed)) { persist().catch(() => {}); publish(); }
    for (const item of mapped) {
      const trigger = engine.add({ emoteId: item.emote.id, count: Math.min(1000, item.count), user });
      if (trigger) { publish(); publish('storm', trigger); }
    }
    publish();
  },
});
const names = ['mintymoth', 'pixelpilot', 'noodle.exe', 'cosmicbean', 'mooncrumpet', 'bloombytes', 'tinyorbit', 'peachmode', 'mossycat', 'heyitsnova'];
const mixes = { balanced: [3, 2, 3, 1, 1, 1], hype: [8, 1, 3, 0, 1, 0], chaos: [2, 6, 5, 0, 1, 1], cozy: [0, 1, 0, 2, 4, 6] };
function snapshot() {
  return { serverNow: Date.now(), config, emotes, sounds: SOUNDS, inputMode, twitch: twitch.snapshot(), ...engine.snapshot(),
    simulation: simulation ? { running: true, sent: simulation.sent, count: simulation.count, duration: simulation.duration, startedAt: simulation.startedAt, mix: simulation.mix } : { running: false } };
}
function publish(event = 'state', data = snapshot()) {
  for (const client of clients) client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function advance() {
  const now = Date.now();
  if (simulation) {
    const target = Math.min(simulation.count, Math.floor((now - simulation.startedAt) / (simulation.duration * 1000) * simulation.count));
    while (simulation.sent < target) {
      const count = Math.min(1 + Math.floor(Math.random() * 3), target - simulation.sent);
      const weights = mixes[simulation.mix];
      let pick = Math.random() * weights.reduce((n, x) => n + x, 0), index = 0;
      while (index < weights.length - 1 && (pick -= weights[index]) >= 0) index++;
      const trigger = engine.add({ emoteId: EMOTES[index].id, count, user: names[Math.floor(Math.random() * names.length)] }, now);
      simulation.sent += count;
      if (trigger) publish('storm', trigger);
    }
    if (simulation.sent >= simulation.count) simulation = null;
  }
  const trigger = engine.tick(now);
  if (trigger) publish('storm', trigger);
  publish();
}
const ticker = setInterval(advance, 250);
function persist() {
  config.emoteCatalog = emotes.filter(e => e.nativeId).map(e => ({ id: e.nativeId, name: e.name }));
  const contents = JSON.stringify(config, null, 2);
  persistQueue = persistQueue.catch(() => {}).then(async () => {
    await writeFile(join(DATA, 'settings.tmp'), contents);
    await rename(join(DATA, 'settings.tmp'), join(DATA, 'settings.json'));
  });
  return persistQueue;
}
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function body(req, limit = 65536) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limit) { const e = new Error('File or request is too large.'); e.status = 413; throw e; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function bounded(value, min, max, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name} must be between ${min} and ${max}.`);
  return Math.round(n);
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.mp4': 'audio/mp4' };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (![ `localhost:${port}`, `127.0.0.1:${port}` ].includes(req.headers.host)) return json(res, { error: 'Use the local studio address printed by the server.' }, 403);
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, snapshot());
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'POST' || req.method === 'DELETE') {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(res, { error: 'This local studio accepts same-origin requests only.' }, 403);
      if (url.pathname.startsWith('/api/upload/')) {
        const id = url.pathname.split('/').pop();
        if (!emotes.some(e => e.id === id)) throw new Error('Unknown emote.');
        const old = config.sounds[id].custom;
        if (req.method === 'DELETE') {
          config.sounds[id].custom = null;
        } else {
          const contentType = (req.headers['content-type'] || '').split(';')[0];
          const extension = { 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/ogg': '.ogg', 'audio/webm': '.webm', 'audio/mp4': '.m4a', 'video/mp4': '.mp4', 'audio/x-m4a': '.m4a' }[contentType];
          if (!extension) throw new Error('Choose a WAV, MP3, OGG, WebM, or M4A audio clip.');
          const audio = await body(req, 5 * 1024 * 1024);
          if (!audio.length) throw new Error('The audio file is empty.');
          const file = randomUUID() + extension;
          await writeFile(join(DATA, 'uploads', file), audio);
          config.sounds[id].custom = { url: '/uploads/' + file, name: String(url.searchParams.get('name') || 'Custom sound').slice(0, 100) };
        }
        await persist();
        if (old) await unlink(join(DATA, 'uploads', old.url.split('/').pop())).catch(() => {});
        publish(); return json(res, snapshot());
      }
      if (req.method !== 'POST' || !String(req.headers['content-type']).startsWith('application/json')) return json(res, { error: 'Use an application/json request.' }, 415);
      let input;
      try { input = JSON.parse((await body(req)).toString() || '{}'); } catch (error) { if (error.status) throw error; throw new Error('Invalid JSON.'); }
      if (url.pathname === '/api/twitch/start') {
        const clientId = String(input.clientId || '').trim();
        if (!/^[a-zA-Z0-9]{10,100}$/.test(clientId)) throw new Error('Enter the Client ID from your Twitch developer application.');
        const state = randomUUID();
        pendingAuthorization = { state, clientId, at: Date.now() };
        config.twitchClientId = clientId; await persist();
        res.setHeader('Set-Cookie', `emote_oauth=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
        const authorize = new URL('https://id.twitch.tv/oauth2/authorize');
        authorize.search = new URLSearchParams({ client_id: clientId, redirect_uri: `http://localhost:${port}/twitch/callback`, response_type: 'token', scope: TWITCH_SCOPE, state }).toString();
        return json(res, { authorizeUrl: authorize.href });
      } else if (url.pathname === '/api/twitch/finish') {
        const cookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('emote_oauth='))?.slice('emote_oauth='.length);
        const pending = pendingAuthorization;
        if (!pending || Date.now() - pending.at > 600_000 || input.state !== pending.state || cookie !== pending.state) throw new Error('This connection request expired. Start again from Twitch settings.');
        pendingAuthorization = null;
        res.setHeader('Set-Cookie', 'emote_oauth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
        if (typeof input.token !== 'string' || input.token.length < 10 || input.token.length > 2048) throw new Error('Twitch returned an invalid access token.');
        simulation = null; engine.reset(); publish('reset', {});
        await twitch.connect({ clientId: pending.clientId, token: input.token });
        inputMode = 'twitch';
      } else if (url.pathname === '/api/twitch/disconnect') {
        twitch.disconnect(); inputMode = 'test'; simulation = null; engine.reset(); publish('reset', {});
      } else if (url.pathname === '/api/mode') {
        if (!['test', 'twitch'].includes(input.mode)) throw new Error('Choose Test mode or Twitch live.');
        if (input.mode === 'twitch' && twitch.snapshot().status !== 'connected') throw new Error('Connect Twitch in settings before switching to live chat.');
        inputMode = input.mode; simulation = null; engine.reset(); publish('reset', {});
      } else if (url.pathname === '/api/emotes') {
        if (inputMode !== 'test') throw new Error('Switch to Test mode to send simulated emotes.');
        const trigger = engine.add({ emoteId: input.emoteId, count: bounded(input.count ?? 1, 1, 1000, 'Count'), user: 'you' });
        if (trigger) publish('storm', trigger);
      } else if (url.pathname === '/api/simulate') {
        if (inputMode !== 'test') throw new Error('Switch to Test mode to run the simulator.');
        if (!mixes[input.mix ?? 'balanced']) throw new Error('Unknown emote mix.');
        simulation = { count: bounded(input.count ?? 120, 1, 2000, 'Emotes'), duration: bounded(input.duration ?? 12, 1, 120, 'Duration'), mix: input.mix ?? 'balanced', sent: 0, startedAt: Date.now() };
      } else if (url.pathname === '/api/stop') simulation = null;
      else if (url.pathname === '/api/reset') { simulation = null; engine.reset(); publish('reset', {}); }
      else if (url.pathname === '/api/config') {
        const next = structuredClone(config);
        for (const [key, min, max, label] of [['threshold', 1, 2000, 'Threshold'], ['windowSeconds', 1, 60, 'Window'], ['cooldownSeconds', 0, 120, 'Cooldown'], ['volume', 0, 100, 'Volume']]) {
          if (input[key] !== undefined) next[key] = bounded(input[key], min, max, label);
        }
        if (input.muted !== undefined) { if (typeof input.muted !== 'boolean') throw new Error('Muted must be true or false.'); next.muted = input.muted; }
        if (input.sounds) for (const [id, value] of Object.entries(input.sounds)) {
          if (!next.sounds[id]) throw new Error('Unknown emote.');
          if (value.preset !== undefined) { if (!SOUNDS.some(s => s.id === value.preset)) throw new Error('Unknown sound.'); next.sounds[id].preset = value.preset; next.sounds[id].custom = null; }
          if (value.volume !== undefined) next.sounds[id].volume = bounded(value.volume, 0, 100, 'Emote volume');
        }
        const obsolete = emotes.map(e => config.sounds[e.id].custom).filter(old => old && !Object.values(next.sounds).some(s => s.custom?.url === old.url));
        config = next; engine.config = config; await persist();
        for (const old of obsolete) await unlink(join(DATA, 'uploads', old.url.split('/').pop())).catch(() => {});
      } else return json(res, { error: 'Unknown action.' }, 404);
      publish(); return json(res, snapshot());
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, { error: 'Method not allowed.' }, 405);
    let path = decodeURIComponent(url.pathname);
    if (['/', '/settings', '/overlay'].includes(path)) path = '/index.html';
    if (path === '/twitch/callback') path = '/twitch-callback.html';
    const isUpload = path.startsWith('/uploads/');
    const base = isUpload ? join(DATA, 'uploads') : join(ROOT, 'public');
    const file = resolve(base, '.' + (isUpload ? path.slice('/uploads'.length) : path));
    if (!file.startsWith(base + '/')) return json(res, { error: 'Not found.' }, 404);
    try {
      const info = await stat(file);
      if (!info.isFile()) throw new Error();
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': isUpload ? 'private, max-age=86400' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch { json(res, { error: 'Not found.' }, 404); }
  } catch (error) { if (!res.headersSent) json(res, { error: error.message || 'Something went wrong.' }, error.status || 400); else res.end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`Emote Echo\nLocal: http://localhost:${port}\nOverlay: http://localhost:${port}/overlay\nPress Ctrl+C to stop.`));
server.on('error', error => { console.error(error.message); clearInterval(ticker); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(ticker); twitch.disconnect(); for (const client of clients) client.end(); server.close(); });
