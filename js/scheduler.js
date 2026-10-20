/* Scheduler — round 1: simple shuffle only (Leitner comes in round 2) */
(function () {
  window.App = window.App || {};

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Build a simple shuffled session queue for round 1
  // filter: { subject: null|string, topics: [] }
  function buildSimpleSession(questions, filter, n) {
    filter = filter || { subject: null, topics: [] };
    var pool = questions.filter(function (q) {
      if (filter.subject && q.subject !== filter.subject) return false;
      if (filter.topics && filter.topics.length && filter.topics.indexOf(q.topic) === -1) return false;
      return true;
    });
    var shuffled = shuffleArray(pool);
    return shuffled.slice(0, Math.max(1, Math.min(n, shuffled.length)));
  }

  // Returns array of indices [0..len-1] shuffled
  function shuffleChoices(len) {
    return shuffleArray(Array.from({ length: len }, function (_, i) { return i; }));
  }

  App.scheduler = {
    shuffleArray: shuffleArray,
    shuffleChoices: shuffleChoices,
    buildSimpleSession: buildSimpleSession
  };
})();