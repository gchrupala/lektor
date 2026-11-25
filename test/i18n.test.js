import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, chooseLanguage, decimal, languageName, setLanguage, t } from '../js/i18n.js';

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('both languages have every text, with the same placeholders', () => {
  const [pl, en] = [MESSAGES.pl, MESSAGES.en];
  assert.deepEqual(Object.keys(pl).sort(), Object.keys(en).sort());
  for (const key of Object.keys(pl)) assert.deepEqual(placeholders(pl[key]), placeholders(en[key]), key);
});

test('the language follows the choice, then the browser', () => {
  assert.equal(chooseLanguage('en', 'pl-PL'), 'en');
  assert.equal(chooseLanguage('', 'pl-PL'), 'pl');
  assert.equal(chooseLanguage('', 'pl'), 'pl');
  assert.equal(chooseLanguage('', 'nl-NL'), 'en');
  assert.equal(chooseLanguage('fr', 'en-GB'), 'en');
});

test('texts, numbers and language names in the chosen language', () => {
  setLanguage('pl');
  assert.equal(t('readingPage', { n: 3, total: 10 }), 'Czytam PDF: strona 3 z 10…');
  assert.equal(decimal(1.25), '1,25');
  assert.equal(languageName('en'), 'angielski');
  setLanguage('en');
  assert.equal(t('reading', { title: '3 Methods' }), 'Reading: 3 Methods');
  assert.equal(decimal(1.25), '1.25');
  assert.equal(languageName('pl'), 'Polish');
  assert.equal(t('no such key'), 'no such key');
});
