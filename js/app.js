/* App bootstrap + hash router + small shared UI helpers */
(function () {
  window.App = window.App || {};

  var routes = ['home', 'session', 'summary', 'stats', 'manage', 'settings'];

  function parseHash() {
    var hash = window.location.hash || '#/home';
    var parts = hash.replace(/^#\/?/, '').split('?');
    var name = parts[0] || 'home';
    if (routes.indexOf(name) === -1) name = 'home';
    return { name: name, query: parts[1] || '' };
  }

  function setActiveNav(name) {
    document.querySelectorAll('.nav-item').forEach(function (el) {
      if (el.getAttribute('data-route') === name) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  function render() {
    var r = parseHash();
    setActiveNav(r.name);
    var main = document.getElementById('main');
    if (!main) return;
    // Clear with textContent-safe approach
    while (main.firstChild) main.removeChild(main.firstChild);
    var fn = App.views && App.views[r.name];
    if (typeof fn === 'function') {
      try {
        fn(main, r.query);
      } catch (e) {
        console.error(e);
        var p = document.createElement('p');
        p.className = 'empty';
        p.textContent = 'เกิดข้อผิดพลาดในการแสดงหน้านี้';
        main.appendChild(p);
      }
    }
  }

  function navigate(name) {
    window.location.hash = '#/' + name;
  }

  // --- Shared UI helpers ---
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'text') node.textContent = v;
        else if (k === 'class') node.className = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v === true) node.setAttribute(k, '');
        else if (v === false || v == null) { /* skip */ }
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.querySelector('.toast');
    if (!t) {
      t = el('div', { class: 'toast' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  function confirmAction(msg) {
    return window.confirm(msg);
  }

  // --- Data helpers (round 1 minimal) ---
  function loadQuestions() { return App.storage.getQuestions(); }
  function saveQuestions(list) { return App.storage.setQuestions(list); }

  // Generate next id for a subject, e.g. de-006
  function nextIdFor(subject, existingList) {
    var prefix = App.subjectPrefix(subject);
    var max = 0;
    (existingList || []).forEach(function (q) {
      if (q.subject !== subject || !q.id) return;
      var m = String(q.id).match(new RegExp('^' + prefix + '-(\\d+)$'));
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    });
    var next = max + 1;
    return prefix + '-' + String(next).padStart(3, '0');
  }

  // Save progress counter minimally (attempts / correct / lastAt)
  function recordAnswerBasics(qid, correct) {
    var progress = App.storage.getProgress();
    var p = progress[qid] || { attempts: 0, correct: 0 };
    p.attempts = (p.attempts || 0) + 1;
    if (correct) p.correct = (p.correct || 0) + 1;
    p.lastAt = Date.now();
    progress[qid] = p;
    App.storage.setProgress(progress);
  }

  function init() {
    if (!App.storage.isAvailable()) {
      var main = document.getElementById('main');
      if (main) {
        while (main.firstChild) main.removeChild(main.firstChild);
        var box = el('div', { class: 'card' }, [
          el('h2', { text: 'ไม่สามารถใช้งานพื้นที่จัดเก็บได้' }),
          el('p', {
            class: 'muted',
            text: 'เบราว์เซอร์นี้บล็อก localStorage กรุณาเปิดในโหมดปกติหรืออนุญาตการจัดเก็บข้อมูล'
          })
        ]);
        main.appendChild(box);
      }
      return;
    }
    App.storage.migrateIfNeeded();
    App.theme.init();
    window.addEventListener('hashchange', render);
    if (!window.location.hash) window.location.hash = '#/home';
    render();
  }

  App.routes = routes;
  App.navigate = navigate;
  App.el = el;
  App.toast = toast;
  App.confirm = confirmAction;
  App.loadQuestions = loadQuestions;
  App.saveQuestions = saveQuestions;
  App.nextIdFor = nextIdFor;
  App.recordAnswerBasics = recordAnswerBasics;
  App.render = render;
  App.views = App.views || {};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();