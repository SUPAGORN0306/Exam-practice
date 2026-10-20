/* Flashcards mode — Swipe (Leitner) + Arrow Navigation + Stat */
(function () {
  window.App = window.App || {};
  App.views = App.views || {};

  var cards = [];            
  var totalCardsCount = 0;
  var understoodCount = 0;   
  var currentIndex = 0;
  var flipped = false;
  var animating = false;     
  var scored = {};           

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

    animating = false;
    while (root.firstChild) root.removeChild(root.firstChild);

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
          sel.appendChild(el('option', { value: '', text: 'ทุกวิชา' }));
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

      var totalAvailable = getPool().length;
      
      var options = [];
      var presets = [10, 20, 30, 45, 60, 80, 90];
      
      presets.forEach(function (val) {
        if (val <= totalAvailable) {
          options.push({ value: val, text: String(val) });
        }
      });
      
      if (totalAvailable > 0 && presets.indexOf(totalAvailable) === -1) {
        options.push({ value: totalAvailable, text: String(totalAvailable) });
      }
      
      options.push({ value: 0, text: 'ทั้งหมด' });
      
      var hasActive = options.some(function(o) { return o.value === selectedLimit; });
      if (!hasActive) {
        selectedLimit = 0;
        selection.limit = 0;
      }

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
        msg = 'จะใช้ ' + selectedLimit + ' จาก ' + n + ' ข้อ';
      }
      poolInfo.textContent = msg;
      renderLimitButtons();
    }

    renderChapters();
    renderLimitButtons();
    updatePoolInfo();
  };

  function startSession(root) {
    while (root.firstChild) root.removeChild(root.firstChild);

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
      App.views.flashcards(root);
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

    totalCardsCount = cards.length;
    understoodCount = 0;
    currentIndex = 0;
    flipped = false;
    animating = false;
    scored = {};

    renderCard(root);
  }

  function renderCard(root) {
    var el = App.el;
    while (root.firstChild) root.removeChild(root.firstChild);

    if (understoodCount >= totalCardsCount) {
      root.appendChild(el('div', { class: 'card center', style: 'padding: 40px 20px;' }, [
        el('h2', { text: 'ทบทวนครบทุกใบแล้ว' }),
        el('p', { class: 'muted', text: 'คุณปัดขวาครบทั้ง ' + totalCardsCount + ' ใบเรียบร้อยแล้ว' }),
        el('div', { class: 'row', style: 'justify-content:center; margin-top:24px;' }, [
          el('button', { class: 'btn', text: 'กลับหน้าเลือกวิชา', onclick: function () { App.views.flashcards(root); } }),
          el('button', { class: 'btn btn-primary', text: 'กลับหน้าแรก', onclick: function () { App.navigate('home'); } })
        ])
      ]));
      return;
    }

    if (cards.length === 0) {
      App.views.flashcards(root);
      return;
    }

    if (currentIndex >= cards.length) currentIndex = 0;
    if (currentIndex < 0) currentIndex = cards.length - 1;

    root.appendChild(el('div', {
      class: 'session-top',
      style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;'
    }, [
      el('button', { class: 'icon-btn', text: '✕', onclick: function () { App.views.flashcards(root); } }),
      el('div', { class: 'small muted', style: 'font-weight:600; font-variant-numeric: tabular-nums; font-size:1.1rem;', text: understoodCount + ' / ' + totalCardsCount }),
      el('div', { style: 'width:48px;' })
    ]));

    var q = cards[currentIndex];

    var scene = el('div', { class: 'flashcard-scene', style: 'touch-action: none;' });
    var inner = el('div', { class: 'flashcard-inner' + (flipped ? ' is-flipped' : '') });

    // 🔥 ลบชื่อวิชาและบทออกจากการ์ดหน้าแรก
    var front = el('div', { class: 'flashcard-front' }, [
      el('h2', { style: 'margin-top:16px; white-space:pre-wrap;', text: q.question }),
      el('p', { class: 'muted', style: 'margin-top:32px; font-size:0.9rem;', text: 'แตะเพื่อพลิกดูเฉลย' })
    ]);

    // 🔥 ลบชื่อวิชาและบทออกจากการ์ดหลัง
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

    var startX = 0, startY = 0, currentX = 0, currentY = 0;
    var isSwiping = false;
    var threshold = 40;

    // 🔥 Tap to flip (click event)
    inner.addEventListener('click', function () {
      if (animating || isSwiping) return;
      flipped = !flipped;
      inner.classList.toggle('is-flipped', flipped);
    });

    // 🔥 Touch Events (สำหรับมือถือ)
    scene.addEventListener('touchstart', function (e) {
      if (animating) return;
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      currentX = 0;
      currentY = 0;
      isSwiping = false;
      inner.style.transition = 'none';
    }, { passive: true });

    scene.addEventListener('touchmove', function (e) {
      if (animating) return;
      var touch = e.touches[0];
      currentX = touch.clientX - startX;
      currentY = touch.clientY - startY;

      // ตรวจสอบว่าเป็นการลากแนวนอนหรือไม่
      if (!isSwiping) {
        if (Math.abs(currentX) > 8 && Math.abs(currentX) > Math.abs(currentY)) {
          isSwiping = true;
        } else {
          return;
        }
      }

      if (e.cancelable) e.preventDefault();

      var rotate = currentX * 0.05;
      inner.style.transform = 'translateX(' + currentX + 'px) rotate(' + rotate + 'deg)';
    }, { passive: false });

    scene.addEventListener('touchend', function () {
      if (animating) return;
      if (!isSwiping) {
        inner.style.transition = '';
        inner.style.transform = '';
        return;
      }

      if (currentX < -threshold) {
        animateSwipe('left', q, root, inner);
      } else if (currentX > threshold) {
        animateSwipe('right', q, root, inner);
      } else {
        inner.style.transition = '';
        inner.style.transform = '';
      }
      isSwiping = false;
      currentX = 0;
      currentY = 0;
    });

    scene.addEventListener('touchcancel', function () {
      inner.style.transition = '';
      inner.style.transform = '';
      isSwiping = false;
      currentX = 0;
      currentY = 0;
    });

    // 🔥 Mouse Events (สำหรับคอมพิวเตอร์)
    var mouseDown = false;
    scene.addEventListener('mousedown', function (e) {
      if (animating) return;
      e.preventDefault();
      mouseDown = true;
      startX = e.clientX;
      startY = e.clientY;
      currentX = 0;
      currentY = 0;
      isSwiping = false;
      inner.style.transition = 'none';
    });

    scene.addEventListener('mousemove', function (e) {
      if (!mouseDown || animating) return;
      currentX = e.clientX - startX;
      currentY = e.clientY - startY;

      if (!isSwiping) {
        if (Math.abs(currentX) > 8 && Math.abs(currentX) > Math.abs(currentY)) {
          isSwiping = true;
        } else {
          return;
        }
      }

      var rotate = currentX * 0.05;
      inner.style.transform = 'translateX(' + currentX + 'px) rotate(' + rotate + 'deg)';
    });

    scene.addEventListener('mouseup', function () {
      if (!mouseDown) return;
      mouseDown = false;

      if (isSwiping) {
        if (currentX < -threshold) {
          animateSwipe('left', q, root, inner);
        } else if (currentX > threshold) {
          animateSwipe('right', q, root, inner);
        } else {
          inner.style.transition = '';
          inner.style.transform = '';
        }
      }
      isSwiping = false;
      currentX = 0;
      currentY = 0;
    });

    scene.addEventListener('mouseleave', function () {
      if (!mouseDown) return;
      mouseDown = false;
      inner.style.transition = '';
      inner.style.transform = '';
      isSwiping = false;
      currentX = 0;
      currentY = 0;
    });

    // ปุ่มควบคุมด้านล่าง
    root.appendChild(el('div', { class: 'row', style: 'margin-top:24px; justify-content:center; gap:16px;' }, [

      el('button', {
        class: 'icon-btn',
        style: 'width:48px; height:48px; font-size:1.5rem;',
        text: '<',
        onclick: function () {
          if (animating) return;
          flipped = false;
          currentIndex = currentIndex - 1;
          if (currentIndex < 0) currentIndex = cards.length - 1;
          renderCard(root);
        }
      }),

      el('button', {
        class: 'btn',
        style: 'min-width:100px;',
        text: 'สุ่มข้อ',
        onclick: function () {
          if (animating || cards.length <= 1) return;
          flipped = false;
          var nextIdx;
          do {
            nextIdx = Math.floor(Math.random() * cards.length);
          } while (nextIdx === currentIndex);
          currentIndex = nextIdx;
          renderCard(root);
        }
      }),

      el('button', {
        class: 'icon-btn',
        style: 'width:48px; height:48px; font-size:1.5rem;',
        text: '>',
        onclick: function () {
          if (animating) return;
          flipped = false;
          currentIndex = currentIndex + 1;
          if (currentIndex >= cards.length) currentIndex = 0;
          renderCard(root);
        }
      })
    ]));
  }

  function animateSwipe(direction, q, root, inner) {
    if (animating) return;
    animating = true;

    inner.style.transition = '';
    void inner.offsetWidth;
    inner.style.transform = '';
    inner.classList.add(direction === 'left' ? 'swipe-left' : 'swipe-right');

    setTimeout(function () {
      if (!scored[q.id]) {
        scored[q.id] = true;
        updateBox(q, direction === 'right');
      }

      var i = cards.indexOf(q);
      if (i !== -1) {
        cards.splice(i, 1);

        if (direction === 'right') {
          understoodCount++;
          if (i >= cards.length) {
            currentIndex = 0;
          } else {
            currentIndex = i;
          }
        } else {
          cards.push(q);
          if (cards.length <= 1) {
            currentIndex = 0;
          } else {
            currentIndex = (i >= cards.length - 1) ? 0 : i;
          }
        }
      }

      flipped = false;
      animating = false;
      
      while (root.firstChild) root.removeChild(root.firstChild);
      
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