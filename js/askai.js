/* Ask AI text builders */
(function () {
  window.App = window.App || {};

  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];

  function letter(i) { return LETTERS[i] || String(i + 1); }

  // Build the "ask AI" copy text from a question + answer record + display order
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
      lines.push(
        'คำตอบที่ฉันเลือก: ' +
          letter(displayChosen) +
          '. ' +
          q.choices[chosen] +
          ' (ความมั่นใจ: ' +
          ({ sure: 'มั่นใจ', unsure: 'ไม่แน่ใจ', guess: 'เดา' }[confidence] || '-') +
          ')'
      );
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
    '- ตัวเลือกผิดต้องฟังดูสมเหตุสมผล สะท้อนความเข้าใจผิดที่พบบ่อย ไม่ใช่ตัวเลือกที่ผิดชัดเจนจนตัดทิ้งได้',
    '- ไม่มีโค้ดหรือรูปในโจทย์ ใช้ข้อความล้วน',
    '- ตอบถูกได้ข้อเดียวเท่านั้น',
    '- เนื้อหาต้องอ้างอิงจากเนื้อหาที่ให้เท่านั้น ถ้าเนื้อหาไม่พอให้ทำน้อยลงและบอกว่าเพราะอะไร',
    '',
    'เนื้อหา:',
    '[วางโน้ตหรือสไลด์ที่นี่]'
  ].join('\n');

  // Copy helper with fallback
  function copyText(text) {
    return new Promise(function (resolve, reject) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve, function () {
          fallbackCopy(text, resolve, reject);
        });
      } else {
        fallbackCopy(text, resolve, reject);
      }
    });
  }

  function fallbackCopy(text, resolve, reject) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    } catch (e) {
      reject(e);
    }
  }

  App.askai = {
    LETTERS: LETTERS,
    letter: letter,
    buildAskAIText: buildAskAIText,
    PROMPT_TEMPLATE: PROMPT_TEMPLATE,
    copyText: copyText
  };
})();