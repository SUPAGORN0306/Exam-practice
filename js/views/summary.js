/* Summary view — Beautiful dashboard for session results */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var currentSummary = null;

  App.views.summary = function (root) {
    var el = App.el;
    var summary = currentSummary;
    
    if (!summary) {
      root.appendChild(el('div', { class: 'empty' }, [
        el('p', { text: 'ไม่มีข้อมูลสรุปผล' }),
        el('button', { class: 'btn btn-primary', text: 'กลับหน้าแรก', onclick: function () { App.navigate('home'); } })
      ]));
      return;
    }

    var questions = App.loadQuestions();
    var n = summary.n || 1;
    var correct = summary.correct || 0;
    var wrong = n - correct;
    var accuracy = Math.round((correct / n) * 100);

    // ============================================
    // 🔥 1. Hero Score Card
    // ============================================
    var ringR = 54;
    var ringC = 2 * Math.PI * ringR;
    var ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 120 120');
    ring.setAttribute('width', '140');
    ring.setAttribute('height', '140');
    
    var bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', '60'); bgCircle.setAttribute('cy', '60');
    bgCircle.setAttribute('r', String(ringR)); bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', 'var(--border)'); bgCircle.setAttribute('stroke-width', '10');
    ring.appendChild(bgCircle);

    var fgColor = accuracy >= 80 ? 'var(--correct)' : (accuracy >= 50 ? 'var(--warn)' : 'var(--wrong)');
    var fgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fgCircle.setAttribute('cx', '60'); fgCircle.setAttribute('cy', '60');
    fgCircle.setAttribute('r', String(ringR)); fgCircle.setAttribute('fill', 'none');
    fgCircle.setAttribute('stroke', fgColor); fgCircle.setAttribute('stroke-width', '10');
    fgCircle.setAttribute('stroke-linecap', 'round');
    fgCircle.setAttribute('stroke-dasharray', String(ringC));
    fgCircle.setAttribute('stroke-dashoffset', String(ringC * (1 - accuracy / 100)));
    fgCircle.setAttribute('transform', 'rotate(-90 60 60)');
    ring.appendChild(fgCircle);

    var ringText1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    ringText1.setAttribute('x', '60'); ringText1.setAttribute('y', '60');
    ringText1.setAttribute('text-anchor', 'middle');
    ringText1.setAttribute('dominant-baseline', 'middle');
    ringText1.setAttribute('fill', fgColor);
    ringText1.setAttribute('font-size', '28');
    ringText1.setAttribute('font-weight', '700');
    ringText1.textContent = accuracy + '%';
    ring.appendChild(ringText1);

    var ringText2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    ringText2.setAttribute('x', '60'); ringText2.setAttribute('y', '82');
    ringText2.setAttribute('text-anchor', 'middle');
    ringText2.setAttribute('dominant-baseline', 'middle');
    ringText2.setAttribute('fill', 'var(--muted)');
    ringText2.setAttribute('font-size', '11');
    ringText2.textContent = 'ความแม่นยำ';
    ring.appendChild(ringText2);

    var durationMin = Math.floor((summary.durationMs || 0) / 60000);
    var durationSec = Math.floor(((summary.durationMs || 0) % 60000) / 1000);
    var durationText = (durationMin > 0 ? durationMin + ' นาที ' : '') + durationSec + ' วินาที';

    root.appendChild(el('div', { class: 'card center', style: 'padding: 32px 20px;' }, [
      el('div', { style: 'display:flex; justify-content:center; margin-bottom: 8px;' }, [ring]),
      el('h2', { style: 'margin-top: 8px;', text: 'ตอบถูก ' + correct + ' จาก ' + n + ' ข้อ' }),
      el('p', { class: 'muted small', text: 'ใช้เวลา ' + durationText })
    ]));

    // ============================================
    // 🔥 2. ข้อที่ตอบถูก/ผิด (Detailed List)
    // ============================================
    var firstAnswers = summary.firstAnswers || [];
    
    // ข้อที่ตอบผิด
    var wrongAnswers = firstAnswers.filter(function(a) { return !a.correct; });
    if (wrongAnswers.length > 0) {
      var wrongCard = el('div', { class: 'card' }, [
        el('h3', { style: 'color:var(--wrong);', text: 'ข้อที่ตอบผิด (' + wrongAnswers.length + ' ข้อ)' })
      ]);

      wrongAnswers.forEach(function (a) {
        var q = questions.find(function (x) { return x.id === a.qid; });
        if (!q) return;
        var isOpen = false;
        
        var detailsBox = el('div', { class: 'explain-box', style: 'display:none; margin-top:12px; border-color: var(--border);' });
        
        var toggleBtn = el('button', {
          class: 'btn btn-ghost btn-small',
          style: 'margin-top:12px; padding:0; color:var(--primary);',
          text: 'ดูเฉลย',
          onclick: function () {
            isOpen = !isOpen;
            detailsBox.style.display = isOpen ? 'block' : 'none';
            toggleBtn.textContent = isOpen ? 'ซ่อนเฉลย' : 'ดูเฉลย';
          }
        });

        wrongCard.appendChild(el('div', { 
          style: 'padding: 12px 0; border-bottom: 1px solid var(--border);' 
        }, [
          el('div', { class: 'small muted', text: q.subject + ' • ' + q.topic }),
          el('p', { style: 'font-weight:600; margin: 6px 0;', text: q.question }),
          el('p', { class: 'small', style: 'color:var(--wrong); margin: 4px 0;', text: 'ตอบว่า: ' + q.choices[a.chosen] }),
          el('p', { class: 'small', style: 'color:var(--correct); margin: 4px 0;', text: 'ที่ถูกคือ: ' + q.choices[q.answer] }),
          toggleBtn,
          detailsBox
        ]));
        
        detailsBox.appendChild(el('p', { style: 'white-space:pre-wrap;', text: q.explanation }));
      });
      
      root.appendChild(wrongCard);
    }

    // ข้อที่ตอบถูก
    var correctAnswers = firstAnswers.filter(function(a) { return a.correct; });
    if (correctAnswers.length > 0) {
      var correctCard = el('div', { class: 'card' }, [
        el('h3', { style: 'color:var(--correct);', text: 'ข้อที่ตอบถูก (' + correctAnswers.length + ' ข้อ)' })
      ]);

      correctAnswers.forEach(function (a) {
        var q = questions.find(function (x) { return x.id === a.qid; });
        if (!q) return;
        var isOpen = false;
        
        var detailsBox = el('div', { class: 'explain-box', style: 'display:none; margin-top:12px;' });
        
        var toggleBtn = el('button', {
          class: 'btn btn-ghost btn-small',
          style: 'margin-top:12px; padding:0; color:var(--primary);',
          text: 'ดูเฉลย',
          onclick: function () {
            isOpen = !isOpen;
            detailsBox.style.display = isOpen ? 'block' : 'none';
            toggleBtn.textContent = isOpen ? 'ซ่อนเฉลย' : 'ดูเฉลย';
          }
        });

        correctCard.appendChild(el('div', { 
          style: 'padding: 12px 0; border-bottom: 1px solid var(--border);' 
        }, [
          el('div', { class: 'small muted', text: q.subject + ' • ' + q.topic }),
          el('p', { style: 'font-weight:600; margin: 6px 0;', text: q.question }),
          el('p', { class: 'small', style: 'color:var(--correct); margin: 4px 0;', text: 'ตอบถูก: ' + q.choices[a.chosen] }),
          toggleBtn,
          detailsBox
        ]));
        
        detailsBox.appendChild(el('p', { style: 'white-space:pre-wrap;', text: q.explanation }));
      });
      
      root.appendChild(correctCard);
    }

    // ============================================
    // 🔥 3. Action Buttons
    // ============================================
    root.appendChild(el('div', { class: 'stack', style: 'margin-bottom: 24px;' }, [
      el('button', { 
        class: 'btn btn-primary btn-block', 
        style: 'height: 56px;', 
        text: 'กลับหน้าแรก', 
        onclick: function () { App.navigate('home'); } 
      }),
      el('button', { 
        class: 'btn btn-block', 
        text: 'ดูสถิติทั้งหมด', 
        onclick: function () { App.navigate('stats'); } 
      })
    ]));
  };

  App.views.summary.setLast = function (summary) { currentSummary = summary; };
})();