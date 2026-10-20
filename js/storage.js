/* localStorage wrapper — schema v1, corrupt guard, migration */
(function () {
  window.App = window.App || {};

  var PREFIX = 'examapp:v1:';
  var SCHEMA = 1;

  function fullKey(key) { return PREFIX + key; }
  function safeParse(raw) {
    try { return { ok: true, value: JSON.parse(raw) }; }
    catch (e) { return { ok: false, error: e }; }
  }

  var defaults = {
    schema: SCHEMA,
    theme: 'system',
    shuffleChoices: true,
    timerMode: 'untimed',
    secondsPerQuestion: 60,
    dailyGoal: 20,
    defaultSessionSize: 20,
    lastBackupAt: null,
    backupSnoozeUntil: null
  };

  var storage = {
    SCHEMA: SCHEMA,
    PREFIX: PREFIX,

    isAvailable: function () {
      try {
        var k = '__probe__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch (e) { return false; }
    },

    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(fullKey(key));
        if (raw == null) return fallback;
        var parsed = safeParse(raw);
        if (!parsed.ok) {
          try { localStorage.setItem(fullKey(key + ':corrupt'), raw); } catch (_) {}
          console.error('Corrupt localStorage data at', key);
          return fallback;
        }
        return parsed.value;
      } catch (e) {
        console.error('storage.get failed', key, e);
        return fallback;
      }
    },

    set: function (key, value) {
      try {
        localStorage.setItem(fullKey(key), JSON.stringify(value));
        return true;
      } catch (e) {
        console.error('storage.set failed', key, e);
        return false;
      }
    },

    remove: function (key) {
      try { localStorage.removeItem(fullKey(key)); } catch (e) {}
    },

    clearAll: function () {
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) keys.push(k);
        }
        keys.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
    },

    // ---- Convenience ----
    getQuestions: function () { return storage.get('questions', []); },
    setQuestions: function (q) { return storage.set('questions', q); },

    getProgress: function () { return storage.get('progress', {}); },
    setProgress: function (p) { return storage.set('progress', p); },

    getDaily: function () { return storage.get('daily', {}); },
    setDaily: function (d) { return storage.set('daily', d); },

    getTopicRecent: function () { return storage.get('topicRecent', {}); },
    setTopicRecent: function (t) { return storage.set('topicRecent', t); },

    getCauses: function () { return storage.get('causes', {}); },
    setCauses: function (c) { return storage.set('causes', c); },

    getSessions: function () { return storage.get('sessions', []); },
    setSessions: function (s) { return storage.set('sessions', s); },

    getActiveSession: function () { return storage.get('activeSession', null); },
    setActiveSession: function (s) { return storage.set('activeSession', s); },

    getSettings: function () {
      var s = storage.get('settings', null);
      if (!s) return Object.assign({}, defaults);
      var merged = Object.assign({}, defaults);
      Object.keys(s).forEach(function (k) { merged[k] = s[k]; });
      return merged;
    },
    setSettings: function (s) { return storage.set('settings', s); },

    migrateIfNeeded: function () {
      var s = storage.getSettings();
      if (s.schema !== SCHEMA) {
        s.schema = SCHEMA;
        storage.setSettings(s);
      }
    }
  };

  App.storage = storage;
})();