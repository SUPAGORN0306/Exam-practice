/* Session view — Free Navigation, continuous timer, unified UI, submit, grid navigator */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  var timerInterval = null;
  var sessionElapsedMs = 0;
  var overtimeStarted = false;
  var hiddenAt = null;
  var currentSessionId = null;   
  var questionStartMs = 0;       
  var lastSaveMs = 0;

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); }
    else { hiddenAt = null; }
  });

  function findQuestion(qid) {
    return App.loadQuestions().find(function (q) { return q.id === qid; });
  }

  function clearTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function syncTimerWithSession(session) {
    if (currentSessionId !== session.id) {
      currentSessionId = session.id;
      sessionElapsedMs = (session.timer && session.timer.elapsedMs) || 0;
      overtimeStarted = !!(session.timer && session.timer.overtime);
      questionStartMs = sessionElapsedMs;
    }
  }

  function saveElapsed() {
    var s = App.storage.getActiveSession();
    if (s) { s.timer.elapsedMs = sessionElapsedMs; App.storage.setActiveSession(s); }
  }

  function startTick(session, elapsedEl, onTick) {
    clearTimer();
    timerInterval = setInterval(function () {
      if (hiddenAt) return;
      sessionElapsedMs += 1000;
      if (session.timer.mode === 'timed' && !overtimeStarted && sessionElapsedMs >= session.timer.totalMs) {
        overtimeStarted = true;
        showOvertimeModal(session);
      }
      if (elapsedEl) elapsedEl.textContent = formatMs(sessionElapsedMs);
      if (onTick) onTick();
      if (sessionElapsedMs - lastSaveMs >= 5000) { lastSaveMs = sessionElapsedMs; saveElapsed(); }
    }, 1000);
  }

  function countAnswered(session) {
    return session.queue.filter(function (cur) {
      return session.answers.some(function (a) { 
        return a.qid === cur.qid && String(a.isRecheck) === String(cur.isRecheck) && a.chosen != null; 
      });
    }).length;
  }

  function countUnanswered(session) {
    return session.queue.length - countAnswered(session);
  }

  function getUnansweredList(session) {
    var list = [];
    session.queue.forEach(function (cur, idx) {
      var hasAnswer = session.answers.some(function (a) { 
        return a.qid === cur.qid && String(a.isRecheck) === String(cur.isRecheck) && a.chosen != null; 
      });
      if (!hasAnswer) list.push(idx + 1);
    });
    return list;
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
    currentSessionId = session.id;
    sessionElapsedMs = 0;
    questionStartMs = 0;
    lastSaveMs = 0;
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

    syncTimerWithSession(session);

    var isScrollMode = (localStorage.getItem('answerMode') || 'button') === 'scroll';
    if (isScrollMode) {
      renderScrollMode(root, session);
    } else {
      renderButtonMode(root, session);
    }
  }

  // ==========================================
  // 🔥 ฟังก์ชันสร้าง Grid Navigator (แบบกรอบสี)
  // ==========================================
  function openGridNavigator(session, onSelect) {
    // 🔥 ดึงข้อมูลสดๆ จาก Storage ทันที
    session = App.storage.getActiveSession();
    if (!session) return;

    var el = App.el;
    var overlay = el('div', {
      style: 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:60; display:flex; align-items:flex-end; justify-content:flex-start;',
      onclick: function (e) {
        if (e.target === overlay) closeGrid();
      }
    });

    var panel = el('div', {
      style: 'position:absolute; bottom:90px; left:16px; background:var(--surface); border-radius:16px; padding:16px; z-index:61; max-width:280px; max-height:60vh; overflow-y:auto; box-shadow:0 8px 24px rgba(0,0,0,0.2);'
    });

    panel.appendChild(el('h4', { style: 'margin: 0 0 12px; font-size: 0.95rem;', text: 'ผังข้อสอบ' }));
    
    panel.appendChild(el('div', { class: 'row', style: 'gap:12px; margin-bottom:12px; font-size:0.75rem;' }, [
      el('div', { class: 'row', style: 'gap:4px;' }, [
        el('div', { style: 'width:14px; height:14px; background:rgba(30,127,79,0.1); border:2px solid var(--correct); border-radius:3px;' }),
        el('span', { class: 'muted', text: 'ตอบแล้ว' })
      ]),
      el('div', { class: 'row', style: 'gap:4px;' }, [
        el('div', { style: 'width:14px; height:14px; background:rgba(192,57,43,0.1); border:2px solid var(--wrong); border-radius:3px;' }),
        el('span', { class: 'muted', text: 'ยังไม่ได้ตอบ' })
      ])
    ]));

    var grid = el('div', { style: 'display:grid; grid-template-columns: repeat(5, 1fr); gap:6px;' });
    
    session.queue.forEach(function (cur, idx) {
      var answered = session.answers.some(function (a) { 
        return a.qid === cur.qid && String(a.isRecheck) === String(cur.isRecheck) && a.chosen != null; 
      });
      var isCurrent = (session.index === idx);
      
      var bgColor = answered ? 'rgba(30,127,79,0.1)' : 'rgba(192,57,43,0.1)';
      var borderColor = answered ? 'var(--correct)' : 'var(--wrong)';
      var textColor = answered ? 'var(--correct)' : 'var(--wrong)';
      
      var cell = el('button', {
        type: 'button',
        style: 'width:40px; height:40px; border-radius:8px; ' +
               'background:' + bgColor + '; ' +
               'border:2px solid ' + borderColor + '; ' +
               'color:' + textColor + '; ' +
               'font-weight:700; font-size:0.85rem; cursor:pointer; ' +
               (isCurrent ? 'outline:2px solid var(--primary); outline-offset:2px;' : ''),
        text: String(idx + 1),
        onclick: function () {
          closeGrid();
          onSelect(idx);
        }
      });
      grid.appendChild(cell);
    });
    
    panel.appendChild(grid);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function closeGrid() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  }

  // ==========================================
  // 🔥 โหมด Scroll
  // ==========================================
  function renderScrollMode(root, session) {
    var el = App.el;
    var s = App.storage.getActiveSession();

    var isTimed = s.timer.mode === 'timed';
    var elapsedEl = el('div', { class: 'small', style: 'font-variant-numeric: tabular-nums; font-weight:700; white-space:nowrap;', text: formatMs(sessionElapsedMs) });

    // 🔥 ดึงจำนวนข้อที่ตอบแล้ว (ใช้ฟังก์ชันที่ดึงจาก storage สดๆ)
    var answeredCounterEl = el('div', { class: 'small muted', style: 'white-space:nowrap;', text: countAnswered(s) + ' / ' + s.queue.length });

    var progressFill = el('div', { class: 'fill', style: 'width:0%' });
    var progressBarEl = isTimed ? el('div', { class: 'progress-bar', style: 'flex:1; margin:0 4px;' }, [progressFill]) : null;
    var totalEl = isTimed ? el('div', { class: 'small muted', style: 'font-variant-numeric: tabular-nums; white-space:nowrap;', text: formatMs(s.timer.totalMs) }) : null;

    var topChildren = [
      el('button', {
        class: 'icon-btn', 'aria-label': 'ออก', text: '✕',
        onclick: function () {
          if (App.confirm('ความคืบหน้าจะถูกเก็บไว้ ต้องการออกหรือไม่?')) {
            clearTimer();
            saveElapsed();
            App.navigate('home');
          }
        }
      }),
      answeredCounterEl,
      elapsedEl
    ];
    if (progressBarEl) topChildren.push(progressBarEl);
    if (totalEl) topChildren.push(totalEl);

    var topContainer = el('div', { class: 'session-top', style: 'display:flex; align-items:center; gap:10px; margin-bottom:16px; width:100%;' }, topChildren);
    root.appendChild(topContainer);

    startTick(session, elapsedEl, function() {
      if (isTimed && s.timer.totalMs > 0) {
        var pct = Math.min(100, Math.round((sessionElapsedMs / s.timer.totalMs) * 100));
        progressFill.style.width = pct + '%';
      }
    });

    s.queue.forEach(function (current, idx) {
      var q = findQuestion(current.qid);
      if (!q) return;

      var order = s.choiceOrders[q.id] || q.choices.map(function (_, i) { return i; });
      var existing = s.answers.find(function (a) {
        return a.qid === q.id && String(a.isRecheck) === String(current.isRecheck);
      });
      var revealedAlready = !!(existing && existing.confidence); 

      var card = el('div', { class: 'card', style: 'margin-bottom:24px;', id: 'q-card-' + idx }, [
        el('div', { class: 'row', style: 'justify-content:space-between; margin-bottom:12px;' }, [
          el('div', { class: 'small muted', text: 'ข้อ ' + (idx + 1) + ' / ' + s.queue.length }),
          el('div', { class: 'small muted', text: App.subjectName(q.subject) + ' • ' + q.topic })
        ]),
        el('p', { style: 'font-size:var(--font-question); white-space:pre-wrap; word-break:break-word; font-weight: 600;', text: q.question })
      ]);

      var choicesWrap = el('div', { style: 'margin-top:12px;' });

      order.forEach(function (origIdx, displayIdx) {
        var btn = el('button', {
          class: 'choice-btn' + (existing && existing.chosen === origIdx ? ' selected' : ''),
          type: 'button',
          onclick: function () {
            if (revealedAlready) return; 

            choicesWrap.querySelectorAll('.choice-btn').forEach(function (b, i) {
              b.classList.toggle('selected', order[i] === origIdx);
            });

            var activeS = App.storage.getActiveSession();
            var cq = activeS.queue[idx];
            var tempExisting = activeS.answers.find(function (a) { return a.qid === q.id && String(a.isRecheck) === String(cq.isRecheck); });
            if (!tempExisting) {
              activeS.answers.push({ qid: q.id, chosen: origIdx, confidence: null, isRecheck: cq.isRecheck, correct: null });
            } else {
              tempExisting.chosen = origIdx;
            }
            activeS.timer.elapsedMs = sessionElapsedMs;
            App.storage.setActiveSession(activeS);

            s = activeS;
            existing = { qid: q.id, chosen: origIdx, confidence: null, isRecheck: cq.isRecheck, correct: null };

            // 🔥 อัปเดตตัวเลขทันที
            answeredCounterEl.textContent = countAnswered(activeS) + ' / ' + activeS.queue.length;
          }
        });
        btn.appendChild(el('span', { class: 'choice-tag', text: LETTERS[displayIdx] }));
        btn.appendChild(document.createTextNode(q.choices[origIdx]));
        choicesWrap.appendChild(btn);
      });

      if (revealedAlready) {
        choicesWrap.querySelectorAll('.choice-btn').forEach(function (b, i) {
          if (order[i] === q.answer) b.classList.add('correct');
          else if (order[i] === existing.chosen) b.classList.add('wrong');
        });
      }

      card.appendChild(choicesWrap);
      root.appendChild(card);
    });

    var submitWrap = el('div', { style: 'margin-top:24px; margin-bottom:80px;' }, [
      el('button', {
        class: 'btn btn-primary btn-block',
        style: 'height:56px; font-size:1.1rem;',
        text: 'ส่งคำตอบ',
        onclick: function () {
          var activeS = App.storage.getActiveSession();
          var unansweredList = getUnansweredList(activeS);
          
          var msg;
          if (unansweredList.length > 0) {
            msg = 'คุณยังไม่ได้ตอบข้อ: ' + unansweredList.join(', ') + '\n\nต้องการส่งคำตอบเลยหรือไม่? (ข้อที่ไม่ได้ตอบจะถูกนับว่าผิด)';
          } else {
            msg = 'คุณตอบครบทุกข้อแล้ว ต้องการส่งคำตอบหรือไม่?';
          }
          if (!App.confirm(msg)) return;

          clearTimer();
          var perQ = Math.max(1000, Math.round(sessionElapsedMs / Math.max(1, activeS.queue.length)));

          activeS.queue.forEach(function (current) {
            var q = findQuestion(current.qid);
            if (!q) return;

            var existing = activeS.answers.find(function (a) {
              return a.qid === q.id && String(a.isRecheck) === String(current.isRecheck);
            });

            if (existing && existing.chosen != null && !existing.confidence) {
              var correct = existing.chosen === q.answer;
              existing.correct = correct;
              existing.confidence = correct ? 'sure' : 'guess';
              existing.type = App.scheduler.classifyAnswer(correct, existing.confidence);
              existing.timeMs = perQ;

              if (!existing.isRecheck) {
                var progress = App.storage.getProgress();
                var prev = progress[q.id] || {};
                var nbox = App.scheduler.nextBox(prev, existing.type, Date.now());
                nbox.lastConfidence = existing.confidence;
                nbox.lastChosen = existing.chosen; 
                progress[q.id] = nbox;
                App.storage.setProgress(progress);
                App.recordDaily(q, existing.confidence, correct, perQ);
                App.recordTopicScore(q, existing.type);
              }
            }
          });
          activeS.timer.elapsedMs = sessionElapsedMs;
          App.storage.setActiveSession(activeS);
          finishSession(activeS);
        }
      })
    ]);
    root.appendChild(submitWrap);

    // 🔥 ปุ่ม Grid Navigator (มุมล่างซ้าย)
    root.appendChild(el('button', {
      class: 'icon-btn',
      style: 'position:fixed; bottom:90px; left:16px; z-index:55; width:56px; height:56px; border-radius:50%; box-shadow:0 4px 12px rgba(0,0,0,0.2); background:var(--primary); color:var(--primary-contrast); border:none;',
      'aria-label': 'เปิดผังข้อสอบ',
      text: '▦',
      onclick: function () {
        // 🔥 ดึง session ล่าสุดจาก storage (เพราะ s ในหน่วยความจำอาจจะอัปเดตแล้ว)
        openGridNavigator(App.storage.getActiveSession(), function (idx) {
          var targetCard = document.getElementById('q-card-' + idx);
          if (targetCard) {
            // 🔥 block: 'center' ทำให้โจทย์อยู่กลางจอ
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    }));
  }

  // ==========================================
  // 🔥 โหมด Button
  // ==========================================
  function renderButtonMode(root, session) {
    var el = App.el;
    var s = App.storage.getActiveSession();
    var current = s.queue[s.index];
    if (!current) { finishSession(s); return; }
    var q = findQuestion(current.qid);
    if (!q) {
      s.index++;
      App.storage.setActiveSession(s);
      renderButtonMode(root, s);
      return;
    }

    var order = s.choiceOrders[q.id] || q.choices.map(function (_, i) { return i; });
    var existing = s.answers.find(function (a) {
      return a.qid === q.id && String(a.isRecheck) === String(current.isRecheck);
    });

    var isTimed = s.timer.mode === 'timed';
    var elapsedEl = el('div', { class: 'small', style: 'font-variant-numeric: tabular-nums; font-weight:700; white-space:nowrap;', text: formatMs(sessionElapsedMs) });

    var answeredCounterEl = el('div', { class: 'small muted', style: 'white-space:nowrap;', text: countAnswered(s) + ' / ' + s.queue.length });

    var progressFill = el('div', { class: 'fill', style: 'width:0%' });
    var progressBarEl = isTimed ? el('div', { class: 'progress-bar', style: 'flex:1; margin:0 4px;' }, [progressFill]) : null;
    var totalEl = isTimed ? el('div', { class: 'small muted', style: 'font-variant-numeric: tabular-nums; white-space:nowrap;', text: formatMs(s.timer.totalMs) }) : null;

    var topChildren = [
      el('button', {
        class: 'icon-btn', 'aria-label': 'ออก', text: '✕',
        onclick: function () {
          if (App.confirm('ความคืบหน้าจะถูกเก็บไว้ ต้องการออกหรือไม่?')) {
            clearTimer();
            saveElapsed();
            App.navigate('home');
          }
        }
      }),
      answeredCounterEl,
      elapsedEl
    ];
    if (progressBarEl) topChildren.push(progressBarEl);
    if (totalEl) topChildren.push(totalEl);

    var topContainer = el('div', { class: 'session-top', style: 'display:flex; align-items:center; gap:10px; margin-bottom:16px; width:100%;' }, topChildren);
    root.appendChild(topContainer);

    startTick(s, elapsedEl, function() {
      if (isTimed && s.timer.totalMs > 0) {
        var pct = Math.min(100, Math.round((sessionElapsedMs / s.timer.totalMs) * 100));
        progressFill.style.width = pct + '%';
      }
    });

    var card = el('div', { class: 'card' }, [
      el('div', { class: 'small muted', text: App.subjectName(q.subject) + ' • ' + q.topic }),
      el('p', { style: 'font-size:var(--font-question); white-space:pre-wrap; word-break:break-word; margin-top:8px;', text: q.question })
    ]);

    var chosen = existing ? existing.chosen : null;
    var revealed = existing ? !!existing.confidence : false;

    var choicesWrap = el('div', { style: 'margin-top:12px;' });

    order.forEach(function (origIdx, displayIdx) {
      var btn = el('button', {
        class: 'choice-btn' + (chosen === origIdx ? ' selected' : ''),
        type: 'button',
        disabled: revealed,
        onclick: function () {
          if (revealed) return;
          chosen = origIdx;

          var activeS = App.storage.getActiveSession();
          var cq = activeS.queue[activeS.index];
          var tempExisting = activeS.answers.find(function (a) { return a.qid === q.id && String(a.isRecheck) === String(cq.isRecheck); });

          if (!tempExisting) {
            activeS.answers.push({ qid: q.id, chosen: chosen, confidence: null, isRecheck: cq.isRecheck, correct: null });
          } else {
            tempExisting.chosen = chosen;
          }
          App.storage.setActiveSession(activeS);

          answeredCounterEl.textContent = countAnswered(activeS) + ' / ' + activeS.queue.length;

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
            el('button', { class: 'btn', text: 'มั่นใจ', onclick: function () { commitAnswer('sure', q, chosen); } }),
            el('button', { class: 'btn', text: 'ไม่แน่ใจ', onclick: function () { commitAnswer('unsure', q, chosen); } }),
            el('button', { class: 'btn', text: 'เดา', onclick: function () { commitAnswer('guess', q, chosen); } })
          ])
        ]);
        bottomWrap.appendChild(bar);
      }
    }

    if (revealed) {
      bottomWrap.appendChild(buildReveal(q, order, existing));
    } else {
      renderConfidence();
    }

    card.appendChild(choicesWrap);
    root.appendChild(card);
    root.appendChild(bottomWrap);

    var isLastQ = (s.index === s.queue.length - 1);
    root.appendChild(el('div', { style: 'display:flex; justify-content:space-between; margin-top:24px; margin-bottom:24px;' }, [
      el('button', {
        class: 'icon-btn', 'aria-label': 'ย้อนกลับ', text: '<',
        style: 'width:56px; height:56px; font-size:1.5rem;' + (s.index === 0 ? 'opacity:0.3; pointer-events:none;' : ''),
        disabled: s.index === 0,
        onclick: function () {
          if (s.index > 0) {
            s.index--;
            s.timer.elapsedMs = sessionElapsedMs;
            questionStartMs = sessionElapsedMs;
            App.storage.setActiveSession(s);
            App.render();
          }
        }
      }),
      isLastQ ?
        el('button', { 
          class: 'btn btn-primary', 
          style: 'height:56px; padding: 0 24px;', 
          text: 'ส่งคำตอบ', 
          onclick: function () { 
            var activeS = App.storage.getActiveSession();
            var unansweredList = getUnansweredList(activeS);
            
            var msg;
            if (unansweredList.length > 0) {
              msg = 'คุณยังไม่ได้ตอบข้อ: ' + unansweredList.join(', ') + '\n\nต้องการส่งคำตอบเลยหรือไม่? (ข้อที่ไม่ได้ตอบจะถูกนับว่าผิด)';
            } else {
              msg = 'คุณตอบครบทุกข้อแล้ว ต้องการส่งคำตอบหรือไม่?';
            }
            if (!App.confirm(msg)) return;

            clearTimer(); 
            finishSession(activeS); 
          } 
        })
        :
        el('button', { class: 'icon-btn', 'aria-label': 'ข้อถัดไป', text: '>', style: 'width:56px; height:56px; font-size:1.5rem;', onclick: function () { goNext(s); } })
    ]));

    // 🔥 ปุ่ม Grid Navigator (มุมล่างซ้าย)
    root.appendChild(el('button', {
      class: 'icon-btn',
      style: 'position:fixed; bottom:90px; left:16px; z-index:55; width:56px; height:56px; border-radius:50%; box-shadow:0 4px 12px rgba(0,0,0,0.2); background:var(--primary); color:var(--primary-contrast); border:none;',
      'aria-label': 'เปิดผังข้อสอบ',
      text: '▦',
      onclick: function () {
        openGridNavigator(App.storage.getActiveSession(), function (idx) {
          var activeS = App.storage.getActiveSession();
          activeS.index = idx;
          activeS.timer.elapsedMs = sessionElapsedMs;
          App.storage.setActiveSession(activeS);
          App.render();
        });
      }
    }));
  }

  function commitAnswer(confidence, q, chosen) {
    var s = App.storage.getActiveSession();
    var current = s.queue[s.index];
    var correct = chosen === q.answer;
    var type = App.scheduler.classifyAnswer(correct, confidence);
    var timeMs = Math.max(1000, sessionElapsedMs - questionStartMs);

    var existing = s.answers.find(function (a) {
      return a.qid === q.id && String(a.isRecheck) === String(current.isRecheck);
    });

    if (existing) {
      existing.confidence = confidence;
      existing.correct = correct;
      existing.type = type;
      existing.timeMs = timeMs; 
      existing.chosen = chosen; 
    } else {
      s.answers.push({
        qid: q.id, chosen: chosen, correct: correct, confidence: confidence, timeMs: timeMs, cause: null, isRecheck: current.isRecheck, type: type
      });
    }

    if (!current.isRecheck) {
      var progress = App.storage.getProgress();
      var prev = progress[q.id] || {};
      var nbox = App.scheduler.nextBox(prev, type, Date.now());
      nbox.lastConfidence = confidence;
      nbox.lastChosen = chosen; 
      progress[q.id] = nbox;
      App.storage.setProgress(progress);

      App.recordDaily(q, confidence, correct, timeMs);
      App.recordTopicScore(q, type);

      if (!correct) {
        var rechecks = s.recheckCount[q.id] || 0;
        if (rechecks < 2) {
          s.recheckCount[q.id] = rechecks + 1;
          s.queue = App.scheduler.injectRecheck(s.queue, q.id, s.index);
        }
      }
    } else {
      App.recordDaily(q, confidence, correct, timeMs);
    }

    s.timer.elapsedMs = sessionElapsedMs;
    App.storage.setActiveSession(s);

    App.render();
  }

  function goNext(session) {
    var s = App.storage.getActiveSession();
    s.index = s.index + 1;
    s.timer.elapsedMs = sessionElapsedMs;
    questionStartMs = sessionElapsedMs;
    App.storage.setActiveSession(s);
    if (s.index >= s.queue.length) {
      clearTimer();
      finishSession(s);
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

  function buildReveal(q, order, answer) {
    var el = App.el;
    var wrap = el('div', { class: 'stack' });
    var isCorrect = answer.correct;

    wrap.appendChild(
      el('div', { class: isCorrect ? 'banner correct' : 'banner wrong' }, [
        el('div', { class: 'icon', text: isCorrect ? '✓' : '✗' }),
        el('div', null, [ el('strong', { text: isCorrect ? 'ถูกต้อง' : 'ยังไม่ถูก' }) ])
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
      el('button', { 
        class: 'btn', 
        text: 'ถาม AI (คัดลอก)', 
        onclick: function () {
          var text;
          if (App.askai && App.askai.buildAskAIText) {
            text = App.askai.buildAskAIText(q, order, answer.chosen, answer.confidence);
          } else {
            text = 'โจทย์: ' + q.question + '\n';
            text += 'คำตอบที่ฉันเลือก: ' + q.choices[answer.chosen] + '\n';
            text += 'คำตอบที่ถูก: ' + q.choices[q.answer] + '\n';
            text += 'คำอธิบาย: ' + q.explanation + '\n';
            text += '\nช่วยอธิบายเพิ่มเติมว่าทำไมข้อนี้ถึงตอบแบบนี้ และฉันควรระวังอะไรบ้าง';
          }

          if (App.askai && App.askai.copyText) {
            App.askai.copyText(text).then(function () {
              App.toast('คัดลอกข้อความแล้ว เปิดเว็บ AI เพื่อวาง');
              window.open('https://claude.ai', '_blank', 'noopener');
            }, function () {
              App.toast('คัดลอกไม่สำเร็จ');
            });
          } else {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(function () {
                App.toast('คัดลอกข้อความแล้ว เปิดเว็บ AI เพื่อวาง');
                window.open('https://claude.ai', '_blank', 'noopener');
              }, function () {
                App.toast('คัดลอกไม่สำเร็จ');
              });
            } else {
              App.toast('เบราว์เซอร์นี้ไม่รองรับการคัดลอกอัตโนมัติ');
            }
          }
        }
      }),
      el('button', { 
        class: 'btn btn-primary', 
        text: 'แชท AI', 
        onclick: function () { 
          if (App.chat && App.chat.open) {
            App.chat.open(q, order, answer); 
          } else {
            App.toast('ฟีเจอร์แชท AI ยังไม่พร้อม');
          }
        } 
      })
    ]);
    wrap.appendChild(aiRow);

    return wrap;
  }

  function finishSession(session) {
    clearTimer();
    var first = session.answers.filter(function (a) { return !a.isRecheck && a.confidence; });
    var correct = first.filter(function (a) { return a.correct; }).length;

    var summary = {
      id: session.id, startedAt: session.startedAt, endedAt: Date.now(), mode: session.mode, n: session.n, correct: correct,
      sure: first.filter(function (a) { return a.confidence === 'sure'; }).length,
      unsure: first.filter(function (a) { return a.confidence === 'unsure'; }).length,
      guess: first.filter(function (a) { return a.confidence === 'guess'; }).length,
      wrongSure: first.filter(function (a) { return !a.correct && a.confidence === 'sure'; }).length,
      durationMs: sessionElapsedMs || (Date.now() - session.startedAt),
      firstAnswers: first.map(function (a) { return { qid: a.qid, correct: a.correct, confidence: a.confidence, chosen: a.chosen, type: a.type, timeMs: a.timeMs }; })
    };
    var sessions = App.storage.getSessions();
    sessions.unshift(summary);
    App.storage.setSessions(sessions);
    App.storage.setActiveSession(null);
    currentSessionId = null;
    App.views.summary.setLast(summary);
    App.navigate('summary');
  }

  App.views.session = function (root) { renderSession(root); };
  App.views.session.startNew = startNew;
  App.views.session.clearTimer = clearTimer;
})();