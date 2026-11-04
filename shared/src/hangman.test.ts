import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsWord, guessLetter, hangmanView, HANGMAN_LIVES, maskWord } from './hangman';

test('reveals every position of a guessed letter', () => {
  const g = guessLetter('banana', [], 'a');
  assert.deepEqual(hangmanView('banana', g).slots, [null, 'a', null, 'a', null, 'a']);
});

test('wins when all letters are found', () => {
  let g: readonly string[] = [];
  for (const ch of 'crane') g = guessLetter('crane', g, ch);
  const v = hangmanView('crane', g);
  assert.equal(v.status, 'won');
  assert.equal(v.livesLeft, HANGMAN_LIVES);
});

test('loses after 6 wrong letters and ignores further guesses', () => {
  let g: readonly string[] = [];
  for (const ch of 'xyzqvw') g = guessLetter('crane', g, ch);
  const v = hangmanView('crane', g);
  assert.equal(v.status, 'lost');
  assert.deepEqual(v.wrong, ['x', 'y', 'z', 'q', 'v', 'w']);
  assert.equal(guessLetter('crane', g, 'c'), g);
});

test('repeated and invalid guesses do not cost a life', () => {
  let g = guessLetter('crane', [], 'x');
  g = guessLetter('crane', g, 'X');
  g = guessLetter('crane', g, '1');
  assert.equal(hangmanView('crane', g).livesLeft, HANGMAN_LIVES - 1);
});

test('maskWord blanks the word and its forms in hints', () => {
  assert.equal(maskWord('My stomach hurts.', 'stomach'), 'My _____ hurts.');
  assert.equal(maskWord('Stomach ache', 'stomach'), '_____ ache');
  assert.equal(maskWord('He craned his neck; cranes fly.', 'crane', ['craned', 'cranes']), 'He _____ his neck; _____ fly.');
  assert.equal(maskWord('form by carving', 'carve', ['carved', 'carving', 'carves']), 'form by _____');
  // 不會挖到剛好包含答案字母的其他字
  assert.equal(maskWord('I scared the cat.', 'care'), 'I scared the cat.');
  assert.ok(containsWord('A paper crane.', 'crane'));
  assert.ok(!containsWord('A paper boat.', 'crane'));
});
