/* Settings view — theme, shuffle, timer, daily goal, danger zone */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  App.views.settings = function (root) {
    var el = App.el;
    var s = App.storage.getSettings();

    function update(patch) {
      var cur = App.storage.getSettings();
      Object.assign(cur, patch);
      App.storage.setSettings(cur);
      App.theme.apply(cur.theme);
    }

    // Theme
    var themeSelect = el('select', { class: 'select' });
    [{ v: 'light', t: 'สว่าง' }, { v: 'dark', t: 'มืด' }, { v: 'system', t: 'ตามเครื่อง' }].forEach(function (o) {
      var opt = el('option', { value: o.v, text: o.t });
      if (s.theme === o.v) opt.selected = true;
      themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', function () { update({ theme: themeSelect.value }); });

    // Shuffle
    var shuffleCb = el('input', { type: 'checkbox' });
    shuffleCb.checked = !!s.shuffleChoices;
    shuffleCb.addEventListener('change', function () { update({ shuffleChoices: shuffleCb.checked }); });

    // Timer mode
    var timerSelect = el('select', { class: 'select' });
    [{ v: 'untimed', t: 'ไม่จำกัดเวลา' }, { v: 'timed', t: 'ตั้งเวลาต่อชุด' }].forEach(function (o) {
      var opt = el('option', { value: o.v, text: o.t });
      if (s.timerMode === o.v) opt.selected = true;
      timerSelect.appendChild(opt);
    });
    timerSelect.addEventListener('change', function () { update({ timerMode: timerSelect.value }); });

    // Seconds per question
    var secInput = el('input', { class: 'input', type: 'number', min: '5', max: '600' });
    secInput.value = String(s.secondsPerQuestion || 60);
    secInput.addEventListener('change', function () {
      var v = parseInt(secInput.value, 10);
      if (isNaN(v) || v < 5) v = 60;
      update({ secondsPerQuestion: v });
    });

    // Daily goal
    var goalInput = el('input', { class: 'input', type: 'number', min: '5', max: '200' });
    goalInput.value = String(s.dailyGoal || 20);
    goalInput.addEventListener('change', function () {
      var v = parseInt(goalInput.value, 10);
      if (isNaN(v) || v < 5) v = 20;
      update({ dailyGoal: v });
    });

    // Default session size
    var sizeSelect = el('select', { class: 'select' });
    [10, 20, 30].forEach(function (n) {
      var opt = el('option', { value: String(n), text: n + ' ข้อ' });
      if (String(s.defaultSessionSize) === String(n)) opt.selected = true;
      sizeSelect.appendChild(opt);
    });
    sizeSelect.addEventListener('change', function () { update({ defaultSessionSize: parseInt(sizeSelect.value, 10) }); });

    // Danger
    var resetBtn = el('button', { class: 'btn btn-danger', text: 'รีเซ็ตความคืบหน้า (เก็บข้อสอบไว้)', onclick: function () {
      var t = window.prompt('พิมพ์ "ยืนยัน" เพื่อยืนยัน');
      if (t !== 'ยืนยัน') return;
      App.storage.setProgress({});
      App.storage.setSessions([]);
      App.storage.setCauses({});
      App.storage.setDaily({});
      App.storage.setTopicRecent({});
      App.storage.setActiveSession(null);
      App.toast('รีเซ็ตแล้ว');
    }});
    var wipeBtn = el('button', { class: 'btn btn-danger', text: 'ลบข้อมูลทั้งหมด', onclick: function () {
      var t = window.prompt('พิมพ์ "ยืนยัน" เพื่อลบข้อมูลทั้งหมด');
      if (t !== 'ยืนยัน') return;
      App.storage.clearAll();
      App.toast('ลบทั้งหมดแล้ว');
      App.navigate('home');
    }});

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'ตั้งค่า' }),
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'ธีม' }), themeSelect]),
      el('div', { class: 'field' }, [el('label', { class: 'row' }, [shuffleCb, el('span', { text: ' สลับลำดับตัวเลือก' })])]),
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'การจับเวลา' }), timerSelect]),
      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'วินาทีต่อข้อ (เมื่อตั้งเวลา)' }),
        secInput,
        el('div', { class: 'hint', text: 'ค่าเริ่มต้น 60 วินาทีต่อข้อ' })
      ]),
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'เป้าหมายรายวัน (ข้อ)' }), goalInput]),
      el('div', { class: 'field' }, [el('span', { class: 'label', text: 'จำนวนข้อเริ่มต้นต่อชุด' }), sizeSelect]),
      el('p', { class: 'small muted', text: 'ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น มือถือกับคอมไม่ซิงก์กัน — ย้ายด้วยไฟล์สำรอง' })
    ]));

    root.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'เครื่องมือข้อมูล' }),
      el('div', { class: 'stack' }, [
        el('button', { class: 'btn', text: 'ไปหน้าสำรอง/กู้คืน', onclick: function () { window.location.hash = '#/manage?tab=import'; } })
      ])
    ]));

    root.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'เขตอันตราย' }),
      el('div', { class: 'stack' }, [resetBtn, wipeBtn])
    ]));

    root.appendChild(el('div', { class: 'card' }, [
      el('p', { class: 'small muted', text: 'เวอร์ชัน: 0.3.0 (รอบ 3)' })
    ]));
  };
})();