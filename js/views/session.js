/* Session view — Free Navigation, continuous timer, scroll mode, submit */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  var timerInterval = null;
  var sessionElapsedMs = 0;
  var overtimeStarted = false;
  var hiddenAt = null;

  function findQuestion(qid) {
    return App.loadQuestions().find(function (q) { return q.id === qid; });
  }

  function clearTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function startNew(ids, meta) {
    clearTimer();
    var questions = App.loadQuestions();
    var byId = {};
    questions.forEach(function (q) { byId[q.id] = q; });
    var settings = App.storage.getSettings();
    var choiceOrders = {};
    ids.forEach(function (qid) {
      var q = byId[qid];
      if (!q) return;
      if (q.noShuffle || !settings.shuffleChoices) {
        choiceOrders[qid] = q.choices.map(function (_, i) { return i; });
      } else {
        choiceOrders[qid] = App.scheduler.shuffleChoices(q.choices.length);
      }
    });

    var timerMode = settings.timerMode === 'timed' ? 'timed' : 'untimed';
    var totalMs = timerMode === 'timed' ? (ids.length * (settings.secondsPerQuestion || 60) * 1000) : 0;

    var session = {
      id: 's-' + Date.now(),
      startedAt: Date.now(),
      mode: 'auto',
      filter: { subject: null, topics: [] },
      n: ids.length,
      queue: ids.map(function (qid) { return { qid: qid, isRecheck: false }; }),
      index: 0,
      choiceOrders: choiceOrders,
      answers: [],
      timer: { mode: timerMode, totalMs: totalMs, elapsedMs: 0, overtime: false },
      recheckCount: {},
      meta: meta || {}
    };
    App.storage.setActiveSession(session);
    sessionElapsedMs = 0;
    overtimeStarted = false;
    App.navigate('session');
    App.render();
  }

  function formatMs(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function renderSession(root) {
    clearTimer();
    
    var el = App.el;
    var session = App.storage.getActiveSession();
    if (!session) {
      root.appendChild(el('div', { class: 'empty' }, [
        el('p', { text: 'ไม่มีชุดที่กำลังทำ' }),
        el('button', { class: 'btn btn-primary', text: 'กลับหน้าแรก', onclick: function () { App.navigate('home'); } })
      ]));
      return;
    }
    var current = session.queue[session.index];
    if (!current) { finishSession(session); return; }
    var q = findQuestion(current.qid);
    if (!q) {
      session.index++;
      App.storage.setActiveSession(session);
      renderSession(root);
      return;
    }

    var order = session.choiceOrders[q.id] || q.choices.map(function (_, i) { return i; });
    
    // 🔥 แก้ไขการค้นหาคำตอบเดิม: ใช้ String() ครอบ isRecheck เพื่อให้เทียบกันติด 100%
    var existing = session.answers.find(function (a) { 
      return a.qid === q.id && String(a.isRecheck) === String(current.isRecheck); 
    });
    
    var isScrollMode = (localStorage.getItem('answerMode') || 'button') === 'scroll';

    // --- Top bar ---
    var isTimed = session.timer.mode === 'timed';
    var elapsedEl = el('div', { class: 'small', style: 'font-variant-numeric: tabular-nums; font-weight:700; white-space:nowrap;', text: formatMs(sessionElapsedMs || session.timer.elapsedMs || 0) });
    var totalEl = el('div', { class: 'small muted', style: 'font-variant-numeric: tabular-nums; white-space:nowrap;', text: isTimed ? formatMs(session.timer.totalMs) : '' });

    var topContainer = el('div', { class: 'session-top', style: 'display:flex; align-items:center; gap:10px; margin-bottom:16px; width:100%;' }, [
      el('button', { 
        class: 'icon-btn', 'aria-label': 'ออก', text: '✕', 
        onclick: function () {
          if (App.confirm('ความคืบหน้าจะถูกเก็บไว้ ต้องการออกหรือไม่?')) {
            clearTimer();
            var s = App.storage.getActiveSession();
            if (s) { s.timer.elapsedMs = sessionElapsedMs; App.storage.setActiveSession(s); }
            App.navigate('home');
          }
        }
      }),
      el('div', { class: 'small muted', style: 'white-space:nowrap;', text: (session.index + 1) + ' / ' + session.queue.length }),
      elapsedEl,
      el('div', { class: 'progress-bar', style: 'flex:1; margin:0 4px;' }, [el('div', { class: 'fill', style: 'width:' + Math.round((session.index / session.queue.length) * 100) + '%' })]),
      totalEl
    ]);
    
    root.appendChild(topContainer);

    // --- Timer tick ---
    timerInterval = setInterval(function () {
      if (hiddenAt) return;
      sessionElapsedMs += 1000;
      if (session.timer.mode === 'timed' && !overtimeStarted && sessionElapsedMs >= session.timer.totalMs) {
        overtimeStarted = true;
        showOvertimeModal(session);
      }
      elapsedEl.textContent = formatMs(sessionElapsedMs);
    }, 1000);

    document.addEventListener('visibilitychange', handleVisibility);
    function handleVisibility() {
      if (document.hidden) { hiddenAt = Date.now(); } else if (hiddenAt) { hiddenAt = null; }
    }

    // --- Question card ---
    var card = el('div', { class: 'card' }, [
      el('div', { class: 'small muted', text: App.subjectName(q.subject) + ' • ' + q.topic }),
      el('p', { style: 'font-size:var(--font-question); white-space:pre-wrap; word-break:break-word; margin-top:8px;', text: q.question })
    ]);

    var chosen = existing ? existing.chosen : null;
    var revealed = !!existing;

    var choicesWrap = el('div', { style: 'margin-top:12px;' });
    
    order.forEach(function (origIdx, displayIdx) {
      var btn = el('button', {
        class: 'choice-btn' + (isScrollMode ? ' scroll-mode' : ''),
        type: 'button',
        disabled: revealed,
        onclick: function () {
          if (revealed) return;
          chosen = origIdx;
          choicesWrap.querySelectorAll('.choice-btn').forEach(function (b, i) {
            b.classList.toggle('selected', order[i] === chosen);
          });
          renderConfidence();
        }
      });
      btn.appendChild(el('span', { class: 'choice-tag', text: LETTERS[displayIdx] }));
      btn.appendChild(document.createTextNode(q.choices[origIdx]));
      
      if (revealed) {
        if (origIdx === q.answer) btn.classList.add('correct');
        if (origIdx === chosen && chosen !== q.answer) btn.classList.add('wrong');
      } else if (chosen === origIdx) {
        btn.classList.add('selected');
      }
      choicesWrap.appendChild(btn);
    });

    var bottomWrap = el('div', { style: 'margin-top:12px;' });
    
    function renderConfidence() {
      while (bottomWrap.firstChild) bottomWrap.removeChild(bottomWrap.firstChild);
      if (revealed) return;

      if (chosen != null) {
        var bar = el('div', { class: 'confidence-bar' }, [
          el('div', { class: 'title', text: 'เลือกความมั่นใจเพื่อดูเฉลย' }),
          el('div', { class: 'confidence-options' }, [
            el('button', { class: 'btn', text: 'มั่นใจ', onclick: function () { commitAnswer('sure', q, chosen, session); } }),
            el('button', { class: 'btn', text: 'ไม่แน่ใจ', onclick: function () { commitAnswer('unsure', q, chosen, session); } }),
            el('button', { class: 'btn', text: 'เดา', onclick: function () { commitAnswer('guess', q, chosen, session); } })
          ])
        ]);
        bottomWrap.appendChild(bar);
      }
    }

    if (revealed) {
      bottomWrap.appendChild(buildReveal(q, order, existing, session));
    } else {
      renderConfidence();
    }

    card.appendChild(choicesWrap);
    root.appendChild(card);
    root.appendChild(bottomWrap);

    // 🔥 ปุ่ม Navigation ชิดซ้าย-ขวา ให้ตรงกับ Card
    var isLastQ = (session.index === session.queue.length - 1);
    
    root.appendChild(el('div', { style: 'display:flex; justify-content:space-between; margin-top:24px; margin-bottom:24px;' }, [
      el('button', {
        class: 'icon-btn', 'aria-label': 'ย้อนกลับ', text: '<',
        style: 'width:56px; height:56px; font-size:1.5rem;' + (session.index === 0 ? 'opacity:0.3; pointer-events:none;' : ''),
        disabled: session.index === 0,
        onclick: function () {
          if (session.index > 0) {
            session.index--;
            App.storage.setActiveSession(session);
            App.render();
          }
        }
      }),
      isLastQ ? 
        (!isScrollMode ? el('button', { class: 'btn btn-primary', style: 'height:56px; padding: 0 24px;', text: 'ส่งคำตอบ', onclick: function() { finishSession(session); } }) : el('div', {style: 'width:56px;'})) 
        : 
        el('button', { class: 'icon-btn', 'aria-label': 'ข้อถัดไป', text: '>', style: 'width:56px; height:56px; font-size:1.5rem;', onclick: function () { goNext(session); } })
    ]));

    // 🔥 Floating Submit Button (สำหรับโหมด Scroll)
    if (isLastQ && isScrollMode) {
      root.appendChild(el('button', {
        class: 'btn btn-primary',
        style: 'position:fixed; bottom:80px; right:20px; z-index:99; box-shadow:var(--shadow-md); padding:12px 24px; border-radius:999px;',
        text: 'ส่งคำตอบ',
        onclick: function() { 
          if(App.confirm('ต้องการส่งคำตอบทั้งหมดเลยหรือไม่?')) finishSession(session); 
        }
      }));
    }
  }

  function commitAnswer(confidence, q, chosen, session) {
    var current = session.queue[session.index];
    var correct = chosen === q.answer;
    var type = App.scheduler.classifyAnswer(correct, confidence);
    var timeMs = 1000; 

    var answer = {
      qid: q.id, chosen: chosen, correct: correct, confidence: confidence,
      timeMs: timeMs, cause: null, isRecheck: current.isRecheck === true, type: type
    };

    if (!answer.isRecheck) {
      var progress = App.storage.getProgress();
      var prev = progress[q.id] || {};
      var nbox = App.scheduler.nextBox(prev, type, Date.now());
      nbox.lastConfidence = confidence;
      progress[q.id] = nbox;
      App.storage.setProgress(progress);

      App.recordDaily(q, confidence, correct, timeMs);
      App.recordTopicScore(q, type);
      
      if (!correct) {
        var rechecks = session.recheckCount[q.id] || 0;
        if (rechecks < 2) {
          session.recheckCount[q.id] = rechecks + 1;
          session.queue = App.scheduler.injectRecheck(session.queue, q.id, session.index);
        }
      }
    } else {
      App.recordDaily(q, confidence, correct, timeMs);
    }

    session.answers = session.answers.filter(function(a) { 
      return a.qid !== q.id || String(a.isRecheck) !== String(current.isRecheck); 
    });
    session.answers.push(answer);
    session.timer.elapsedMs = sessionElapsedMs;
    App.storage.setActiveSession(session);
    
    App.render(); 
  }

  function goNext(session) {
    session.index = session.index + 1;
    App.storage.setActiveSession(session);
    if (session.index >= session.queue.length) {
      clearTimer();
      finishSession(session);
    } else {
      App.render();
    }
  }

  function showOvertimeModal(session) {
    var s = App.storage.getActiveSession();
    if (!s || s.timer.overtime) return;
    s.timer.overtime = true;
    App.storage.setActiveSession(s);
    var ans = window.confirm('หมดเวลาแล้ว ทำต่อหรือจบชุด?\n\nOK = ทำต่อ\nCancel = จบชุดและดูสรุป');
    if (!ans) {
      clearTimer();
      finishSession(s);
    }
  }

  function buildReveal(q, order, answer, session) {
    var el = App.el;
    var wrap = el('div', { class: 'stack' });
    var isCorrect = answer.correct;

    wrap.appendChild(
      el('div', { class: isCorrect ? 'banner correct' : 'banner wrong' }, [
        el('div', { class: 'icon', text: isCorrect ? '✓' : '✗' }),
        el('div', null, [
          el('strong', { text: isCorrect ? 'ถูกต้อง' : 'ยังไม่ถูก' })
        ])
      ])
    );

    wrap.appendChild(
      el('div', { class: 'explain-box' }, [
        el('strong', { text: 'ทำไมข้อนี้ถึงถูก' }),
        el('p', { style: 'margin:8px 0 0; white-space:pre-wrap;', text: q.explanation })
      ])
    );

    if (!isCorrect) {
      var causes = ['noKnowledge', 'misread', 'confused'];
      var labels = { noKnowledge: 'ไม่รู้เนื้อหา', misread: 'อ่านโจทย์พลาด', confused: 'สับสนแนวคิด' };
      var chipRow = el('div', { class: 'row' });
      chipRow.appendChild(el('span', { class: 'small muted', text: 'สาเหตุ (ไม่บังคับ):' }));
      causes.forEach(function (c) {
        chipRow.appendChild(el('button', {
          class: 'chip' + (answer.cause === c ? ' selected' : ''),
          text: labels[c],
          onclick: function () {
            var s = App.storage.getActiveSession();
            if (!s) return;
            var a = s.answers.find(function (x) { return x.qid === q.id && !x.isRecheck; });
            if (!a) return;
            a.cause = (a.cause === c) ? null : c; 
            if (a.cause) App.recordCause(q.subject, c);
            App.storage.setActiveSession(s);
            App.render();
          }
        }));
      });
      wrap.appendChild(chipRow);
    }

    var aiRow = el('div', { class: 'row', style: 'flex-wrap:wrap; margin-top:16px;' }, [
      el('button', { class: 'btn', text: 'ถาม AI', onclick: function () { /* ... */ } }),
      el('button', { class: 'btn btn-primary', text: 'แชท AI', onclick: function () { App.chat.open(q, order, answer); } })
    ]);
    wrap.appendChild(aiRow);

    return wrap;
  }

  function finishSession(session) {
    clearTimer();
    var first = session.answers.filter(function (a) { return !a.isRecheck; });
    var correct = first.filter(function (a) { return a.correct; }).length;

    var summary = {
      id: session.id, startedAt: session.startedAt, endedAt: Date.now(), mode: session.mode, n: session.n, correct: correct,
      sure: first.filter(function (a) { return a.confidence === 'sure'; }).length,
      unsure: first.filter(function (a) { return a.confidence === 'unsure'; }).length,
      guess: first.filter(function (a) { return a.confidence === 'guess'; }).length,
      wrongSure: first.filter(function (a) { return !a.correct && a.confidence === 'sure'; }).length,
      durationMs: Date.now() - session.startedAt,
      firstAnswers: first.map(function (a) { return { qid: a.qid, correct: a.correct, confidence: a.confidence, chosen: a.chosen, type: a.type, timeMs: a.timeMs }; })
    };
    var sessions = App.storage.getSessions();
    sessions.unshift(summary);
    App.storage.setSessions(sessions);
    App.storage.setActiveSession(null);
    App.views.summary.setLast(summary);
    App.navigate('summary');
  }

  App.views.session = function (root) { renderSession(root); };
  App.views.session.startNew = startNew;
  App.views.session.clearTimer = clearTimer;
})();