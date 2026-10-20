/* localStorage wrapper with schema version + corrupt guard */
(function () {
  window.App = window.App || {};

  var PREFIX = 'examapp:v1:';
  var SCHEMA = 1;

  function fullKey(key) { return PREFIX + key; }

  function safeParse(raw) {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  var storage = {
    SCHEMA: SCHEMA,
    PREFIX: PREFIX,

    isAvailable: function () {
      try {
        var k = '__probe__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch (e) {
        return false;
      }
    },

    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(fullKey(key));
        if (raw == null) return fallback;
        var parsed = safeParse(raw);
        if (!parsed.ok) {
          // Preserve corrupt copy, do not silently overwrite
          try {
            localStorage.setItem(fullKey(key + ':corrupt'), raw);
          } catch (_) { /* ignore */ }
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
      var raw = JSON.stringify(value);
      try {
        localStorage.setItem(fullKey(key), raw);
        return true;
      } catch (e) {
        console.error('storage.set failed', key, e);
        return false;
      }
    },

    remove: function (key) {
      try {
        localStorage.removeItem(fullKey(key));
      } catch (e) {
        /* ignore */
      }
    },

    clearAll: function () {
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) keys.push(k);
        }
        keys.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {
        /* ignore */
      }
    },

    // Defaults helpers (round 1 keeps progress minimal)
    getQuestions: function () { return storage.get('questions', []); },
    setQuestions: function (q) { return storage.set('questions', q); },

    getProgress: function () { return storage.get('progress', {}); },
    setProgress: function (p) { return storage.set('progress', p); },

    getSettings: function () {
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
      var s = storage.get('settings', null);
      if (!s) return defaults;
      // merge with defaults
      return Object.assign(defaults, s);
    },
    setSettings: function (s) { return storage.set('settings', s); },

    getActiveSession: function () { return storage.get('activeSession', null); },
    setActiveSession: function (s) { return storage.set('activeSession', s); },

    getSessions: function () { return storage.get('sessions', []); },
    setSessions: function (s) { return storage.set('sessions', s); },

    getDaily: function () { return storage.get('daily', {}); },
    setDaily: function (d) { return storage.set('daily', d); },

    getTopicRecent: function () { return storage.get('topicRecent', {}); },
    setTopicRecent: function (t) { return storage.set('topicRecent', t); },

    getCauses: function () { return storage.get('causes', {}); },
    setCauses: function (c) { return storage.set('causes', c); },

    // Schema check + migration placeholder for future versions
    migrateIfNeeded: function () {
      var s = storage.getSettings();
      if (s.schema !== SCHEMA) {
        // Future migrations go here
        s.schema = SCHEMA;
        storage.setSettings(s);
      }
    }
  };

  App.storage = storage;
})();