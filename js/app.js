/* App bootstrap + hash router + helpers */
(function () {
  window.App = window.App || {};

  var routes = ['home', 'session', 'summary', 'stats', 'manage', 'settings', 'flashcards'];

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
    // 🔥 ล้างตัวจับเวลาเก่าเสมอเมื่อเปลี่ยนหน้า
    if (window.App.views.session && window.App.views.session.clearTimer) {
      window.App.views.session.clearTimer();
    }

    var r = parseHash();
    setActiveNav(r.name);
    var main = document.getElementById('main');
    if (!main) return;
    
    while (main.firstChild) {
      main.removeChild(main.firstChild);
    }

    var fn = App.views && App.views[r.name];
    if (typeof fn === 'function') {
      try { fn(main, r.query); }
      catch (e) {
        console.error(e);
        var p = document.createElement('p');
        p.className = 'empty';
        p.textContent = 'เกิดข้อผิดพลาดในการแสดงหน้านี้';
        main.appendChild(p);
      }
    }
  }

  function navigate(name) { window.location.hash = '#/' + name; }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === 'text') node.textContent = v;
        else if (k === 'class') node.className = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) node.setAttribute(k, '');
        else if (v === false || v == null) {}
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
    if (!t) { t = el('div', { class: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  function confirmAction(msg) { return window.confirm(msg); }

  function loadQuestions() { return App.storage.getQuestions(); }
  function saveQuestions(list) { return App.storage.setQuestions(list); }

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
    return prefix + '-' + String(max + 1).padStart(3, '0');
  }

  function recordDaily(q, confidence, correct, timeMs) {
    var daily = App.storage.getDaily();
    var today = App.scheduler.todayKey();
    daily[today] = daily[today] || {};
    daily[today][q.subject] = daily[today][q.subject] || {};
    daily[today][q.subject][q.topic] = daily[today][q.subject][q.topic] || {
      n: 0, sure: 0, unsure: 0, guess: 0, wrong: 0, wrongSure: 0, ms: 0
    };
    var cell = daily[today][q.subject][q.topic];
    cell.n++;
    cell[confidence] = (cell[confidence] || 0) + 1;
    if (!correct) {
      cell.wrong++;
      if (confidence === 'sure') cell.wrongSure++;
    }
    cell.ms += (timeMs || 0);
    App.storage.setDaily(daily);
  }

  function recordTopicScore(q, type) {
    var recent = App.storage.getTopicRecent();
    var key = App.scheduler.topicKey(q.subject, q.topic);
    recent[key] = recent[key] || [];
    recent[key].push(App.scheduler.scoreForType(type));
    if (recent[key].length > 20) recent[key] = recent[key].slice(-20);
    App.storage.setTopicRecent(recent);
  }

  function recordCause(subject, cause) {
    var causes = App.storage.getCauses();
    causes[subject] = causes[subject] || { noKnowledge: 0, misread: 0, confused: 0 };
    causes[subject][cause] = (causes[subject][cause] || 0) + 1;
    App.storage.setCauses(causes);
  }

  // 🔥 Hamburger Menu
  function initMenu() {
    var btn = document.getElementById('menu-toggle');
    if (!btn) return;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay hidden';
    overlay.style = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:1000; display:flex; justify-content:flex-end;';
    
    var menu = document.createElement('div');
    menu.className = 'card';
    menu.style = 'width:280px; height:100%; margin:0; border-radius:0; display:flex; flex-direction:column; gap:16px; padding:24px; background:var(--surface);';
    
    menu.appendChild(el('h2', { text: 'ตั้งค่าด่วน' }));
    
    menu.appendChild(el('div', { class: 'field' }, [
      el('span', { class: 'label', text: 'ภาษา (Language)' }),
      (function(){
        var sel = el('select', { class: 'select' });
        sel.appendChild(el('option', { value: 'th', text: 'ไทย' }));
        sel.appendChild(el('option', { value: 'en', text: 'English (เร็วๆ นี้)' }));
        sel.disabled = true;
        return sel;
      })()
    ]));

    menu.appendChild(el('div', { class: 'field' }, [
      el('span', { class: 'label', text: 'รูปแบบการตอบ' }),
      (function(){
        var sel = el('select', { class: 'select' });
        sel.appendChild(el('option', { value: 'button', text: 'กดปุ่ม' }));
        sel.appendChild(el('option', { value: 'scroll', text: 'เลื่อนลง (Scroll)' }));
        
        var saved = localStorage.getItem('answerMode') || 'button';
        sel.value = saved;
        
        sel.addEventListener('change', function() {
          localStorage.setItem('answerMode', sel.value);
          App.toast('บันทึกการตั้งค่าแล้ว');
          App.render();
        });
        return sel;
      })()
    ]));

    menu.appendChild(el('button', { 
      class: 'btn btn-primary', 
      style: 'margin-top:auto;', 
      text: 'ปิดเมนู', 
      onclick: function() { overlay.classList.add('hidden'); }
    }));

    overlay.appendChild(menu);
    document.body.appendChild(overlay);

    btn.addEventListener('click', function() {
      overlay.classList.remove('hidden');
    });
    
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  }

  function init() {
    if (!App.storage.isAvailable()) {
      var main = document.getElementById('main');
      if (main) {
        while (main.firstChild) main.removeChild(main.firstChild);
        main.appendChild(el('div', { class: 'card' }, [
          el('h2', { text: 'ไม่สามารถใช้งานพื้นที่จัดเก็บได้' }),
          el('p', { class: 'muted', text: 'เบราว์เซอร์นี้บล็อก localStorage กรุณาเปิดในโหมดปกติหรืออนุญาตการจัดเก็บข้อมูล' })
        ]));
      }
      return;
    }
    App.storage.migrateIfNeeded();
    App.theme.init();
    
    initMenu(); // เรียกใช้ Hamburger Menu

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

  App.recordDaily = recordDaily;
  App.recordTopicScore = recordTopicScore;
  App.recordCause = recordCause;

  App.render = render;
  App.views = App.views || {};

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();