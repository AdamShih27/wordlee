import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGradingMessages, GradeParseError, parseGradeResponse } from './grading';

test('prompt includes the word, meaning and sentence', () => {
  const m = buildGradingMessages('crane', ' I saw a crane. ', '名詞 鶴');
  assert.equal(m[0].role, 'system');
  assert.equal(m[1].content, '單字：crane（名詞 鶴）\n學生的句子：I saw a crane.');
});

test('parses a clean JSON reply', () => {
  const r = parseGradeResponse(
    '{"uses_word": true, "verdict": "minor", "corrected": "I saw a crane.", "explanations": ["要加冠詞 a"], "example": "A crane flew by."}',
    'I saw crane.',
  );
  assert.deepEqual(r, {
    usesWord: true,
    verdict: 'minor',
    corrected: 'I saw a crane.',
    explanations: ['要加冠詞 a'],
    example: 'A crane flew by.',
  });
});

test('handles think blocks, code fences, extra text and simplified Chinese', () => {
  const reply = '<think>let me check</think>好的，以下是批改：\n```json\n{"uses_word": true, "verdict": "incorrect", "corrected": "He cranes his neck.", "explanations": ["这里要用第三人称单数"]}\n```';
  const r = parseGradeResponse(reply, 'He crane his neck.');
  assert.equal(r.verdict, 'incorrect');
  assert.deepEqual(r.explanations, ['這裡要用第三人稱單數']);
  assert.equal(r.example, undefined);
});

test('fills safe defaults for missing or odd fields', () => {
  const r = parseGradeResponse('{"verdict": "great", "explanations": "不錯"}', 'Original.');
  assert.equal(r.verdict, 'minor');
  assert.equal(r.corrected, 'Original.');
  assert.deepEqual(r.explanations, ['不錯']);
  assert.equal(r.usesWord, true);
});

test('rejects replies without JSON', () => {
  assert.throws(() => parseGradeResponse('Sorry, I cannot help.', 'x'), GradeParseError);
  assert.throws(() => parseGradeResponse('{not json}', 'x'), GradeParseError);
});
