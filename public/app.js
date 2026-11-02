import { SoundPlayer } from './audio.js';
import { DemoRecorder } from './recorder.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (paths, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const icons = {
  wave: svg('<path d="M3 10v4m4-9v14m5-17v20m5-16v12m4-8v4"/>'),
  studio: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  library: svg('<path d="M4 4v16m5-16v16m5-16v16m4-15 3 14"/>'),
  settings: svg('<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/>'),
  arrow: svg('<path d="M7 17 17 7M7 7h10v10"/>'),
  play: svg('<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>'),
  sound: svg('<path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'),
  mute: svg('<path d="M11 4 6 8H3v8h3l5 4zm5 5 5 6m0-6-5 6"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  spark: svg('<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  upload: svg('<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>'),
  reset: svg('<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>'),
  check: svg('<path d="m5 12 4 4L19 6"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/>'),
  link: svg('<path d="m9 15 6-6m-5-3 2-2a5 5 0 0 1 7 7l-2 2m-3 5-2 2a5 5 0 0 1-7-7l2-2"/>'),
};

function face(emote, size = '') {
  if (emote.image) return `<span class="emote-face ${size}" style="--emote:${emote.color}" title="${escape(emote.name)}"><img src="${escape(emote.image)}" alt="${escape(emote.name)}" loading="lazy"></span>`;
  const detail = {
    surprise: '<ellipse cx="22" cy="25" rx="2.5" ry="4"/><ellipse cx="42" cy="25" rx="2.5" ry="4"/><ellipse cx="32" cy="42" rx="6" ry="8"/><path d="m17 16 9-3m12 0 9 3" fill="none" stroke="currentColor" stroke-width="3"/>',
    smirk: '<path d="m17 25 9-3m12 0 9 3m-23 16q10 9 20-3" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="23" cy="28" r="2"/><circle cx="41" cy="28" r="2"/>',
    laugh: '<path d="m17 25 6-5 6 5m6 0 6-5 6 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19 35h26q-1 18-13 18T19 35Z"/><path d="M24 38h16" stroke="#fff" stroke-width="4"/>',
    cry: '<path d="m17 22 9 3m12 0 9-3m-23 21q8-7 16 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19 29q-8 10 0 11t0-11m26 0q-8 10 0 11t0-11" fill="#5095e6"/>',
    happy: '<path d="M18 27q5-9 10 0m8 0q5-9 10 0M23 38q9 13 18 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',
    sleep: '<path d="M17 28h10m10 0h10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><ellipse cx="32" cy="42" rx="4" ry="5"/><path d="M41 7h9l-9 9h9" fill="none" stroke="currentColor" stroke-width="2"/>',
  }[emote.face];
  return `<span class="emote-face ${size}" style="--emote:${emote.color}" title="${emote.name}"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="5" y="5" width="54" height="54" rx="18" fill="${emote.color}"/><g fill="currentColor">${detail}</g></svg></span>`;
}

const player = new SoundPlayer();
const recorder = new DemoRecorder(player, status => {
  const timer = $('#recording-time');
  if (timer) timer.textContent = status.downloaded ? 'Video downloaded. Ready for YouTube.' : `${Math.floor((status.elapsed||0)/60)}:${String((status.elapsed||0)%60).padStart(2,'0')} / 2:55`;
  if ($('#record-demo')) $('#record-demo').disabled = status.recording;
  if ($('#stop-recording')) $('#stop-recording').hidden = !status.recording;
  if(status.downloaded)toast('Demo saved to your downloads. Nothing was uploaded.');
});
let state, source, connected = false, monitor = false, lastSoundAt = 0, previewId = '', requestId = 0;
const overlay = location.pathname === '/overlay';
const settingsPage = location.pathname === '/settings';
const toast = (message, error = false) => {
  const box = $('#toast'); box.textContent = message; box.className = `visible${error ? ' error' : ''}`;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => box.className = '', 4000);
};
async function api(path, data = {}) {
  try {
    const response = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save your change.');
    state = result; update(); return result;
  } catch (error) { toast(error.message, true); throw error; }
}
const safeApi = (...args) => api(...args).catch(() => {});
const relative = timestamp => { const seconds = Math.max(0, Math.floor((state.serverNow - timestamp) / 1000)); return seconds < 2 ? 'just now' : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`; };

function layout() {
  document.title = `Emote Echo — ${settingsPage ? 'Sound library' : 'Live studio'}`;
  const active = settingsPage ? 'library' : 'studio';
  $('#app').innerHTML = `<aside class="sidebar">
    <a class="brand" href="/" aria-label="Emote Echo home"><span class="brand-mark">${icons.wave}</span><span>emote<span class="brand-second">echo<span class="brand-dot">.</span></span></span></a>
    <div class="nav-label">WORKSPACE</div>
    <nav aria-label="Main navigation">
      <a class="nav-item ${active === 'studio' ? 'active' : ''}" href="/">${icons.studio}Live studio${active === 'studio' ? '<span class="nav-indicator"></span>' : ''}</a>
      <a class="nav-item ${active === 'library' ? 'active' : ''}" href="/settings">${icons.library}Sound library</a>
      <a class="nav-item" href="/settings#trigger">${icons.settings}Stream settings</a>
      <a class="nav-item" href="/settings#twitch">${icons.link}Twitch connection</a>
    </nav>
    <div class="sidebar-bottom"><div class="local-card"><span class="tiny-orb"></span><strong>Your chat, in full color</strong><p>Real Twitch emotes.<br>A voice of their own.</p><span class="local-tag">EMOTE ECHO · v0.2</span></div><div class="connection"><span class="status-dot"></span><span id="connection-label">Connecting…</span></div></div>
  </aside>
  <div class="workspace"><header class="topbar"><div class="breadcrumb">Workspace <span>/</span> ${settingsPage ? 'Sound library' : 'Live studio'}</div><div class="topbar-right"><span class="test-badge" id="mode-badge"><span></span><b>TEST MODE</b></span><span class="separator"></span><span class="avatar">S</span></div></header>
  <main>${settingsPage ? settingsMarkup() : studioMarkup()}</main>
  <footer><span>A little chat. A lot of feeling.</span><span>Made for the moments you share. ${icons.spark}</span></footer></div>`;
  bind(); update();
}

function studioMarkup() {
  return `<section class="page-heading"><div><div class="eyebrow">CHAT HAS A SOUND NOW</div><h1>Make chat heard<span>.</span></h1><p>Turn a burst of emotes into a little sonic chaos.</p></div><div class="heading-actions"><button class="button secondary monitor-toggle">${icons.sound}<span>Enable sound</span></button><a class="button primary" href="/overlay" target="_blank" rel="noopener">Open overlay ${icons.arrow}</a></div></section>
  <section class="source-bar"><div><strong id="source-title">Test playground</strong><span id="source-description">Simulated chat. The same sound engine.</span></div><div class="source-actions"><label class="sr-only" for="input-mode">Chat source</label><select id="input-mode"><option value="test">Test mode</option><option value="twitch">Twitch live</option></select><a class="text-button" href="/settings#twitch" id="source-connect">Connect Twitch ${icons.arrow}</a></div></section>
  <div class="studio-grid"><section class="panel visual-panel"><div class="panel-heading"><div class="panel-title"><span class="live-dot"></span>LIVE PREVIEW<span class="small-tag">OVERLAY</span></div><span class="preview-status">Listening for emotes</span></div>
  <div class="sound-stage" id="sound-stage"><div class="stage-grid"></div><div class="orb-orbit orbit-one"></div><div class="orb-orbit orbit-two"></div><div class="sound-orb"><div class="orb-core"></div><div class="orb-grain"></div>${icons.wave}</div><span class="float-emote float-one">${face(state.emotes[0])}</span><span class="float-emote float-two">${face(state.emotes[1])}</span><span class="float-emote float-three">${face(state.emotes[3])}</span><span class="stage-caption" id="stage-caption">Good things are about to get loud.</span><div class="stage-badge">${icons.wave} YOUR CHAT, REIMAGINED</div><div class="audio-bars" aria-hidden="true">${Array.from({length:50},(_,i)=>`<i style="--bar:${Math.sin(i * 1.7)*.5+.5};--i:${i}"></i>`).join('')}</div></div>
  <div class="charge"><div class="charge-heading"><div><strong>Emote storm</strong><span id="charge-caption">Collecting fresh emotes</span></div><div class="charge-number"><strong id="charge-count">0</strong><span>/ <span class="threshold-label">100</span></span></div></div><div class="progress-track" role="progressbar" aria-label="Fresh emotes toward next soundscape" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="charge-progress"></div></div><div class="charge-footer"><span>${icons.clock}<span id="window-caption">Rolling 15-second window</span></span><span id="trigger-status">Ready when chat is.</span></div></div>
  </section><section class="panel chat-panel"><div class="panel-heading"><div class="panel-title">${icons.wave}<span id="chat-source-label">SIMULATED CHAT</span></div><span class="count-tag" id="chat-use-count">0 uses</span></div><div class="chat-feed" id="chat-feed"></div><div class="chat-foot"><span class="status-dot"></span><span id="chat-source-foot">Test messages only</span><span id="chat-live-label">Waiting for your cue</span></div></section>
  <section class="panel simulator-panel"><div class="section-heading"><div><h2>Bring the chat energy</h2><p>Send a few emotes, or let a whole crowd roll in.</p></div><span class="outline-tag">SIMULATOR</span></div>
  <div class="emote-pads">${state.emotes.slice(0,6).map(e=>`<div class="emote-pad"><button class="send-one" data-emote="${e.id}" aria-label="Send one ${e.name}">${face(e)}<span>${e.name}</span></button><button class="send-ten" data-emote="${e.id}" aria-label="Send ten ${e.name}">+10 ${icons.plus}</button></div>`).join('')}</div>
  <div class="simulation-controls"><label>Emotes<input id="sim-count" type="number" min="1" max="2000" value="120"></label><label>Over (seconds)<input id="sim-duration" type="number" min="1" max="120" value="12"></label><label class="mix-label">Crowd mood<select id="sim-mix"><option value="balanced">A little of everything</option><option value="hype">Hype train</option><option value="chaos">Pure chaos</option><option value="cozy">Cozy hours</option></select></label><button class="button primary" id="run-simulation">${icons.play}<span>Start a wave</span></button></div>
  <div class="sim-bottom"><span id="simulation-status"><span class="mini-dot"></span>120 emotes over 12 seconds will trigger your first storm.</span><button class="text-button" id="reset-session">${icons.reset}Reset session</button></div>
  </section><section class="panel history-panel"><div class="panel-heading"><div class="panel-title">RECENT SOUNDSCAPES</div>${icons.spark}</div><div id="history-list"></div><div class="session-stat-row"><div><strong id="total-uses">0</strong><span>emotes sent</span></div><div><strong id="total-storms">0</strong><span>storms played</span></div></div></section></div>
  <section class="how-banner"><span class="how-icon">${icons.spark}</span><div><strong>Every emote has a voice. Make it yours.</strong><p>Give hype a sparkle, mischief a chuckle, or upload something completely you.</p></div><a href="/settings">Explore your sound library ${icons.arrow}</a></section>
  <details class="demo-recorder"><summary>Record your hackathon demo</summary><p>Choose a browser window or screen. This records real footage with Emote Echo’s audio and downloads it locally. It stops automatically at 2 minutes 55 seconds. Keep this studio tab open while recording.</p><div><button class="button secondary" id="record-demo">Start recording</button><button class="button primary" id="stop-recording" hidden>Stop &amp; save</button><span id="recording-time">Ready · local recording only</span></div></details>`;
}

function settingsMarkup() {
  return `<section class="page-heading"><div><div class="eyebrow">YOUR CHANNEL. YOUR SOUNDS.</div><h1>A sound for every feeling<span>.</span></h1><p>Remix your emote palette. Changes save automatically.</p></div><span class="saved-label">${icons.check}Saved on this device</span></section>
  ${twitchMarkup()}
  <section class="library-section" id="library"><div class="section-header"><h2>Emote sound library <span class="number-badge" id="library-count">${state.emotes.length}</span></h2><span class="muted-text">New Twitch emotes appear here automatically</span></div><div class="sound-library" id="sound-library" data-catalog="${state.emotes.map(e=>e.id).join('|')}">${state.emotes.map(soundCard).join('')}</div><p class="library-note">${icons.sound}Clips up to 10 seconds and 5 MB. Soundscapes mix up to four voices and play at most 4 seconds. Test faces are original stand-ins; live emotes use Twitch artwork.</p></section>
  <section class="settings-grid" id="trigger"><div class="panel settings-panel"><div class="section-heading"><div><h2>Find your storm</h2><p>Choose how much chat energy it takes to make a sound.</p></div>${icons.settings}</div><form id="trigger-form"><div class="trigger-fields"><label>Emote threshold<input type="number" id="config-threshold" min="1" max="2000" required><small>Total fresh emote uses</small></label><label>Rolling window<input type="number" id="config-windowSeconds" min="1" max="60" required><small>Seconds · continuously moving</small></label><label>Cooldown<input type="number" id="config-cooldownSeconds" min="0" max="120" required><small>Seconds between soundscapes</small></label></div><div class="settings-form-footer"><span>Used emotes never trigger twice.</span><button class="button secondary" type="submit">Save trigger settings</button></div></form></div>
  <div class="panel output-panel"><div class="section-heading"><div><h2>Sound output</h2><p>A comfortable level for your stream.</p></div>${icons.sound}</div><label class="master-label" for="master-volume">Master volume <span id="master-volume-label">65%</span></label><input type="range" id="master-volume" min="0" max="100" value="65"><div class="output-actions"><button class="button secondary monitor-toggle">${icons.sound}<span>Enable sound</span></button><button class="button quiet" id="global-mute">${icons.mute}<span>Pause output</span></button></div><p class="helper">Monitor here to test. Disable studio monitoring when your OBS overlay is playing to avoid double audio.</p></div></section>
  <section class="panel overlay-setup" id="overlay-setup"><div class="section-heading"><div><h2>Your stream, with a little extra feeling</h2><p>Add this URL as an OBS Browser Source. Use 1920 × 1080 and enable “Control audio via OBS.”</p></div><a href="/overlay" target="_blank" rel="noopener" class="button secondary">Preview overlay ${icons.arrow}</a></div><div class="copy-field"><span>${icons.link}</span><input id="overlay-url" aria-label="Overlay URL" readonly value="${escape(location.origin)}/overlay"><button class="button primary" id="copy-overlay">${icons.copy}<span>Copy URL</span></button></div><p class="helper">Keep the local server running. In a regular browser, click Enable sound on the overlay once. OBS normally allows Browser Source audio automatically.</p></section>`;
}

function soundCard(e) {
  return `<article class="panel sound-card" style="--emote:${e.color}" data-card="${e.id}"><div class="sound-card-top">${face(e,'large')}<span class="mood-tag">${escape(e.mood)}</span><button class="preview-sound circle-button" data-emote="${e.id}" aria-label="Preview ${escape(e.name)} sound">${icons.play}</button></div><h3>${escape(e.name)}</h3><label class="field-label" for="sound-${e.id}">SOUND</label><select id="sound-${e.id}" class="sound-select" data-emote="${e.id}">${state.sounds.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}<option value="custom" hidden>Custom sound</option></select><p class="sound-description" id="description-${e.id}"></p><label class="volume-row" for="volume-${e.id}">${icons.sound}<input type="range" id="volume-${e.id}" class="emote-volume" data-emote="${e.id}" min="0" max="100" value="80" aria-label="${escape(e.name)} volume"><span id="volume-label-${e.id}">80%</span></label><div class="sound-card-bottom"><label class="upload-button">${icons.upload}<span>Upload a sound</span><input class="upload-input" data-emote="${e.id}" type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm" aria-label="Upload custom ${escape(e.name)} sound"></label><button class="text-button reset-sound" data-emote="${e.id}" title="Restore default sound">Reset</button></div></article>`;
}

function twitchMarkup() {
  return `<section class="panel twitch-panel" id="twitch"><div class="section-heading"><div><h2>Connect your Twitch chat</h2><p>Real emotes in. A soundscape out. Read access only.</p></div><span class="twitch-state" id="twitch-state">Not connected</span></div><p class="helper" id="twitch-detail">Authorize Emote Echo to read the chat on your own channel.</p><div class="twitch-fields"><label for="twitch-client-id">Twitch application Client ID<input id="twitch-client-id" type="text" autocomplete="off" placeholder="Your public Client ID" spellcheck="false"></label><button class="button primary" id="connect-twitch">Connect with Twitch ${icons.arrow}</button><button class="button secondary" id="disconnect-twitch" hidden>Disconnect</button></div><details class="twitch-instructions"><summary>First time connecting?</summary><ol><li>Register a Public app in the <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener">Twitch developer console</a>.</li><li>Use <code>${escape(location.origin)}/twitch/callback</code> as its OAuth redirect URL.</li><li>Paste its Client ID above and connect. No client secret is needed.</li></ol><p>Tokens stay in server memory. Restarting the server requires another sign-in. Channel emotes join your sound library when they first appear in chat.</p></details></section>`;
}

function overlayLayout() {
  document.body.classList.add('overlay-mode'); document.title = 'Emote Echo — Stream overlay';
  $('#app').innerHTML = `<button class="overlay-unlock button primary" id="overlay-unlock">${icons.sound}Enable sound</button><div class="overlay-reconnect" id="overlay-connection" hidden>Studio disconnected · reconnecting…</div><div class="broadcast-widget"><div class="broadcast-header"><span class="brand-mark">${icons.wave}</span><div><strong>Emote storm</strong><span id="overlay-status">Chat is charging up</span></div><strong class="broadcast-count"><span id="overlay-count">0</span><small>/ <span class="threshold-label">100</span></small></strong></div><div class="broadcast-progress"><div id="overlay-progress"></div></div><div class="broadcast-mix" id="overlay-mix"></div><div class="broadcast-waves" aria-hidden="true">${Array.from({length:35},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div></div>`;
  $('#overlay-unlock').onclick = enableMonitor;
  player.create();
  player.context.resume().then(() => { monitor = player.ready; update(); }).catch(() => {});
  update();
}

async function enableMonitor() {
  if (monitor) { monitor = false; player.stop(); update(); return; }
  try { monitor = await player.unlock(); update(); if (!overlay) toast('Studio sound is on. Start a wave to hear chat.'); }
  catch { toast('Your browser could not enable audio. Try opening this page in a regular browser.', true); }
}
async function previewSound(id) {
  const token = ++requestId; previewId = id; update();
  try { await player.preview(state.config.sounds[id], state.config.volume); if (token === requestId) toast(`Playing ${state.emotes.find(e=>e.id===id).name} sound`); }
  catch (error) { toast(error.message, true); }
  setTimeout(() => { if (token === requestId) { previewId = ''; update(); } }, 2300);
}

function bind() {
  document.querySelectorAll('a[href^="/settings"]').forEach(link => link.onclick = event => {
    if (recorder.recording) { event.preventDefault(); window.open(link.href,'emote-echo-settings'); toast('Settings opened in another tab so recording can continue.'); }
  });
  if ($('#record-demo')) {
    $('#record-demo').onclick = async () => { try { await recorder.start(); monitor=player.ready; update(); } catch(error) { toast(error.name==='NotAllowedError'?'Screen sharing was cancelled. You can start again when ready.':error.message,true); } };
    $('#stop-recording').onclick = () => recorder.stop();
  }
  if ($('#input-mode')) $('#input-mode').onchange = event => safeApi('mode', { mode: event.target.value });
  if ($('#twitch-client-id')) {
    $('#twitch-client-id').oninput = event => event.target.dataset.dirty = 'yes';
    $('#connect-twitch').onclick = async () => {
      const button = $('#connect-twitch'); button.disabled = true;
      try {
        const response = await fetch('/api/twitch/start', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({clientId:$('#twitch-client-id').value.trim()}) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        location.assign(data.authorizeUrl);
      } catch(error) { toast(error.message,true); button.disabled=false; }
    };
    $('#disconnect-twitch').onclick = () => safeApi('twitch/disconnect');
  }
  document.querySelectorAll('.monitor-toggle').forEach(button => button.onclick = enableMonitor);
  document.querySelectorAll('.send-one,.send-ten').forEach(button => button.onclick = () => safeApi('emotes', { emoteId: button.dataset.emote, count: button.classList.contains('send-ten') ? 10 : 1 }));
  const run = $('#run-simulation');
  if (run) run.onclick = () => {
    if (state.simulation.running) return safeApi('stop');
    const count = $('#sim-count'), duration = $('#sim-duration');
    if (!count.reportValidity() || !duration.reportValidity()) return;
    return safeApi('simulate', { count: Number(count.value), duration: Number(duration.value), mix: $('#sim-mix').value });
  };
  if ($('#reset-session')) $('#reset-session').onclick = () => { player.stop(); lastSoundAt = 0; safeApi('reset'); };
  document.querySelectorAll('.preview-sound').forEach(button => button.onclick = () => previewSound(button.dataset.emote));
  document.querySelectorAll('.sound-select').forEach(select => select.onchange = () => { if (select.value !== 'custom') safeApi('config', { sounds: { [select.dataset.emote]: { preset: select.value } } }); });
  document.querySelectorAll('.emote-volume').forEach(input => {
    input.oninput = () => $(`#volume-label-${input.dataset.emote}`).textContent = `${input.value}%`;
    input.onchange = () => safeApi('config', { sounds: { [input.dataset.emote]: { volume: Number(input.value) } } });
  });
  document.querySelectorAll('.reset-sound').forEach(button => button.onclick = () => safeApi('config', { sounds: { [button.dataset.emote]: { preset: state.emotes.find(e=>e.id===button.dataset.emote).sound, volume: 80 } } }));
  document.querySelectorAll('.upload-input').forEach(input => input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    const label = input.closest('label'); label.classList.add('uploading');
    try {
      await player.validate(file);
      const knownTypes = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', m4a: 'audio/mp4' };
      const response = await fetch(`/api/upload/${input.dataset.emote}?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': file.type || knownTypes[file.name.split('.').pop().toLowerCase()] || 'application/octet-stream' }, body: file });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      state = result; update(); toast(`Custom sound saved for ${state.emotes.find(e=>e.id===input.dataset.emote).name}`);
    } catch (error) { toast(error.message, true); }
    finally { label.classList.remove('uploading'); input.value = ''; }
  });
  if ($('#trigger-form')) $('#trigger-form').onsubmit = async event => {
    event.preventDefault();
    try {
      await api('config', Object.fromEntries(['threshold', 'windowSeconds', 'cooldownSeconds'].map(key=>[key,Number($('#config-'+key).value)])));
      for (const key of ['threshold', 'windowSeconds', 'cooldownSeconds']) delete $('#config-'+key).dataset.dirty;
      toast('Trigger settings saved.');
    } catch {}
  };
  if ($('#master-volume')) {
    $('#master-volume').oninput = event => { $('#master-volume-label').textContent = event.target.value+'%'; player.setVolume(Number(event.target.value)); };
    $('#master-volume').onchange = event => safeApi('config', { volume: Number(event.target.value) });
    $('#global-mute').onclick = () => safeApi('config', { muted: !state.config.muted });
  }
  if ($('#copy-overlay')) $('#copy-overlay').onclick = async () => {
    try { await navigator.clipboard.writeText(location.origin + '/overlay'); toast('Overlay URL copied. Add it as an OBS Browser Source.'); }
    catch { $('#overlay-url').select(); toast('Select and copy the overlay URL.'); }
  };
}

let chatSignature = '', historySignature = '';
function update() {
  if (!state) return;
  const { config } = state;
  const live = state.inputMode === 'twitch';
  const twitchConnected = state.twitch?.status === 'connected';
  const playing = lastSoundAt && Date.now() - lastSoundAt < 3600;
  const cooling = state.cooldownRemaining > 0;
  const percent = Math.min(100, state.chargeCount / config.threshold * 100);
  document.querySelectorAll('.threshold-label').forEach(e => e.textContent = config.threshold);
  player.setVolume(config.volume);
  if (config.muted) player.stop();
  if (overlay) {
    $('#overlay-unlock').hidden = monitor && player.ready;
    $('#overlay-connection').hidden = connected;
    $('#overlay-count').textContent = state.chargeCount;
    $('#overlay-progress').style.width = percent + '%';
    $('#overlay-status').textContent = config.muted ? 'Output paused' : playing ? 'Chat has entered the soundscape' : cooling ? `Next storm in ${Math.ceil(state.cooldownRemaining/1000)}s` : `${state.rollingCount} emotes in the last ${config.windowSeconds}s`;
    $('.broadcast-widget').classList.toggle('storming', Boolean(playing));
    $('#overlay-mix').innerHTML = state.mix.filter(e=>e.count).slice(0,4).map(e=>face(state.emotes.find(x=>x.id===e.emoteId), 'tiny')).join('') || '<span>Send emotes. Make some noise.</span>';
    return;
  }
  $('#connection-label').textContent = connected ? 'Local studio connected' : 'Reconnecting…';
  $('#mode-badge b').textContent = live ? 'TWITCH LIVE' : 'TEST MODE';
  $('#mode-badge').classList.toggle('live-mode',live);
  $('.connection').classList.toggle('disconnected', !connected);
  document.querySelectorAll('.monitor-toggle').forEach(button => {
    button.innerHTML = `${monitor && player.ready ? icons.sound : icons.mute}<span>${monitor && player.ready ? 'Sound enabled' : 'Enable sound'}</span>`;
    button.classList.toggle('monitor-active', monitor && player.ready);
  });
  if (!settingsPage) {
    $('#source-title').textContent = live ? `Twitch · ${state.twitch.channel || 'connecting'}` : 'Test playground';
    $('#source-description').textContent = live ? (state.twitch.error || `${state.twitch.messageCount} chat messages received · ${state.twitch.emoteUses} emote uses`) : 'Simulated chat. The same sound engine.';
    $('#input-mode').value = live ? 'twitch' : 'test';
    $('#input-mode option[value="twitch"]').disabled = !twitchConnected;
    $('#source-connect').textContent = twitchConnected ? 'Manage connection ↗' : 'Connect Twitch ↗';
    $('#chat-source-label').textContent = live ? 'TWITCH CHAT' : 'SIMULATED CHAT';
    $('#chat-source-foot').textContent = live ? `Channel: ${state.twitch.channel || 'connecting'}` : 'Test messages only';
    document.querySelectorAll('.send-one,.send-ten').forEach(button => button.disabled = live);
    $('#charge-count').textContent = state.chargeCount;
    $('#charge-progress').style.width = percent + '%';
    $('.progress-track').setAttribute('aria-valuemax', config.threshold);
    $('.progress-track').setAttribute('aria-valuenow', Math.min(config.threshold,state.chargeCount));
    $('#charge-caption').textContent = `${state.rollingCount} total uses in the last ${config.windowSeconds}s`;
    $('#window-caption').textContent = `Rolling ${config.windowSeconds}-second window`;
    $('#trigger-status').textContent = config.muted ? 'Output paused in settings' : cooling ? `${Math.ceil(state.cooldownRemaining / 1000)}s cooldown · collecting fresh uses` : state.chargeCount ? `${Math.max(0,config.threshold - state.chargeCount)} more to make a sound` : 'Ready when chat is.';
    $('.preview-status').textContent = config.muted ? 'Output paused' : playing ? 'Soundscape in the air' : 'Listening for emotes';
    $('#sound-stage').classList.toggle('playing', Boolean(playing));
    $('#stage-caption').textContent = playing ? 'That’s what your chat sounds like.' : state.chargeCount ? 'A little louder. A little closer.' : 'Good things are about to get loud.';
    $('#chat-use-count').textContent = `${state.rollingCount} uses`;
    const nextChat = `${live ? 'twitch' : 'test'}:${JSON.stringify(state.messages.map(m=>m.id))}`;
    if (nextChat !== chatSignature) {
      chatSignature = nextChat;
      $('#chat-feed').innerHTML = state.messages.length ? state.messages.map((m,i)=>`<div class="chat-line"><span class="chat-name" style="color:${state.emotes.find(e=>e.id===m.emoteId).color}">${escape(m.user)}</span><span class="chat-emotes">${Array.from({length:Math.min(m.count,5)},()=>face(state.emotes.find(e=>e.id===m.emoteId),'tiny')).join('')}${m.count>5?`<span class="more-count">+${m.count-5}</span>`:''}</span></div>`).join('') : `<div class="empty-chat"><div class="empty-icon">${icons.wave}</div><strong>${live ? 'Your Twitch chat is connected.' : 'Your crowd is on standby.'}</strong><p>${live ? 'Send an emote in your Twitch channel<br>to get the soundscape going.' : 'Send an emote below<br>to get the conversation going.'}</p><span>↓</span></div>`;
    }
    const nextHistory = JSON.stringify(state.history.map(h=>h.id)) + Math.floor(state.serverNow/5000);
    if (historySignature !== nextHistory) {
      historySignature = nextHistory;
      $('#history-list').innerHTML = state.history.length ? state.history.slice(0,3).map(h=>`<div class="history-item"><span class="history-icon" style="--emote:${state.emotes.find(e=>e.id===h.mix[0].emoteId).color}">${icons.wave}</span><div><strong>Storm ${String(h.id).padStart(2,'0')}</strong><span>${h.count} emotes · ${Math.min(4,h.mix.length)} voices</span></div><span class="history-time">${relative(h.at)}</span></div>`).join('') : `<div class="empty-history">${icons.spark}<strong>Your first storm is coming.</strong><p>Hit the threshold and<br>watch the soundscape land here.</p></div>`;
    }
    $('#total-uses').textContent = state.totalUses.toLocaleString(); $('#total-storms').textContent = state.totalStorms;
    const running = state.simulation.running;
    $('#run-simulation').innerHTML = `${running ? icons.stop : icons.play}<span>${running ? 'Stop wave' : 'Start a wave'}</span>`;
    $('#run-simulation').classList.toggle('running', running);
    $('#chat-live-label').textContent = live ? state.twitch.status : running ? 'Wave in progress' : 'Waiting for your cue';
    $('#run-simulation').disabled = live;
    $('#simulation-status').innerHTML = live ? '<span class="mini-dot busy"></span>Live input is active. Switch to Test mode to use the simulator.' : running ? `<span class="mini-dot busy"></span>Sending ${state.simulation.sent} / ${state.simulation.count} emotes over ${state.simulation.duration}s` : `<span class="mini-dot"></span>Fresh emotes charge the next storm. Used emotes aren’t counted twice.`;
    ['sim-count','sim-duration','sim-mix'].forEach(id=>$('#'+id).disabled=running||live);
  } else {
    const catalogue = state.emotes.map(e=>e.id).join('|');
    if ($('#sound-library').dataset.catalog !== catalogue) {
      $('#sound-library').innerHTML = state.emotes.map(soundCard).join('');
      $('#sound-library').dataset.catalog = catalogue;
      $('#library-count').textContent = state.emotes.length;
      bind();
    }
    $('#twitch-state').textContent = twitchConnected ? `Connected · ${state.twitch.login}` : state.twitch?.status === 'error' ? 'Connection needs attention' : state.twitch?.status === 'connecting' || state.twitch?.status === 'reconnecting' ? 'Connecting…' : 'Not connected';
    $('#twitch-state').classList.toggle('connected',twitchConnected);
    $('#twitch-detail').textContent = state.twitch?.error || (twitchConnected ? `Reading ${state.twitch.channel} · ${state.twitch.messageCount} messages · ${state.twitch.emoteUses} emote uses` : 'Authorize Emote Echo to read the chat on your own channel.');
    if (!$('#twitch-client-id').dataset.dirty) $('#twitch-client-id').value = config.twitchClientId || '';
    $('#disconnect-twitch').hidden = !twitchConnected && !['connecting','reconnecting'].includes(state.twitch?.status);
    state.emotes.forEach(e=>{
      const setting = config.sounds[e.id], select = $('#sound-'+e.id);
      const custom = select.querySelector('[value="custom"]'); custom.hidden = !setting.custom; custom.textContent = setting.custom ? `Custom · ${setting.custom.name}` : 'Custom sound';
      if (document.activeElement !== select) select.value = setting.custom ? 'custom' : setting.preset;
      $('#description-'+e.id).textContent = setting.custom ? setting.custom.name : state.sounds.find(s=>s.id===setting.preset).description;
      if (document.activeElement !== $('#volume-'+e.id)) { $('#volume-'+e.id).value = setting.volume; $('#volume-label-'+e.id).textContent = setting.volume+'%'; }
      const button = $(`.preview-sound[data-emote="${e.id}"]`); button.classList.toggle('previewing', previewId === e.id); button.innerHTML = previewId === e.id ? icons.wave : icons.play;
    });
    for (const key of ['threshold','windowSeconds','cooldownSeconds']) {
      const input = $('#config-'+key); if (!input.dataset.dirty && document.activeElement !== input) input.value = config[key];
      input.oninput = () => input.dataset.dirty = 'yes';
    }
    const volume = $('#master-volume'); if (document.activeElement !== volume) { volume.value=config.volume; $('#master-volume-label').textContent=config.volume+'%'; }
    $('#global-mute').innerHTML = `${config.muted ? icons.play : icons.mute}<span>${config.muted ? 'Resume output' : 'Pause output'}</span>`;
    $('#global-mute').classList.toggle('paused', config.muted);
  }
}

function drawBars() {
  const levels = player.levels();
  const bars = overlay ? document.querySelectorAll('.broadcast-waves i') : document.querySelectorAll('.audio-bars i');
  bars.forEach((bar,i)=>{
    const level = levels ? levels[Math.min(levels.length-1,Math.floor(i/bars.length*40))]/255 : 0;
    bar.style.height = `${3 + level * 34 + (state?.chargeCount || 0)/Math.max(1,state?.config.threshold || 100)*Math.sin(i*.8)**2*5}px`;
  });
  requestAnimationFrame(drawBars);
}

try {
  const response = await fetch('/api/state'); if (!response.ok) throw new Error('The local server is unavailable.');
  state = await response.json();
  if (overlay) overlayLayout(); else layout();
  source = new EventSource('/api/events');
  source.onopen = () => { connected = true; update(); };
  source.onerror = () => { connected = false; update(); };
  source.addEventListener('state', event => { state = JSON.parse(event.data); update(); });
  source.addEventListener('storm', event => {
    const trigger = JSON.parse(event.data); lastSoundAt = Date.now();
    if (monitor) player.storm(trigger,state.config).catch(error=>toast(error.message,true));
    else if (!overlay) toast('Soundscape triggered! Enable sound to hear the next one.');
    update();
  });
  source.addEventListener('reset', () => { lastSoundAt=0; player.stop(); });
  drawBars();
  window.addEventListener('pagehide', () => { recorder.stop(); source.close(); player.stop(); });
} catch (error) { $('#app').innerHTML = `<div class="fatal-error"><h1>Let’s get your studio running.</h1><p>${escape(error.message)}</p><button class="button primary" onclick="location.reload()">Try again</button></div>`; }
