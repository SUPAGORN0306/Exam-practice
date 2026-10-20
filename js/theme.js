/* Theme switcher */
(function () {
  window.App = window.App || {};

  function apply(theme) {
    var dark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#12151C' : '#F7F8FA');
  }

  function set(theme) {
    var s = App.storage.getSettings();
    s.theme = theme;
    App.storage.setSettings(s);
    apply(theme);
  }

  function init() {
    var s = App.storage.getSettings();
    apply(s.theme || 'system');
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) {
        mq.addEventListener('change', function () {
          var cur = App.storage.getSettings().theme;
          if (cur === 'system') apply('system');
        });
      }
    }
    var btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var cur = App.storage.getSettings().theme;
        var next = cur === 'light' ? 'dark' : cur === 'dark' ? 'system' : 'light';
        set(next);
      });
    }
  }

  App.theme = { apply: apply, set: set, init: init };
})();