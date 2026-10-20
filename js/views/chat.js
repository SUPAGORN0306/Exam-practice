/* Chat panel — bottom sheet on mobile, sidebar on wide */
(function () {
  window.App = window.App || {};
  App.chat = {};

  var currentQ = null, currentOrder = null, currentAnswer = null;
  var messages = [];
  var usedHint = false;

  function open(q, order, answer) {
    currentQ = q; currentOrder = order; currentAnswer = answer;
    messages = [];
    usedHint = false;
    renderPanel();
  }

  function closePanel() {
    var el = document.querySelector('.chat-overlay');
    if (el) el.remove();
  }

  function renderPanel() {
    closePanel();
    var el = App.el;
    var overlay = el('div', {
      class: 'chat-overlay',
      style: 'position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:60;',
      onclick: function (e) { if (e.target === overlay) closePanel(); }
    });
    var sheet = el('div', {
      style: 'position:fixed; left:0; right:0; bottom:0; background:var(--surface); border-radius:20px 20px 0 0; padding:16px; z-index:61; max-height:85vh; display:flex; flex-direction:column;'
    });

    // Header
    sheet.appendChild(el('div', { class: 'row-between' }, [
      el('h3', { text: 'แชท AI' }),
      el('button', { class: 'icon-btn', text: '✕', onclick: closePanel })
    ]));

    // Quick prompts
    var quickRow = el('div', { class: 'row', style: 'margin-top:8px; flex-wrap:wrap;' });
    [
      { key: 'explain', label: 'อธิบายให้ง่ายขึ้น' },
      { key: 'whyWrong', label: 'ทำไมตัวเลือกนี้ผิด' },
      { key: 'example', label: 'ยกตัวอย่างจริง' },
      { key: 'newQuestion', label: 'ออกข้อใหม่แนวเดียวกัน' }
    ].forEach(function (qp) {
      quickRow.appendChild(el('button', {
        class: 'chip', text: qp.label,
        onclick: function () { sendMessage(App.askai.QUICK_PROMPTS[qp.key], qp.key); }
      }));
    });
    // Hint button
    quickRow.appendChild(el('button', {
      class: 'chip', text: '💡 ใบ้ (ไม่บอกเฉลย)',
      onclick: function () { usedHint = true; sendMessage('ขอคำใบ้โดยไม่บอกคำตอบ', 'hint'); }
    }));
    sheet.appendChild(quickRow);

    // Messages area
    var msgArea = el('div', {
      style: 'flex:1; overflow-y:auto; margin-top:12px; padding:8px; background:var(--bg); border-radius:12px; min-height:120px; max-height:50vh;'
    });
    messages.forEach(function (m) {
      var bubble = el('div', {
        style: 'margin-bottom:8px; padding:8px 12px; border-radius:12px; white-space:pre-wrap; word-break:break-word; ' +
          (m.role === 'user' ? 'background:var(--primary); color:#fff; margin-left:40px;' : 'background:var(--surface); border:1px solid var(--border); margin-right:40px;')
      });
      bubble.textContent = m.text;
      msgArea.appendChild(bubble);
    });
    sheet.appendChild(msgArea);

    // Input
    var inputWrap = el('div', { class: 'row', style: 'margin-top:8px;' });
    var input = el('input', { class: 'input', placeholder: 'พิมพ์คำถาม...', style: 'flex:1;' });
    var sendBtn = el('button', {
      class: 'btn btn-primary', text: 'ส่ง',
      onclick: function () { var t = input.value.trim(); if (t) { input.value = ''; sendMessage(t, 'custom'); } }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendBtn.click(); });
    inputWrap.appendChild(input);
    inputWrap.appendChild(sendBtn);
    sheet.appendChild(inputWrap);

    // Status / error area
    var status = el('div', { class: 'small muted', style: 'margin-top:4px; min-height:20px;' });
    sheet.appendChild(status);

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    function sendMessage(text, type) {
      if (!App.askai.getApiKey()) {
        status.textContent = 'ยังไม่ได้ตั้งค่า API Key — ไปที่ตั้งค่าเพื่อเพิ่ม';
        status.style.color = 'var(--wrong)';
        return;
      }
      messages.push({ role: 'user', text: text });
      renderPanelMessages(msgArea);
      status.textContent = 'กำลังคิด...';
      status.style.color = 'var(--muted)';

      var msgs = App.askai.buildContextMessages(
        currentQ, currentOrder, currentAnswer.chosen, currentAnswer.confidence, text
      );
      var sys = type === 'hint' ? App.askai.HINT_SYSTEM : null;

      App.askai.callAnthropic(msgs, sys).then(function (reply) {
        messages.push({ role: 'assistant', text: reply });
        status.textContent = '';
        renderPanelMessages(msgArea);
        if (type === 'newQuestion') tryOfferAddQuestion(reply, sheet);
      }).catch(function (err) {
        var msg = {
          NO_KEY: 'ยังไม่ได้ตั้งค่า API Key',
          BAD_KEY: 'API Key ไม่ถูกต้อง — ตรวจสอบใน Console',
          RATE_LIMIT: 'เรียกถี่เกินไป กรุณารอสักครู่',
          NO_QUOTA: 'โควตาหมด — ตรวจสอบวงเงินใน Console',
          NETWORK: 'เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ต',
          API_ERROR: 'เกิดข้อผิดพลาดจาก API'
        }[err.message] || ('เกิดข้อผิดพลาด: ' + err.message);
        status.textContent = msg;
        status.style.color = 'var(--wrong)';
        messages.pop();
        renderPanelMessages(msgArea);
      });
    }

    function renderPanelMessages(area) {
      while (area.firstChild) area.removeChild(area.firstChild);
      messages.forEach(function (m) {
        var bubble = el('div', {
          style: 'margin-bottom:8px; padding:8px 12px; border-radius:12px; white-space:pre-wrap; word-break:break-word; ' +
            (m.role === 'user' ? 'background:var(--primary); color:#fff; margin-left:40px;' : 'background:var(--surface); border:1px solid var(--border); margin-right:40px;')
        });
        bubble.textContent = m.text;
        area.appendChild(bubble);
      });
      area.scrollTop = area.scrollHeight;
    }

    function tryOfferAddQuestion(reply, parentSheet) {
      var match = reply.match(/\[[\s\S]*\]/);
      if (!match) return;
      try {
        var arr = JSON.parse(match[0]);
        if (!Array.isArray(arr) || !arr.length) return;
        var q0 = arr[0];
        var errs = App.validate.validateQuestion(q0);
        if (errs.length) return;
        var btn = el('button', {
          class: 'btn btn-primary btn-block', style: 'margin-top:8px;', text: 'เพิ่มข้อนี้เข้าคลัง',
          onclick: function () {
            var all = App.loadQuestions();
            var norm = App.validate.normalizeQuestion(q0, all);
            if (!norm.id) norm.id = App.nextIdFor(norm.subject, all);
            all.push(norm);
            App.saveQuestions(all);
            App.toast('เพิ่มข้อใหม่แล้ว');
            btn.disabled = true;
            btn.textContent = 'เพิ่มแล้ว ✓';
          }
        });
        parentSheet.appendChild(btn);
      } catch (e) { /* ignore */ }
    }
  }

  App.chat = { open: open, close: closePanel };
})();