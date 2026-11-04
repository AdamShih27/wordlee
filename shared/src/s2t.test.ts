import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toTraditional } from './s2t';
import { evaluateGuess, hardModeError } from './evaluate';

test('simplified to traditional', () => {
  assert.equal(toTraditional('教我怎么折纸鹤吧。我忘记怎么折了。'), '教我怎麼摺紙鶴吧。我忘記怎麼折了。');
  assert.equal(toTraditional('他伸长了脖子，希望能听到她们低声说的话。'), '他伸長了脖子，希望能聽到她們低聲說的話。');
  assert.equal(toTraditional('头发很干净'), '頭髮很乾淨');
  assert.equal(toTraditional('already 繁體 stays'), 'already 繁體 stays');
});

test('hard mode', () => {
  const rows = [{ word: 'react', states: evaluateGuess('react', 'crane') }]; // r e 黃， a 綠， c 黃
  assert.equal(hardModeError('crane', rows), null);
  assert.match(hardModeError('mouse', rows)!, /第 3 個字母必須是 A/);
  assert.match(hardModeError('beach', rows)!, /必須包含 R/);
});
