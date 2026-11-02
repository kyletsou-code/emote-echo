import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEmotes, safeReconnectUrl, TwitchClient } from '../lib/twitch.mjs';

const fragment = (id, text) => ({ type:'emote', text, emote:{id} });
test('counts real emote fragments while ignoring plain-text emote names', () => {
  assert.deepEqual(extractEmotes({ message:{fragments:[
    {type:'text',text:'Kappa'},fragment('25','Kappa'),{type:'text',text:' '},fragment('25','Kappa'),fragment('88','PogChamp')
  ]}}),[{id:'25',name:'Kappa',count:2},{id:'88',name:'PogChamp',count:1}]);
});
test('handles repeated tokens, custom channel emotes, and malformed fragments', () => {
  const result = extractEmotes({message:{fragments:[fragment('emotesv2_abcd','customHype'),fragment('25',Array(100).fill('Kappa').join(' ')),fragment('../../bad','Bad'),{type:'emote',text:'Broken'}]}});
  assert.deepEqual(result,[{id:'emotesv2_abcd',name:'customHype',count:1},{id:'25',name:'Kappa',count:100}]);
  assert.deepEqual(extractEmotes({}),[]);
});
test('accepts only Twitch EventSub reconnect URLs', () => {
  assert.equal(safeReconnectUrl('wss://eventsub.wss.twitch.tv/ws?reconnect=abc'),'wss://eventsub.wss.twitch.tv/ws?reconnect=abc');
  for (const value of ['https://eventsub.wss.twitch.tv/ws','wss://evil.example/ws','wss://eventsub.wss.twitch.tv.evil.example/ws','not a URL']) assert.equal(safeReconnectUrl(value),null);
});

class FakeSocket extends EventTarget {
  static sockets = [];
  constructor(url) { super(); this.url=url; FakeSocket.sockets.push(this); }
  packet(packet) { this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(packet)})); }
  close() { this.dispatchEvent(new Event('close')); }
}
const wait = () => new Promise(resolve=>setImmediate(resolve));
test('subscribes with the authenticated user, deduplicates chat, and never publishes tokens', async () => {
  FakeSocket.sockets=[];
  const received=[], requests=[], states=[];
  const client = new TwitchClient({WebSocketImpl:FakeSocket,onChat:x=>received.push(x),onState:x=>states.push(x),fetchImpl:async(url, options)=>{
    requests.push({url,options});
    return url.includes('/validate') ? new Response(JSON.stringify({client_id:'client',user_id:'123',login:'testchannel',scopes:['user:read:chat'],expires_in:3600})) : new Response('{}',{status:202});
  }});
  try {
    await client.connect({clientId:'client',token:'private-test-token'});
    const socket=FakeSocket.sockets[0];
    socket.packet({metadata:{message_type:'session_welcome'},payload:{session:{id:'socket-id',keepalive_timeout_seconds:30}}});
    await wait(); await wait();
    assert.equal(client.snapshot().status,'connected');
    const subscription=JSON.parse(requests[1].options.body);
    assert.deepEqual(subscription.condition,{broadcaster_user_id:'123',user_id:'123'});
    const event={message_id:'message-1',broadcaster_user_id:'123',chatter_user_name:'Viewer',message:{fragments:[fragment('25','Kappa')]}};
    const packet={metadata:{message_type:'notification',subscription_type:'channel.chat.message',message_id:'delivery-1'},payload:{event}};
    socket.packet(packet); socket.packet(packet);
    assert.equal(received.length,1); assert.equal(client.snapshot().emoteUses,1);
    assert.equal(JSON.stringify(states).includes('private-test-token'),false);
    assert.equal(JSON.stringify(client.snapshot()).includes('private-test-token'),false);
  } finally { client.disconnect(); }
});
test('rejects a token without read-chat permission', async () => {
  const client=new TwitchClient({WebSocketImpl:FakeSocket,fetchImpl:async()=>new Response(JSON.stringify({client_id:'client',user_id:'123',scopes:[],expires_in:3600}))});
  await assert.rejects(()=>client.connect({clientId:'client',token:'invalid-scope-token'}),/permission to read chat/);
  assert.equal(client.snapshot().status,'error'); assert.equal(client.token,null);
});
