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
    // 🔥 1. Hero Score Card (คะแนนหลัก)
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
      el('p', { class: 'muted small', text: 'ใช้เวลา ' + durationText }),
      
      // Warning badge if many wrong-sure
      summary.wrongSure > 0 ? el('div', { 
        class: 'banner warn', 
        style: 'margin-top: 16px; text-align: left;' 
      }, [
        el('div', { class: 'icon', text: '!' }),
        el('div', { class: 'small' }, [
          el('strong', { text: 'มี ' + summary.wrongSure + ' ข้อที่มั่นใจแต่ตอบผิด' }),
          el('br'),
          el('span', { class: 'muted', text: 'ลองกลับไปทบทวนข้อที่มั่นใจว่าถูกแต่ผิด เพราะนั่นคือจุดบอดของเรา' })
        ])
      ]) : null
    ]));

    // ============================================
    // 🔥 2. Confidence Breakdown (แยกตามความมั่นใจ)
    // ============================================
    var statGrid = el('div', { class: 'stat-grid', style: 'margin-top: 16px;' }, [
      el('div', { class: 'stat-cell', style: 'border-left: 4px solid var(--correct);' }, [
        el('div', { class: 'label', text: 'มั่นใจ' }),
        el('div', { class: 'value', style: 'color: var(--correct);', text: String(summary.sure || 0) })
      ]),
      el('div', { class: 'stat-cell', style: 'border-left: 4px solid var(--warn);' }, [
        el('div', { class: 'label', text: 'ไม่แน่ใจ' }),
        el('div', { class: 'value', style: 'color: var(--warn);', text: String(summary.unsure || 0) })
      ]),
      el('div', { class: 'stat-cell', style: 'border-left: 4px solid var(--wrong);' }, [
        el('div', { class: 'label', text: 'เดา' }),
        el('div', { class: 'value', style: 'color: var(--wrong);', text: String(summary.guess || 0) })
      ]),
      el('div', { class: 'stat-cell', style: 'border-left: 4px solid var(--muted);' }, [
        el('div', { class: 'label', text: 'ตอบผิดรวม' }),
        el('div', { class: 'value', text: String(wrong) })
      ])
    ]);
    root.appendChild(el('div', { class: 'card' }, [
      el('h3', { text: 'สรุปความมั่นใจ' }),
      statGrid
    ]));

    // ============================================
    // 🔥 3. Slowest Questions (ข้อที่ใช้เวลานานสุด)
    // ============================================
    var firstAnswers = summary.firstAnswers || [];
    var withTime = firstAnswers.filter(function (a) { return a.timeMs && a.timeMs > 0; });
    withTime.sort(function (a, b) { return b.timeMs - a.timeMs; });
    var slowest = withTime.slice(0, 3);

    if (slowest.length > 0) {
      var slowCard = el('div', { class: 'card' }, [
        el('h3', { text: 'ข้อที่ใช้เวลานานสุด' }),
        el('p', { class: 'muted small', style: 'margin-bottom: 12px;', text: 'ลองกลับไปดูข้อที่ใช้เวลานาน อาจเป็นจุดที่ต้องทบทวนเพิ่ม' })
      ]);

      slowest.forEach(function (a) {
        var q = questions.find(function (x) { return x.id === a.qid; });
        if (!q) return;
        var sec = Math.round(a.timeMs / 1000);
        slowCard.appendChild(el('div', { 
          style: 'padding: 10px 0; border-bottom: 1px solid var(--border);' 
        }, [
          el('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:12px;' }, [
            el('div', { style: 'flex:1; min-width:0;' }, [
              el('div', { class: 'small muted', text: q.subject + ' • ' + q.topic }),
              el('div', { class: 'small', style: 'margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;', text: q.question })
            ]),
            el('div', { style: 'white-space:nowrap; text-align:right;' }, [
              el('div', { style: 'font-weight:700; font-size: 1.05rem; color:' + (a.correct ? 'var(--correct)' : 'var(--wrong)') + ';', text: sec + ' วิ' }),
              el('div', { class: 'small muted', text: a.correct ? 'ตอบถูก' : 'ตอบผิด' })
            ])
          ])
        ]));
      });
      root.appendChild(slowCard);
    }

    // ============================================
    // 🔥 4. Recheck Section (ถ้ามี)
    // ============================================
    if (summary.recheckTotal > 0) {
      var recheckCorrect = summary.recheckCorrect || 0;
      root.appendChild(el('div', { class: 'card' }, [
        el('h3', { text: 'ข้อที่ตอบซ้ำ' }),
        el('p', { class: 'muted small', text: 'มี ' + summary.recheckTotal + ' ข้อที่ระบบดึงกลับมาถามซ้ำ' }),
        el('p', { class: 'small', style: 'margin-top: 8px; font-weight: 600; color: var(--correct);', 
          text: 'ตอบถูกในรอบซ้ำ: ' + recheckCorrect + ' / ' + summary.recheckTotal })
      ]));
    }

    // ============================================
    // 🔥 5. AI Helper (คัดลอกส่ง AI)
    // ============================================
    var aiCard = el('div', { class: 'card' }, [
      el('h3', { text: 'ปรึกษา AI' }),
      el('p', { class: 'muted small', style: 'margin-bottom: 12px;', text: 'ให้ AI ช่วยวิเคราะห์ว่าควรกลับไปทบทวนเรื่องไหนต่อ' }),
      el('div', { class: 'row', style: 'flex-wrap:wrap;' }, [
        el('button', { 
          class: 'btn', 
          text: 'คัดลอกสรุป', 
          onclick: function () {
            var text = buildSummaryText(summary, questions);
            if (App.askai && App.askai.copyText) {
              App.askai.copyText(text).then(function () {
                App.toast('คัดลอกสรุปแล้ว เปิดแชท AI เพื่อวาง');
              }, function () { App.toast('คัดลอกไม่สำเร็จ'); });
            }
          }
        }),
        el('button', { 
          class: 'btn btn-primary', 
          text: 'แชท AI', 
          onclick: function () { 
            if (App.chat && App.chat.openSummary) {
              App.chat.openSummary(summary, questions);
            } else {
              App.toast('ฟีเจอร์นี้ยังไม่พร้อม');
            }
          }
        })
      ])
    ]);
    root.appendChild(aiCard);

    // ============================================
    // 🔥 6. Action Buttons
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

  // ============================================
  // Helper: สร้างข้อความสรุปสำหรับ Copy ส่ง AI
  // ============================================
  function buildSummaryText(summary, questions) {
    var lines = [];
    lines.push('=== สรุปผลการฝึกทำข้อสอบ ===');
    lines.push('จำนวนข้อ: ' + summary.n);
    lines.push('ตอบถูก: ' + summary.correct);
    lines.push('ตอบผิด: ' + (summary.n - summary.correct));
    lines.push('ความแม่นยำ: ' + Math.round((summary.correct / summary.n) * 100) + '%');
    lines.push('');
    lines.push('ความมั่นใจ:');
    lines.push('- มั่นใจ: ' + (summary.sure || 0) + ' ข้อ');
    lines.push('- ไม่แน่ใจ: ' + (summary.unsure || 0) + ' ข้อ');
    lines.push('- เดา: ' + (summary.guess || 0) + ' ข้อ');
    lines.push('- มั่นใจแต่ผิด: ' + (summary.wrongSure || 0) + ' ข้อ');
    lines.push('');
    lines.push('ข้อที่ตอบผิด:');
    var firstAnswers = summary.firstAnswers || [];
    firstAnswers.forEach(function (a, i) {
      if (a.correct) return;
      var q = questions.find(function (x) { return x.id === a.qid; });
      if (!q) return;
      lines.push('- [' + q.subject + ' / ' + q.topic + '] ' + q.question);
      lines.push('  คำตอบที่เลือก: ' + q.choices[a.chosen]);
      lines.push('  คำตอบที่ถูก: ' + q.choices[q.answer]);
      lines.push('  คำอธิบาย: ' + q.explanation);
      lines.push('');
    });
    lines.push('ช่วยวิเคราะห์ว่าฉันควรทบทวนเรื่องไหนเพิ่ม และแนะนำวิธีฝึกให้เก่งขึ้น');
    return lines.join('\n');
  }

  App.views.summary.setLast = function (summary) { currentSummary = summary; };
})();