/* Chat / askai structure tests — Node (no DOM, no network) */
const assert = require('assert');
const path = require('path');

// Mock minimal globals so askai.js can load
global.window = global;
global.App = {};
global.navigator = {};

// Load subjects (needed for subjectName)
require(path.join(__dirname, '..', 'data', 'subjects.js'));

// Mock storage used by askai (getSettings etc.)
global.App.storage = {
  _data: {},
  get: function (k, def) { return this._data[k] != null ? this._data[k] : def; },
  set: function (k, v) { this._data[k] = v; return true; },
  getSettings: function () { return { aiModel: 'claude-haiku-5-5' }; },
  setSettings: function (s) { this._settings = s; }
};

// Mock validate (only used when adding new question — not needed here)
global.App.validate = {
  validateQuestion: function () { return []; },
  normalizeQuestion: function (q) { return q; }
};

require(path.join(__dirname, '..', 'js', 'askai.js'));

const { App } = global;
const A = App.askai;

// --- Fn presence ---
(function testAskaiFunctions() {
  assert.strictEqual(typeof A.buildAskAIText, 'function');
  assert.strictEqual(typeof A.copyText, 'function');
  assert.strictEqual(typeof A.getApiKey, 'function');
  assert.strictEqual(typeof A.setApiKey, 'function');
  assert.strictEqual(typeof A.getModel, 'function');
  assert.strictEqual(typeof A.setModel, 'function');
  assert.strictEqual(typeof A.buildContextMessages, 'function');
  assert.strictEqual(typeof A.callAnthropic, 'function');
  assert.ok(A.PROMPT_TEMPLATE.includes('ช่วยร่างข้อสอบ'));
  assert.ok(typeof A.QUICK_PROMPTS === 'object');
  ['explain', 'whyWrong', 'example', 'newQuestion'].forEach(function (k) {
    assert.ok(A.QUICK_PROMPTS[k], 'missing quick prompt: ' + k);
  });
  assert.ok(A.HINT_SYSTEM.includes('ห้ามบอก'), 'hint system must forbid revealing answer');
})();

// --- get/set api key (roundtrip) ---
(function testApiKeyRoundtrip() {
  A.setApiKey('sk-test-123');
  assert.strictEqual(A.getApiKey(), 'sk-test-123');
  A.setApiKey('');
  assert.strictEqual(A.getApiKey(), '');
})();

// --- buildAskAIText output structure ---
(function testBuildAskAIText() {
  var q = {
    id: 'de-001',
    subject: 'data-engineering',
    topic: 'พื้นฐาน',
    question: 'ข้อใดถูก',
    choices: ['A', 'B', 'C', 'D'],
    answer: 2,
    explanation: 'เพราะ C ถูก'
  };
  // Display order: [2, 0, 3, 1] => C is displayed first
  var order = [2, 0, 3, 1];
  var text = A.buildAskAIText(q, order, 0, 'sure');
  assert.ok(text.includes('ช่วยอธิบายข้อสอบ'));
  assert.ok(text.includes('วิชา: Data Engineering'));
  assert.ok(text.includes('โจทย์: ข้อใดถูก'));
  assert.ok(text.includes('ก. C'), 'first displayed choice is C');
  assert.ok(text.includes('คำตอบที่ฉันเลือก: ข. A'), 'chosen 0 displayed at index 1 => ข');
  assert.ok(text.includes('เฉลยที่ถูกต้อง: ก. C'), 'answer 2 displayed at index 0 => ก');
  assert.ok(text.includes('ความมั่นใจ: มั่นใจ'));
})();

// --- buildContextMessages (used by chat) ---
(function testBuildContextMessages() {
  var q = {
    id: 'mi-001',
    subject: 'marketing-innovation',
    topic: 'พื้นฐาน',
    question: '4Ps คืออะไร',
    choices: ['Prod', 'Price', 'Place', 'Promo'],
    answer: 0,
    explanation: 'Prod มาจาก Product'
  };
  var msgs = A.buildContextMessages(q, [0, 1, 2, 3], 1, 'guess', 'อธิบายเพิ่ม');
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].role, 'user');
  assert.ok(msgs[0].content.includes('บริบทข้อสอบ'));
  assert.ok(msgs[0].content.includes('โจทย์: 4Ps คืออะไร'));
  assert.ok(msgs[0].content.includes('คำถาม: อธิบายเพิ่ม'));
  assert.ok(msgs[0].content.includes('เดา'));
})();

// --- callAnthropic rejects without key ---
(function testCallNoKey() {
  A.setApiKey('');
  return A.callAnthropic([{ role: 'user', content: 'hi' }], null).then(
    function () { throw new Error('should have rejected'); },
    function (err) { assert.strictEqual(err.message, 'NO_KEY'); }
  );
})();

console.log('Round 4 chat/askai tests passed.');