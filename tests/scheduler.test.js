/* Round 3 scheduler tests — Node */
const assert = require('assert');
const path = require('path');

global.window = global;
global.App = {};
require(path.join(__dirname, '..', 'data', 'subjects.js'));
require(path.join(__dirname, '..', 'js', 'scheduler.js'));
const { App } = global;
const S = App.scheduler;

// ---- nextBox ----
(function testBoxRules() {
  var p = S.nextBox({ box: 0 }, 'correctSure', new Date(2025, 0, 15, 10).getTime());
  assert.strictEqual(p.box, 1);
  assert.strictEqual(p.due, S.addDays('2025-01-15', 1));

  var p2 = S.nextBox({ box: 5 }, 'correctSure', new Date(2025, 0, 15, 10).getTime());
  assert.strictEqual(p2.box, 5);
  assert.strictEqual(p2.due, S.addDays('2025-01-15', 30));

  var p3 = S.nextBox({ box: 3 }, 'correctGuess', new Date(2025, 0, 15, 10).getTime());
  assert.strictEqual(p3.box, 1);

  var p4 = S.nextBox({ box: 2, lapses: 1 }, 'wrong', new Date(2025, 0, 15, 10).getTime());
  assert.strictEqual(p4.box, 0);
  assert.strictEqual(p4.due, '2025-01-15');
  assert.strictEqual(p4.lapses, 2);

  var p5 = S.nextBox({ box: 2 }, 'wrongSure', new Date(2025, 0, 15, 10).getTime());
  assert.strictEqual(p5.box, 0);
})();

// ---- todayKey boundary 03:59 vs 04:00 ----
(function testTodayKey() {
  var t1 = new Date(2025, 0, 15, 3, 59, 0).getTime();
  var t2 = new Date(2025, 0, 15, 4, 0, 0).getTime();
  assert.strictEqual(S.todayKey(t1), '2025-01-14');
  assert.strictEqual(S.todayKey(t2), '2025-01-15');
})();

// ---- buildAutoSession: due before new ----
(function testDueBeforeNew() {
  var qs = [];
  for (var i = 0; i < 30; i++) {
    qs.push({ id: 'q' + i, subject: i % 2 ? 'data-engineering' : 'marketing-innovation', topic: 't' + (i % 3) });
  }
  var progress = {};
  [0, 1, 2, 3, 4].forEach(function (i) {
    progress['q' + i] = { box: 1, due: '2025-01-10', attempts: 1, correct: 0, lapses: 1, lastAt: Date.now() };
  });
  var res = S.buildAutoSession({
    questions: qs, progress: progress, topicRecent: {},
    n: 10, filter: { subject: null, topics: [] },
    now: new Date(2025, 0, 15, 10).getTime(),
    rng: function () { return 0.5; }
  });
  assert.strictEqual(res.ids.length, 10, 'gets N');
  var firstFive = res.ids.slice(0, 5);
  firstFive.forEach(function (qid) {
    assert.ok(qid.match(/^q[0-4]$/), 'first 5 are due: ' + qid);
  });
  assert.strictEqual(new Set(res.ids).size, res.ids.length);
})();

// ---- New questions capped at 60% ----
(function testNewCap() {
  var qs = [];
  for (var i = 0; i < 50; i++) qs.push({ id: 'q' + i, subject: 'data-engineering', topic: 't' + (i % 5) });
  var progress = {};
  for (var j = 0; j < 30; j++) {
    progress['q' + j] = { box: 2, due: '2030-01-01', attempts: 1, correct: 1, lapses: 0, lastAt: Date.now() };
  }
  var res = S.buildAutoSession({
    questions: qs, progress: progress, topicRecent: {},
    n: 10, filter: { subject: null, topics: [] },
    now: new Date(2025, 0, 15, 10).getTime(),
    rng: function () { return 0.5; }
  });
  var newCount = res.ids.filter(function (id) {
    var num = parseInt(id.replace('q', ''), 10);
    return num >= 30;
  }).length;
  assert.ok(newCount <= 6, 'new questions capped at 60% (got ' + newCount + ')');
})();

// ---- Library smaller than N ----
(function testSmallLibrary() {
  var qs = [{ id: 'a', subject: 'data-engineering', topic: 't' }];
  var res = S.buildAutoSession({
    questions: qs, progress: {}, topicRecent: {},
    n: 20, filter: { subject: null, topics: [] },
    now: Date.now(), rng: Math.random
  });
  assert.strictEqual(res.ids.length, 1);
})();

// ---- Weak topic sampled more often (statistical) ----
(function testWeakTopicWeighted() {
  var qs = [];
  for (var i = 0; i < 10; i++) qs.push({ id: 'weak-' + i, subject: 'data-engineering', topic: 'weak' });
  for (var j = 0; j < 10; j++) qs.push({ id: 'strong-' + j, subject: 'data-engineering', topic: 'strong' });
  var progress = {};
  for (var k = 0; k < 10; k++) {
    progress['strong-' + k] = { box: 4, due: '2030-01-01', attempts: 5, correct: 5, lapses: 0, lastAt: Date.now() };
  }
  for (var w = 0; w < 10; w++) {
    progress['weak-' + w] = { box: 1, due: '2030-01-01', attempts: 3, correct: 1, lapses: 2, lastAt: Date.now() };
  }
  var topicRecent = {
    'data-engineering|weak': [0.2, 0.3, 0.1, 0.2, 0.3],
    'data-engineering|strong': [0.95, 1.0, 0.9, 0.95, 1.0]
  };
  var weakPicks = 0, strongPicks = 0;
  for (var trial = 0; trial < 2000; trial++) {
    var res = S.buildAutoSession({
      questions: qs, progress: progress, topicRecent: topicRecent,
      n: 1, filter: { subject: null, topics: [] },
      now: new Date(2025, 0, 15, 10).getTime(),
      rng: Math.random
    });
    if (res.ids[0] && res.ids[0].indexOf('weak-') === 0) weakPicks++;
    else strongPicks++;
  }
  assert.ok(weakPicks > strongPicks, 'weak picked more (' + weakPicks + ' vs ' + strongPicks + ')');
})();

// ---- injectRecheck returns new array; inserts at offset 3..5 ----
(function testInjectRecheck() {
  var queue = [{ qid: 'a' }, { qid: 'b' }, { qid: 'c' }, { qid: 'd' }, { qid: 'e' }, { qid: 'f' }, { qid: 'g' }];
  var out = S.injectRecheck(queue, 'a', 0, function () { return 0; });
  assert.strictEqual(out.length, queue.length + 1);
  assert.strictEqual(out[3].qid, 'a');
  assert.strictEqual(out[3].isRecheck, true);
  assert.strictEqual(queue.length, 7, 'original queue unchanged');
})();

// ---- classifyAnswer ----
(function testClassify() {
  assert.strictEqual(S.classifyAnswer(true, 'sure'), 'correctSure');
  assert.strictEqual(S.classifyAnswer(true, 'unsure'), 'correctUnsure');
  assert.strictEqual(S.classifyAnswer(true, 'guess'), 'correctGuess');
  assert.strictEqual(S.classifyAnswer(false, 'sure'), 'wrongSure');
  assert.strictEqual(S.classifyAnswer(false, 'guess'), 'wrong');
})();

// ---- Backup Banner Logic ----
(function testBackupBanner() {
  var now = Date.now();
  
  // Case 1: Not enough activity -> false
  assert.strictEqual(S.shouldShowBackupBanner({ answeredTotal: 10, addedQuestions: 5, lastBackupAt: null, now: now }), false);
  
  // Case 2: Enough activity, never backed up -> true
  assert.strictEqual(S.shouldShowBackupBanner({ answeredTotal: 25, addedQuestions: 0, lastBackupAt: null, now: now }), true);
  
  // Case 3: Enough activity, backed up 8 days ago -> true
  var eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);
  assert.strictEqual(S.shouldShowBackupBanner({ answeredTotal: 25, addedQuestions: 0, lastBackupAt: eightDaysAgo, now: now }), true);

  // Case 4: Enough activity, backed up 2 days ago -> false
  var twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
  assert.strictEqual(S.shouldShowBackupBanner({ answeredTotal: 25, addedQuestions: 0, lastBackupAt: twoDaysAgo, now: now }), false);

  // Case 5: Snoozed -> false
  var tomorrow = now + (1 * 24 * 60 * 60 * 1000);
  assert.strictEqual(S.shouldShowBackupBanner({ answeredTotal: 25, addedQuestions: 0, lastBackupAt: null, backupSnoozeUntil: tomorrow, now: now }), false);
})();

console.log('Round 3 tests passed.');