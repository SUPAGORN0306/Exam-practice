/* Flashcards mode — swipeable cards, updates Leitner box */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  var cards = [];
  var currentIndex = 0;
  var flipped = false;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  App.views.flashcards = function (root) {
    var el = App.el;
    var questions = App.loadQuestions();
    var progress = App.storage.getProgress();
    
    // Filter: pick due cards first, then others. Max 20.
    var due = [];
    var rest = [];
    questions.forEach(function (q) {
      var p = progress[q.id];
      if (p && p.due && p.due <= App.scheduler.todayKey()) due.push(q);
      else rest.push(q);
    });
    due = shuffle(due);
    rest = shuffle(rest);
    var selected = due.concat(rest).slice(0, 20);

    if (selected.length === 0) {
      root.appendChild(el('div', { class: 'empty' }, [
        el('p', { text: 'ยังไม่มีข้อสอบในระบบ' }),
        el('button', { class: 'btn btn-primary', text: 'กลับหน้าแรก', onclick: function () { App.navigate('home'); } })
      ]));
      return;
    }

    cards = selected;
    currentIndex = 0;
    flipped = false;

    renderCard(root);
  };

  function renderCard(root) {
    var el = App.el;
    // Clear root
    while (root.firstChild) root.removeChild(root.firstChild);

    // Top bar
    root.appendChild(el('div', { class: 'session-top' }, [
      el('button', { class: 'icon-btn', text: '✕', onclick: function () { App.navigate('home'); } }),
      el('div', { class: 'small muted', text: (currentIndex + 1) + ' / ' + cards.length }),
      el('div', { class: 'progress-bar', style: 'flex:1;' }, [
        el('div', { class: 'fill', style: 'width:' + Math.round((currentIndex / cards.length) * 100) + '%' })
      ])
    ]));

    if (currentIndex >= cards.length) {
      // Done
      root.appendChild(el('div', { class: 'card center' }, [
        el('h2', { text: 'จบชุดแฟลชการ์ด 🎉' }),
        el('p', { class: 'muted', text: 'ทบทวนครบ ' + cards.length + ' ใบแล้ว' }),
        el('button', { class: 'btn btn-primary btn-block', style: 'margin-top:16px;', text: 'กลับหน้าแรก', onclick: function () { App.navigate('home'); } })
      ]));
      return;
    }

    var q = cards[currentIndex];
    var order = q.noShuffle ? q.choices.map(function (_, i) { return i; }) : shuffle(q.choices.map(function (_, i) { return i; }));

    // Card container
    var card = el('div', { class: 'card', style: 'min-height: 300px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; cursor: pointer; transition: all 0.2s;' });
    
    if (!flipped) {
      // Front: Question
      card.appendChild(el('div', { class: 'small muted', text: App.subjectName(q.subject) + ' • ' + q.topic }));
      card.appendChild(el('h2', { style: 'margin-top:16px; white-space:pre-wrap;', text: q.question }));
      card.appendChild(el('p', { class: 'muted', style: 'margin-top:24px; font-size:0.9rem;', text: 'แตะเพื่อดูเฉลย' }));
      
      card.addEventListener('click', function () {
        flipped = true;
        renderCard(root);
      });
    } else {
      // Back: Answer + Explanation
      card.appendChild(el('div', { class: 'small muted', text: 'เฉลย' }));
      var correctText = q.choices[q.answer];
      card.appendChild(el('h2', { style: 'margin-top:8px; color: var(--correct);', text: correctText }));
      
      card.appendChild(el('div', { style: 'margin-top:16px; text-align:left; width:100%; background:var(--bg); padding:12px; border-radius:8px;' }, [
        el('div', { class: 'small muted', text: 'คำอธิบาย:' }),
        el('p', { style: 'margin-top:4px; white-space:pre-wrap;', text: q.explanation })
      ]));

      // Actions
      var actionRow = el('div', { class: 'row', style: 'margin-top:24px; width:100%;' }, [
        el('button', { class: 'btn btn-danger', style: 'flex:1;', text: 'จำไม่ได้', onclick: function (e) {
          e.stopPropagation();
          updateBox(q, false);
          currentIndex++;
          flipped = false;
          renderCard(root);
        }}),
        el('button', { class: 'btn btn-primary', style: 'flex:1;', text: 'จำได้', onclick: function (e) {
          e.stopPropagation();
          updateBox(q, true);
          currentIndex++;
          flipped = false;
          renderCard(root);
        }})
      ]);
      card.appendChild(actionRow);
    }

    root.appendChild(card);
  }

  function updateBox(q, remembered) {
    var progress = App.storage.getProgress();
    var prev = progress[q.id] || {};
    // Mock a "correctSure" or "wrong" answer for the scheduler
    var type = remembered ? 'correctSure' : 'wrong';
    var nbox = App.scheduler.nextBox(prev, type, Date.now());
    nbox.lastConfidence = remembered ? 'sure' : 'unsure';
    progress[q.id] = nbox;
    App.storage.setProgress(progress);
    
    // Record daily
    App.recordDaily(q, nbox.lastConfidence, remembered, 0);
  }
})();