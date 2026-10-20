/* Home view — round 1: simple start session + resume banner + empty state */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  App.views.home = function (root) {
    var el = App.el;
    var questions = App.loadQuestions();
    var settings = App.storage.getSettings();
    var active = App.storage.getActiveSession();

    // --- Resume banner ---
    if (active) {
      var resumeCard = el('div', { class: 'card' }, [
        el('h2', { text: 'ชุดที่ค้างอยู่' }),
        el('p', {
          class: 'muted small',
          text:
            'ตอบแล้ว ' +
            (active.answers ? active.answers.length : 0) +
            ' / ' +
            active.n +
            ' ข้อ'
        }),
        el('div', { class: 'row' }, [
          el('button', {
            class: 'btn btn-primary',
            text: 'ทำต่อ',
            onclick: function () { App.navigate('session'); }
          }),
          el('button', {
            class: 'btn',
            text: 'ทิ้งชุดนี้',
            onclick: function () {
              if (App.confirm('ต้องการทิ้งชุดนี้หรือไม่?')) {
                App.storage.setActiveSession(null);
                App.render();
              }
            }
          })
        ])
      ]);
      root.appendChild(resumeCard);
    }

    // --- Empty state ---
    if (questions.length === 0) {
      var emptyCard = el('div', { class: 'card' }, [
        el('h2', { text: 'ยินดีต้อนรับ' }),
        el('p', {
          class: 'muted',
          text: 'ยังไม่มีข้อสอบในระบบ เริ่มได้ด้วยการโหลดตัวอย่าง เพิ่มเอง หรือนำเข้าไฟล์'
        }),
        el('div', { class: 'stack' }, [
          el('button', {
            class: 'btn btn-primary btn-block',
            text: 'โหลดข้อสอบตัวอย่าง (20 ข้อ)',
            onclick: function () {
              var existing = App.loadQuestions();
              var ids = {};
              existing.forEach(function (q) { if (q.id) ids[q.id] = true; });
              var added = 0;
              App.sampleQuestions.forEach(function (q) {
                if (q.id && ids[q.id]) return;
                existing.push(q);
                added++;
              });
              App.saveQuestions(existing);
              App.toast('เพิ่มข้อสอบตัวอย่าง ' + added + ' ข้อ');
              App.render();
            }
          }),
          el('button', {
            class: 'btn btn-block',
            text: 'เพิ่มข้อสอบ',
            onclick: function () {
              window.location.hash = '#/manage?tab=form';
            }
          }),
          el('button', {
            class: 'btn btn-block',
            text: 'นำเข้าจากไฟล์',
            onclick: function () {
              window.location.hash = '#/manage?tab=import';
            }
          })
        ])
      ]);
      root.appendChild(emptyCard);
      return;
    }

    // --- Quick start (simple shuffle in round 1) ---
    var nOptions = [10, 20, 30];
    var chosenN = settings.defaultSessionSize || 20;
    var sizeRow = el('div', { class: 'row' });
    nOptions.forEach(function (n) {
      var b = el('button', {
        class: 'chip' + (n === chosenN ? ' selected' : ''),
        text: String(n) + ' ข้อ',
        onclick: function () {
          chosenN = n;
          sizeRow.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('selected'); });
          b.classList.add('selected');
        }
      });
      sizeRow.appendChild(b);
    });

    var startCard = el('div', { class: 'card' }, [
      el('h2', { text: 'เริ่มฝึก' }),
      el('p', { class: 'muted small', text: 'สุ่มข้อสอบจากทุกวิชา' }),
      sizeRow,
      el('button', {
        class: 'btn btn-primary btn-block',
        style: 'margin-top:12px;',
        text: 'เริ่มฝึกเลย',
        onclick: function () {
          var picked = App.scheduler.buildSimpleSession(questions, { subject: null, topics: [] }, chosenN);
          if (!picked.length) {
            App.toast('ไม่มีข้อสอบให้ฝึก');
            return;
          }
          App.views.session.startNew(picked);
        }
      })
    ]);
    root.appendChild(startCard);

    // --- Subject cards (simple) ---
    var subjectSection = el('div', { class: 'stack' });
    subjectSection.appendChild(el('div', { class: 'section-title', text: 'เลือกตามวิชา' }));
    App.subjects.forEach(function (s) {
      var count = questions.filter(function (q) { return q.subject === s.id; }).length;
      if (count === 0) return;
      subjectSection.appendChild(
        el('div', { class: 'card' }, [
          el('div', { class: 'row-between' }, [
            el('div', null, [
              el('h3', { text: s.name }),
              el('div', { class: 'muted small', text: count + ' ข้อ' })
            ]),
            el('button', {
              class: 'btn btn-primary',
              text: 'เริ่ม',
              onclick: function () {
                var picked = App.scheduler.buildSimpleSession(questions, { subject: s.id, topics: [] }, chosenN);
                if (!picked.length) {
                  App.toast('ไม่มีข้อสอบในวิชานี้');
                  return;
                }
                App.views.session.startNew(picked);
              }
            })
          ])
        ])
      );
    });
    if (subjectSection.children.length > 1) root.appendChild(subjectSection);

    // --- Review mistakes (basic) ---
    var wrongList = questions.filter(function (q) {
      var p = App.storage.getProgress()[q.id];
      return p && p.attempts > 0 && p.correct < p.attempts;
    });
    if (wrongList.length > 0) {
      root.appendChild(
        el('div', { class: 'card' }, [
          el('h3', { text: 'ทบทวนข้อที่เคยผิด' }),
          el('p', { class: 'muted small', text: 'มี ' + wrongList.length + ' ข้อ' }),
          el('button', {
            class: 'btn btn-block',
            text: 'ทบทวนข้อที่เคยผิด',
            onclick: function () {
              App.views.session.startNew(App.scheduler.shuffleArray(wrongList));
            }
          })
        ])
      );
    }
  };
})();