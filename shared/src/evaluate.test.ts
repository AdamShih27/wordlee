import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGuess, mergeKeyStates, isSolved, toEmojiGrid } from './evaluate';
import { ANSWERS, answersFor, answerForDay, isValidWord, dailyAnswer, dailyIndex, LENGTHS } from './words';

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
    assert.equal(answerForDay(3, n).length, n);
  }
  assert.ok(isValidWord('potato'));
  assert.ok(isValidWord('stomach', 7));
  assert.ok(!isValidWord('stomach', 5), 'length must match when given');
  assert.ok(!isValidWord('abcdefgh'), '8 letters is not supported');
});

test('5-letter daily puzzles keep their order', () => {
  assert.equal(answerForDay(3), 'exact');
  assert.equal(answerForDay(3, 5), 'exact');
});

test('daily answer changes per local day and is stable', () => {
  const d1 = new Date(2026, 10, 1, 9);
  const d1late = new Date(2026, 10, 1, 23, 59);
  const d2 = new Date(2026, 10, 2, 0, 1);
  assert.equal(dailyIndex(d1), 0);
  assert.equal(dailyAnswer(d1), dailyAnswer(d1late));
  assert.notEqual(dailyAnswer(d1), dailyAnswer(d2));
  assert.equal(dailyAnswer(new Date(2020, 0, 1)).length, 5); // 負數天數也不會壞
});
