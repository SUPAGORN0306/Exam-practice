/* Flashcards mode — 3D Flip, Swipe, Subject/Topic Selection */
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
    var questions = App.loadQuestions();
    var progress = App.storage.getProgress();

    var pool = questions.filter(function(q) {
      if (subjectId && q.subject !== subjectId) return false;
      if (topicName && q.topic !== topicName) return false;
      return true;
    });

    if (pool.length === 0) {
      App.toast('ไม่มีข้อสอบในหมวดหมู่นี้');
      return;
    }

    var due = [];
    var rest = [];
    pool.forEach(function (q) {
      var p = progress[q.id];
      if (p && p.due && p.due <= App.scheduler.todayKey()) due.push(q);
      else rest.push(q);
    });

    due = shuffle(due);
    rest = shuffle(rest);
    cards = due.concat(rest).slice(0, 20);

    currentIndex = 0;
    flipped = false;

    renderCard(root, subjectId, topicName);
  }

  function renderCard(root, subjectId, topicName) {
    var el = App.el;
    while (root.firstChild) root.removeChild(root.firstChild);

    // Top bar
    root.appendChild(el('div', { 
      class: 'session-top', 
      style: 'display:flex; align-items:center; gap:12px; margin-bottom:16px;' 
    }, [
      el('button', { class: 'icon-btn', text: '✕', onclick: function () { App.navigate('home'); } }),
      el('div', { class: 'small muted', style: 'white-space:nowrap;', text: (currentIndex + 1) + ' / ' + cards.length }),
      el('div', { class: 'progress-bar', style: 'flex:1; margin:0 8px;' }, [
        el('div', { class: 'fill', style: 'width:' + Math.round((currentIndex / cards.length) * 100) + '%' })
      ])
    ]));

    if (currentIndex >= cards.length) {
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

    // Card container
    var scene = el('div', { class: 'flashcard-scene' });
    var inner = el('div', { class: 'flashcard-inner' + (flipped ? ' is-flipped' : '') });
    
    // Front
    var front = el('div', { class: 'flashcard-front' }, [
      el('div', { class: 'small muted', text: App.subjectName(q.subject) + ' • ' + q.topic }),
      el('h2', { style: 'margin-top:16px; white-space:pre-wrap;', text: q.question }),
      el('p', { class: 'muted', style: 'margin-top:32px; font-size:0.9rem;', text: 'แตะเพื่อพลิกดูเฉลย' })
    ]);

    // Back
    var back = el('div', { class: 'flashcard-back' }, [
      el('div', { class: 'small muted', text: 'เฉลย' }),
      el('h2', { style: 'margin-top:12px; color: var(--correct);', text: q.choices[q.answer] }),
      el('div', { style: 'margin-top:16px; text-align:left; width:100%; background:var(--bg); padding:16px; border-radius:12px;' }, [
        el('div', { class: 'small muted', text: 'คำอธิบาย:' }),
        el('p', { style: 'margin-top:8px; white-space:pre-wrap;', text: q.explanation })
      ])
    ]);

    inner.appendChild(front);
    inner.appendChild(back);
    scene.appendChild(inner);
    root.appendChild(scene);

    // Hint labels (Swipe)
    var hintLeft = el('div', { class: 'swipe-hint hint-left', text: 'จำไม่ได้' });
    var hintRight = el('div', { class: 'swipe-hint hint-right', text: 'จำได้' });
    scene.appendChild(hintLeft);
    scene.appendChild(hintRight);

    // Flip Logic
    inner.addEventListener('click', function () {
      // ป้องกันการพลิกตอนกำลังลากการ์ด
      if (isDragging) return;
      flipped = !flipped;
      inner.classList.toggle('is-flipped', flipped);
    });

    // Bottom Actions (Fallback for desktop)
    root.appendChild(el('div', { class: 'row', style: 'margin-top:24px;' }, [
      el('button', { class: 'btn btn-danger', style: 'flex:1;', text: 'จำไม่ได้', onclick: function () {
        animateSwipe('left', q, subjectId, topicName, root);
      }}),
      el('button', { class: 'btn btn-primary', style: 'flex:1;', text: 'จำได้', onclick: function () {
        animateSwipe('right', q, subjectId, topicName, root);
      }})
    ]));

    // Swipe Logic (Pointer Events)
    var startX = 0, startY = 0, currentX = 0, currentY = 0;
    var isDragging = false;
    var swipeThreshold = 80;

    scene.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return; // ไม่ลากถ้ากดปุ่ม
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      inner.style.transition = 'none'; // ปิด transition ตอนลาก
      scene.setPointerCapture(e.pointerId);
    });

    scene.addEventListener('pointermove', function (e) {
      if (!isDragging) return;
      currentX = e.clientX - startX;
      currentY = e.clientY - startY;

      // ถ้าลากแนวนอนมากกว่าแนวตั้ง ให้ทำการหมุน/เลื่อน
      if (Math.abs(currentX) > Math.abs(currentY)) {
        var rotate = currentX * 0.05;
        inner.style.transform = 'translateX(' + currentX + 'px) rotate(' + rotate + 'deg)';
        
        // แสดง hint
        if (currentX < -20) {
          hintLeft.style.opacity = Math.min(1, Math.abs(currentX) / swipeThreshold);
          hintRight.style.opacity = 0;
        } else if (currentX > 20) {
          hintRight.style.opacity = Math.min(1, Math.abs(currentX) / swipeThreshold);
          hintLeft.style.opacity = 0;
        } else {
          hintLeft.style.opacity = 0;
          hintRight.style.opacity = 0;
        }
      }
    });

    scene.addEventListener('pointerup', function (e) {
      if (!isDragging) return;
      isDragging = false;
      inner.style.transition = '';

      if (currentX < -swipeThreshold) {
        // ปัดซ้าย (จำไม่ได้)
        animateSwipe('left', q, subjectId, topicName, root);
      } else if (currentX > swipeThreshold) {
        // ปัดขวา (จำได้)
        animateSwipe('right', q, subjectId, topicName, root);
      } else {
        // ดีดกลับ
        inner.style.transform = '';
        hintLeft.style.opacity = 0;
        hintRight.style.opacity = 0;
      }
      currentX = 0; currentY = 0;
    });
  }

  function animateSwipe(direction, q, subjectId, topicName, root) {
    var inner = document.querySelector('.flashcard-inner');
    var hintLeft = document.querySelector('.hint-left');
    var hintRight = document.querySelector('.hint-right');
    
    if (inner) {
      inner.classList.add(direction === 'left' ? 'swipe-left' : 'swipe-right');
    }

    // อัปเดตกล่อง Leitner
    setTimeout(function () {
      if (direction === 'left') {
        updateBox(q, false); // จำไม่ได้
      } else {
        updateBox(q, true);  // จำได้
      }
      currentIndex++;
      flipped = false;
      renderCard(root, subjectId, topicName);
    }, 300); // รออนิเมชัน 0.3s
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