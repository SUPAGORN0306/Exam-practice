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
    choiceOrder.forEach(function (origIdx, displayIdx) {
      lines.push(letter(displayIdx) + '. ' + q.choices[origIdx]);
    });
    lines.push('');
    if (typeof chosen === 'number' && chosen >= 0) {
      var displayChosen = choiceOrder.indexOf(chosen);
      lines.push('คำตอบที่ฉันเลือก: ' + letter(displayChosen) + '. ' + q.choices[chosen] +
        ' (ความมั่นใจ: ' + ({ sure: 'มั่นใจ', unsure: 'ไม่แน่ใจ', guess: 'เดา' }[confidence] || '-') + ')');
    }
    var displayAnswer = choiceOrder.indexOf(q.answer);
    lines.push('เฉลยที่ถูกต้อง: ' + letter(displayAnswer) + '. ' + q.choices[q.answer]);
    lines.push('คำอธิบายเดิมของฉัน: ' + q.explanation);
    lines.push('');
    lines.push('สิ่งที่ฉันอยากรู้เพิ่ม: ');
    return lines.join('\n');
  }

  var PROMPT_TEMPLATE = [
    'ช่วยร่างข้อสอบปรนัยจากเนื้อหาด้านล่าง',
    'วิชา (ใช้ค่านี้ในฟิลด์ subject): [data-engineering | marketing-innovation | feature-engineering | ai-digital-essentials]',
    'บท: [ชื่อบท]',
    'จำนวน: [10] ข้อ',
    'ระดับความยาก: [1-3]',
    '',
    'กติกา:',
    '- ตอบเป็น JSON อาร์เรย์เท่านั้น ห้ามมีข้อความอื่นนอก JSON',
    '- แต่ละข้อมีฟิลด์: subject, topic, question, choices (4 ข้อ), answer (เลขตำแหน่งที่ถูก เริ่มที่ 0), explanation, whyWrong (อาร์เรย์ยาว 4 ช่อง ช่องของข้อที่ถูกเป็น null), difficulty',
    '- ตัวเลือกผิดต้องฟังดูสมเหตุสมผล สะท้อนความเข้าใจผิดที่พบบ่อย',
    '- ไม่มีโค้ดหรือรูปในโจทย์ ใช้ข้อความล้วน',
    '- ตอบถูกได้ข้อเดียวเท่านั้น',
    '- เนื้อหาต้องอ้างอิงจากเนื้อหาที่ให้เท่านั้น',
    '',
    'เนื้อหา:',
    '[วางโน้ตหรือสไลด์ที่นี่]'
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
    return s.aiModel || 'claude-haiku-5-5';
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
    choiceOrder.forEach(function (origIdx, displayIdx) {
      ctx.push(letter(displayIdx) + '. ' + q.choices[origIdx]);
    });
    if (typeof chosen === 'number' && chosen >= 0) {
      var displayChosen = choiceOrder.indexOf(chosen);
      ctx.push('คำตอบที่ผู้ใช้เลือก: ' + letter(displayChosen) + '. ' + q.choices[chosen] +
        ' (ความมั่นใจ: ' + ({ sure: 'มั่นใจ', unsure: 'ไม่แน่ใจ', guess: 'เดา' }[confidence] || '-') + ')');
    }
    var displayAnswer = choiceOrder.indexOf(q.answer);
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

  var QUICK_PROMPTS = {
    explain: 'อธิบายข้อนี้ให้เข้าใจง่ายขึ้น โดยไม่ต้องบอกเฉลยตรง ๆ',
    whyWrong: 'ทำไมตัวเลือกที่ฉันเลือกถึงผิด และตัวเลือกที่ถูกต้องต่างกันอย่างไร',
    example: 'ยกตัวอย่างจริงที่ช่วยให้เข้าใจแนวคิดของข้อนี้',
    newQuestion: 'ออกข้อใหม่แนวเดียวกันกับข้อนี้ 1 ข้อ ในรูปแบบ JSON ตาม schema ของข้อสอบ (subject, topic, question, choices, answer, explanation, whyWrong, difficulty) ตอบเป็น JSON อาร์เรย์เท่านั้น'
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