/* Round 1 basic scheduler tests (Node) */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Minimal DOM-free environment for load
global.window = global;
global.App = {};
// Load subjects
require(path.join(__dirname, '..', 'data', 'subjects.js'));
// Load scheduler
require(path.join(__dirname, '..', 'js', 'scheduler.js'));

const { App } = global;

// --- buildSimpleSession respects n and filter ---
const qs = [
  { id: 'de-1', subject: 'data-engineering', topic: 't1', question: 'q', choices: ['a','b'], answer: 0, explanation: 'e' },
  { id: 'de-2', subject: 'data-engineering', topic: 't2', question: 'q', choices: ['a','b'], answer: 0, explanation: 'e' },
  { id: 'mi-1', subject: 'marketing-innovation', topic: 't1', question: 'q', choices: ['a','b'], answer: 0, explanation: 'e' }
];

const picked = App.scheduler.buildSimpleSession(qs, { subject: null, topics: [] }, 2);
assert.strictEqual(picked.length, 2, 'returns N when pool >= N');

const pickedFilter = App.scheduler.buildSimpleSession(qs, { subject: 'data-engineering', topics: [] }, 10);
assert.strictEqual(pickedFilter.length, 2, 'filters by subject');
assert.ok(pickedFilter.every(q => q.subject === 'data-engineering'));

const pickedTopics = App.scheduler.buildSimpleSession(qs, { subject: null, topics: ['t2'] }, 10);
assert.strictEqual(pickedTopics.length, 1, 'filters by topic');

// --- shuffleChoices returns permutation ---
const perm = App.scheduler.shuffleChoices(4);
assert.strictEqual(perm.length, 4);
const sorted = perm.slice().sort((a, b) => a - b);
assert.deepStrictEqual(sorted, [0, 1, 2, 3], 'shuffleChoices is a permutation');

// --- todayKey local time minus 4h ---
require(path.join(__dirname, '..', 'js', 'stats.js'));
const origNow = Date.now;
try {
  // 2025-01-15 03:59 local
  const t1 = new Date(2025, 0, 15, 3, 59, 0).getTime();
  // 2025-01-15 04:00 local
  const t2 = new Date(2025, 0, 15, 4, 0, 0).getTime();
  Date.now = () => t1;
  const k1 = App.stats.todayKey();
  Date.now = () => t2;
  const k2 = App.stats.todayKey();
  assert.notStrictEqual(k1, k2, 'todayKey changes at 04:00 local');
  assert.strictEqual(k1, '2025-01-14');
  assert.strictEqual(k2, '2025-01-15');
} finally {
  Date.now = origNow;
}

console.log('Round 1 tests passed.');