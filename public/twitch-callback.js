const fragment = new URLSearchParams(location.hash.slice(1));
const query = new URLSearchParams(location.search);
// Remove the token from browser history before doing any asynchronous work.
history.replaceState(null, '', '/twitch/callback');
const result = document.querySelector('#connection-result');
try {
  if (query.has('error')) throw new Error('Twitch authorization was cancelled. You can connect again from settings.');
  const token = fragment.get('access_token'), state = fragment.get('state');
  if (!token || !state) throw new Error('This authorization link is incomplete. Start again from the Twitch settings card.');
  const response = await fetch('/api/twitch/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, state }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not connect to Twitch.');
  result.textContent = 'Authorized. Returning to your studio…';
  location.replace('/');
} catch (error) { result.textContent = error.message; }
