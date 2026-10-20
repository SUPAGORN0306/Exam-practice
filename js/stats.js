/* Stats helpers — daily streak, mastery %, next-day due count */
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

  // Streak = consecutive days with >=5 answers (counting back from today or yesterday)
  function streakDays(daily, todayK) {
    var t = todayK || todayKey();
    var count = 0;
    var cursor = t;
    // If today has <5, streak ends yesterday (no freeze per spec)
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

  // Mastery = (# q with box >= MASTERED) / (# total in subject)
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

  // Due count today (due <= today)
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

  // Due count tomorrow
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

  // Slow questions: >2x median for that subject, requires >=5 samples
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

  App.stats = {
    todayKey: todayKey,
    prevDayKey: prevDayKey,
    dailyAnsweredCount: dailyAnsweredCount,
    streakDays: streakDays,
    subjectMastery: subjectMastery,
    dueTodayCount: dueTodayCount,
    dueTomorrowCount: dueTomorrowCount,
    slowQuestions: slowQuestions,
    median: median
  };
})();