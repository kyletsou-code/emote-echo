import test from 'node:test';
import assert from 'node:assert/strict';
import { StormEngine, DEFAULT_CONFIG } from '../lib/engine.mjs';

function setup(overrides = {}) {
  let now = 0;
  const engine = new StormEngine({ ...structuredClone(DEFAULT_CONFIG), ...overrides }, () => now);
  return { engine, setTime(value) { now=value; } };
}
test('100 occurrences trigger a single soundscape containing the actual emote mix', () => {
  const { engine } = setup();
  assert.equal(engine.add({ emoteId:'pog', count:60 }), null);
  const trigger = engine.add({ emoteId:'cry', count:40 });
  assert.equal(trigger.count, 100);
  assert.deepEqual(trigger.mix, [{emoteId:'pog',count:60},{emoteId:'cry',count:40}]);
  assert.equal(engine.snapshot().rollingCount,100);
  assert.equal(engine.snapshot().chargeCount,0);
});
test('expired uses do not contribute and the exact window boundary expires', () => {
  const { engine, setTime } = setup();
  engine.add({ emoteId:'pog', count:99 });
  setTime(15_000);
  assert.equal(engine.add({ emoteId:'lul' }),null);
  assert.equal(engine.snapshot().rollingCount,1);
  setTime(15_001);
  assert.equal(engine.add({emoteId:'kappa',count:99}).count,100);
});
test('spent emotes cannot retrigger after the cooldown', () => {
  const { engine, setTime } = setup();
  engine.add({emoteId:'pog',count:100});
  setTime(8000); assert.equal(engine.tick(),null);
  assert.equal(engine.add({emoteId:'lul',count:99}),null);
  assert.equal(engine.add({emoteId:'lul',count:1}).id,2);
});
test('fresh uses collected during cooldown trigger once cooldown ends', () => {
  const { engine, setTime } = setup();
  engine.add({emoteId:'pog',count:100});
  setTime(2000); assert.equal(engine.add({emoteId:'cry',count:100}),null);
  setTime(7999); assert.equal(engine.tick(),null);
  setTime(8000); assert.equal(engine.tick().id,2);
  assert.equal(engine.tick(),null);
});
test('uses that expire during a long cooldown cannot produce a delayed storm', () => {
  const { engine, setTime } = setup({cooldownSeconds:30});
  engine.add({emoteId:'pog',count:100});
  setTime(1000); engine.add({emoteId:'lul',count:100});
  setTime(30000); assert.equal(engine.tick(),null);
  assert.equal(engine.snapshot().chargeCount,0);
});
test('pause prevents storms without spending emotes; reset clears the session', () => {
  const { engine } = setup({muted:true});
  assert.equal(engine.add({emoteId:'sleep',count:100}),null);
  assert.equal(engine.snapshot().chargeCount,100);
  engine.config.muted=false;
  assert.equal(engine.tick().id,1);
  engine.reset();
  assert.equal(engine.snapshot().totalUses,0);
  assert.equal(engine.snapshot().totalStorms,0);
  assert.equal(engine.snapshot().history.length,0);
});
test('invalid emotes and invalid occurrence counts are rejected', () => {
  const { engine } = setup();
  assert.throws(()=>engine.add({emoteId:'unknown'}));
  for (const count of [0, -1, 1.5, 1001, NaN]) assert.throws(()=>engine.add({emoteId:'pog',count}));
});
