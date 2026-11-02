// A local, read-only EventSub client. Access tokens stay in process memory.
export const TWITCH_SCOPE = 'user:read:chat';
const SOCKET_URL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30';

export function extractEmotes(event) {
  const result = new Map();
  for (const fragment of event?.message?.fragments || []) {
    if (fragment.type !== 'emote' || !fragment.emote?.id) continue;
    const id = String(fragment.emote.id);
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) continue;
    const text = String(fragment.text || 'Emote').trim();
    // EventSub normally sends one fragment per occurrence. Also handle a
    // fragment containing adjacent repetitions of the same emote token.
    const tokens = text.split(/\s+/);
    const repeated = tokens.length > 1 && tokens.every(token => token === tokens[0]);
    const count = repeated ? tokens.length : 1;
    const existing = result.get(id);
    if (existing) existing.count += count;
    else result.set(id, { id, name: (repeated ? tokens[0] : text).slice(0, 100), count });
  }
  return [...result.values()];
}

export function safeReconnectUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'wss:' && url.hostname === 'eventsub.wss.twitch.tv' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export class TwitchClient {
  constructor({ onChat, onState = () => {}, fetchImpl = fetch, WebSocketImpl = WebSocket } = {}) {
    this.onChat = onChat;
    this.onState = onState;
    this.fetch = fetchImpl;
    this.WebSocket = WebSocketImpl;
    this.generation = 0;
    this.seen = new Map();
    this.public = { status: 'disconnected', login: '', channel: '', messageCount: 0, emoteUses: 0, error: '', lastMessageAt: null };
  }
  snapshot() { return { ...this.public }; }
  change(patch) { Object.assign(this.public, patch); this.onState(this.snapshot()); }
  async validate() {
    const response = await this.fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${this.token}` }, signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error('Twitch authorization expired or was removed. Connect with Twitch again.');
    const details = await response.json();
    if (details.client_id !== this.clientId || !details.scopes?.includes(TWITCH_SCOPE)) throw new Error('Authorize this application with permission to read chat.');
    this.expiresAt = Date.now() + details.expires_in * 1000;
    return details;
  }
  async connect({ clientId, token }) {
    this.disconnect();
    this.clientId = clientId; this.token = token;
    const generation = this.generation;
    this.change({ status: 'connecting', error: '', messageCount: 0, emoteUses: 0 });
    try {
      const details = await this.validate();
      if (generation !== this.generation) return;
      this.userId = details.user_id;
      this.change({ login: details.login, channel: details.login });
      this.attempt = 0;
      this.openSocket(SOCKET_URL, false, generation);
      this.validationTimer = setInterval(() => this.validate().catch(error => this.fail(error.message)), 3_600_000);
      this.validationTimer.unref?.();
    } catch (error) { this.fail(error.message); throw error; }
  }
  openSocket(url, handoff, generation = this.generation) {
    if (generation !== this.generation || !this.token) return;
    const socket = new this.WebSocket(url);
    if (handoff) this.pending = socket; else this.socket = socket;
    let welcomed = false, lastSeen = Date.now(), keepalive = 30_000;
    const watchdog = setInterval(() => {
      if (Date.now() - lastSeen > (welcomed ? keepalive + 5000 : 15_000)) socket.close();
      if (this.expiresAt && Date.now() >= this.expiresAt) this.fail('Your Twitch session expired. Connect with Twitch again.');
    }, 2000);
    watchdog.unref?.();
    socket.addEventListener('message', async message => {
      if (generation !== this.generation) return;
      let packet;
      try { packet = JSON.parse(String(message.data)); } catch { return; }
      lastSeen = Date.now();
      const type = packet.metadata?.message_type;
      if (type === 'session_welcome') {
        welcomed = true;
        keepalive = (packet.payload.session.keepalive_timeout_seconds || 30) * 1000;
        if (handoff) {
          const old = this.socket;
          this.socket = socket; this.pending = null;
          this.change({ status: 'connected', error: '' });
          old?.close();
          return;
        }
        try {
          const response = await this.fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST', headers: { 'Client-Id': this.clientId, Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'channel.chat.message', version: '1', condition: { broadcaster_user_id: this.userId, user_id: this.userId }, transport: { method: 'websocket', session_id: packet.payload.session.id } }),
            signal: AbortSignal.timeout(9000),
          });
          if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Twitch denied chat access. Connect again and allow permission to read chat.' : 'Twitch could not start the chat subscription. Try connecting again.');
          if (generation !== this.generation || this.socket !== socket) return;
          this.attempt = 0;
          this.change({ status: 'connected', error: '' });
        } catch (error) { if (generation === this.generation) this.fail(error.message); }
      } else if (type === 'notification' && packet.metadata.subscription_type === 'channel.chat.message') {
        const event = packet.payload?.event;
        if (!event || event.broadcaster_user_id !== this.userId) return;
        const id = event.message_id || packet.metadata.message_id;
        if (!id || this.seen.has(id)) return;
        this.seen.set(id, Date.now());
        if (this.seen.size > 5000) for (const [key, at] of this.seen) {
          if (at < Date.now() - 600_000 || this.seen.size > 5000) this.seen.delete(key); else break;
        }
        const emotes = extractEmotes(event);
        this.change({ messageCount: this.public.messageCount + 1, emoteUses: this.public.emoteUses + emotes.reduce((sum, e) => sum + e.count, 0), lastMessageAt: Date.now() });
        if (emotes.length) this.onChat?.({ emotes, user: event.chatter_user_name || event.chatter_user_login || 'viewer' });
      } else if (type === 'session_reconnect') {
        const reconnect = safeReconnectUrl(packet.payload?.session?.reconnect_url);
        if (reconnect && !this.pending) { this.change({ status: 'reconnecting' }); this.openSocket(reconnect, true, generation); }
        else if (!reconnect) this.fail('Twitch sent an invalid reconnect address. Connect again.');
      } else if (type === 'revocation') this.fail('Twitch removed this chat subscription. Connect with Twitch again.');
    });
    socket.addEventListener('error', () => socket.close());
    socket.addEventListener('close', () => {
      clearInterval(watchdog);
      if (generation !== this.generation || !this.token) return;
      if (socket === this.pending) { this.pending = null; this.change({ status: 'connected' }); return; }
      if (socket !== this.socket) return;
      this.socket = null;
      this.change({ status: 'reconnecting', error: 'Connection interrupted. Retrying automatically…' });
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(5, this.attempt++));
      this.retryTimer = setTimeout(() => this.openSocket(SOCKET_URL, false, generation), delay);
      this.retryTimer.unref?.();
    });
  }
  fail(message) { this.disconnect(); this.change({ status: 'error', error: String(message).slice(0, 180) }); }
  disconnect() {
    this.generation++;
    clearTimeout(this.retryTimer); clearInterval(this.validationTimer);
    this.socket?.close(); this.pending?.close();
    this.socket = null; this.pending = null; this.token = null; this.clientId = null;
    this.seen.clear();
    this.change({ status: 'disconnected', error: '', login: '', channel: '' });
  }
}
