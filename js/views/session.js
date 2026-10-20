/* Session view — with recheck injection, confidence, timers, recordDaily/topicRecent */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];

  function findQuestion(qid) {
    return App.loadQuestions().find(function (q) { return q.id === qid; });
  }

  function startNew(ids, meta) {
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
      timer: { mode: 'untimed', totalMs: 0, elapsedMs: 0, overtime: false },
      recheckCount: {},
      meta: meta || {}
    };
    App.storage.setActiveSession(session);
    App.navigate('session');
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

    // Top bar
    var pct = Math.round((session.index / session.n) * 100);
    root.appendChild(el('div', { class: 'session-top' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'ออก', text: '✕', onclick: function () {
        if (App.confirm('ความคืบหน้าจะถูกเก็บไว้ ต้องการออกหรือไม่?')) App.navigate('home');
      }}),
      el('div', { class: 'small muted', text: (session.index + 1) + ' / ' + session.n }),
      el('div', { class: 'progress-bar' }, [el('div', { class: 'fill', style: 'width:' + pct + '%' })])
    ]));

    // Question
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

      var answer = {
        qid: question.id, chosen: chosen, correct: correct, confidence: confidence,
        timeMs: 0, cause: null, isRecheck: cq.isRecheck === true, type: type
      };

      if (!answer.isRecheck) {
        // Update progress
        var progress = App.storage.getProgress();
        progress[question.id] = App.scheduler.nextBox(progress[question.id], type, Date.now());
        progress[question.id].lastConfidence = confidence;
        App.storage.setProgress(progress);

        // Daily
        App.recordDaily(question, confidence, correct, 0);
        // Topic recent
        App.recordTopicScore(question, type);

        // Insert recheck if wrong
        if (!correct) {
          var rechecks = s.recheckCount[question.id] || 0;
          if (rechecks < 2) {
            s.recheckCount[question.id] = rechecks + 1;
            s.queue = App.scheduler.injectRecheck(s.queue, question.id, s.index);
          }
        }
      } else {
        // Recheck: no box change, no score
        App.recordDaily(question, confidence, correct, 0);
      }

      s.answers.push(answer);
      App.storage.setActiveSession(s);
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
        if (cur.index >= cur.queue.length) finishSession(cur);
        else App.render();
      }
    }));

    return wrap;
  }

  function finishSession(session) {
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
      // Detail for summary view
      firstAnswers: first.map(function (a) { return { qid: a.qid, correct: a.correct, confidence: a.confidence, chosen: a.chosen, type: a.type }; })
    };
    var sessions = App.storage.getSessions();
    sessions.unshift(summary);
    if (sessions.length > 100) sessions.length = 100;
    App.storage.setSessions(sessions);
    App.storage.setActiveSession(null);
    App.views.summary.setLast(summary);
    App.navigate('summary');
  }

  App.views.session = function (root) { renderSession(root); };
  App.views.session.startNew = startNew;
})();