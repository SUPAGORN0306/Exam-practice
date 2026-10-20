/* Scheduler — Leitner + weighted builder + recheck + backup hint helpers */
(function () {
  window.App = window.App || {};

  var INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
  var MASTERED_BOX = 4;
  var TOPIC_WINDOW = 20;
  var TOPIC_MIN_SAMPLES = 5;
  var DAY_START_HOUR = 4;
  var BACKUP_QUIET_DAYS = 3;
  var BACKUP_STALE_DAYS = 7;

  function todayKey(ts) {
    var t = (typeof ts === 'number') ? ts : Date.now();
    var d = new Date(t - DAY_START_HOUR * 60 * 60 * 1000);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function addDays(key, days) {
    var parts = key.split('-').map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function classifyAnswer(correct, confidence) {
    if (correct) {
      if (confidence === 'sure') return 'correctSure';
      if (confidence === 'unsure') return 'correctUnsure';
      return 'correctGuess';
    }
    return confidence === 'sure' ? 'wrongSure' : 'wrong';
  }

  function scoreForType(type) {
    switch (type) {
      case 'correctSure': return 1.0;
      case 'correctUnsure': return 0.6;
      case 'correctGuess': return 0.3;
      default: return 0;
    }
  }

  function nextBox(prevProgress, type, ts) {
    var p = Object.assign({
      box: 0, due: null, attempts: 0, correct: 0, lapses: 0,
      lastAt: null, lastConfidence: null, lastTimeMs: null, avgTimeMs: null
    }, prevProgress || {});
    var today = todayKey(ts);
    p.attempts = (p.attempts || 0) + 1;

    if (type === 'correctSure') {
      p.box = Math.min((p.box || 0) + 1, 5);
      p.due = addDays(today, INTERVAL_DAYS[p.box]);
      p.correct = (p.correct || 0) + 1;
    } else if (type === 'correctUnsure') {
      p.box = Math.max(p.box || 0, 1);
      p.due = addDays(today, INTERVAL_DAYS[p.box]);
      p.correct = (p.correct || 0) + 1;
    } else if (type === 'correctGuess') {
      p.box = 1;
      p.due = addDays(today, INTERVAL_DAYS[1]);
      p.correct = (p.correct || 0) + 1;
    } else {
      p.box = 0;
      p.due = today;
      p.lapses = (p.lapses || 0) + 1;
    }
    p.lastAt = ts || Date.now();
    return p;
  }

  function topicKey(subject, topic) { return subject + '|' + topic; }

  function topicAccuracy(scores) {
    if (!scores || !scores.length) return null;
    if (scores.length < TOPIC_MIN_SAMPLES) return null;
    var s = 0;
    for (var i = 0; i < scores.length; i++) s += scores[i];
    return s / scores.length;
  }

  function weightedSampleNoReplace(pool, weights, k, rng) {
    rng = rng || Math.random;
    var items = pool.map(function (item, i) { return { item: item, w: weights[i] }; });
    var picked = [];
    for (var n = 0; n < k && items.length > 0; n++) {
      var total = items.reduce(function (a, x) { return a + x.w; }, 0);
      if (total <= 0) break;
      var r = rng() * total;
      var acc = 0;
      var idx = items.length - 1;
      for (var i = 0; i < items.length; i++) {
        acc += items[i].w;
        if (r <= acc) { idx = i; break; }
      }
      picked.push(items[idx].item);
      items.splice(idx, 1);
    }
    return picked;
  }

  function buildAutoSession(opts) {
    var questions = opts.questions || [];
    var progress = opts.progress || {};
    var topicRecent = opts.topicRecent || {};
    var n = opts.n || 20;
    var filter = opts.filter || { subject: null, topics: [] };
    var rng = opts.rng || Math.random;
    var today = todayKey(opts.now);

    var inScope = questions.filter(function (q) {
      if (filter.subject && q.subject !== filter.subject) return false;
      if (filter.topics && filter.topics.length && filter.topics.indexOf(q.topic) === -1) return false;
      return true;
    });
    if (inScope.length === 0) {
      return { ids: [], meta: { dueCount: 0, filled: 0, newCount: 0, totalInLibrary: 0, empty: true } };
    }

    var due = [], rest = [];
    inScope.forEach(function (q) {
      var p = progress[q.id];
      if (p && p.due && p.due <= today) due.push(q);
      else rest.push(q);
    });

    due.sort(function (a, b) {
      var pa = progress[a.id], pb = progress[b.id];
      if (pa.due !== pb.due) return pa.due < pb.due ? -1 : 1;
      return (pa.box || 0) - (pb.box || 0);
    });

    var dueBySubject = {};
    due.forEach(function (q) {
      (dueBySubject[q.subject] = dueBySubject[q.subject] || []).push(q);
    });
    var subjectIds = Object.keys(dueBySubject);
    var dueOrdered = [];
    var cursor = 0;
    while (dueOrdered.length < due.length) {
      var added = false;
      for (var i = 0; i < subjectIds.length; i++) {
        var arr = dueBySubject[subjectIds[i]];
        if (cursor < arr.length) {
          dueOrdered.push(arr[cursor]);
          added = true;
          if (dueOrdered.length >= n) break;
        }
      }
      if (dueOrdered.length >= n) break;
      if (!added) break;
      cursor++;
    }

    var chosen = dueOrdered.slice(0, n);
    var remain = n - chosen.length;

    if (remain > 0 && rest.length > 0) {
      var newCap = Math.max(0, Math.floor(n * 0.6) - chosen.filter(function (q) { return !progress[q.id]; }).length);
      var newChosen = 0;
      var weights = rest.map(function (q) {
        var p = progress[q.id];
        var tk = topicKey(q.subject, q.topic);
        var acc = topicAccuracy((topicRecent[tk] || []).slice(-TOPIC_WINDOW));
        var accEff = acc == null ? 0.5 : acc;
        var w = 1 + 3 * (1 - accEff);
        if (!p) w *= 1.0;
        else if (p.due && p.due > today) w *= 0.5;
        if (p && (p.lapses || 0) >= 2) w *= 1.5;
        return w;
      });
      var filteredPickable = [], filteredWeights = [];
      for (var j = 0; j < rest.length; j++) {
        var q = rest[j];
        var isNew = !progress[q.id];
        if (isNew && newChosen >= newCap) continue;
        if (isNew) newChosen++;
        filteredPickable.push(q);
        filteredWeights.push(weights[j]);
      }
      var filled = weightedSampleNoReplace(filteredPickable, filteredWeights, remain, rng);
      filled.forEach(function (q) { chosen.push(q); });
    }

    var ordered = interleaveSubjects(chosen, 2);
    var newCount = ordered.filter(function (q) { return !progress[q.id]; }).length;
    return {
      ids: ordered.map(function (q) { return q.id; }),
      meta: {
        dueCount: due.length,
        filled: ordered.length - Math.min(due.length, ordered.length),
        newCount: newCount,
        totalInLibrary: inScope.length,
        empty: false
      }
    };
  }

  function interleaveSubjects(list, maxRun) {
    if (list.length <= 1) return list.slice();
    var remaining = list.slice();
    var out = [];
    var lastSubj = null, run = 0;
    while (remaining.length) {
      var pickIdx = -1;
      for (var i = 0; i < remaining.length; i++) {
        var q = remaining[i];
        if (q.subject === lastSubj && run >= maxRun) continue;
        pickIdx = i;
        break;
      }
      if (pickIdx === -1) pickIdx = 0;
      var picked = remaining.splice(pickIdx, 1)[0];
      if (picked.subject === lastSubj) run++;
      else { lastSubj = picked.subject; run = 1; }
      out.push(picked);
    }
    return out;
  }

  function buildReviewWrongSession(opts) {
    var questions = opts.questions || [];
    var progress = opts.progress || {};
    var n = opts.n || 20;
    var filter = opts.filter || { subject: null, topics: [] };

    var pool = questions.filter(function (q) {
      if (filter.subject && q.subject !== filter.subject) return false;
      if (filter.topics && filter.topics.length && filter.topics.indexOf(q.topic) === -1) return false;
      var p = progress[q.id];
      return p && (p.lapses || 0) > 0 && (p.box || 0) <= 2;
    });
    pool.sort(function (a, b) {
      var pa = progress[a.id], pb = progress[b.id];
      return (pb.lastAt || 0) - (pa.lastAt || 0);
    });
    var chosen = pool.slice(0, n);
    return {
      ids: chosen.map(function (q) { return q.id; }),
      meta: { dueCount: chosen.length, filled: chosen.length, newCount: 0, totalInLibrary: chosen.length }
    };
  }

  function injectRecheck(queue, qid, atIndex, rng) {
    rng = rng || Math.random;
    var offset = 3 + Math.floor(rng() * 3);
    var insertAt = Math.min(queue.length, atIndex + offset);
    if (insertAt <= atIndex) insertAt = queue.length;
    var copy = queue.slice();
    copy.splice(insertAt, 0, { qid: qid, isRecheck: true });
    return copy;
  }

  function shuffleChoices(len, rng) {
    rng = rng || Math.random;
    var a = [];
    for (var i = 0; i < len; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(rng() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  // ---- Storage persistence (silent, best-effort) ----
  function ensurePersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(function () {});
      }
    } catch (e) {}
  }

  // ---- Backup banner condition ----
  function shouldShowBackupBanner(opts) {
    var answeredTotal = opts.answeredTotal || 0;
    var addedQuestions = opts.addedQuestions || 0;
    var lastBackupAt = opts.lastBackupAt;
    var snoozeUntil = opts.backupSnoozeUntil;
    var now = opts.now || Date.now();
    if (snoozeUntil && now < snoozeUntil) return false;
    if (!(answeredTotal >= 20 || addedQuestions >= 10)) return false;
    if (!lastBackupAt) return true;
    var days = (now - lastBackupAt) / (24 * 60 * 60 * 1000);
    return days > BACKUP_STALE_DAYS;
  }

  function snoozeBannerDays() {
    return Date.now() + BACKUP_QUIET_DAYS * 24 * 60 * 60 * 1000;
  }

  App.scheduler = {
    INTERVAL_DAYS: INTERVAL_DAYS,
    MASTERED_BOX: MASTERED_BOX,
    TOPIC_WINDOW: TOPIC_WINDOW,
    TOPIC_MIN_SAMPLES: TOPIC_MIN_SAMPLES,
    DAY_START_HOUR: DAY_START_HOUR,
    BACKUP_QUIET_DAYS: BACKUP_QUIET_DAYS,

    todayKey: todayKey,
    addDays: addDays,
    classifyAnswer: classifyAnswer,
    scoreForType: scoreForType,
    nextBox: nextBox,
    topicKey: topicKey,
    topicAccuracy: topicAccuracy,

    buildAutoSession: buildAutoSession,
    buildReviewWrongSession: buildReviewWrongSession,
    injectRecheck: injectRecheck,
    shuffleChoices: shuffleChoices,
    interleaveSubjects: interleaveSubjects,

    ensurePersist: ensurePersist,
    shouldShowBackupBanner: shouldShowBackupBanner,
    snoozeBannerDays: snoozeBannerDays
  };
})();