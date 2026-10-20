/* Summary view — round 1: basic */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var lastSummary = null;

  App.views.summary = function (root) {
    var el = App.el;
    var s = lastSummary;
    if (!s) {
      var sessions = App.storage.getSessions();
      s = sessions[0];
    }
    if (!s) {
      root.appendChild(el('div', { class: 'empty', text: 'ยังไม่มีชุดที่จบ' }));
      return;
    }
    var pct = Math.round((s.correct / s.n) * 100);
    root.appendChild(
      el('div', { class: 'card' }, [
        el('h2', { text: 'สรุปชุด' }),
        el('p', { class: 'muted small', text: new Date(s.endedAt).toLocaleString('th-TH') }),
        el('div', { class: 'row-between', style: 'margin-top:12px;' }, [
          el('div', null, [
            el('div', { class: 'stat-big', text: s.correct + ' / ' + s.n }),
            el('div', { class: 'muted small', text: 'ตอบถูก ' + pct + '%' })
          ])
        ]),
        el('div', { class: 'stat-grid', style: 'margin-top:12px;' }, [
          el('div', { class: 'stat-cell' }, [
            el('div', { class: 'label', text: 'มั่นใจ' }),
            el('div', { class: 'value', text: String(s.sure || 0) })
          ]),
          el('div', { class: 'stat-cell' }, [
            el('div', { class: 'label', text: 'ไม่แน่ใจ' }),
            el('div', { class: 'value', text: String(s.unsure || 0) })
          ]),
          el('div', { class: 'stat-cell' }, [
            el('div', { class: 'label', text: 'เดา' }),
            el('div', { class: 'value', text: String(s.guess || 0) })
          ]),
          el('div', { class: 'stat-cell highlight' }, [
            el('div', { class: 'label', text: 'ผิดทั้งที่มั่นใจ' }),
            el('div', { class: 'value', text: String(s.wrongSure || 0) })
          ])
        ])
      ])
    );

    root.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'ตอบซ้ำ' }),
        el('p', {
          class: 'muted',
          text: 'ตอบซ้ำถูก ' + (s.recheckCorrect || 0) + ' / ' + (s.recheckTotal || 0) + ' ข้อ'
        }),
        el('p', {
          class: 'small muted',
          text: 'เวลา: ' + Math.round((s.durationMs || 0) / 1000) + ' วินาที'
        })
      ])
    );

    root.appendChild(
      el('div', { class: 'stack', style: 'margin-top:12px;' }, [
        el('button', {
          class: 'btn btn-primary btn-block',
          text: 'กลับหน้าแรก',
          onclick: function () {
            lastSummary = null;
            App.navigate('home');
          }
        })
      ])
    );
  };

  App.views.summary.setLast = function (s) { lastSummary = s; };
})();