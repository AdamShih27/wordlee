import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGuess, mergeKeyStates, isSolved, toEmojiGrid } from './evaluate';
import { ANSWERS, answersFor, isValidWord, LENGTHS, randomAnswer } from './words';

const short = (s: string[]) => s.map((x) => x[0]).join(''); // c/p/a

test('all correct', () => {
  assert.equal(short(evaluateGuess('crane', 'crane')), 'ccccc');
  assert.ok(isSolved(evaluateGuess('crane', 'crane')));
});

test('present and absent', () => {
  assert.equal(short(evaluateGuess('react', 'crane')), 'ppcpa');
});

test('duplicate letters in guess, single in answer', () => {
  // 答案只有一個 L,猜兩個 L：只有一個能亮
  assert.equal(short(evaluateGuess('lolly', 'world')), 'acaca');
  assert.equal(short(evaluateGuess('hello', 'world')), 'aaacp');
});

test('duplicate letters: correct takes priority over present', () => {
  assert.equal(short(evaluateGuess('bobby', 'abbey')), 'pacac');
});

test('case insensitive', () => {
  assert.equal(short(evaluateGuess('CRANE', 'crane')), 'ccccc');
});

test('key states keep the best state', () => {
  let k = mergeKeyStates({}, 'react', evaluateGuess('react', 'crane'));
  assert.equal(k.t, 'absent');
  assert.equal(k.r, 'present');
  k = mergeKeyStates(k, 'crane', evaluateGuess('crane', 'crane'));
  assert.equal(k.r, 'correct');
  k = mergeKeyStates(k, 'rrrrr', evaluateGuess('rrrrr', 'crane'));
  assert.equal(k.r, 'correct');
});

test('emoji grid', () => {
  assert.equal(toEmojiGrid([evaluateGuess('react', 'crane')]), '🟨🟨🟩🟨⬜');
});

test('word lists', () => {
  assert.ok(ANSWERS.length > 1000);
  assert.ok(ANSWERS.every((w) => /^[a-z]{5}$/.test(w)));
  assert.ok(ANSWERS.every((w) => isValidWord(w)));
  assert.ok(isValidWord('crane'));
  assert.ok(isValidWord('BOOKS'));
  assert.ok(!isValidWord('abcde'));
  assert.ok(!isValidWord('cran'));
});

test('6 and 7 letter word lists', () => {
  for (const n of LENGTHS) {
    const list = answersFor(n);
    assert.ok(list.length > 1000, `length ${n}`);
    assert.ok(list.every((w) => w.length === n && /^[a-z]+$/.test(w) && isValidWord(w, n)));
    assert.equal(randomAnswer(Math.random, n).length, n);
  }
  assert.ok(isValidWord('potato'));
  assert.ok(isValidWord('stomach', 7));
  assert.ok(!isValidWord('stomach', 5), 'length must match when given');
  assert.ok(!isValidWord('abcdefgh'), '8 letters is not supported');
});
