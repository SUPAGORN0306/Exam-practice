/* Ask AI — round 4: chat panel + direct Anthropic API */
(function () {
  window.App = window.App || {};

  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  function letter(i) { return LETTERS[i] || String(i + 1); }

  function buildAskAIText(q, choiceOrder, chosen, confidence) {
    var lines = [];
    lines.push('ช่วยอธิบายข้อสอบข้อนี้ให้เข้าใจง่าย ๆ');
    lines.push('วิชา: ' + App.subjectName(q.subject));
    lines.push('บท: ' + q.topic);
    lines.push('');
    lines.push('โจทย์: ' + q.question);
    lines.push('');
    lines.push('ตัวเลือก:');
    
    // 🔥 fallback ถ้า choiceOrder ไม่มี
    var order = choiceOrder || q.choices.map(function (_, i) { return i; });
    order.forEach(function (origIdx, displayIdx) {
      lines.push(letter(displayIdx) + '. ' + q.choices[origIdx]);
    });
    
    lines.push('');
    if (typeof chosen === 'number' && chosen >= 0) {
      var displayChosen = order.indexOf(chosen);
      lines.push('คำตอบที่ฉันเลือก: ' + letter(displayChosen) + '. ' + q.choices[chosen] +
        ' (ความมั่นใจ: ' + ({ sure: 'มั่นใจ', unsure: 'ไม่แน่ใจ', guess: 'เดา' }[confidence] || '-') + ')');
    }
    var displayAnswer = order.indexOf(q.answer);
    lines.push('เฉลยที่ถูกต้อง: ' + letter(displayAnswer) + '. ' + q.choices[q.answer]);
    lines.push('คำอธิบายเดิมของฉัน: ' + q.explanation);
    lines.push('');
    lines.push('สิ่งที่ฉันอยากรู้เพิ่ม: ');
    return lines.join('\n');
  }

  // ==========================================
  // 🔥 PROMPT TEMPLATE (สำหรับสร้างข้อสอบใหม่)
  // ==========================================
  var PROMPT_TEMPLATE = [
    'คุณคือผู้เชี่ยวชาญด้านการออกข้อสอบ (Assessment Designer)',
    '',
    '== ข้อมูลนำเข้า ==',
    'วิชา: [ระบุรหัสวิชา: data-engineering | marketing-innovation | feature-engineering | ai-digital-essentials]',
    'บทเรียน: [ระบุชื่อบท]',
    'จำนวนข้อ: [ระบุจำนวน เช่น 10]',
    'ระดับความยาก: [1 = ง่าย, 2 = ปานกลาง, 3 = ยาก]',
    '',
    '== เนื้อหาอ้างอิง ==',
    '[วางโน้ต สไลด์ หรือเนื้อหาที่ต้องการให้ออกข้อสอบตรงนี้]',
    '',
    '== กติกาการสร้างข้อสอบ (สำคัญมาก) ==',
    '1. ตอบเป็น JSON Array เท่านั้น ห้ามมีข้อความเกริ่นนำหรือปิดท้าย',
    '2. แต่ละข้อต้องมีฟิลด์ครบ: subject, topic, question, choices (4 ตัวเลือก), answer (index 0-3), explanation, whyWrong (array 4 ช่อง), difficulty',
    '3. ตัวเลือกที่ผิด (Distractors): ต้องดูสมเหตุสมผล และสะท้อน misconception หรือความเข้าใจผิดที่พบบ่อย',
    '4. คำอธิบาย (explanation): ต้องอธิบายว่าทำไมคำตอบนั้นถูก โดยอ้างอิงหลักการหรือเหตุผล',
    '5. whyWrong: ต้องอธิบายว่าทำไมตัวเลือกอื่นถึงผิด (ถ้าเป็นตัวเลือกที่ถูกให้ใส่ null)',
    '6. หลีกเลี่ยงคำถามที่ตอบได้ด้วยการเดา หรือใช้ความรู้ทั่วไปโดยไม่ต้องอ่านเนื้อหา',
    '7. ต้องมีคำตอบที่ถูกต้องเพียง 1 ข้อเท่านั้น',
    '8. ห้ามใช้รูปภาพ โค้ดยาวๆ หรือตาราง ให้ใช้ข้อความล้วน',
    '',
    '== เริ่มสร้างข้อสอบตามเนื้อหาข้างต้น =='
  ].join('\n');

  function copyText(text) {
    return new Promise(function (resolve, reject) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve, function () { fallbackCopy(text, resolve, reject); });
      } else { fallbackCopy(text, resolve, reject); }
    });
  }
  function fallbackCopy(text, resolve, reject) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    } catch (e) { reject(e); }
  }

  // ---------- Anthropic API client ----------
  var API_URL = 'https://api.anthropic.com/v1/messages';
  var API_VERSION = '2023-06-01';

  function getApiKey() { return App.storage.get('apiKey', ''); }
  function setApiKey(k) { return App.storage.set('apiKey', k); }
  
  function getModel() {
    var s = App.storage.getSettings();
    // 🔥 แก้ชื่อโมเดลให้ถูกต้อง
    return s.aiModel || 'claude-3-5-haiku-20241022';
  }
  function setModel(m) {
    var s = App.storage.getSettings();
    s.aiModel = m;
    App.storage.setSettings(s);
  }

  function buildContextMessages(q, choiceOrder, chosen, confidence, userPrompt) {
    var ctx = [];
    ctx.push('บริบทข้อสอบ:');
    ctx.push('วิชา: ' + App.subjectName(q.subject));
    ctx.push('บท: ' + q.topic);
    ctx.push('');
    ctx.push('โจทย์: ' + q.question);
    ctx.push('');
    ctx.push('ตัวเลือก:');
    
    // 🔥 fallback ถ้า choiceOrder ไม่มี
    var order = choiceOrder || q.choices.map(function (_, i) { return i; });
    order.forEach(function (origIdx, displayIdx) {
      ctx.push(letter(displayIdx) + '. ' + q.choices[origIdx]);
    });
    
    if (typeof chosen === 'number' && chosen >= 0) {
      var displayChosen = order.indexOf(chosen);
      ctx.push('คำตอบที่ผู้ใช้เลือก: ' + letter(displayChosen) + '. ' + q.choices[chosen] +
        ' (ความมั่นใจ: ' + ({ sure: 'มั่นใจ', unsure: 'ไม่แน่ใจ', guess: 'เดา' }[confidence] || '-') + ')');
    }
    var displayAnswer = order.indexOf(q.answer);
    ctx.push('เฉลย: ' + letter(displayAnswer) + '. ' + q.choices[q.answer]);
    ctx.push('คำอธิบายเดิม: ' + q.explanation);
    ctx.push('');
    ctx.push('คำถาม: ' + userPrompt);

    return [{ role: 'user', content: ctx.join('\n') }];
  }

  var HINT_SYSTEM = 'คุณเป็นติวเตอร์ที่ช่วยให้แนวคิดโดยไม่บอกคำตอบที่ถูกต้อง ห้ามบอกเฉลยหรือชี้ตัวเลือกที่ถูกโดยตรง ให้คำใบ้ที่นำไปสู่การคิดวิเคราะห์เอง';

  function callAnthropic(messages, systemPrompt) {
    return new Promise(function (resolve, reject) {
      var key = getApiKey();
      if (!key) { reject(new Error('NO_KEY')); return; }

      var body = {
        model: getModel(),
        max_tokens: 2048,
        messages: messages
      };
      if (systemPrompt) body.system = systemPrompt;

      fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var errType = data.error && data.error.type;
            var errMsg = data.error && data.error.message;
            if (errType === 'authentication_error') reject(new Error('BAD_KEY'));
            else if (errType === 'rate_limit_error') reject(new Error('RATE_LIMIT'));
            else if (errType === 'insufficient_quota') reject(new Error('NO_QUOTA'));
            else reject(new Error(errMsg || 'API_ERROR'));
            return;
          }
          var text = '';
          (data.content || []).forEach(function (block) {
            if (block.type === 'text') text += block.text;
          });
          resolve(text);
        });
      }).catch(function () {
        reject(new Error('NETWORK'));
      });
    });
  }

  // ==========================================
  // 🔥 QUICK PROMPTS (สำหรับปุ่มลัดในหน้าแชท)
  // ==========================================
  var QUICK_PROMPTS = {
    explain: 'ช่วยอธิบายโจทย์ข้อนี้ให้เข้าใจง่ายขึ้น โดยไม่ต้องบอกเฉลยตรงๆ ให้คำใบ้ที่นำไปสู่การคิดวิเคราะห์เอง',
    whyWrong: 'ทำไมตัวเลือกที่ฉันเลือกถึงผิด และตัวเลือกที่ถูกต้องต่างกันอย่างไร อธิบายหลักการที่เกี่ยวข้องด้วย',
    example: 'ยกตัวอย่างในชีวิตจริงหรือกรณีศึกษาที่ช่วยให้เข้าใจแนวคิดของข้อนี้ได้ชัดเจนขึ้น',
    newQuestion: 'ช่วยออกข้อสอบใหม่ 1 ข้อในแนวเดียวกัน (หัวข้อเดียวกัน) ระดับความยากเท่ากัน โดยใช้รูปแบบ JSON ตาม schema ของข้อสอบ (subject, topic, question, choices, answer, explanation, whyWrong, difficulty) ตอบเป็น JSON Array เท่านั้น'
  };

  App.askai = {
    LETTERS: LETTERS,
    letter: letter,
    buildAskAIText: buildAskAIText,
    PROMPT_TEMPLATE: PROMPT_TEMPLATE,
    copyText: copyText,

    getApiKey: getApiKey,
    setApiKey: setApiKey,
    getModel: getModel,
    setModel: setModel,
    buildContextMessages: buildContextMessages,
    HINT_SYSTEM: HINT_SYSTEM,
    callAnthropic: callAnthropic,
    QUICK_PROMPTS: QUICK_PROMPTS
  };
})();