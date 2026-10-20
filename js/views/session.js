/* Session view — timers (untimed/timed), visibility pause, per-question timing */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  var timerInterval = null;
  var questionStartAt = null;
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
    var existing = session.answers.find(function (a) { return a.qid === q.id && !a.isRecheck; });

    // --- Top bar with timer ---
    var timerEl = el('div', {
      class: 'small muted',
      style: 'font-variant-numeric: tabular-nums; min-width:60px; text-align:right;',
      text: formatMs(sessionElapsedMs || session.timer.elapsedMs || 0)
    });
    var pct = Math.round((session.index / session.n) * 100);
    root.appendChild(el('div', { class: 'session-top' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'ออก', text: '✕', onclick: function () {
        if (App.confirm('ความคืบหน้าจะถูกเก็บไว้ ต้องการออกหรือไม่?')) {
          clearTimer();
          var s = App.storage.getActiveSession();
          if (s) { s.timer.elapsedMs = sessionElapsedMs; App.storage.setActiveSession(s); }
          App.navigate('home');
        }
      }}),
      el('div', { class: 'small muted', text: (session.index + 1) + ' / ' + session.n }),
      timerEl,
      el('div', { class: 'progress-bar' }, [el('div', { class: 'fill', style: 'width:' + pct + '%' })])
    ]));

    // --- Timer tick ---
    clearTimer();
    var questionStart = Date.now();
    var answerCommitAt = null;
    timerInterval = setInterval(function () {
      if (hiddenAt) return;
      sessionElapsedMs += 1000;
      if (session.timer.mode === 'timed' && !overtimeStarted && sessionElapsedMs >= session.timer.totalMs) {
        overtimeStarted = true;
        showOvertimeModal(session);
      }
      var remainOrElapsed = session.timer.mode === 'timed' && !overtimeStarted
        ? (session.timer.totalMs - sessionElapsedMs)
        : sessionElapsedMs;
      timerEl.textContent = formatMs(Math.max(0, remainOrElapsed));
    }, 1000);

    document.addEventListener('visibilitychange', handleVisibility);
    function handleVisibility() {
      if (document.hidden) { hiddenAt = Date.now(); }
      else if (hiddenAt) {
        hiddenAt = null;
      }
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
        class: 'choice-btn',
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
      if (revealed || chosen == null) return;
      var bar = el('div', { class: 'confidence-bar' }, [
        el('div', { class: 'title', text: 'เลือกความมั่นใจเพื่อดูเฉลย' }),
        el('div', { class: 'confidence-options' }, [
          el('button', { class: 'btn', text: 'มั่นใจ', onclick: function () { commitAnswer('sure'); } }),
          el('button', { class: 'btn', text: 'ไม่แน่ใจ', onclick: function () { commitAnswer('unsure'); } }),
          el('button', { class: 'btn', text: 'เดา', onclick: function () { commitAnswer('guess'); } })
        ])
      ]);
      bottomWrap.appendChild(bar);
    }

    function commitAnswer(confidence) {
      var s = App.storage.getActiveSession();
      if (!s) return;
      var cq = s.queue[s.index];
      var question = findQuestion(cq.qid);
      if (!question) return;
      var correct = chosen === question.answer;
      var type = App.scheduler.classifyAnswer(correct, confidence);
      var timeMs = Date.now() - questionStart;

      var answer = {
        qid: question.id, chosen: chosen, correct: correct, confidence: confidence,
        timeMs: timeMs, cause: null, isRecheck: cq.isRecheck === true, type: type
      };

      if (!answer.isRecheck) {
        var progress = App.storage.getProgress();
        var prev = progress[question.id] || {};
        var nbox = App.scheduler.nextBox(prev, type, Date.now());
        nbox.lastConfidence = confidence;
        nbox.lastTimeMs = timeMs;
        nbox.avgTimeMs = prev.avgTimeMs ? Math.round((prev.avgTimeMs + timeMs) / 2) : timeMs;
        progress[question.id] = nbox;
        App.storage.setProgress(progress);

        App.recordDaily(question, confidence, correct, timeMs);
        App.recordTopicScore(question, type);

        if (!correct) {
          var rechecks = s.recheckCount[question.id] || 0;
          if (rechecks < 2) {
            s.recheckCount[question.id] = rechecks + 1;
            s.queue = App.scheduler.injectRecheck(s.queue, question.id, s.index);
          }
        }
      } else {
        App.recordDaily(question, confidence, correct, timeMs);
      }

      s.answers.push(answer);
      s.timer.elapsedMs = sessionElapsedMs;
      App.storage.setActiveSession(s);
      clearTimer();
      renderSession(root);
    }

    if (revealed) {
      bottomWrap.appendChild(buildReveal(q, order, existing));
    } else {
      renderConfidence();
    }

    card.appendChild(choicesWrap);
    root.appendChild(card);
    root.appendChild(bottomWrap);
  }

  function showOvertimeModal(session) {
    var s = App.storage.getActiveSession();
    if (!s || s.timer.overtime) return;
    s.timer.overtime = true;
    App.storage.setActiveSession(s);
    var ans = window.confirm('หมดเวลาแล้ว ทำต่อหรือจบชุด?\n\nOK = ทำต่อ (นับเวลาต่อแบบนับขึ้น)\nCancel = จบชุดและดูสรุป');
    if (!ans) {
      clearTimer();
      finishSession(s);
    } else {
      // Continue in overtime; timer switches to count-up automatically via session.timer.overtime
    }
  }

  function buildReveal(q, order, answer) {
    var el = App.el;
    var wrap = el('div', { class: 'stack' });
    var isCorrect = answer.correct;
    var isWrongSure = !isCorrect && answer.confidence === 'sure';

    wrap.appendChild(
      el('div', { class: isCorrect ? 'banner correct' : 'banner wrong' }, [
        el('div', { class: 'icon', text: isCorrect ? '✓' : '✗' }),
        el('div', null, [
          el('strong', { text: isCorrect ? 'ถูกต้อง' : 'ยังไม่ถูก' }),
          isWrongSure ? el('p', { class: 'small', text: 'ข้อนี้มั่นใจแต่ผิด น่าจะมีแนวคิดที่เข้าใจคลาดเคลื่อน ลองอ่านคำอธิบายให้ละเอียด' }) : null
        ])
      ])
    );
    if (!isCorrect) wrap.appendChild(el('p', { class: 'small muted', text: 'ข้อนี้จะกลับมาอีกครั้งในชุดนี้' }));

    wrap.appendChild(
      el('div', { class: 'explain-box' }, [
        el('strong', { text: 'ทำไมข้อนี้ถึงถูก' }),
        el('p', { style: 'margin:8px 0 0; white-space:pre-wrap;', text: q.explanation })
      ])
    );

    if (q.whyWrong && q.whyWrong.length === q.choices.length) {
      var details = el('details', { class: 'details' }, [
        el('summary', { text: 'ทำไมตัวเลือกอื่นถึงผิด' })
      ]);
      var body = el('div', { class: 'body' });
      order.forEach(function (origIdx, displayIdx) {
        if (origIdx === q.answer) return;
        var text = q.whyWrong[origIdx];
        if (!text) return;
        var d = el('details', { class: 'details' }, [
          el('summary', { text: 'ตัวเลือก ' + LETTERS[displayIdx] + '. ' + q.choices[origIdx] }),
          el('div', { class: 'body', text: text })
        ]);
        if (origIdx === answer.chosen) d.setAttribute('open', '');
        body.appendChild(d);
      });
      details.appendChild(body);
      wrap.appendChild(details);
    }

    if (!isCorrect) {
      var causes = ['noKnowledge', 'misread', 'confused'];
      var labels = { noKnowledge: 'ไม่รู้เนื้อหา', misread: 'อ่านโจทย์พลาด', confused: 'สับสนแนวคิดที่คล้ายกัน' };
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
            if (a.cause === c) { a.cause = null; }
            else { App.recordCause(q.subject, c); a.cause = c; }
            App.storage.setActiveSession(s);
            App.render();
          }
        }));
      });
      wrap.appendChild(chipRow);
    }

    var aiRow = el('div', { class: 'row' }, [
      el('button', { class: 'btn', text: 'ถาม AI', onclick: function () {
        var text = App.askai.buildAskAIText(q, order, answer.chosen, answer.confidence);
        App.askai.copyText(text).then(
          function () { App.toast('คัดลอกแล้ว เปิด Claude เพื่อวาง'); window.open('https://claude.ai', '_blank', 'noopener'); },
          function () { App.toast('คัดลอกไม่สำเร็จ'); }
        );
      }}),
      el('button', { class: 'btn btn-ghost', text: 'แก้ไขข้อนี้', onclick: function () { window.location.hash = '#/manage?edit=' + encodeURIComponent(q.id); } })
    ]);
    wrap.appendChild(aiRow);

    var s = App.storage.getActiveSession();
    var isLast = s && s.index >= s.queue.length - 1;
    wrap.appendChild(el('button', {
      class: 'btn btn-primary btn-block',
      text: isLast ? 'ดูสรุป' : 'ข้อถัดไป',
      onclick: function () {
        var cur = App.storage.getActiveSession();
        if (!cur) return;
        cur.index = cur.index + 1;
        App.storage.setActiveSession(cur);
        if (cur.index >= cur.queue.length) { clearTimer(); finishSession(cur); }
        else App.render();
      }
    }));

    return wrap;
  }

  function finishSession(session) {
    clearTimer();
    var first = session.answers.filter(function (a) { return !a.isRecheck; });
    var rechecks = session.answers.filter(function (a) { return a.isRecheck; });
    var correct = first.filter(function (a) { return a.correct; }).length;

    var summary = {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      mode: session.mode,
      n: session.n,
      correct: correct,
      sure: first.filter(function (a) { return a.confidence === 'sure'; }).length,
      unsure: first.filter(function (a) { return a.confidence === 'unsure'; }).length,
      guess: first.filter(function (a) { return a.confidence === 'guess'; }).length,
      wrongSure: first.filter(function (a) { return !a.correct && a.confidence === 'sure'; }).length,
      durationMs: Date.now() - session.startedAt,
      recheckTotal: rechecks.length,
      recheckCorrect: rechecks.filter(function (a) { return a.correct; }).length,
      firstAnswers: first.map(function (a) {
        return { qid: a.qid, correct: a.correct, confidence: a.confidence, chosen: a.chosen, type: a.type, timeMs: a.timeMs };
      })
    };
    var sessions = App.storage.getSessions();
    sessions.unshift(summary);
    if (sessions.length > 100) sessions.length = 100;
    App.storage.setSessions(sessions);
    App.storage.setActiveSession(null);

    // Request persistent storage once after first session
    if (sessions.length === 1) App.scheduler.ensurePersist();

    App.views.summary.setLast(summary);
    App.navigate('summary');
  }

  App.views.session = function (root) { renderSession(root); };
  App.views.session.startNew = startNew;
})();