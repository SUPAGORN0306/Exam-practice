/* Stats view — full: overall, 30d chart, topic accuracy, causes, wrongSure 30d */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  App.views.stats = function (root) {
    var el = App.el;
    var questions = App.loadQuestions();
    var progress = App.storage.getProgress();
    var sessions = App.storage.getSessions();
    var causes = App.storage.getCauses();
    var topicRecent = App.storage.getTopicRecent();
    var today = App.scheduler.todayKey();

    var counts = App.stats.overallCounts(questions, progress);

    // ---- Overall ----
    root.appendChild(
      el('div', { class: 'card' }, [
        el('h2', { text: 'สถิติ' }),
        el('div', { class: 'stat-grid', style: 'margin-top:12px;' }, [
          el('div', { class: 'stat-cell' }, [el('div', { class: 'label', text: 'ข้อทั้งหมด' }), el('div', { class: 'value', text: String(counts.total) })]),
          el('div', { class: 'stat-cell' }, [el('div', { class: 'label', text: 'จำได้แล้ว' }), el('div', { class: 'value', text: String(counts.mastered) })]),
          el('div', { class: 'stat-cell' }, [el('div', { class: 'label', text: 'กำลังเรียน' }), el('div', { class: 'value', text: String(counts.learning) })]),
          el('div', { class: 'stat-cell' }, [el('div', { class: 'label', text: 'ยังไม่เคยทำ' }), el('div', { class: 'value', text: String(counts.untouched) })])
        ])
      ])
    );

    if (counts.total === 0) {
      root.appendChild(el('div', { class: 'empty', text: 'ยังไม่มีข้อมูลให้แสดง' }));
      return;
    }

    // ---- 30-day chart ----
    root.appendChild(buildChartCard(questions, progress, sessions, today));

    // ---- Topic accuracy per subject ----
    var topicList = App.stats.topicAccuracyList(questions, progress, topicRecent);
    var topicWrap = el('div', { class: 'card' }, [
      el('h3', { text: 'ความแม่นยำรายบท' })
    ]);
    App.subjects.forEach(function (sub) {
      var arr = topicList[sub.id];
      if (!arr || !arr.length) return;
      arr.sort(function (a, b) {
        if (a.accuracy == null && b.accuracy == null) return 0;
        if (a.accuracy == null) return 1;
        if (b.accuracy == null) return -1;
        return a.accuracy - b.accuracy;
      });
      topicWrap.appendChild(el('h3', { style: 'margin-top:16px; font-size:0.95rem;', text: sub.name }));
      arr.forEach(function (t) {
        var pct = t.accuracy == null ? null : Math.round(t.accuracy * 100);
        var color = 'var(--muted)';
        var icon = '–';
        if (pct != null) {
          if (pct >= 80) { color = 'var(--correct)'; icon = '✓'; }
          else if (pct >= 60) { color = 'var(--warn)'; icon = '!'; }
          else { color = 'var(--wrong)'; icon = '✗'; }
        }
        var bar = el('div', { class: 'progress-bar', style: 'margin-top:4px;' }, [
          el('div', { class: 'fill', style: 'width:' + (pct == null ? 0 : pct) + '%; background:' + color })
        ]);
        topicWrap.appendChild(
          el('div', { style: 'margin-top:10px;' }, [
            el('div', { class: 'row-between small' }, [
              el('span', { text: icon + ' ' + t.topic }),
              el('span', { class: 'muted', text: (pct == null ? 'ข้อมูลไม่พอ' : pct + '%') + ' • ' + t.n + ' ข้อ' })
            ]),
            bar
          ])
        );
      });
    });
    root.appendChild(topicWrap);

    // ---- Causes ----
    var causesCard = el('div', { class: 'card' }, [el('h3', { text: 'สาเหตุที่ผิดบ่อย' })]);
    var causeLabels = { noKnowledge: 'ไม่รู้เนื้อหา', misread: 'อ่านโจทย์พลาด', confused: 'สับสนแนวคิดที่คล้ายกัน' };
    var hasCause = false;
    App.subjects.forEach(function (sub) {
      var c = causes[sub.id];
      if (!c) return;
      var total = (c.noKnowledge || 0) + (c.misread || 0) + (c.confused || 0);
      if (total === 0) return;
      hasCause = true;
      causesCard.appendChild(el('p', { class: 'small', style: 'margin-top:12px; font-weight:600;', text: sub.name }));
      ['noKnowledge', 'misread', 'confused'].forEach(function (k) {
        var v = c[k] || 0;
        var pct = total ? (v / total) * 100 : 0;
        causesCard.appendChild(
          el('div', { class: 'row-between small', style: 'margin-top:4px;' }, [
            el('span', { text: causeLabels[k] }),
            el('span', { class: 'muted', text: v + ' ครั้ง' })
          ])
        );
        causesCard.appendChild(el('div', { class: 'progress-bar', style: 'margin-top:2px;' }, [
          el('div', { class: 'fill', style: 'width:' + pct + '%; background:var(--primary)' })
        ]));
      });
      // Quick summary: dominant cause
      var dom = ['noKnowledge', 'misread', 'confused'].sort(function (a, b) { return (c[b] || 0) - (c[a] || 0); })[0];
      var tip = {
        noKnowledge: 'ส่วนใหญ่ผิดเพราะไม่รู้เนื้อหา ลองทบทวนพื้นฐานของบทนั้น',
        misread: 'ส่วนใหญ่ผิดเพราะอ่านโจทย์พลาด ลองอ่านโจทย์ช้าลง',
        confused: 'ส่วนใหญ่ผิดเพราะสับสนแนวคิดที่คล้ายกัน ลองเปรียบเทียบความต่างของแนวคิด'
      }[dom];
      causesCard.appendChild(el('p', { class: 'small muted', style: 'margin-top:6px;', text: tip }));
    });
    if (!hasCause) causesCard.appendChild(el('p', { class: 'muted small', text: 'ยังไม่มีข้อมูลสาเหตุ' }));
    root.appendChild(causesCard);

    // ---- WrongSure last 30d ----
    var wrongSure30 = App.stats.wrongSureLast30(sessions, today);
    root.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'ผิดทั้งที่มั่นใจ (30 วัน)' }),
        el('div', { class: 'stat-big', style: 'margin-top:8px;', text: String(wrongSure30) }),
        el('p', { class: 'small muted', text: 'ตัวเลขนี้คือความเข้าใจผิดที่คุณมั่นใจ — ควรกลับไปอ่านเฉลยของข้อเหล่านั้น' })
      ])
    );
  };

  function buildChartCard(questions, progress, sessions, today) {
    var el = App.el;
    var wrap = el('div', { class: 'card' }, [el('h3', { text: 'ความแม่นยำรายวัน (30 วัน)' })]);
    var subjMap = {};
    App.subjects.forEach(function (s) { subjMap[s.id] = true; });
    var visible = {};
    App.subjects.forEach(function (s) { visible[s.id] = true; });

    var toggleRow = el('div', { class: 'row', style: 'margin-top:8px;' });
    App.subjects.forEach(function (s) {
      var chip = el('button', {
        class: 'chip' + (visible[s.id] ? ' selected' : ''),
        text: s.name.length > 18 ? s.name.slice(0, 16) + '…' : s.name,
        onclick: function () {
          visible[s.id] = !visible[s.id];
          chip.classList.toggle('selected', visible[s.id]);
          drawChart();
        }
      });
      toggleRow.appendChild(chip);
    });
    wrap.appendChild(toggleRow);

    var svgWrap = el('div', { style: 'margin-top:12px; width:100%; overflow-x:auto;' });
    wrap.appendChild(svgWrap);

    function drawChart() {
      while (svgWrap.firstChild) svgWrap.removeChild(svgWrap.firstChild);
      var data = App.stats.dailyAccuracy30(questions, progress, sessions, App.subjects.map(function (s) { return s.id; }), today);
      var days = data.days;
      var W = 720, H = 240, padL = 32, padR = 12, padT = 12, padB = 24;
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', '100%');
      svg.setAttribute('style', 'min-width:600px;');

      // Y grid
      [0, 25, 50, 75, 100].forEach(function (pct) {
        var y = padT + (H - padT - padB) * (1 - pct / 100);
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(padL));
        line.setAttribute('x2', String(W - padR));
        line.setAttribute('y1', String(y));
        line.setAttribute('y2', String(y));
        line.setAttribute('stroke', 'var(--border)');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
        var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', String(padL - 4));
        t.setAttribute('y', String(y + 3));
        t.setAttribute('font-size', '10');
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('fill', 'var(--muted)');
        t.textContent = String(pct);
        svg.appendChild(t);
      });

      var stepX = (W - padL - padR) / Math.max(1, days.length - 1);
      var colors = ['var(--primary)', '#8B5CF6', 'var(--correct)', 'var(--warn)'];
      var dashPatterns = ['', '6 4', '2 3', '8 4'];

      var seriesKeys = App.subjects.map(function (s) { return s.id; }).filter(function (k) { return visible[k]; });
      seriesKeys.forEach(function (sub, idx) {
        var pts = data.series[sub] || [];
        var segs = [];
        var currentSeg = [];
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          if (p == null) {
            if (currentSeg.length) { segs.push(currentSeg); currentSeg = []; }
          } else {
            var x = padL + stepX * i;
            var y = padT + (H - padT - padB) * (1 - p.pct);
            currentSeg.push({ x: x, y: y });
          }
        }
        if (currentSeg.length) segs.push(currentSeg);

        segs.forEach(function (seg) {
          var path = seg.map(function (pt, k) { return (k === 0 ? 'M' : 'L') + pt.x + ' ' + pt.y; }).join(' ');
          var elp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          elp.setAttribute('d', path);
          elp.setAttribute('fill', 'none');
          elp.setAttribute('stroke', colors[idx % colors.length]);
          elp.setAttribute('stroke-width', '2');
          if (dashPatterns[idx % dashPatterns.length]) {
            elp.setAttribute('stroke-dasharray', dashPatterns[idx % dashPatterns.length]);
          }
          svg.appendChild(elp);
          // Dots
          seg.forEach(function (pt) {
            var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', String(pt.x));
            c.setAttribute('cy', String(pt.y));
            c.setAttribute('r', '2.5');
            c.setAttribute('fill', colors[idx % colors.length]);
            svg.appendChild(c);
          });
        });
      });

      // X labels (first, middle, last)
      [0, Math.floor(days.length / 2), days.length - 1].forEach(function (i) {
        if (i < 0 || i >= days.length) return;
        var x = padL + stepX * i;
        var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', String(x));
        t.setAttribute('y', String(H - 6));
        t.setAttribute('font-size', '10');
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('fill', 'var(--muted)');
        t.textContent = days[i].slice(5);
        svg.appendChild(t);
      });

      svgWrap.appendChild(svg);
    }
    drawChart();
    return wrap;
  }
})();