import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessLetter, hangmanView, HANGMAN_LIVES } from './hangman';

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
