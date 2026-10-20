/* Flashcards mode — 3D Flip, Swipe, Subject/Topic Multi-select + Limit */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var cards = [];
  var currentIndex = 0;
  var flipped = false;

  // เก็บ state การเลือก เพื่อให้กลับมาจากจบชุดแล้วค่าเดิมยังอยู่
  var selection = {
    subjectId: null,
    chapters: [],   // array ของชื่อ topic ที่เลือก (ว่าง = ทุกบท)
    limit: 20       // 0 = ทั้งหมด
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

    // --- Selection UI ---
    var selectedSubject = selection.subjectId;
    var selectedChapters = selection.chapters.slice();
    var selectedLimit = selection.limit;

    // container สำหรับ checkbox บท (จะ re-render เมื่อเปลี่ยนวิชา)
    var chapterContainer = el('div', { id: 'fc-chapter-container' });

    // container สำหรับปุ่มลัดจำนวนข้อ
    var limitContainer = el('div', { id: 'fc-limit-container', class: 'row', style: 'gap:8px; flex-wrap:wrap;' });

    // ข้อความบอกจำนวนข้อที่มีจริง
    var poolInfo = el('p', { class: 'muted small', style: 'margin-top:8px;' });

    root.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'ฝึกแฟลชการ์ด' }),
      el('p', { class: 'muted small', text: 'เลือกวิชา บท (ได้หลายบท) และจำนวนข้อ' }),

      // วิชา
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
            // เปลี่ยนวิชา → reset บทที่เลือกไว้ (เพราะชื่อบทอาจไม่ตรงกัน)
            selectedChapters = [];
            selection.subjectId = selectedSubject;
            selection.chapters = [];
            renderChapters();
            updatePoolInfo();
          });
          return sel;
        })()
      ]),

      // บท (multi-checkbox)
      el('div', { class: 'field' }, [
        el('div', { style: 'display:flex; align-items:center; justify-content:space-between; gap:8px;' }, [
          el('span', { class: 'label', text: 'บท (เลือกได้หลายบท)' }),
          el('div', { style: 'display:flex; gap:6px;' }, [
            el('button', {
              class: 'btn btn-small', type: 'button', text: 'เลือกทั้งหมด',
              onclick: function () {
                var boxes = chapterContainer.querySelectorAll('input[type=checkbox]');
                selectedChapters = [];
                for (var i = 0; i < boxes.length; i++) {
                  boxes[i].checked = true;
                  selectedChapters.push(boxes[i].value);
                }
                selection.chapters = selectedChapters.slice();
                updatePoolInfo();
              }
            }),
            el('button', {
              class: 'btn btn-small', type: 'button', text: 'ล้าง',
              onclick: function () {
                var boxes = chapterContainer.querySelectorAll('input[type=checkbox]');
                for (var i = 0; i < boxes.length; i++) boxes[i].checked = false;
                selectedChapters = [];
                selection.chapters = [];
                updatePoolInfo();
              }
            })
          ])
        ]),
        chapterContainer
      ]),

      // จำนวนข้อ
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

    // ---------- helpers ----------

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

      // นับจำนวนข้อต่อบท
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
        var id = 'fc-ch-' + Math.random().toString(36).slice(2, 8);
        var cb = el('input', { type: 'checkbox', id: id, value: t });
        if (selectedChapters.indexOf(t) !== -1) cb.checked = true;

        cb.addEventListener('change', function () {
          if (cb.checked) {
            if (selectedChapters.indexOf(t) === -1) selectedChapters.push(t);
          } else {
            var idx = selectedChapters.indexOf(t);
            if (idx !== -1) selectedChapters.splice(idx, 1);
          }
          selection.chapters = selectedChapters.slice();
          updatePoolInfo();
        });

        chapterContainer.appendChild(el('div', {
          class: 'check-row',
          style: 'display:flex; align-items:center; gap:10px; padding:8px 0;'
        }, [
          cb,
          el('label', { for: id, style: 'flex:1; cursor:pointer;', text: t + ' (' + topics[t] + ' ข้อ)' })
        ]));
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
      var pool = getPool();
      var n = pool.length;
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

    // init
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

    // แยก due / rest
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
      if (limit > pool.length) {
        // ไม่ควรเกิด แต่กันไว้
        App.toast('มีข้อสอบแค่ ' + pool.length + ' ข้อ');
      }
    }
    cards = merged;

    currentIndex = 0;
    flipped = false;

    renderCard(root);
  }

  function renderCard(root) {
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
    var isDragging = false;

    inner.addEventListener('click', function () {
      if (isDragging) return;
      flipped = !flipped;
      inner.classList.toggle('is-flipped', flipped);
    });

    // Bottom Actions (Fallback for desktop)
    root.appendChild(el('div', { class: 'row', style: 'margin-top:24px;' }, [
      el('button', { class: 'btn btn-danger', style: 'flex:1;', text: 'จำไม่ได้', onclick: function () {
        animateSwipe('left', q, root);
      }}),
      el('button', { class: 'btn btn-primary', style: 'flex:1;', text: 'จำได้', onclick: function () {
        animateSwipe('right', q, root);
      }})
    ]));

    // Swipe Logic (Pointer Events)
    var startX = 0, startY = 0, currentX = 0, currentY = 0;
    var swipeThreshold = 80;

    scene.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
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
        animateSwipe('left', q, root);
      } else if (currentX > swipeThreshold) {
        animateSwipe('right', q, root);
      } else {
        inner.style.transform = '';
        hintLeft.style.opacity = 0;
        hintRight.style.opacity = 0;
      }
      currentX = 0; currentY = 0;
    });
  }

  function animateSwipe(direction, q, root) {
    var inner = document.querySelector('.flashcard-inner');

    if (inner) {
      inner.classList.add(direction === 'left' ? 'swipe-left' : 'swipe-right');
    }

    setTimeout(function () {
      if (direction === 'left') {
        updateBox(q, false);
      } else {
        updateBox(q, true);
      }
      currentIndex++;
      flipped = false;
      renderCard(root);
    }, 300);
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