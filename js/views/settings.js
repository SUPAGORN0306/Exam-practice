/* Settings view — Modern UI with grouped sections */
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
      if (patch.theme) App.theme.apply(cur.theme);
    }

    // ==========================================
    // 1. การแสดงผล (Theme + Language)
    // ==========================================
    var themeSelect = el('select', { class: 'select' });
    [{ v: 'light', t: 'สว่าง' }, { v: 'dark', t: 'มืด' }, { v: 'system', t: 'ตามเครื่อง' }].forEach(function (o) {
      var opt = el('option', { value: o.v, text: o.t });
      if (s.theme === o.v) opt.selected = true;
      themeSelect.appendChild(opt);
    });
    themeSelect.addEventListener('change', function () { update({ theme: themeSelect.value }); });

    var langSelect = el('select', { class: 'select' });
    [{ v: 'th', t: 'ไทย' }, { v: 'en', t: 'English (เร็วๆ นี้)' }].forEach(function (o) {
      var opt = el('option', { value: o.v, text: o.t });
      if ((s.language || 'th') === o.v) opt.selected = true;
      langSelect.appendChild(opt);
    });
    langSelect.addEventListener('change', function () {
      update({ language: langSelect.value });
      App.toast('บันทึกภาษาแล้ว (ระบบแปลจะมาเร็วๆ นี้)');
    });

    root.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'การแสดงผล' }),
      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'ธีม' }),
        themeSelect
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'ภาษา' }),
        langSelect,
        el('div', { class: 'hint', text: 'ระบบแปลทั้งแอปจะมาในเวอร์ชันถัดไป' })
      ])
    ]));

    // ==========================================
    // 2. การฝึกฝน (Shuffle, Timer, Goal, Size, Answer Mode)
    // ==========================================

    // 🔥 Toggle Switch (แก้บั๊ก: ดึงค่าล่าสุดจาก storage ทุกครั้ง)
    var shuffleToggle = el('div', {
      style: 'display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0; cursor:pointer;',
      onclick: function () {
        var current = App.storage.getSettings();
        var newVal = !current.shuffleChoices;
        update({ shuffleChoices: newVal });
        
        // อัปเดต UI ทันที
        if (newVal) {
          shuffleKnob.style.transform = 'translateX(20px)';
          shuffleTrack.style.background = 'var(--primary)';
        } else {
          shuffleKnob.style.transform = 'translateX(0)';
          shuffleTrack.style.background = 'var(--border)';
        }
      }
    });

    var shuffleTrack = el('div', {
      style: 'width:44px; height:24px; border-radius:999px; background:' + (s.shuffleChoices ? 'var(--primary)' : 'var(--border)') + '; position:relative; transition:background 0.2s ease; flex-shrink:0;'
    });

    var shuffleKnob = el('div', {
      style: 'width:20px; height:20px; border-radius:50%; background:#fff; position:absolute; top:2px; left:2px; transition:transform 0.2s ease; box-shadow:0 1px 3px rgba(0,0,0,0.2); transform:' + (s.shuffleChoices ? 'translateX(20px)' : 'translateX(0)') + ';'
    });

    shuffleTrack.appendChild(shuffleKnob);

    shuffleToggle.appendChild(el('div', null, [
      el('div', { style: 'font-weight:600; font-size:0.95rem;', text: 'สลับลำดับตัวเลือก' }),
      el('div', { class: 'small muted', style: 'margin-top:2px;', text: 'สุ่มลำดับ ก ข ค ง ในข้อสอบ' })
    ]));
    shuffleToggle.appendChild(shuffleTrack);

    // Timer
    var timerSelect = el('select', { class: 'select' });
    [{ v: 'untimed', t: 'ไม่จำกัดเวลา' }, { v: 'timed', t: 'ตั้งเวลาต่อชุด' }].forEach(function (o) {
      var opt = el('option', { value: o.v, text: o.t });
      if (s.timerMode === o.v) opt.selected = true;
      timerSelect.appendChild(opt);
    });

    var secInput = el('input', { class: 'input', type: 'number', min: '5', max: '600' });
    secInput.value = String(s.secondsPerQuestion || 60);
    secInput.addEventListener('change', function () {
      var v = parseInt(secInput.value, 10);
      if (isNaN(v) || v < 5) v = 60;
      update({ secondsPerQuestion: v });
    });

    var secField = el('div', { class: 'field' }, [
      el('span', { class: 'label', text: 'วินาทีต่อข้อ' }),
      secInput,
      el('div', { class: 'hint', text: 'ใช้เมื่อเลือก "ตั้งเวลาต่อชุด"' })
    ]);
    secField.style.display = (s.timerMode === 'timed') ? 'block' : 'none';

    timerSelect.addEventListener('change', function () {
      update({ timerMode: timerSelect.value });
      secField.style.display = (timerSelect.value === 'timed') ? 'block' : 'none';
    });

    var goalInput = el('input', { class: 'input', type: 'number', min: '5', max: '200' });
    goalInput.value = String(s.dailyGoal || 20);
    goalInput.addEventListener('change', function () {
      var v = parseInt(goalInput.value, 10);
      if (isNaN(v) || v < 5) v = 20;
      update({ dailyGoal: v });
    });

    var sizeSelect = el('select', { class: 'select' });
    [10, 20, 30, 45, 60, 80, 90].forEach(function (n) {
      var opt = el('option', { value: String(n), text: n + ' ข้อ' });
      if (String(s.defaultSessionSize) === String(n)) opt.selected = true;
      sizeSelect.appendChild(opt);
    });
    sizeSelect.addEventListener('change', function () { update({ defaultSessionSize: parseInt(sizeSelect.value, 10) }); });

    // รูปแบบการตอบ
    var answerMode = localStorage.getItem('answerMode') || 'button';
    var answerModeSelect = el('select', { class: 'select' });
    [{ v: 'button', t: 'กดปุ่ม (ทีละข้อ)' }, { v: 'scroll', t: 'เลื่อนลง (กระดาษคำตอบ)' }].forEach(function (o) {
      var opt = el('option', { value: o.v, text: o.t });
      if (answerMode === o.v) opt.selected = true;
      answerModeSelect.appendChild(opt);
    });
    answerModeSelect.addEventListener('change', function () {
      localStorage.setItem('answerMode', answerModeSelect.value);
      App.toast('บันทึกรูปแบบการตอบแล้ว');
    });

    root.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'การฝึกฝน' }),
      shuffleToggle,
      el('div', { class: 'field', style: 'margin-top:16px;' }, [
        el('span', { class: 'label', text: 'รูปแบบการตอบ' }),
        answerModeSelect,
        el('div', { class: 'hint', text: 'แบบกดปุ่ม = ทำทีละข้อ, แบบเลื่อนลง = แสดงทุกข้อในหน้ายาว' })
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'การจับเวลา' }),
        timerSelect
      ]),
      secField,
      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'เป้าหมายรายวัน (ข้อ)' }),
        goalInput
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'จำนวนข้อเริ่มต้นต่อชุด' }),
        sizeSelect
      ])
    ]));

    // ==========================================
    // 3. AI Settings
    // ==========================================
    var apiKey = App.askai.getApiKey();
    var keyInput = el('input', { class: 'input', type: 'password', placeholder: 'วาง API Key ที่นี่' });
    keyInput.value = apiKey || '';
    
    var modelInput = el('input', { class: 'input', placeholder: 'claude-3-5-haiku-20241022' });
    modelInput.value = App.askai.getModel();

    var saveKeyBtn = el('button', {
      class: 'btn btn-primary', text: 'บันทึก Key',
      onclick: function () {
        App.askai.setApiKey(keyInput.value.trim());
        App.askai.setModel(modelInput.value.trim() || 'claude-3-5-haiku-20241022');
        App.toast('บันทึกการตั้งค่า AI แล้ว');
        App.render();
      }
    });
    var clearKeyBtn = el('button', {
      class: 'btn', text: 'ลบ Key',
      onclick: function () {
        if (!App.confirm('ลบ API Key ออกจากเครื่องนี้หรือไม่?')) return;
        App.askai.setApiKey('');
        keyInput.value = '';
        App.toast('ลบ API Key แล้ว');
        App.render();
      }
    });

    root.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'AI (Anthropic API)' }),
      el('div', { class: 'banner warn', style: 'margin-bottom:16px;' }, [
        el('div', { class: 'icon', text: '!' }),
        el('div', null, [
          el('strong', { text: 'คำเตือน' }),
          el('p', { class: 'small', style: 'margin:4px 0 0;', text: 'API คิดเงินตามการใช้งานแยกจากแอป Claude, Key อยู่ในเครื่องนี้เท่านั้น, แนะนำให้ตั้งวงเงินสูงสุดใน Console' })
        ])
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'API Key' }),
        keyInput,
        el('div', { class: 'hint', text: 'เก็บใน localStorage ของเบราว์เซอร์นี้เท่านั้น ไม่ถูกส่งไปที่อื่นนอกจาก api.anthropic.com' })
      ]),
      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'ชื่อโมเดล' }),
        modelInput,
        el('div', { class: 'hint', text: 'ค่าเริ่มต้น claude-3-5-haiku-20241022' })
      ]),
      el('div', { class: 'row' }, [saveKeyBtn, clearKeyBtn])
    ]));

    // ==========================================
    // 4. ข้อมูล (Data Management) - แยกการ์ด
    // ==========================================

    root.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'สำรองข้อมูล' }),
      el('p', { class: 'small muted', style: 'margin:8px 0 12px;', text: 'ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON หรือกู้คืนจากไฟล์สำรอง' }),
      el('button', {
        class: 'btn btn-primary btn-block',
        text: 'ไปหน้าสำรอง/กู้คืน',
        onclick: function () { window.location.hash = '#/manage?tab=import'; }
      })
    ]));

    root.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'รีเซ็ตความคืบหน้า' }),
      el('p', { class: 'small muted', style: 'margin:8px 0 12px;', text: 'ล้างสถิติการเรียน, กล่อง Leitner, และวันที่ทบทวนทั้งหมด (ข้อสอบยังอยู่)' }),
      el('button', {
        class: 'btn btn-danger btn-block',
        text: 'รีเซ็ตความคืบหน้า',
        onclick: function () {
          if (!App.confirm('ยืนยันการรีเซ็ตความคืบหน้า?\n\nข้อสอบจะยังอยู่ แต่สถิติและ Leitner จะหายหมด')) return;
          App.storage.setProgress({});
          App.storage.setSessions([]);
          App.storage.setCauses({});
          App.storage.setDaily({});
          App.storage.setTopicRecent({});
          App.storage.setActiveSession(null);
          App.toast('รีเซ็ตความคืบหน้าแล้ว');
          App.render();
        }
      })
    ]));

    root.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'ลบข้อมูลทั้งหมด' }),
      el('p', { class: 'small muted', style: 'margin:8px 0 12px;', text: 'ลบทุกอย่างในแอป (ข้อสอบ, สถิติ, การตั้งค่า) ไม่สามารถกู้คืนได้' }),
      el('button', {
        class: 'btn btn-danger btn-block',
        text: 'ลบข้อมูลทั้งหมด',
        onclick: function () {
          if (!App.confirm('ยืนยันการลบข้อมูลทั้งหมด?\n\nข้อสอบ, สถิติ, การตั้งค่าจะหายหมด และกู้คืนไม่ได้')) return;
          App.storage.clearAll();
          App.toast('ลบข้อมูลทั้งหมดแล้ว');
          App.navigate('home');
        }
      })
    ]));

    root.appendChild(el('div', { class: 'card center' }, [
      el('p', { class: 'small muted', text: 'ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น มือถือกับคอมไม่ซิงก์กัน — ย้ายด้วยไฟล์สำรอง' })
    ]));

    // ==========================================
    // 5. Version
    // ==========================================
    root.appendChild(el('div', { class: 'card center' }, [
      el('p', { class: 'small muted', text: 'Smart Practice v0.4.0' })
    ]));
  };
})();