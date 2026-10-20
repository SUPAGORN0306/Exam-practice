/* Stats view — round 1: placeholders, full stats in round 3 */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  App.views.stats = function (root) {
    var el = App.el;
    var questions = App.loadQuestions();
    var progress = App.storage.getProgress();

    var total = questions.length;
    var attempted = 0;
    var correctTotal = 0;
    questions.forEach(function (q) {
      var p = progress[q.id];
      if (p && p.attempts > 0) {
        attempted++;
        correctTotal += p.correct || 0;
      }
    });

    root.appendChild(
      el('div', { class: 'card' }, [
        el('h2', { text: 'สถิติ (พื้นฐาน)' }),
        el('div', { class: 'stat-grid', style: 'margin-top:12px;' }, [
          el('div', { class: 'stat-cell' }, [
            el('div', { class: 'label', text: 'ข้อทั้งหมด' }),
            el('div', { class: 'value', text: String(total) })
          ]),
          el('div', { class: 'stat-cell' }, [
            el('div', { class: 'label', text: 'เคยทำแล้ว' }),
            el('div', { class: 'value', text: String(attempted) })
          ]),
          el('div', { class: 'stat-cell' }, [
            el('div', { class: 'label', text: 'ตอบถูกสะสม' }),
            el('div', { class: 'value', text: String(correctTotal) })
          ]),
          el('div', { class: 'stat-cell' }, [
            el('div', { class: 'label', text: 'ยังไม่เคยทำ' }),
            el('div', { class: 'value', text: String(Math.max(0, total - attempted)) })
          ])
        ]),
        el('p', {
          class: 'muted small',
          style: 'margin-top:12px;',
          text: 'กราฟและรายละเอียดรายบทจะมาในรอบถัดไป'
        })
      ])
    );
  };
})();