/* Flashcards mode — Swipe (Leitner) + Arrow Navigation + Submit */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var cards = [];
  var currentIndex = 0;
  var flipped = false;

  var selection = {
    subjectId: null,
    chapters: [],
    limit: 20
  };

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

    if (questions.length === 0) {
      root.appendChild(el('div', { class: 'empty' }, [
        el('p', { text: 'ยังไม่มีข้อสอบในระบบ' }),
        el('button', { class: 'btn btn-primary', text: 'กลับหน้าแรก', onclick: function () { App.navigate('home'); } })
      ]));
      return;
    }

    var selectedSubject = selection.subjectId;
    var selectedChapters = selection.chapters.slice();
    var selectedLimit = selection.limit;

    var chapterContainer = el('div', { id: 'fc-chapter-container', style: 'display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;' });
    var limitContainer = el('div', { id: 'fc-limit-container', class: 'row', style: 'gap:8px; flex-wrap:wrap;' });
    var poolInfo = el('p', { class: 'muted small', style: 'margin-top:8px;' });

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'ฝึกแฟลชการ์ด' }),
      el('p', { class: 'muted small', text: 'เลือกวิชา บท (ได้หลายบท) และจำนวนข้อ' }),

      el('div', { class: 'field', style: 'margin-top:16px;' }, [
        el('span', { class: 'label', text: 'วิชา' }),
        (function () {
          var sel = el('select', { class: 'select' });
          sel.appendChild(el('option', { value: '', text: '-- ทุกวิชา --' }));
          App.subjects.forEach(function (s) {
            var count = questions.filter(function (q) { return q.subject === s.id; }).length;
            if (count > 0) {
              sel.appendChild(el('option', { value: s.id, text: s.name + ' (' + count + ' ข้อ)' }));
            }
          });
          if (selectedSubject) sel.value = selectedSubject;
          sel.addEventListener('change', function () {
            selectedSubject = sel.value || null;
            selectedChapters = [];
            selection.subjectId = selectedSubject;
            selection.chapters = [];
            renderChapters();
            updatePoolInfo();
          });
          return sel;
        })()
      ]),

      el('div', { class: 'field' }, [
        el('div', { style: 'display:flex; align-items:center; justify-content:space-between; gap:8px;' }, [
          el('span', { class: 'label', text: 'บท (เลือกได้หลายบท)' }),
          el('div', { style: 'display:flex; gap:6px;' }, [
            el('button', {
              class: 'btn btn-small', type: 'button', text: 'เลือกทั้งหมด',
              onclick: function () {
                selectedChapters = [];
                var chips = chapterContainer.querySelectorAll('.chip');
                for (var i = 0; i < chips.length; i++) {
                  chips[i].classList.add('selected');
                  selectedChapters.push(chips[i].getAttribute('data-topic'));
                }
                selection.chapters = selectedChapters.slice();
                updatePoolInfo();
              }
            }),
            el('button', {
              class: 'btn btn-small', type: 'button', text: 'ล้าง',
              onclick: function () {
                var chips = chapterContainer.querySelectorAll('.chip');
                for (var i = 0; i < chips.length; i++) chips[i].classList.remove('selected');
                selectedChapters = [];
                selection.chapters = [];
                updatePoolInfo();
              }
            })
          ])
        ]),
        chapterContainer
      ]),

      el('div', { class: 'field' }, [
        el('span', { class: 'label', text: 'จำนวนข้อ' }),
        limitContainer,
        poolInfo
      ]),

      el('button', {
        class: 'btn btn-primary btn-block',
        style: 'margin-top:24px; font-size:1.05rem; min-height:56px;',
        text: 'เริ่มฝึก',
        onclick: function () {
          selection.subjectId = selectedSubject;
          selection.chapters = selectedChapters.slice();
          selection.limit = selectedLimit;
          startSession(root);
        }
      })
    ]));

    function getPool() {
      return questions.filter(function (q) {
        if (selectedSubject && q.subject !== selectedSubject) return false;
        if (selectedChapters.length > 0 && selectedChapters.indexOf(q.topic) === -1) return false;
        return true;
      });
    }

    function renderChapters() {
      while (chapterContainer.firstChild) chapterContainer.removeChild(chapterContainer.firstChild);

      var filtered = questions.filter(function (q) {
        return !selectedSubject || q.subject === selectedSubject;
      });

      var topics = {};
      filtered.forEach(function (q) {
        topics[q.topic] = (topics[q.topic] || 0) + 1;
      });

      var topicNames = Object.keys(topics);
      if (topicNames.length === 0) {
        chapterContainer.appendChild(el('p', { class: 'muted small', text: 'ไม่มีบทในวิชานี้' }));
        return;
      }

      topicNames.forEach(function (t) {
        var isSel = selectedChapters.indexOf(t) !== -1;
        var chip = el('div', { 
          class: 'chip' + (isSel ? ' selected' : ''),
          'data-topic': t,
          text: t + ' (' + topics[t] + ')'
        });

        chip.addEventListener('click', function () {
          if (chip.classList.contains('selected')) {
            chip.classList.remove('selected');
            var i = selectedChapters.indexOf(t);
            if (i !== -1) selectedChapters.splice(i, 1);
          } else {
            chip.classList.add('selected');
            if (selectedChapters.indexOf(t) === -1) selectedChapters.push(t);
          }
          selection.chapters = selectedChapters.slice();
          updatePoolInfo();
        });

        chapterContainer.appendChild(chip);
      });
    }

    function renderLimitButtons() {
      while (limitContainer.firstChild) limitContainer.removeChild(limitContainer.firstChild);

      var options = [
        { value: 10, text: '10' },
        { value: 20, text: '20' },
        { value: 50, text: '50' },
        { value: 0, text: 'ทั้งหมด' }
      ];

      options.forEach(function (opt) {
        var isActive = (selectedLimit === opt.value);
        var btn = el('button', {
          type: 'button',
          class: 'btn btn-small' + (isActive ? ' btn-primary' : ''),
          text: opt.text
        });
        btn.addEventListener('click', function () {
          selectedLimit = opt.value;
          selection.limit = opt.value;
          renderLimitButtons();
          updatePoolInfo();
        });
        limitContainer.appendChild(btn);
      });
    }

    function updatePoolInfo() {
      var n = getPool().length;
      var msg;
      if (n === 0) {
        msg = 'ไม่มีข้อสอบในเงื่อนไขที่เลือก';
      } else if (selectedLimit === 0) {
        msg = 'จะใช้ทั้งหมด ' + n + ' ข้อ';
      } else if (selectedLimit > n) {
        msg = 'มีข้อสอบ ' + n + ' ข้อ (น้อยกว่าที่เลือก จะใช้ทั้งหมด)';
      } else {
        msg = 'จะสุ่ม ' + selectedLimit + ' จาก ' + n + ' ข้อ';
      }
      poolInfo.textContent = msg;
    }

    renderChapters();
    renderLimitButtons();
    updatePoolInfo();
  };

  function startSession(root) {
    var questions = App.loadQuestions();
    var progress = App.storage.getProgress();

    var subjectId = selection.subjectId;
    var chapters = selection.chapters || [];
    var limit = selection.limit;

    var pool = questions.filter(function (q) {
      if (subjectId && q.subject !== subjectId) return false;
      if (chapters.length > 0 && chapters.indexOf(q.topic) === -1) return false;
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
    var merged = due.concat(rest);

    if (limit > 0 && limit < merged.length) {
      merged = merged.slice(0, limit);
    }
    cards = merged;

    currentIndex = 0;
    flipped = false;

    renderCard(root);
  }

  function renderCard(root) {
    var el = App.el;
    while (root.firstChild) root.removeChild(root.firstChild);

    // 🔥 Header แบบมินิมอล
    root.appendChild(el('div', {
      class: 'session-top',
      style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;'
    }, [
      el('button', { class: 'icon-btn', text: '✕', onclick: function () { App.navigate('home'); } }),
      el('div', { class: 'small muted', style: 'font-weight:600;', text: 'โหมดทบทวน' }),
      el('div', { style: 'width:48px;' })
    ]));

    var q = cards[currentIndex];

    var scene = el('div', { class: 'flashcard-scene' });
    var inner = el('div', { class: 'flashcard-inner' + (flipped ? ' is-flipped' : '') });

    var front = el('div', { class: 'flashcard-front' }, [
      el('div', { class: 'small muted', text: App.subjectName(q.subject) + ' • ' + q.topic }),
      el('h2', { style: 'margin-top:16px; white-space:pre-wrap;', text: q.question }),
      el('p', { class: 'muted', style: 'margin-top:32px; font-size:0.9rem;', text: 'แตะเพื่อพลิกดูเฉลย' })
    ]);

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

    var isDragging = false;

    inner.addEventListener('click', function () {
      if (isDragging) return;
      flipped = !flipped;
      inner.classList.toggle('is-flipped', flipped);
    });

    var startX = 0, startY = 0, currentX = 0, currentY = 0;
    var swipeThreshold = 80;

    scene.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      currentX = 0;
      currentY = 0;
      inner.style.transition = 'none';
      scene.setPointerCapture(e.pointerId);
    });

    scene.addEventListener('pointermove', function (e) {
      if (!isDragging) return;
      currentX = e.clientX - startX;
      currentY = e.clientY - startY;

      if (Math.abs(currentX) > Math.abs(currentY)) {
        var rotate = currentX * 0.05;
        inner.style.transform = 'translateX(' + currentX + 'px) rotate(' + rotate + 'deg)';
      }
    });

    scene.addEventListener('pointerup', function (e) {
      if (!isDragging) return;
      isDragging = false;

      var shouldSwipe = currentX < -swipeThreshold ? 'left'
                      : currentX > swipeThreshold  ? 'right'
                      : null;

      if (shouldSwipe) {
        animateSwipe(shouldSwipe, q, root);
      } else {
        inner.style.transition = '';
        inner.style.transform = '';
      }
      currentX = 0; currentY = 0;
    });

    scene.addEventListener('pointercancel', function () {
      if (!isDragging) return;
      isDragging = false;
      inner.style.transition = '';
      inner.style.transform = '';
      currentX = 0; currentY = 0;
    });

    // 🔥 ปุ่มควบคุมด้านล่าง: [ < ] [ สุ่มข้อ ] [ > หรือ Submit ]
    var isLastCard = (currentIndex === cards.length - 1);

    root.appendChild(el('div', { class: 'row', style: 'margin-top:24px; justify-content:center; gap:16px;' }, [
      
      // ย้อนกลับ
      el('button', { 
        class: 'icon-btn', 
        style: 'width:48px; height:48px; font-size:1.5rem;',
        text: '<',
        onclick: function () {
          currentIndex = (currentIndex - 1 + cards.length) % cards.length;
          flipped = false;
          renderCard(root);
        }
      }),

      // สุ่มข้อ
      el('button', { 
        class: 'btn',
        style: 'min-width:100px;',
        text: 'สุ่มข้อ',
        onclick: function () {
          if (cards.length <= 1) return;
          var nextIdx;
          do {
            nextIdx = Math.floor(Math.random() * cards.length);
          } while (nextIdx === currentIndex);
          
          currentIndex = nextIdx;
          flipped = false;
          renderCard(root);
        }
      }),

      // ไปข้างหน้า / จบการทบทวน
      isLastCard ? 
        el('button', { 
          class: 'btn btn-primary', style: 'min-width:120px;', text: 'จบการทบทวน',
          onclick: function () { App.views.flashcards(root); }
        })
        :
        el('button', { 
          class: 'icon-btn', 
          style: 'width:48px; height:48px; font-size:1.5rem;',
          text: '>',
          onclick: function () {
            currentIndex = (currentIndex + 1) % cards.length;
            flipped = false;
            renderCard(root);
          }
        })
    ]));
  }

  function animateSwipe(direction, q, root) {
    var inner = document.querySelector('.flashcard-inner');
    if (!inner) return;

    inner.style.transition = '';
    inner.style.transform = '';
    void inner.offsetWidth;

    inner.classList.add(direction === 'left' ? 'swipe-left' : 'swipe-right');

    setTimeout(function () {
      updateBox(q, direction === 'right');
      
      cards.splice(currentIndex, 1);
      
      if (cards.length === 0) {
        App.toast('ทบทวนครบทุกใบแล้ว');
        App.views.flashcards(root);
        return;
      }

      if (currentIndex >= cards.length) {
        currentIndex = 0;
      }
      
      flipped = false;
      renderCard(root);
    }, 380);
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