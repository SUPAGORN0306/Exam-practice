/* Manage view — round 1: list, form, import/export, backup/restore */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  var state = {
    tab: 'list',
    search: '',
    filterSubject: '',
    editId: null
  };

  function parseQuery(q) {
    var out = {};
    (q || '').split('&').forEach(function (pair) {
      if (!pair) return;
      var kv = pair.split('=');
      out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  App.views.manage = function (root, query) {
    var params = parseQuery(query);
    if (params.tab) state.tab = params.tab;
    if (params.edit) {
      state.tab = 'form';
      state.editId = params.edit;
    }

    var el = App.el;
    root.appendChild(
      el('div', { class: 'tabs' }, [
        tabBtn('list', 'รายการ'),
        tabBtn('form', 'เพิ่ม/แก้ไข'),
        tabBtn('import', 'นำเข้า/ส่งออก')
      ])
    );

    function tabBtn(name, label) {
      return el('button', {
        class: 'tab' + (state.tab === name ? ' active' : ''),
        text: label,
        onclick: function () {
          state.tab = name;
          if (name === 'form' && !state.editId) state.editId = null;
          App.render();
        }
      });
    }

    if (state.tab === 'list') renderList(root);
    else if (state.tab === 'form') renderForm(root);
    else renderImport(root);
  };

  // ---------------- LIST ----------------
  function renderList(root) {
    var el = App.el;
    var questions = App.loadQuestions();

    // --- ส่วนที่เพิ่มใหม่: ระบบจัดการบท ---
    var topicsMap = {};
    questions.forEach(function(q) {
      if (!topicsMap[q.topic]) topicsMap[q.topic] = { count: 0, subject: q.subject };
      topicsMap[q.topic].count++;
    });
    var uniqueTopics = Object.keys(topicsMap).sort();

    var topicManageWrap = el('div', { class: 'stack', style: 'margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 16px;' });
    if (uniqueTopics.length > 0) {
      topicManageWrap.appendChild(el('div', { class: 'label', text: 'จัดการบทเรียน' }));
      uniqueTopics.forEach(function(topicName) {
        var row = el('div', { class: 'row-between', style: 'background: var(--bg); padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; align-items: center;' }, [
          el('div', null, [
            el('div', { style: 'font-weight: 600; font-size: 0.95rem;', text: topicName }),
            el('div', { class: 'small muted', text: topicsMap[topicName].count + ' ข้อ' })
          ]),
          el('div', { class: 'row' }, [
            el('button', {
              class: 'btn btn-ghost small', // สมมติว่ามีคลาสนี้ หรือใช้ inline style
              style: 'padding: 4px 8px; font-size: 0.85rem;',
              text: 'เปลี่ยนชื่อ',
              onclick: function() {
                var newName = window.prompt('เปลี่ยนชื่อบท "' + topicName + '" เป็น:', topicName);
                if (newName && newName.trim() !== '' && newName !== topicName) {
                  var all = App.loadQuestions();
                  all.forEach(function(q) {
                    if (q.topic === topicName) q.topic = newName.trim();
                  });
                  App.saveQuestions(all);
                  App.toast('เปลี่ยนชื่อบทแล้ว');
                  App.render();
                }
              }
            }),
            el('button', {
              class: 'btn btn-danger',
              style: 'padding: 4px 8px; font-size: 0.85rem; background: transparent; color: var(--danger); border: 1px solid var(--danger);',
              text: 'ลบทั้งบท',
              onclick: function() {
                if (!App.confirm('ยืนยันการลบข้อสอบทั้งหมด ' + topicsMap[topicName].count + ' ข้อ ในบท "' + topicName + '" หรือไม่?')) return;
                var all = App.loadQuestions();
                var progress = App.storage.getProgress();
                var remaining = [];
                
                all.forEach(function(q) {
                  if (q.topic === topicName) {
                    delete progress[q.id]; // ลบประวัติการทำ
                  } else {
                    remaining.push(q);
                  }
                });
                
                App.saveQuestions(remaining);
                App.storage.setProgress(progress);
                App.toast('ลบบทและข้อมูลที่เกี่ยวข้องแล้ว');
                App.render();
              }
            })
          ])
        ]);
        topicManageWrap.appendChild(row);
      });
    }

    var subjSelect = el('select', { class: 'select' });
    subjSelect.appendChild(el('option', { value: '', text: 'ทุกวิชา' }));
    App.subjects.forEach(function (s) {
      var opt = el('option', { value: s.id, text: s.name });
      if (state.filterSubject === s.id) opt.selected = true;
      subjSelect.appendChild(opt);
    });
    subjSelect.addEventListener('change', function () {
      state.filterSubject = subjSelect.value;
      App.render();
    });

    var searchInput = el('input', { class: 'input', placeholder: 'ค้นหาข้อความ', type: 'search' });
    searchInput.value = state.search;
    searchInput.addEventListener('input', function () {
      state.search = searchInput.value;
      renderItems();
    });

    var itemsWrap = el('div', { style: 'margin-top:12px;' });

    function renderItems() {
      while (itemsWrap.firstChild) itemsWrap.removeChild(itemsWrap.firstChild);
      var list = questions.filter(function (q) {
        if (state.filterSubject && q.subject !== state.filterSubject) return false;
        if (state.search) {
          var s = state.search.trim().toLowerCase();
          if (
            q.question.toLowerCase().indexOf(s) === -1 &&
            q.topic.toLowerCase().indexOf(s) === -1
          ) return false;
        }
        return true;
      });
      if (list.length === 0) {
        itemsWrap.appendChild(el('p', { class: 'empty', text: 'ไม่พบข้อสอบ' }));
        return;
      }
      list.forEach(function (q) {
        var item = el('button', {
          class: 'list-item',
          onclick: function () {
            state.tab = 'form';
            state.editId = q.id;
            App.render();
          }
        });
        var title = el('div', { class: 'title' });
        title.appendChild(document.createTextNode(q.question));
        if (q.sample) title.appendChild(el('span', { class: 'badge', text: 'ตัวอย่าง' }));
        item.appendChild(title);
        item.appendChild(el('div', { class: 'meta', text: App.subjectName(q.subject) + ' • ' + q.topic }));
        itemsWrap.appendChild(item);
      });
    }
    renderItems();

    root.appendChild(
      el('div', { class: 'card' }, [
        el('div', { class: 'stack' }, [searchInput, subjSelect]),
        el('div', { class: 'row-between', style: 'margin-top:8px;' }, [
          el('span', { class: 'muted small', text: 'ทั้งหมด ' + questions.length + ' ข้อ' }),
          el('div', { class: 'row' }, [
            el('button', {
              class: 'btn',
              text: 'ลบข้อตัวอย่างทั้งหมด',
              onclick: function () {
                if (!App.confirm('ลบข้อสอบตัวอย่างทั้งหมดหรือไม่?')) return;
                var remaining = App.loadQuestions().filter(function (q) { return !q.sample; });
                App.saveQuestions(remaining);
                App.render();
              }
            }),
            el('button', {
              class: 'btn btn-primary',
              text: 'เพิ่มข้อสอบ',
              onclick: function () {
                state.tab = 'form';
                state.editId = null;
                App.render();
              }
            })
          ])
        ]),
        topicManageWrap, // แทรกกล่องจัดการบทตรงนี้
        itemsWrap
      ])
    );
  }

  // ---------------- FORM ----------------
  function renderForm(root) {
    var el = App.el;
    var questions = App.loadQuestions();
    var editing = state.editId ? questions.find(function (q) { return q.id === state.editId; }) : null;

    var form = {
      subject: editing ? editing.subject : App.subjects[0].id,
      topic: editing ? editing.topic : '',
      question: editing ? editing.question : '',
      choices: editing ? editing.choices.slice() : ['', '', '', ''],
      answer: editing ? editing.answer : -1,
      explanation: editing ? editing.explanation : '',
      whyWrong: editing && editing.whyWrong ? editing.whyWrong.slice() : null,
      difficulty: editing ? editing.difficulty || 1 : 1,
      noShuffle: editing ? !!editing.noShuffle : false,
      id: editing ? editing.id : null,
      sample: editing ? !!editing.sample : false
    };

    var errorBox = el('div', { class: 'stack' });
    function showErrors(errors) {
      while (errorBox.firstChild) errorBox.removeChild(errorBox.firstChild);
      errors.forEach(function (e) {
        errorBox.appendChild(el('div', { class: 'error', text: e.message }));
      });
    }

    var subjSelect = el('select', { class: 'select' });
    App.subjects.forEach(function (s) {
      var opt = el('option', { value: s.id, text: s.name });
      if (form.subject === s.id) opt.selected = true;
      subjSelect.appendChild(opt);
    });
    subjSelect.addEventListener('change', function () { form.subject = subjSelect.value; });

    var topicInput = el('input', { class: 'input', placeholder: 'ชื่อบท' });
    topicInput.value = form.topic;
    topicInput.addEventListener('input', function () { form.topic = topicInput.value; });

    var qInput = el('textarea', { class: 'textarea', placeholder: 'โจทย์ (ข้อความล้วน)' });
    qInput.value = form.question;
    qInput.addEventListener('input', function () { form.question = qInput.value; });

    var choicesWrap = el('div');
    var whyWrongWrap = el('div', { style: 'margin-top:8px;' });

    function renderChoices() {
      while (choicesWrap.firstChild) choicesWrap.removeChild(choicesWrap.firstChild);
      while (whyWrongWrap.firstChild) whyWrongWrap.removeChild(whyWrongWrap.firstChild);
      form.choices.forEach(function (c, i) {
        var row = el('div', { class: 'choice-row' }, [
          el('div', { class: 'choice-letter', text: LETTERS[i] })
        ]);
        var inputs = el('div', { class: 'choice-inputs' });
        var inp = el('input', { class: 'input', placeholder: 'ตัวเลือกที่ ' + (i + 1) });
        inp.value = c;
        inp.addEventListener('input', function () { form.choices[i] = inp.value; });
        inputs.appendChild(inp);

        var answerLabel = el('label', { class: 'radio-answer' });
        var radio = el('input', { type: 'radio', name: 'answer' });
        radio.checked = form.answer === i;
        radio.addEventListener('change', function () { form.answer = i; });
        answerLabel.appendChild(radio);
        answerLabel.appendChild(document.createTextNode(' ข้อนี้คือคำตอบที่ถูก'));
        inputs.appendChild(answerLabel);

        if (form.choices.length > 2) {
          var removeBtn = el('button', {
            class: 'btn remove-choice',
            text: 'ลบ',
            type: 'button',
            onclick: function () {
              form.choices.splice(i, 1);
              if (form.whyWrong) form.whyWrong.splice(i, 1);
              if (form.answer === i) form.answer = -1;
              else if (form.answer > i) form.answer -= 1;
              renderChoices();
            }
          });
          row.appendChild(inputs);
          row.appendChild(removeBtn);
        } else {
          row.appendChild(inputs);
        }
        choicesWrap.appendChild(row);

        if (form.whyWrong) {
          if (i === form.answer) {
            whyWrongWrap.appendChild(el('div', { class: 'small muted', text: LETTERS[i] + ': (คำตอบที่ถูก — ไม่ต้องกรอก)' }));
          } else {
            var wInp = el('textarea', { class: 'textarea', placeholder: 'ทำไมตัวเลือก ' + LETTERS[i] + ' ผิด (ไม่บังคับ)' });
            wInp.value = form.whyWrong[i] || '';
            wInp.addEventListener('input', function () { form.whyWrong[i] = wInp.value; });
            whyWrongWrap.appendChild(wInp);
          }
        }
      });
    }
    renderChoices();

    var addChoiceBtn = el('button', {
      class: 'btn',
      text: '+ เพิ่มตัวเลือก',
      type: 'button',
      onclick: function () {
        if (form.choices.length >= 6) return;
        form.choices.push('');
        if (form.whyWrong) form.whyWrong.push('');
        renderChoices();
      }
    });

    var toggleWhyWrong = el('button', {
      class: 'btn btn-ghost',
      text: form.whyWrong ? 'ปิดช่อง "ทำไมตัวเลือกผิด"' : 'เพิ่มช่อง "ทำไมตัวเลือกผิด"',
      type: 'button',
      onclick: function () {
        if (form.whyWrong) {
          form.whyWrong = null;
        } else {
          form.whyWrong = form.choices.map(function (_, i) { return i === form.answer ? null : ''; });
        }
        renderChoices();
        renderWhyWrongToggleLabel();
      }
    });
    function renderWhyWrongToggleLabel() {
      toggleWhyWrong.textContent = form.whyWrong ? 'ปิดช่อง "ทำไมตัวเลือกผิด"' : 'เพิ่มช่อง "ทำไมตัวเลือกผิด"';
    }

    var expInput = el('textarea', { class: 'textarea', placeholder: 'อธิบายว่าทำไมข้อที่ถูกจึงถูก' });
    expInput.value = form.explanation;
    expInput.addEventListener('input', function () { form.explanation = expInput.value; });

    var diffSelect = el('select', { class: 'select' });
    [1, 2, 3].forEach(function (d) {
      var opt = el('option', { value: String(d), text: 'ระดับ ' + d });
      if (form.difficulty === d) opt.selected = true;
      diffSelect.appendChild(opt);
    });
    diffSelect.addEventListener('change', function () { form.difficulty = parseInt(diffSelect.value, 10); });

    var noShuffleTrack = el('div', {
      style: 'width:44px; height:24px; border-radius:999px; background:' + (form.noShuffle ? 'var(--primary)' : 'var(--border)') + '; position:relative; transition:background 0.2s ease; flex-shrink:0;'
    });
    var noShuffleKnob = el('div', {
      style: 'width:20px; height:20px; border-radius:50%; background:#fff; position:absolute; top:2px; left:2px; transition:transform 0.2s ease; box-shadow:0 1px 3px rgba(0,0,0,0.2); transform:' + (form.noShuffle ? 'translateX(20px)' : 'translateX(0)') + ';'
    });
    noShuffleTrack.appendChild(noShuffleKnob);

    var noShuffleToggle = el('div', {
      style: 'display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0; cursor:pointer;',
      onclick: function () {
        form.noShuffle = !form.noShuffle;
        if (form.noShuffle) {
          noShuffleKnob.style.transform = 'translateX(20px)';
          noShuffleTrack.style.background = 'var(--primary)';
        } else {
          noShuffleKnob.style.transform = 'translateX(0)';
          noShuffleTrack.style.background = 'var(--border)';
        }
      }
    });
    noShuffleToggle.appendChild(el('div', null, [
      el('div', { style: 'font-weight:600; font-size:0.95rem;', text: 'ห้ามสลับลำดับตัวเลือก' }),
      el('div', { class: 'small muted', style: 'margin-top:2px;', text: 'ใช้เมื่อตัวเลือกต้องเรียงตามลำดับ' })
    ]));
    noShuffleToggle.appendChild(noShuffleTrack);

    function save(thenNext) {
      var payload = {
        subject: form.subject,
        topic: form.topic,
        question: form.question,
        choices: form.choices.slice(),
        answer: form.answer,
        explanation: form.explanation
      };
      if (form.whyWrong) payload.whyWrong = form.whyWrong.slice();
      if (form.difficulty) payload.difficulty = form.difficulty;
      if (form.noShuffle) payload.noShuffle = true;
      if (form.sample) payload.sample = true;
      if (form.id) payload.id = form.id;

      var errs = App.validate.validateQuestion(payload);
      if (errs.length) {
        showErrors(errs);
        return;
      }
      showErrors([]);

      var all = App.loadQuestions();
      if (form.id) {
        var idx = all.findIndex(function (q) { return q.id === form.id; });
        if (idx >= 0) {
          var oldQ = all[idx];
          var progress = App.storage.getProgress();
          if (progress[form.id] && oldQ.answer !== payload.answer) {
            if (!App.confirm('ประวัติการทำของข้อนี้จะยังคงอยู่ ตรวจสอบเฉลยให้ถูกต้อง บันทึกต่อหรือไม่?')) return;
          }
          all[idx] = payload;
        } else {
          all.push(payload);
        }
      } else {
        var newId = App.nextIdFor(payload.subject, all);
        payload.id = newId;
        all.push(payload);
      }
      App.saveQuestions(all);
      App.toast('บันทึกแล้ว');

      if (thenNext) {
        form.question = '';
        form.choices = ['', '', '', ''];
        form.answer = -1;
        form.explanation = '';
        form.whyWrong = form.whyWrong ? ['', '', '', ''] : null;
        form.difficulty = 1;
        form.noShuffle = false;
        form.id = null;
        form.sample = false;
        App.render();
      } else {
        state.tab = 'list';
        state.editId = null;
        App.render();
      }
    }

    root.appendChild(
      el('div', { class: 'card' }, [
        el('h2', { text: editing ? 'แก้ไขข้อสอบ' : 'เพิ่มข้อสอบ' }),
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'วิชา' }), subjSelect]),
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'บท' }), topicInput]),
        el('div', { class: 'field' }, [el('span', { class: 'label', text: 'โจทย์' }), qInput]),
        el('div', { class: 'field' }, [
          el('span', { class: 'label', text: 'ตัวเลือก' }),
          choicesWrap,
          el('div', { class: 'row', style: 'margin-top:8px;' }, [addChoiceBtn, toggleWhyWrong])
        ]),
        whyWrongWrap,
        el('div', { class: 'field' }, [
          el('span', { class: 'label', text: 'คำอธิบาย' }),
          expInput
        ]),
        el('div', { class: 'field' }, [
          el('span', { class: 'label', text: 'ระดับความยาก' }),
          diffSelect
        ]),
        el('div', { class: 'field' }, [noShuffleToggle]),
        errorBox,
        el('div', { class: 'row', style: 'margin-top:12px;' }, [
          el('button', {
            class: 'btn btn-primary',
            text: 'บันทึก',
            onclick: function () { save(false); }
          }),
          el('button', {
            class: 'btn',
            text: 'บันทึกแล้วเพิ่มข้อต่อไป',
            onclick: function () { save(true); }
          }),
          editing
            ? el('button', {
                class: 'btn btn-danger',
                text: 'ลบข้อนี้',
                onclick: function () {
                  if (!App.confirm('ลบข้อนี้และประวัติการทำหรือไม่?')) return;
                  var all = App.loadQuestions().filter(function (q) { return q.id !== form.id; });
                  App.saveQuestions(all);
                  var progress = App.storage.getProgress();
                  delete progress[form.id];
                  App.storage.setProgress(progress);
                  state.tab = 'list';
                  state.editId = null;
                  App.render();
                }
              })
            : null
        ])
      ])
    );
  }

  // ---------------- IMPORT / EXPORT ----------------
  function renderImport(root) {
    var el = App.el;

    function createFileInput(onLoad, label) {
      var fileInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none;' });
      var btn = el('button', {
        class: 'btn btn-block',
        text: label || 'เลือกไฟล์ .json',
        type: 'button',
        onclick: function () { fileInput.click(); }
      });
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () { onLoad(String(reader.result || ''), f.name); };
        reader.readAsText(f);
      });
      return el('div', null, [fileInput, btn]);
    }

    var pasteArea = el('textarea', { class: 'textarea', placeholder: 'วาง JSON ที่นี่' });
    var fileNameDisplay = el('div', { class: 'small muted', style: 'margin-top:8px;', text: 'ยังไม่ได้เลือกไฟล์' });

    var fileSelectBtn = createFileInput(function (text, name) {
      pasteArea.value = text;
      fileNameDisplay.textContent = 'ไฟล์ที่เลือก: ' + name;
      doValidate();
    }, 'เลือกไฟล์ .json');

    var previewBox = el('div', { style: 'margin-top:12px;' });

    function doValidate() {
      while (previewBox.firstChild) previewBox.removeChild(previewBox.firstChild);
      var text = pasteArea.value.trim();
      if (!text) {
        previewBox.appendChild(el('p', { class: 'muted small', text: 'ยังไม่มีข้อมูล' }));
        return null;
      }
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        previewBox.appendChild(el('p', { class: 'error', text: 'JSON ไม่ถูกต้อง: ' + e.message }));
        return null;
      }
      var result = App.validate.validateImportArray(data);
      previewBox.appendChild(
        el('p', {
          text: 'ถูกต้อง ' + result.valid.length + ' ข้อ / มีปัญหา ' + result.invalid.length + ' ข้อ'
        })
      );
      if (result.invalid.length) {
        var wrap = el('div', { class: 'stack' });
        result.invalid.forEach(function (item) {
          var msg = 'ข้อที่ ' + (item.index + 1) + ': ' +
            (item.errors || []).map(function (e) { return e.message; }).join(' • ');
          wrap.appendChild(el('div', { class: 'error', text: msg }));
        });
        previewBox.appendChild(wrap);
      }
      return result;
    }

    pasteArea.addEventListener('input', doValidate);

    var importBtn = el('button', {
      class: 'btn btn-primary',
      text: 'นำเข้าเฉพาะข้อที่ถูกต้อง',
      onclick: function () {
        var result = doValidate();
        if (!result) return;
        if (result.valid.length === 0) {
          App.toast('ไม่มีข้อที่ถูกต้อง');
          return;
        }
        var all = App.loadQuestions();
        var existingKey = {};
        all.forEach(function (q) {
          existingKey[q.subject + '|' + q.question.trim().toLowerCase()] = true;
        });
        var added = 0, skipped = 0;
        result.valid.forEach(function (q) {
          var key = q.subject + '|' + q.question.trim().toLowerCase();
          if (existingKey[key]) { skipped++; return; }
          var norm = App.validate.normalizeQuestion(q, all);
          if (!norm.id) norm.id = App.nextIdFor(norm.subject, all);
          all.push(norm);
          existingKey[key] = true;
          added++;
        });
        App.saveQuestions(all);
        App.toast('นำเข้า ' + added + ' ข้อ (ข้าม ' + skipped + ' ข้อซ้ำ)');
        App.render();
      }
    });

    var copyPromptBtn = el('button', {
      class: 'btn',
      text: 'คัดลอกพรอมต์สำหรับให้ AI ร่างข้อสอบ',
      onclick: function () {
        App.askai.copyText(App.askai.PROMPT_TEMPLATE).then(
          function () { 
            App.toast('คัดลอกพรอมต์แล้ว — เอาไปวางใน Claude/ChatGPT แล้วแนบไฟล์เนื้อหาให้ AI'); 
          },
          function () { App.toast('คัดลอกไม่สำเร็จ'); }
        );
      }
    });

    var exportBtn = el('button', {
      class: 'btn',
      text: 'ส่งออกข้อสอบ (.json)',
      onclick: function () {
        var data = App.loadQuestions();
        downloadJSON('questions-' + App.stats.todayKey() + '.json', data);
      }
    });

    var backupBtn = el('button', {
      class: 'btn btn-primary',
      text: 'สำรองข้อมูลทั้งหมด',
      onclick: function () {
        var backup = {
          app: 'smart-practice',
          schema: App.storage.SCHEMA,
          exportedAt: new Date().toISOString(),
          questions: App.storage.getQuestions(),
          progress: App.storage.getProgress(),
          daily: App.storage.getDaily(),
          topicRecent: App.storage.getTopicRecent(),
          causes: App.storage.getCauses(),
          sessions: App.storage.getSessions(),
          settings: App.storage.getSettings()
        };
        var filename = 'exam-backup-' + App.stats.todayKey() + '.json';
        downloadJSON(filename, backup);
        var s = App.storage.getSettings();
        s.lastBackupAt = Date.now();
        App.storage.setSettings(s);
        App.toast('สำรองแล้ว');
      }
    });

    var restoreFileNameDisplay = el('div', { class: 'small muted', style: 'margin-top:8px;', text: 'ยังไม่ได้เลือกไฟล์' });
    var restoreInput = createFileInput(function (text, name) {
      restoreFileNameDisplay.textContent = 'ไฟล์ที่เลือก: ' + name;
      try {
        var data = JSON.parse(text);
        restoreFrom(data);
      } catch (e) {
        alert('อ่านไฟล์ไม่สำเร็จ: ' + e.message);
      }
    }, 'เลือกไฟล์สำรองเพื่อกู้คืน');

    root.appendChild(
      el('div', { class: 'card' }, [
        el('h2', { text: 'นำเข้าข้อสอบ' }),
        el('div', { class: 'field' }, [
          el('span', { class: 'label', text: 'เลือกไฟล์ .json' }),
          fileSelectBtn,
          fileNameDisplay
        ]),
        el('div', { class: 'field' }, [
          el('span', { class: 'label', text: 'หรือวาง JSON' }),
          pasteArea,
          el('div', { class: 'hint', text: 'ต้องเป็นอาร์เรย์ของข้อสอบ' })
        ]),
        previewBox,
        el('div', { class: 'row', style: 'margin-top:12px;' }, [importBtn, copyPromptBtn])
      ])
    );

    root.appendChild(
      el('div', { class: 'card' }, [
        el('h2', { text: 'ส่งออก / สำรอง' }),
        // แก้ไขส่วนนี้ให้ปุ่มไม่ติดกัน โดยใช้ flex-direction column และ gap
        el('div', { style: 'display: flex; flex-direction: column; gap: 16px;' }, [
          el('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap;' }, [exportBtn, backupBtn]),
          el('div', { class: 'field', style: 'margin: 0;' }, [
            el('span', { class: 'label', text: 'กู้คืนข้อมูลจากไฟล์สำรอง' }),
            restoreInput,
            restoreFileNameDisplay
          ])
        ])
      ])
    );
  }

  function downloadJSON(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    if (navigator.share && navigator.canShare) {
      try {
        var file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: filename }).catch(function () {
            triggerDownload(blob, filename);
          });
          return;
        }
      } catch (e) { /* fall through */ }
    }
    triggerDownload(blob, filename);
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function restoreFrom(data) {
    if (!data || data.app !== 'smart-practice') {
      alert('ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอป');
      return;
    }
    if (data.schema !== App.storage.SCHEMA) {
      alert('เวอร์ชัน schema ไม่ตรงกัน');
      return;
    }
    var mode = window.prompt(
      'พิมพ์ "รวม" เพื่อรวมกับข้อมูลเดิม หรือ "แทน" เพื่อแทนที่ทั้งหมด'
    );
    if (mode === 'แทน') {
      if (!App.confirm('ยืนยันการแทนที่ข้อมูลทั้งหมดหรือไม่?')) return;
      App.storage.setQuestions(data.questions || []);
      App.storage.setProgress(data.progress || {});
      App.storage.setDaily(data.daily || {});
      App.storage.setTopicRecent(data.topicRecent || {});
      App.storage.setCauses(data.causes || {});
      App.storage.setSessions(data.sessions || []);
      App.storage.setSettings(data.settings || App.storage.getSettings());
      App.toast('กู้คืนแล้ว');
      App.render();
    } else if (mode === 'รวม') {
      var existing = App.loadQuestions();
      var ids = {};
      existing.forEach(function (q) { if (q.id) ids[q.id] = true; });
      var added = 0;
      (data.questions || []).forEach(function (q) {
        if (q.id && ids[q.id]) return;
        existing.push(q);
        added++;
      });
      App.saveQuestions(existing);
      App.toast('รวมแล้ว ' + added + ' ข้อ');
      App.render();
    }
  }
})();