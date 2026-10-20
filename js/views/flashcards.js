/* Flashcards mode — swipeable cards with subject/topic selection */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

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
    var settings = App.storage.getSettings();

    if (questions.length === 0) {
      root.appendChild(el('div', { class: 'empty' }, [
        el('p', { text: 'ยังไม่มีข้อสอบในระบบ' }),
        el('button', { class: 'btn btn-primary', text: 'กลับหน้าแรก', onclick: function () { App.navigate('home'); } })
      ]));
      return;
    }

    // --- Selection UI ---
    var selectedSubject = null;
    var selectedTopic = '';

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'ฝึกแฟลชการ์ด' }),
      el('p', { class: 'muted small', text: 'เลือกวิชาและบทที่ต้องการทบทวน' }),
      
      // Subject Select
      el('div', { class: 'field', style: 'margin-top:16px;' }, [
        el('span', { class: 'label', text: 'วิชา' }),
        (function() {
          var sel = el('select', { class: 'select' });
          sel.appendChild(el('option', { value: '', text: '-- ทุกวิชา --' }));
          App.subjects.forEach(function (s) {
            var count = questions.filter(function(q) { return q.subject === s.id; }).length;
            if (count > 0) {
              sel.appendChild(el('option', { value: s.id, text: s.name + ' (' + count + ' ข้อ)' }));
            }
          });
          sel.addEventListener('change', function () {
            selectedSubject = sel.value || null;
            renderTopicSelect();
          });
          return sel;
        })()
      ]),

      // Topic Select (Container)
      el('div', { class: 'field', id: 'fc-topic-wrap' }, [
        el('span', { class: 'label', text: 'บท (ไม่บังคับ)' }),
        el('div', { id: 'fc-topic-container' }, [
          el('select', { class: 'select', disabled: true }, [el('option', { text: 'เลือกวิชาก่อน' })])
        ])
      ]),

      el('button', {
        class: 'btn btn-primary btn-block',
        style: 'margin-top:24px; font-size:1.05rem; min-height:56px;',
        text: 'เริ่มฝึก',
        onclick: function () {
          startSession(root, selectedSubject, selectedTopic);
        }
      })
    ]));

    function renderTopicSelect() {
      var container = document.getElementById('fc-topic-container');
      if (!container) return;
      while (container.firstChild) container.removeChild(container.firstChild);

      var sel = el('select', { class: 'select' });
      sel.appendChild(el('option', { value: '', text: 'ทุกบทในวิชานี้' }));
      
      var filtered = questions.filter(function(q) {
        return !selectedSubject || q.subject === selectedSubject;
      });
      
      var topics = {};
      filtered.forEach(function(q) {
        topics[q.topic] = (topics[q.topic] || 0) + 1;
      });

      Object.keys(topics).forEach(function(t) {
        sel.appendChild(el('option', { value: t, text: t + ' (' + topics[t] + ' ข้อ)' }));
      });

      sel.addEventListener('change', function() {
        selectedTopic = sel.value;
      });

      container.appendChild(sel);
    }
  };

  function startSession(root, subjectId, topicName) {
    var el = App.el;
    var questions = App.loadQuestions();
    var progress = App.storage.getProgress();

    // Filter questions
    var pool = questions.filter(function(q) {
      if (subjectId && q.subject !== subjectId) return false;
      if (topicName && q.topic !== topicName) return false;
      return true;
    });

    if (pool.length === 0) {
      App.toast('ไม่มีข้อสอบในหมวดหมู่นี้');
      return;
    }

    // Split into due vs rest
    var due = [];
    var rest = [];
    pool.forEach(function (q) {
      var p = progress[q.id];
      if (p && p.due && p.due <= App.scheduler.todayKey()) due.push(q);
      else rest.push(q);
    });

    due = shuffle(due);
    rest = shuffle(rest);
    var selected = due.concat(rest).slice(0, 20);

    cards = selected;
    currentIndex = 0;
    flipped = false;

    renderCard(root, subjectId, topicName);
  }

  function renderCard(root, subjectId, topicName) {
    var el = App.el;
    // Clear root
    while (root.firstChild) root.removeChild(root.firstChild);

    // Top bar
    root.appendChild(el('div', { 
      class: 'session-top', 
      style: 'display:flex; align-items:center; gap:12px; margin-bottom:16px;' 
    }, [
      el('button', { 
        class: 'icon-btn', 
        text: '✕', 
        onclick: function () { App.navigate('home'); } 
      }),
      el('div', { 
        class: 'small muted', 
        style: 'white-space:nowrap;', 
        text: (currentIndex + 1) + ' / ' + cards.length 
      }),
      el('div', { 
        class: 'progress-bar', 
        style: 'flex:1; margin:0 8px;' 
      }, [
        el('div', { class: 'fill', style: 'width:' + Math.round((currentIndex / cards.length) * 100) + '%' })
      ])
    ]));

    if (currentIndex >= cards.length) {
      // Done
      root.appendChild(el('div', { class: 'card center' }, [
        el('h2', { text: 'จบชุดแฟลชการ์ด' }),
        el('p', { class: 'muted', text: 'ทบทวนครบ ' + cards.length + ' ใบแล้ว' }),
        el('div', { class: 'row', style: 'justify-content:center; margin-top:16px;' }, [
          el('button', { class: 'btn', text: 'เลือกหมวดใหม่', onclick: function () { App.views.flashcards(root); } }),
          el('button', { class: 'btn btn-primary', text: 'กลับหน้าแรก', onclick: function () { App.navigate('home'); } })
        ])
      ]));
      return;
    }

    var q = cards[currentIndex];

    var card = el('div', { 
      class: 'card', 
      style: 'min-height: 350px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; cursor: pointer; transition: all 0.2s;' 
    });
    
    if (!flipped) {
      card.appendChild(el('div', { class: 'small muted', text: App.subjectName(q.subject) + ' • ' + q.topic }));
      card.appendChild(el('h2', { style: 'margin-top:16px; white-space:pre-wrap;', text: q.question }));
      card.appendChild(el('p', { class: 'muted', style: 'margin-top:32px; font-size:0.9rem;', text: 'แตะเพื่อดูเฉลย' }));
      
      card.addEventListener('click', function () {
        flipped = true;
        renderCard(root, subjectId, topicName);
      });
    } else {
      card.appendChild(el('div', { class: 'small muted', text: 'เฉลย' }));
      var correctText = q.choices[q.answer];
      card.appendChild(el('h2', { style: 'margin-top:12px; color: var(--correct);', text: correctText }));
      
      card.appendChild(el('div', { style: 'margin-top:16px; text-align:left; width:100%; background:var(--bg); padding:16px; border-radius:12px;' }, [
        el('div', { class: 'small muted', text: 'คำอธิบาย:' }),
        el('p', { style: 'margin-top:8px; white-space:pre-wrap;', text: q.explanation })
      ]));

      var actionRow = el('div', { class: 'row', style: 'margin-top:24px; width:100%;' }, [
        el('button', { 
          class: 'btn btn-danger', 
          style: 'flex:1;', 
          text: 'จำไม่ได้', 
          onclick: function (e) {
            e.stopPropagation();
            e.preventDefault();
            updateBox(q, false);
            currentIndex++;
            flipped = false;
            renderCard(root, subjectId, topicName);
          }
        }),
        el('button', { 
          class: 'btn btn-primary', 
          style: 'flex:1;', 
          text: 'จำได้', 
          onclick: function (e) {
            e.stopPropagation();
            e.preventDefault();
            updateBox(q, true);
            currentIndex++;
            flipped = false;
            renderCard(root, subjectId, topicName);
          }
        })
      ]);
      card.appendChild(actionRow);
      
      card.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

    root.appendChild(card);
  }

  function updateBox(q, remembered) {
    var progress = App.storage.getProgress();
    var prev = progress[q.id] || {};
    var type = remembered ? 'correctSure' : 'wrong';
    var nbox = App.scheduler.nextBox(prev, type, Date.now());
    nbox.lastConfidence = remembered ? 'sure' : 'unsure';
    progress[q.id] = nbox;
    App.storage.setProgress(progress);
    
    App.recordDaily(q, nbox.lastConfidence, remembered, 0);
  }
})();