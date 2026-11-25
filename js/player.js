// Reads the planned pieces (speech.plan) aloud one at a time through the
// Web Speech API. The synthesizer is passed in, so tests use a fake one.
//
// Pausing cancels the current piece and resuming says it again from its
// start: speechSynthesis.pause() does nothing on Android and stops for good
// after a while in Chrome, so it is not used.

const WATCH_INTERVAL = 1000;
const SILENT_CHECKS = 3; // seconds of silence after which a lost "end" event is assumed

export class Player {
  /**
   * @param {object} o
   * @param {{ speak, cancel, speaking, pending }} o.synth window.speechSynthesis or a fake
   * @param {(text: string) => object} o.makeUtterance text -> SpeechSynthesisUtterance
   * @param {(player: Player) => void} [o.onChange] called on every change of state or piece
   * @param {(error: string) => void} [o.onError]
   */
  constructor({
    synth,
    makeUtterance,
    onChange = () => {},
    onError = () => {},
    // Wrapped: browsers refuse setTimeout called as a method of another object.
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (t) => clearTimeout(t),
    now = () => Date.now(),
  }) {
    Object.assign(this, { synth, makeUtterance, onChange, onError, setTimer, clearTimer, now });
    this.units = [];
    this.index = 0;
    this.end = null; // stop before this piece (end of a chosen section)
    this.state = 'stopped'; // 'stopped' | 'playing' | 'paused'
    this.voice = null;
    this.lang = 'en';
    this.rate = 1;
    this.token = 0;
    this.utterance = null; // kept so Chrome does not collect it before "end"
    this.timer = 0;
  }

  load(units, index = 0) {
    this.halt();
    this.units = units;
    this.index = Math.max(0, Math.min(index, units.length - 1));
    this.end = null;
    this.state = 'stopped';
    this.onChange(this);
  }

  /** Starts at piece `index`; with `end`, stops before piece `end`. */
  play(index = this.index, { end = null } = {}) {
    if (!this.units.length) return;
    this.index = Math.max(0, Math.min(index, this.units.length - 1));
    this.end = end;
    this.state = 'playing';
    this.restart();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.halt();
    this.state = 'paused';
    this.onChange(this);
  }

  resume() {
    if (!this.units.length) return;
    this.state = 'playing';
    this.restart();
  }

  toggle() {
    if (this.state === 'playing') this.pause();
    else this.resume();
  }

  stop() {
    this.halt();
    this.state = 'stopped';
    this.end = null;
    this.onChange(this);
  }

  /** Moves by `delta` pieces; keeps playing if it was. */
  step(delta) {
    const i = Math.max(0, Math.min(this.index + delta, this.units.length - 1));
    this.seek(i);
  }

  /** Goes to piece i, keeping the state; a chosen section's end is kept only inside it. */
  seek(i) {
    if (!this.units.length) return;
    this.index = Math.max(0, Math.min(i, this.units.length - 1));
    if (this.end != null && this.index >= this.end) this.end = null;
    if (this.state === 'playing') this.restart();
    else this.onChange(this);
  }

  setRate(rate) {
    this.rate = rate;
    if (this.state === 'playing') this.restart();
  }

  setVoice(voice, lang) {
    this.voice = voice;
    if (lang) this.lang = lang;
    if (this.state === 'playing') this.restart();
  }

  // ---------- internals ----------

  halt() {
    this.token++;
    this.clearTimer(this.timer);
    this.utterance = null;
    try {
      this.synth.cancel();
    } catch {
      // Nothing was speaking.
    }
  }

  restart() {
    const busy = this.synth.speaking || this.synth.pending;
    this.halt();
    const token = this.token;
    this.onChange(this);
    // Chrome may drop an utterance spoken right after cancel().
    if (busy) this.timer = this.setTimer(() => token === this.token && this.speak(), 80);
    else this.speak();
  }

  speak() {
    const unit = this.units[this.index];
    if (!unit) return this.finish();
    const token = ++this.token;
    const u = this.makeUtterance(unit.text);
    u.lang = this.voice?.lang || this.lang;
    if (this.voice) u.voice = this.voice;
    u.rate = this.rate;
    u.onend = () => {
      if (token === this.token) this.advance();
    };
    u.onerror = (e) => {
      if (token !== this.token) return;
      const error = e?.error || 'error';
      if (error === 'interrupted' || error === 'canceled') return;
      if (error === 'not-allowed') {
        // The browser wants a tap first (iOS, Chrome's autoplay rules).
        this.halt();
        this.state = 'paused';
        this.onError(error);
        this.onChange(this);
        return;
      }
      this.onError(error);
      this.advance();
    };
    this.utterance = u;
    this.synth.speak(u);
    this.watch(token, this.now(), 0);
  }

  // A missed "end" event (Android, a locked screen) would stop reading for
  // good: after a few seconds of silence, go on.
  watch(token, since, silent) {
    this.clearTimer(this.timer);
    this.timer = this.setTimer(() => {
      if (token !== this.token || this.state !== 'playing') return;
      const quiet = !this.synth.speaking && !this.synth.pending && this.now() - since > 1500;
      if (quiet && silent + 1 >= SILENT_CHECKS) this.advance();
      else this.watch(token, since, quiet ? silent + 1 : 0);
    }, WATCH_INTERVAL);
  }

  advance() {
    const next = this.nextIndex(this.index);
    if (next == null || (this.end != null && next >= this.end)) return this.finish(next);
    this.index = next;
    this.speak();
    this.onChange(this);
  }

  /** The next piece to read; skipped pieces (references) are passed over unless reading is already inside them. */
  nextIndex(i) {
    const inside = this.units[i]?.skip;
    for (let j = i + 1; j < this.units.length; j++) {
      if (this.end != null && j >= this.end) return j;
      if (!this.units[j].skip || inside) return j;
    }
    return null;
  }

  finish(next = null) {
    this.halt();
    this.state = 'stopped';
    // Ready to go on from where it stopped.
    if (next != null && next < this.units.length) this.index = next;
    this.end = null;
    this.onChange(this);
  }
}

/**
 * The voice to use for a language: the one asked for by name, else a good
 * one for the language ("Natural", "Neural", "Premium" voices first).
 */
export function pickVoice(voices, lang, preferred = '') {
  if (preferred) {
    const v = voices.find((x) => x.voiceURI === preferred || x.name === preferred);
    if (v) return v;
  }
  const base = (lang || 'en').toLowerCase().slice(0, 2);
  const fit = voices.filter((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith(base));
  if (!fit.length) return null;
  const score = (v) =>
    (/natural|neural|premium|enhanced|wavenet|online/i.test(v.name) ? 4 : 0) +
    (/google|microsoft|siri/i.test(v.name) ? 1 : 0) +
    (v.default ? 1 : 0) +
    (v.localService === false ? 0.5 : 0) -
    (/compact|eloquence|novelty|bad news|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|organ|albert|jester|superstar|wobble/i.test(v.name) ? 5 : 0);
  return [...fit].sort((a, b) => score(b) - score(a))[0];
}
