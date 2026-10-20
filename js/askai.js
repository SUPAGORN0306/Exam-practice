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
  // 🔥 PROMPT TEMPLATE (Interactive — AI ถามกลับ)
  // ==========================================
  var PROMPT_TEMPLATE = [
    '[คำแนะนำสำหรับผู้ใช้งาน:',
    '1. ก๊อปปี้ข้อความทั้งหมดนี้ไปวางใน AI (Claude/ChatGPT)',
    '2. AI จะถามคุณกลับมาทีละคำถาม ให้ตอบตามจริง',
    '3. ถ้าคุณมีไฟล์เนื้อหา (PDF, Word, สไลด์) หรือข้อความโน้ต ให้แนบไฟล์หรือวางข้อความให้ AI ตอนที่มันถามหา',
    '4. พอตอบครบ AI จะสร้างข้อสอบเป็น JSON ให้ ก๊อปปี้ไปเซฟเป็น .json แล้วเอาไปนำเข้าในแอป]',
    '',
    '---',
    '',
    'คุณคือผู้เชี่ยวชาญด้านการออกข้อสอบ (Assessment Designer) ที่มีหน้าที่สร้างข้อสอบปรนัยคุณภาพสูง',
    'ฉันต้องการให้คุณช่วยสร้างข้อสอบชุดใหม่ แต่ก่อนที่คุณจะเริ่มสร้าง ฉันอยากให้คุณสอบถามข้อมูลที่จำเป็นจากฉันทีละข้อ (ถามกลับมาเป็นข้อ ๆ เพื่อให้ฉันตอบได้ง่าย)',
    '',
    '== ข้อมูลที่คุณต้องถามฉัน ==',
    '1. วิชา: ต้องการออกข้อสอบวิชาอะไร? (เลือกได้ 1 อย่าง: data-engineering, marketing-innovation, feature-engineering, ai-digital-essentials)',
    '2. บทเรียน: ต้องการออกข้อสอบในบทไหน?',
    '3. จำนวนข้อ: ต้องการกี่ข้อ?',
    '4. ระดับความยาก: 1 (ง่าย), 2 (ปานกลาง), หรือ 3 (ยาก)?',
    '5. เนื้อหาอ้างอิง: ให้ฉันวางโน้ต สไลด์ เนื้อหา หรือแนบไฟล์ (PDF, Word, รูปภาพ) ที่ต้องการให้ออกข้อสอบ',
    '',
    '== กติกาการสร้างข้อสอบ (เมื่อได้ข้อมูลครบแล้ว) ==',
    '1. ตอบเป็น JSON Array เท่านั้น ห้ามมีข้อความเกริ่นนำหรือปิดท้าย (ห้ามมี ```json ครอบ)',
    '2. แต่ละข้อต้องมีฟิลด์: id, subject, topic, question, choices (4 ข้อ), answer (index), explanation, whyWrong (array 4 ช่อง), difficulty',
    '3. id ต้องตั้งให้ไม่ซ้ำ (ใช้รหัสวิชา-เลขลำดับ เช่น de-006, de-007)',
    '4. ตัวเลือกที่ผิด (Distractors) ต้องดูสมเหตุสมผล สะท้อน misconception (ไม่ใช่ผิดแบบชัดเจนจนเกินไป)',
    '5. explanation: อธิบายว่าทำไมคำตอบนั้นถูก โดยอ้างอิงหลักการหรือเหตุผล',
    '6. whyWrong: อธิบายว่าทำไมตัวเลือกอื่นถึงผิด (ช่องของตัวเลือกที่ถูกต้องให้ใส่ null)',
    '7. ต้องมีคำตอบที่ถูกต้องเพียง 1 ข้อเท่านั้น',
    '8. หลีกเลี่ยงคำถามที่ตอบได้ด้วยการเดา หรือใช้ความรู้ทั่วไปโดยไม่ต้องอ่านเนื้อหา',
    '',
    '== Schema (โครงสร้าง JSON ที่จะตอบกลับมา) ==',
    '[',
    '  {',
    '    "id": "string",',
    '    "subject": "string",',
    '    "topic": "string",',
    '    "question": "string",',
    '    "choices": ["string", "string", "string", "string"],',
    '    "answer": 0,',
    '    "explanation": "string",',
    '    "whyWrong": [null, "string", "string", "string"],',
    '    "difficulty": 1',
    '  }',
    ']',
    '',
    '== สิ่งที่คุณต้องทำตอนนี้ ==',
    'กรุณาถามฉันทีละข้อ (1-5) ตามรายการด้านบน และรอให้ฉันตอบก่อน แล้วค่อยถามข้อถัดไป',
    'เมื่อได้ข้อมูลครบแล้ว ให้สร้างข้อสอบตาม Schema ด้านบนทันที (ไม่ต้องถามซ้ำ)'
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