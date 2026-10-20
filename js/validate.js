/* Question validation — pure logic, no DOM */
(function () {
  window.App = window.App || {};

  function isNonEmptyString(s) {
    return typeof s === 'string' && s.trim().length > 0;
  }

  // Validate one question. Returns array of {field, message} (empty = OK).
  function validateQuestion(q, opts) {
    opts = opts || {};
    var errors = [];

    if (!q || typeof q !== 'object') {
      errors.push({ field: '_', message: 'ข้อสอบต้องเป็นออบเจกต์' });
      return errors;
    }

    // Subject
    if (!isNonEmptyString(q.subject)) {
      errors.push({ field: 'subject', message: 'ต้องระบุวิชา' });
    } else if (window.App && App.subjectById && !App.subjectById(q.subject)) {
      errors.push({ field: 'subject', message: 'ไม่พบวิชา "' + q.subject + '" ในรายการวิชา' });
    }

    if (!isNonEmptyString(q.topic)) {
      errors.push({ field: 'topic', message: 'ต้องระบุชื่อบท' });
    }
    if (!isNonEmptyString(q.question)) {
      errors.push({ field: 'question', message: 'ต้องระบุโจทย์' });
    }

    if (!Array.isArray(q.choices)) {
      errors.push({ field: 'choices', message: 'ตัวเลือกต้องเป็นอาร์เรย์' });
    } else {
      if (q.choices.length < 2 || q.choices.length > 6) {
        errors.push({ field: 'choices', message: 'ตัวเลือกต้องมี 2 ถึง 6 ข้อ' });
      }
      var seen = {};
      q.choices.forEach(function (c, i) {
        if (!isNonEmptyString(c)) {
          errors.push({ field: 'choices[' + i + ']', message: 'ตัวเลือกที่ ' + (i + 1) + ' ว่าง' });
        } else if (seen[c.trim()]) {
          errors.push({ field: 'choices[' + i + ']', message: 'ตัวเลือกซ้ำ' });
        } else {
          seen[c.trim()] = true;
        }
      });
    }

    if (typeof q.answer !== 'number' || !Number.isInteger(q.answer)) {
      errors.push({ field: 'answer', message: 'ต้องระบุคำตอบที่ถูกเป็นตัวเลข' });
    } else if (Array.isArray(q.choices) && (q.answer < 0 || q.answer >= q.choices.length)) {
      errors.push({ field: 'answer', message: 'ตำแหน่งคำตอบไม่ถูกต้อง' });
    }

    if (!isNonEmptyString(q.explanation)) {
      errors.push({ field: 'explanation', message: 'ต้องระบุคำอธิบาย' });
    }

    if (q.whyWrong != null) {
      if (!Array.isArray(q.whyWrong)) {
        errors.push({ field: 'whyWrong', message: 'whyWrong ต้องเป็นอาร์เรย์' });
      } else if (Array.isArray(q.choices) && q.whyWrong.length !== q.choices.length) {
        errors.push({ field: 'whyWrong', message: 'whyWrong ต้องยาวเท่าจำนวนตัวเลือก' });
      } else if (q.whyWrong[q.answer] !== null) {
        errors.push({ field: 'whyWrong', message: 'ช่องของคำตอบที่ถูกต้องต้องเป็น null' });
      }
    }

    if (q.difficulty != null) {
      if (![1, 2, 3].includes(q.difficulty)) {
        errors.push({ field: 'difficulty', message: 'ระดับความยากต้องเป็น 1, 2 หรือ 3' });
      }
    }

    return errors;
  }

  // Normalize question before saving — fills defaults, keeps identity
  function normalizeQuestion(q, existingIds) {
    var out = {
      subject: q.subject,
      topic: q.topic,
      question: q.question,
      choices: q.choices.slice(),
      answer: q.answer,
      explanation: q.explanation
    };
    if (q.whyWrong != null) out.whyWrong = q.whyWrong.slice();
    if (q.difficulty != null) out.difficulty = q.difficulty;
    if (q.noShuffle) out.noShuffle = true;
    if (q.sample) out.sample = true;
    if (isNonEmptyString(q.id)) out.id = q.id.trim();
    return out;
  }

  // Validate a whole imported array. Returns {valid, invalid}
  function validateImportArray(arr) {
    var valid = [];
    var invalid = [];
    if (!Array.isArray(arr)) {
      return { valid: valid, invalid: [{ index: -1, message: 'ไฟล์ต้องเป็นอาร์เรย์ของข้อสอบ' }] };
    }
    arr.forEach(function (q, i) {
      var errs = validateQuestion(q);
      if (errs.length === 0) valid.push(q);
      else invalid.push({ index: i, errors: errs });
    });
    return { valid: valid, invalid: invalid };
  }

  App.validate = {
    validateQuestion: validateQuestion,
    normalizeQuestion: normalizeQuestion,
    validateImportArray: validateImportArray
  };
})();