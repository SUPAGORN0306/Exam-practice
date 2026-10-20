/* Summary view — full breakdown + review list + next-day count */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};
  var lastSummary = null;

  App.views.summary = function (root) {
    var el = App.el;
    var s = lastSummary;
    if (!s) s = App.storage.getSessions()[0];
    if (!s) {
      root.appendChild(el('div', { class: 'empty', text: 'ยังไม่มีชุดที่จบ' }));
      return;
    }

    var questions = App.loadQuestions();
    var byId = {};
    questions.forEach(function (q) { byId[q.id] = q; });

    // Score bar
    var correctSure = (s.firstAnswers || []).filter(function (a) { return a.type === 'correctSure'; }).length;
    var correctUnsure = (s.firstAnswers || []).filter(function (a) { return a.type === 'correctUnsure'; }).length;
    var correctGuess = (s.firstAnswers || []).filter(function (a) { return a.type === 'correctGuess'; }).length;
    var wrong = (s.firstAnswers || []).filter(function (a) { return a.type === 'wrong' || a.type === 'wrongSure'; }).length;

    root.appendChild(
      el('div', { class: 'card' }, [
        el('h2', { text: 'สรุปชุด' }),
        el('p', { class: 'muted small', text: new Date(s.endedAt).toLocaleString('th-TH') }),
        el('div', { class: 'row-between', style: 'margin-top:12px;' }, [
          el('div', null, [
            el('div', { class: 'stat-big', text: s.correct + ' / ' + s.n }),
            el('div', { class: 'muted small', text: 'ตอบถูกครั้งแรก ' + Math.round((s.correct / s.n) * 100) + '%' })
          ])
        ]),
        el('div', { class: 'stat-grid', style: 'margin-top:12px;' }, [
          el('div', { class: 'stat-cell' }, [el('div', { class: 'label', text: 'ถูก + มั่นใจ' }), el('div', { class: 'value', text: String(correctSure) })]),
          el('div', { class: 'stat-cell' }, [el('div', { class: 'label', text: 'ถูก + ไม่แน่ใจ' }), el('div', { class: 'value', text: String(correctUnsure) })]),
          el('div', { class: 'stat-cell' }, [el('div', { class: 'label', text: 'ถูก + เดา' }), el('div', { class: 'value', text: String(correctGuess) })]),
          el('div', { class: 'stat-cell' }, [el('div', { class: 'label', text: 'ผิด' }), el('div', { class: 'value', text: String(wrong) })])
        ]),
        el('div', { class: 'stat-cell highlight', style: 'margin-top:12px;' }, [
          el('div', { class: 'label', text: '⚠ ผิดทั้งที่มั่นใจ' }),
          el('div', { class: 'value', text: String(s.wrongSure || 0) + ' ข้อ' }),
          el('p', { class: 'small muted', style: 'margin:4px 0 0;', text: 'นี่คือความเข้าใจผิดที่มั่นใจ ลองกลับไปอ่านเฉลยให้ละเอียด' })
        ])
      ])
    );

    // Recheck
    root.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'ตอบซ้ำในชุดนี้' }),
        el('p', { class: 'muted', text: 'ตอบซ้ำถูก ' + (s.recheckCorrect || 0) + ' / ' + (s.recheckTotal || 0) + ' ข้อ' })
      ])
    );

    // Time
    root.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'เวลา' }),
        el('p', { class: 'muted', text: 'รวม: ' + Math.round((s.durationMs || 0) / 1000) + ' วินาที' })
      ])
    );

    // Review list
    var reviewable = (s.firstAnswers || []).filter(function (a) {
      return a.type === 'wrong' || a.type === 'wrongSure' || a.type === 'correctGuess';
    });
    if (reviewable.length) {
      var listWrap = el('div', { class: 'stack' });
      var reviewTexts = [];
      reviewable.forEach(function (a) {
        var q = byId[a.qid];
        if (!q) return;
        var qOrder = App.scheduler.shuffleChoices(q.choices.length);
        var txt = App.askai.buildAskAIText(q, qOrder, a.chosen, a.confidence);
        reviewTexts.push(txt);

        var d = el('details', { class: 'details' }, [
          el('summary', { text: '[' + (a.type === 'correctGuess' ? 'เดา' : 'ผิด') + '] ' + q.question.slice(0, 60) + (q.question.length > 60 ? '…' : '') }),
          el('div', { class: 'body' }, [
            el('p', { style: 'margin:0 0 6px;', text: q.question }),
            el('p', { class: 'small', style: 'margin:0;', text: 'วิชา: ' + App.subjectName(q.subject) + ' • บท: ' + q.topic }),
            el('p', { class: 'small', style: 'margin:6px 0 0;', text: 'คำอธิบาย: ' + q.explanation })
          ])
        ]);
        listWrap.appendChild(d);
      });
      root.appendChild(
        el('div', { class: 'card' }, [
          el('h3', { text: 'ข้อที่ควรกลับมาดู (' + reviewable.length + ' ข้อ)' }),
          listWrap,
          el('button', {
            class: 'btn btn-block', style: 'margin-top:12px;',
            text: 'คัดลอกข้อเหล่านี้ไปถาม AI',
            onclick: function () {
              App.askai.copyText(reviewTexts.join('\n\n---\n\n')).then(
                function () { App.toast('คัดลอกแล้ว'); window.open('https://claude.ai', '_blank', 'noopener'); },
                function () { App.toast('คัดลอกไม่สำเร็จ'); }
              );
            }
          })
        ])
      );
    }

    // Tomorrow due
    var tomorrow = App.stats.dueTomorrowCount(questions, App.storage.getProgress(), App.scheduler.todayKey());
    root.appendChild(
      el('div', { class: 'card' }, [
        el('p', { class: 'muted', text: 'พรุ่งนี้จะมี ' + tomorrow + ' ข้อมาทบทวน' })
      ])
    );

    // Actions
    root.appendChild(
      el('div', { class: 'stack', style: 'margin-top:12px;' }, [
        el('button', { class: 'btn btn-primary btn-block', text: 'กลับหน้าแรก', onclick: function () { lastSummary = null; App.navigate('home'); App.render(); } })
      ])
    );
  };

  App.views.summary.setLast = function (s) { lastSummary = s; };
})();