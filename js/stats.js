/* Stats helpers */
(function () {
  window.App = window.App || {};

  function todayKey(ts) {
    var t = (typeof ts === 'number') ? ts : Date.now();
    var d = new Date(t - 4 * 60 * 60 * 1000);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function prevDayKey(key) {
    var p = key.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() - 1);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function dailyAnsweredCount(daily, dayKey) {
    var d = daily[dayKey];
    if (!d) return 0;
    var total = 0;
    Object.keys(d).forEach(function (subj) {
      Object.keys(d[subj] || {}).forEach(function (topic) {
        total += (d[subj][topic].n || 0);
      });
    });
    return total;
  }
  function streakDays(daily, todayK) {
    var t = todayK || todayKey();
    var count = 0;
    var cursor = t;
    if (dailyAnsweredCount(daily, cursor) >= 5) {
      count = 1;
      cursor = prevDayKey(cursor);
    } else {
      cursor = prevDayKey(cursor);
    }
    while (dailyAnsweredCount(daily, cursor) >= 5) {
      count++;
      cursor = prevDayKey(cursor);
    }
    return count;
  }
  function subjectMastery(questions, progress, subject) {
    var total = 0, mastered = 0;
    questions.forEach(function (q) {
      if (q.subject !== subject) return;
      total++;
      var p = progress[q.id];
      if (p && (p.box || 0) >= 4) mastered++;
    });
    return { total: total, mastered: mastered, pct: total ? mastered / total : 0 };
  }
  function dueTodayCount(questions, progress, todayK, filter) {
    filter = filter || {};
    var t = todayK || todayKey();
    var n = 0;
    questions.forEach(function (q) {
      if (filter.subject && q.subject !== filter.subject) return;
      var p = progress[q.id];
      if (p && p.due && p.due <= t) n++;
    });
    return n;
  }
  function dueTomorrowCount(questions, progress, todayK, filter) {
    filter = filter || {};
    var t = todayK || todayKey();
    var tomorrow = App.scheduler.addDays(t, 1);
    var n = 0;
    questions.forEach(function (q) {
      if (filter.subject && q.subject !== filter.subject) return;
      var p = progress[q.id];
      if (p && p.due && p.due === tomorrow) n++;
    });
    return n;
  }
  function slowQuestions(subject, progress, questions) {
    var times = [];
    questions.forEach(function (q) {
      if (q.subject !== subject) return;
      var p = progress[q.id];
      if (p && p.lastTimeMs) times.push(p.lastTimeMs);
    });
    if (times.length < 5) return [];
    var sorted = times.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    var med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    var threshold = med * 2;
    var slow = [];
    questions.forEach(function (q) {
      if (q.subject !== subject) return;
      var p = progress[q.id];
      if (p && p.lastTimeMs && p.lastTimeMs > threshold) slow.push({ q: q, p: p });
    });
    return slow;
  }

  function median(nums) {
    if (!nums.length) return 0;
    var s = nums.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  // --- Round 3: extra helpers ---
  function overallCounts(questions, progress) {
    var total = questions.length;
    var mastered = 0, learning = 0, untouched = 0;
    questions.forEach(function (q) {
      var p = progress[q.id];
      if (!p) untouched++;
      else if ((p.box || 0) >= 4) mastered++;
      else learning++;
    });
    return { total: total, mastered: mastered, learning: learning, untouched: untouched };
  }

  // 30-day daily accuracy per subject
  // Returns { days: [ 'YYYY-MM-DD', ...], series: { subject: [ {answered, correct} ] } }
  function dailyAccuracy30(questions, progress, sessions, subjectList, todayK) {
    var t = todayK || todayKey();
    var days = [];
    for (var i = 29; i >= 0; i--) days.push(App.scheduler.addDays(t, -i));

    // Build per-subject map: session -> day
    var byId = {};
    questions.forEach(function (q) { byId[q.id] = q; });
    var daily = {}; // { dayKey: { subject: {n, correct} } }
    days.forEach(function (d) { daily[d] = {}; });

    sessions.forEach(function (s) {
      if (!s.endedAt) return;
      var d = todayKey(s.endedAt);
      if (!daily[d]) return;
      var firsts = s.firstAnswers || [];
      firsts.forEach(function (fa) {
        var q = byId[fa.qid];
        if (!q) return;
        if (!daily[d][q.subject]) daily[d][q.subject] = { n: 0, correct: 0 };
        daily[d][q.subject].n++;
        if (fa.correct) daily[d][q.subject].correct++;
      });
    });

    var series = {};
    subjectList.forEach(function (sub) {
      series[sub] = days.map(function (d) {
        var cell = daily[d][sub];
        if (!cell || !cell.n) return null;
        return { n: cell.n, correct: cell.correct, pct: cell.correct / cell.n };
      });
    });
    return { days: days, series: series };
  }

  function topicAccuracyList(questions, progress, topicRecent) {
    // Returns per subject: array of { topic, accuracy|null, n }
    var bySubject = {};
    questions.forEach(function (q) {
      bySubject[q.subject] = bySubject[q.subject] || {};
      bySubject[q.subject][q.topic] = (bySubject[q.subject][q.topic] || 0) + 1;
    });
    var result = {};
    Object.keys(bySubject).forEach(function (subj) {
      result[subj] = Object.keys(bySubject[subj]).map(function (topic) {
        var key = App.scheduler.topicKey(subj, topic);
        var scores = (topicRecent[key] || []).slice(-App.scheduler.TOPIC_WINDOW);
        var acc = App.scheduler.topicAccuracy(scores);
        return { topic: topic, accuracy: acc, n: bySubject[subj][topic], samples: scores.length };
      });
    });
    return result;
  }

  function wrongSureLast30(sessions, todayK) {
    var t = todayK || todayKey();
    var cutoff = App.scheduler.addDays(t, -29);
    var total = 0;
    sessions.forEach(function (s) {
      if (!s.endedAt) return;
      var d = todayKey(s.endedAt);
      if (d >= cutoff) total += (s.wrongSure || 0);
    });
    return total;
  }

  App.stats = {
    todayKey: todayKey,
    prevDayKey: prevDayKey,
    dailyAnsweredCount: dailyAnsweredCount,
    streakDays: streakDays,
    subjectMastery: subjectMastery,
    dueTodayCount: dueTodayCount,
    dueTomorrowCount: dueTomorrowCount,
    slowQuestions: slowQuestions,
    median: median,

    overallCounts: overallCounts,
    dailyAccuracy30: dailyAccuracy30,
    topicAccuracyList: topicAccuracyList,
    wrongSureLast30: wrongSureLast30
  };
})();