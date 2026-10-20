/* Home view — smart start + goal ring + backup banner + flashcards */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  App.views.home = function (root) {
    var el = App.el;
    var questions = App.loadQuestions();
    var progress = App.storage.getProgress();
    var settings = App.storage.getSettings();
    var active = App.storage.getActiveSession();
    var today = App.scheduler.todayKey();
    var daily = App.storage.getDaily();

    // ---- Backup banner ----
    var answeredTotal = 0;
    Object.keys(progress).forEach(function (qid) {
      var p = progress[qid];
      if (p && p.attempts) answeredTotal += p.attempts;
    });
    var addedQuestions = questions.filter(function (q) { return !q.sample; }).length;

    if (App.scheduler.shouldShowBackupBanner({
      answeredTotal: answeredTotal,
      addedQuestions: addedQuestions,
      lastBackupAt: settings.lastBackupAt,
      backupSnoozeUntil: settings.backupSnoozeUntil
    })) {
      root.appendChild(el('div', { class: 'banner warn' }, [
        el('div', { class: 'icon', text: '!' }),
        el('div', { style: 'flex:1;' }, [
          el('strong', { text: 'ยังไม่ได้สำรองข้อมูล' }),
          el('p', { class: 'small', style: 'margin:4px 0 8px;', text: 'ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น ถ้าล้างข้อมูลจะหาย' }),
          el('div', { class: 'row' }, [
            el('button', { class: 'btn btn-primary', text: 'ไปสำรอง', onclick: function () { window.location.hash = '#/manage?tab=import'; } }),
            el('button', { class: 'btn', text: 'ไว้ทีหลัง', onclick: function () {
              var s = App.storage.getSettings();
              s.backupSnoozeUntil = App.scheduler.snoozeBannerDays();
              App.storage.setSettings(s);
              App.render();
            }})
          ])
        ])
      ]));
    }

    // ---- Resume banner ----
    if (active) {
      root.appendChild(el('div', { class: 'card' }, [
        el('h2', { text: 'ชุดที่ค้างอยู่' }),
        el('p', { class: 'muted small', text: 'ตอบแล้ว ' + (active.answers ? active.answers.length : 0) + ' / ' + active.n + ' ข้อ' }),
        el('div', { class: 'row', style: 'margin-top:8px;' }, [
          el('button', { class: 'btn btn-primary', text: 'ทำต่อ', onclick: function () { App.navigate('session'); App.render(); } }),
          el('button', { class: 'btn', text: 'ทิ้งชุดนี้', onclick: function () {
            if (App.confirm('ต้องการทิ้งชุดนี้หรือไม่?')) {
              App.storage.setActiveSession(null);
              App.render();
            }
          }})
        ])
      ]));
    }

    // ---- Empty state ----
    if (questions.length === 0) {
      root.appendChild(el('div', { class: 'card' }, [
        el('h2', { text: 'ยินดีต้อนรับ' }),
        el('p', { class: 'muted', text: 'ยังไม่มีข้อสอบในระบบ เริ่มได้ด้วยการโหลดตัวอย่าง เพิ่มเอง หรือนำเข้าจากไฟล์' }),
        el('div', { class: 'stack' }, [
          el('button', { class: 'btn btn-primary btn-block', text: 'โหลดข้อสอบตัวอย่าง (20 ข้อ)', onclick: function () {
            var existing = App.loadQuestions();
            var ids = {};
            existing.forEach(function (q) { if (q.id) ids[q.id] = true; });
            var added = 0;
            App.sampleQuestions.forEach(function (q) {
              if (q.id && ids[q.id]) return;
              existing.push(q); added++;
            });
            App.saveQuestions(existing);
            App.toast('เพิ่มข้อสอบตัวอย่าง ' + added + ' ข้อ');
            App.render();
          }}),
          el('button', { class: 'btn btn-block', text: 'เพิ่มข้อสอบ', onclick: function () { window.location.hash = '#/manage?tab=form'; } }),
          el('button', { class: 'btn btn-block', text: 'นำเข้าจากไฟล์', onclick: function () { window.location.hash = '#/manage?tab=import'; } })
        ])
      ]));
      return;
    }

    // ---- Big Start ----
    var dueCount = App.stats.dueTodayCount(questions, progress, today);
    var statusText;
    if (dueCount > 0) statusText = 'วันนี้มี ' + dueCount + ' ข้อที่ถึงเวลาทบทวน';
    else if (Object.keys(progress).length === 0) statusText = 'พร้อมเริ่มชุดแรกของคุณ';
    else statusText = 'ไม่มีข้อค้างทบทวน — ฝึกเพิ่มได้เลย';

    // 🔥 เปลี่ยนตัวเลือกจำนวนข้อเป็น 10, 20, 30, 45, 60, 80, 90
    var sizeOptions = [10, 20, 30, 45, 60, 80, 90];
    var chosenN = settings.defaultSessionSize || 20;
    if (questions.length < chosenN) chosenN = Math.min(questions.length, 10) || 10;
    var sizeRow = el('div', { class: 'row' });
    sizeOptions.forEach(function (n) {
      var b = el('button', {
        class: 'chip' + (n === chosenN ? ' selected' : ''),
        text: n + ' ข้อ',
        onclick: function () {
          chosenN = n;
          sizeRow.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('selected'); });
          b.classList.add('selected');
        }
      });
      sizeRow.appendChild(b);
    });

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'เริ่มฝึกวันนี้' }),
      el('p', { class: 'muted small', text: statusText }),
      el('div', { style: 'margin-top:12px;' }, [sizeRow]),
      el('button', {
        class: 'btn btn-primary btn-block',
        style: 'margin-top:16px; font-size:1.05rem; min-height:56px;',
        text: 'เริ่มฝึกวันนี้',
        onclick: function () {
          var result = App.scheduler.buildAutoSession({
            questions: questions, progress: progress,
            topicRecent: App.storage.getTopicRecent(),
            n: chosenN, filter: { subject: null, topics: [] }
          });
          if (!result.ids.length) { App.toast('ไม่มีข้อสอบให้ฝึก'); return; }
          App.views.session.startNew(result.ids, result.meta);
          App.render();
        }
      })
    ]));

    // ---- Flashcards Card ----
    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'row-between' }, [
        el('div', { style: 'flex:1; min-width:0;' }, [
          el('h3', { text: 'ท่องจำด้วยแฟลชการ์ด' }),
          el('p', { class: 'muted small', style: 'margin:4px 0 0;', text: 'ปัดซ้าย-ขวาเพื่อทบทวนการ์ด พร้อมระบบ Leitner' })
        ])
      ]),
      el('button', {
        class: 'btn btn-block',
        style: 'margin-top:12px;',
        text: '▣ ฝึกแฟลชการ์ด',
        onclick: function () {
          window.location.hash = '#/flashcards';
        }
      })
    ]));

    // ---- Goal + streak ----
    var answeredToday = App.stats.dailyAnsweredCount(daily, today);
    var goal = settings.dailyGoal || 20;
    
    var isGoalMet = answeredToday >= goal;
    var displayCount = isGoalMet ? goal : answeredToday;
    var pct = Math.min(1, goal ? displayCount / goal : 0);
    
    var streak = App.stats.streakDays(daily, today);
    var ringR = 34, ringC = 2 * Math.PI * ringR;
    var ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 80 80');
    ring.setAttribute('width', '80'); ring.setAttribute('height', '80');
    
    var bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', '40'); bgCircle.setAttribute('cy', '40');
    bgCircle.setAttribute('r', String(ringR)); bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'var(--border)'); bgCircle.setAttribute('stroke-width', '8');
    ring.appendChild(bgCircle);
    
    var fgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fgCircle.setAttribute('cx', '40'); fgCircle.setAttribute('cy', '40');
    fgCircle.setAttribute('r', String(ringR)); fgCircle.setAttribute('fill', 'none');
    fgCircle.setAttribute('stroke', isGoalMet ? 'var(--correct)' : 'var(--primary)');
    fgCircle.setAttribute('stroke-width', '8');
    fgCircle.setAttribute('stroke-linecap', 'round');
    fgCircle.setAttribute('stroke-dasharray', String(ringC));
    fgCircle.setAttribute('stroke-dashoffset', String(ringC * (1 - pct)));
    fgCircle.setAttribute('transform', 'rotate(-90 40 40)');
    ring.appendChild(fgCircle);
    
    var ringLabel = el('div', { 
      style: 'text-align:center; font-weight:700; margin-top:4px; font-size: 0.95rem;',
      text: displayCount + ' / ' + goal
    });

    root.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'row-between', style: 'margin-bottom: 12px;' }, [
        el('h3', { text: 'เป้าหมายรายวัน' }),
        el('div', { class: 'small muted', text: 'เป้าหมาย: ' + goal + ' ข้อ' })
      ]),
      el('div', { class: 'row', style: 'align-items:center; gap:16px;' }, [
        el('div', null, [ring, ringLabel]),
        el('div', { style: 'flex:1;' }, [
          el('p', { 
            style: 'margin:0; font-weight:600; color: ' + (isGoalMet ? 'var(--correct)' : 'var(--text)') + ';', 
            text: isGoalMet ? 'สำเร็จแล้ว! คุณทำครบเป้าหมายแล้ว' : 'ตอบถูกไปแล้ววันนี้ ' + answeredToday + ' ข้อ' 
          }),
          el('p', { class: 'small', style: 'margin:6px 0 0; color:var(--muted);', text: 'สตรีค ' + streak + ' วันติดกัน' })
        ])
      ])
    ]));

    // ---- Subject cards ----
    var subjectSection = el('div', { class: 'stack' });
    subjectSection.appendChild(el('div', { class: 'section-title', text: 'ความคืบหน้ารายวิชา' }));
    
    App.subjects.forEach(function (s) {
      var m = App.stats.subjectMastery(questions, progress, s.id);
      if (m.total === 0) return;
      var sDue = App.stats.dueTodayCount(questions, progress, today, { subject: s.id });
      var pctText = Math.round(m.pct * 100) + '%';
      
      var bar = el('div', { class: 'progress-bar', style: 'margin-top:8px;' }, [
        el('div', { class: 'fill', style: 'width:' + pctText + '; background: ' + (m.pct > 0 ? 'var(--primary)' : 'var(--border)') })
      ]);
      
      subjectSection.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'row-between' }, [
          el('div', { style: 'flex:1; min-width:0;' }, [
            el('h3', { text: s.name }),
            el('div', { class: 'muted small', style: 'margin-top: 4px;', text: 'ความแม่นยำ ' + pctText + ' (' + m.mastered + ' จาก ' + m.total + ' ข้อ)' }),
            bar,
            el('div', { class: 'muted small', style: 'margin-top:8px;', text: 'ค้างทบทวน ' + sDue + ' ข้อ' })
          ]),
          el('button', { 
            class: 'btn btn-primary', 
            text: 'ฝึก', 
            onclick: function () { openSubjectSheet(s, questions, progress, chosenN); } 
          })
        ])
      ]));
    });
    root.appendChild(subjectSection);

    // ---- Review wrong ----
    var wrongCount = questions.filter(function (q) {
      var p = progress[q.id];
      return p && (p.lapses || 0) > 0 && (p.box || 0) <= 2;
    }).length;
    if (wrongCount > 0) {
      root.appendChild(el('div', { class: 'card' }, [
        el('h3', { text: 'ทบทวนข้อที่เคยผิด' }),
        el('p', { class: 'muted small', text: 'มี ' + wrongCount + ' ข้อที่ยังไม่แม่น' }),
        el('button', { class: 'btn btn-block', text: 'ทบทวนข้อที่เคยผิด', onclick: function () {
          var res = App.scheduler.buildReviewWrongSession({
            questions: questions, progress: progress, n: chosenN,
            filter: { subject: null, topics: [] }
          });
          if (!res.ids.length) { App.toast('ไม่มีข้อที่ต้องทบทวน'); return; }
          App.views.session.startNew(res.ids, res.meta);
          App.render();
        }})
      ]));
    }
  };

  function openSubjectSheet(subject, questions, progress, chosenN) {
    var el = App.el;
    var topics = {};
    questions.forEach(function (q) {
      if (q.subject === subject.id) topics[q.topic] = (topics[q.topic] || 0) + 1;
    });
    var selectedTopic = '';
    var n = chosenN;
    
    document.body.style.overflow = 'hidden';

    var overlay = el('div', {
      style: 'position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:50;',
      onclick: function (e) { 
        if (e.target === overlay) closeSheet(); 
      }
    });

    var sheet = el('div', {
      style: 'position:fixed; left:0; right:0; bottom:0; background:var(--surface); border-radius:20px 20px 0 0; padding:20px; padding-bottom: calc(20px + env(safe-area-inset-bottom)); z-index:51; max-height:80vh; overflow-y:auto;'
    });

    sheet.appendChild(el('div', { class: 'row-between', style: 'margin-bottom:16px;' }, [
      el('h2', { text: 'ฝึก ' + subject.name, style: 'margin:0;' }),
      el('button', { class: 'icon-btn', text: '✕', 'aria-label': 'ปิด', onclick: closeSheet })
    ]));

    sheet.appendChild(el('p', { class: 'muted small', text: 'เลือกบท (ไม่บังคับ)' }));
    var topicSelect = el('select', { class: 'select' });
    topicSelect.appendChild(el('option', { value: '', text: 'ทุกบท' }));
    Object.keys(topics).forEach(function (t) {
      topicSelect.appendChild(el('option', { value: t, text: t + ' (' + topics[t] + ' ข้อ)' }));
    });
    topicSelect.addEventListener('change', function () { selectedTopic = topicSelect.value; });
    sheet.appendChild(el('div', { class: 'field' }, [topicSelect]));

    // 🔥 เปลี่ยนตัวเลือกจำนวนข้อใน Bottom Sheet เป็น 10, 20, 30, 45, 60, 80, 90
    var nRow = el('div', { class: 'row' });
    [10, 20, 30, 45, 60, 80, 90].forEach(function (val) {
      var b = el('button', {
        class: 'chip' + (val === n ? ' selected' : ''), text: val + ' ข้อ',
        onclick: function () {
          n = val;
          nRow.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('selected'); });
          b.classList.add('selected');
        }
      });
      nRow.appendChild(b);
    });
    sheet.appendChild(el('p', { class: 'muted small', text: 'จำนวนข้อ' }));
    sheet.appendChild(nRow);

    sheet.appendChild(el('button', {
      class: 'btn btn-primary btn-block', style: 'margin-top:16px;',
      text: 'เริ่มฝึกวิชานี้',
      onclick: function () {
        var res = App.scheduler.buildAutoSession({
          questions: questions, progress: progress,
          topicRecent: App.storage.getTopicRecent(),
          n: n, filter: { subject: subject.id, topics: selectedTopic ? [selectedTopic] : [] }
        });
        if (!res.ids.length) { App.toast('ไม่มีข้อในเงื่อนไขนี้'); return; }
        closeSheet();
        App.views.session.startNew(res.ids, res.meta);
        App.render();
      }
    }));
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    function closeSheet() {
      document.body.style.overflow = '';
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  }
})();