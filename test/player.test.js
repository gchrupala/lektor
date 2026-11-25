import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player, pickVoice } from '../js/player.js';

// A synthesizer the test drives: utterances end when the test says so.
function setup(units) {
  const synth = {
    spoken: [],
    current: null,
    speaking: false,
    pending: false,
    cancels: 0,
    speak(u) {
      this.current = u;
      this.speaking = true;
      this.spoken.push(u.text);
    },
    cancel() {
      this.cancels++;
      const u = this.current;
      this.current = null;
      this.speaking = false;
      u?.onerror?.({ error: 'interrupted' });
    },
    finish() {
      const u = this.current;
      this.current = null;
      this.speaking = false;
      u.onend();
    },
  };
  const timers = [];
  let clock = 0;
  const errors = [];
  const player = new Player({
    synth,
    makeUtterance: (text) => ({ text }),
    onError: (e) => errors.push(e),
    setTimer: (fn, ms) => timers.push({ fn, at: clock + ms }) && timers.length,
    clearTimer: (id) => id && (timers[id - 1].fn = null),
    now: () => clock,
  });
  const tick = (ms) => {
    clock += ms;
    for (const t of [...timers]) {
      if (t.fn && t.at <= clock) {
        const fn = t.fn;
        t.fn = null;
        fn();
      }
    }
  };
  player.load(units.map((text) => (typeof text === 'string' ? { text } : text)));
  return { synth, player, tick, errors };
}

test('reads one piece after another and stops at the end of a chosen section', () => {
  const { synth, player } = setup(['a', 'b', 'c', 'd']);
  player.play(1, { end: 3 });
  synth.finish();
  synth.finish();
  assert.deepEqual(synth.spoken, ['b', 'c']);
  assert.equal(player.state, 'stopped');
  assert.equal(player.index, 3); // ready to go on
});

test('pausing cancels; resuming says the piece again from its start', () => {
  const { synth, player } = setup(['a', 'b', 'c']);
  player.play(0);
  synth.finish();
  player.pause();
  assert.equal(player.state, 'paused');
  assert.equal(synth.current, null);
  player.resume();
  assert.deepEqual(synth.spoken, ['a', 'b', 'b']);
  synth.finish();
  synth.finish();
  assert.equal(player.state, 'stopped');
});

test('the reference list is passed over, unless reading starts in it', () => {
  const units = ['a', { text: 'ref 1', skip: 1 }, { text: 'ref 2', skip: 1 }, 'appendix'];
  let { synth, player } = setup(units);
  player.play(0);
  synth.finish();
  synth.finish();
  assert.deepEqual(synth.spoken, ['a', 'appendix']);
  ({ synth, player } = setup(units));
  player.play(1);
  synth.finish();
  synth.finish();
  synth.finish();
  assert.deepEqual(synth.spoken, ['ref 1', 'ref 2', 'appendix']);
});

test('a lost "end" event does not stop reading for good', () => {
  const { synth, player, tick } = setup(['a', 'b']);
  player.play(0);
  synth.speaking = false; // the voice finished, but no event came
  tick(1000);
  tick(1000);
  tick(1000);
  assert.deepEqual(synth.spoken, ['a']);
  tick(1000); // about four seconds of silence
  assert.deepEqual(synth.spoken, ['a', 'b']);
});

test('a speaking voice is not cut short by the watch', () => {
  const { synth, player, tick } = setup(['a', 'b']);
  player.play(0);
  for (let i = 0; i < 20; i++) tick(1000);
  assert.deepEqual(synth.spoken, ['a']);
});

test('a refusal to speak without a tap pauses and reports', () => {
  const { synth, player, errors } = setup(['a', 'b']);
  player.play(0);
  synth.current.onerror({ error: 'not-allowed' });
  assert.equal(player.state, 'paused');
  assert.deepEqual(errors, ['not-allowed']);
});

test('stepping and seeking keep playing; a section end is dropped outside it', () => {
  const { synth, player, tick } = setup(['a', 'b', 'c', 'd', 'e']);
  player.play(0, { end: 2 });
  player.step(3);
  tick(100);
  assert.equal(player.index, 3);
  assert.equal(player.end, null);
  assert.equal(synth.spoken.at(-1), 'd');
});

test('the best voice for a language', () => {
  const voices = [
    { name: 'Zosia', lang: 'pl-PL', voiceURI: 'zosia', localService: true },
    { name: 'Microsoft Marek Online (Natural)', lang: 'pl-PL', voiceURI: 'marek', localService: false },
    { name: 'Samantha', lang: 'en-US', voiceURI: 'sam', default: true },
    { name: 'Bad News', lang: 'en-US', voiceURI: 'bad' },
  ];
  assert.equal(pickVoice(voices, 'pl').voiceURI, 'marek');
  assert.equal(pickVoice(voices, 'pl', 'zosia').voiceURI, 'zosia');
  assert.equal(pickVoice(voices, 'en').voiceURI, 'sam');
  assert.equal(pickVoice(voices, 'nl'), null);
});
