(function (global) {
  'use strict';

  var STICKY_COLORS = ['#e8c547', '#7ec8a4', '#c97b84', '#8eb4e8', '#d4a574'];

  function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 10);
  }

  function setPaletteActive(container, selected) {
    container.querySelectorAll('.gm-sticky-palette-swatch').forEach(function (btn) {
      var color = btn.getAttribute('data-color');
      btn.classList.toggle('gm-sticky-palette-swatch--active', color === selected);
    });
  }

  function renderPalette(container, colors, selected, onSelect) {
    if (!container) return;
    container.classList.add('gm-sticky-palette');
    var existing = container.querySelectorAll('.gm-sticky-palette-swatch');
    if (existing.length) {
      existing.forEach(function (btn) {
        var color = btn.getAttribute('data-color');
        if (!color) return;
        btn.onclick = function () {
          onSelect(color);
          setPaletteActive(container, color);
        };
      });
      setPaletteActive(container, selected);
      return;
    }
    container.innerHTML = '';
    colors.forEach(function (color) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gm-sticky-palette-swatch';
      btn.style.background = color;
      btn.setAttribute('data-color', color);
      btn.title = 'Note color';
      btn.setAttribute('aria-label', 'Note color ' + color);
      if (color === selected) {
        btn.classList.add('gm-sticky-palette-swatch--active');
      }
      btn.addEventListener('click', function () {
        onSelect(color);
        renderPalette(container, colors, color, onSelect);
      });
      container.appendChild(btn);
    });
  }

  function renderNotePalette(container, note, onSelect) {
    if (!container) return;
    container.innerHTML = '';
    container.classList.add('gm-sticky-note-palette');
    STICKY_COLORS.forEach(function (color) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gm-sticky-palette-swatch gm-sticky-palette-swatch--small';
      btn.style.background = color;
      btn.title = 'Set color';
      if (color === note.color) {
        btn.classList.add('gm-sticky-palette-swatch--active');
      }
      btn.addEventListener('click', function (event) {
        event.stopPropagation();
        note.color = color;
        onSelect();
      });
      container.appendChild(btn);
    });
  }

  function mount(boardEl, options) {
    if (!boardEl || typeof options.getStickies !== 'function') {
      return null;
    }

    var onChange = options.onChange || function () {};
    var newColor = options.defaultColor || STICKY_COLORS[0];
    var stickyDrag = null;
    var stickyOffset = { x: 0, y: 0 };
    var stickyMirror = null;
    var wired = false;

    function getMirror() {
      if (!stickyMirror) {
        stickyMirror = document.createElement('div');
        stickyMirror.className = 'gm-sticky-mirror';
        stickyMirror.setAttribute('aria-hidden', 'true');
        document.body.appendChild(stickyMirror);
      }
      return stickyMirror;
    }

    function autosizeStickyText(ta) {
      if (!ta) return;
      var minWidth = 80;
      var maxWidth = 168;
      var text = ta.value.length ? ta.value : '\u00a0';
      var style = window.getComputedStyle(ta);
      var mirror = getMirror();
      mirror.style.font = style.font;
      mirror.style.lineHeight = style.lineHeight;
      mirror.style.padding = style.padding;
      mirror.style.border = style.border;
      mirror.style.boxSizing = style.boxSizing;
      mirror.style.letterSpacing = style.letterSpacing;
      mirror.style.display = 'inline-block';
      mirror.style.whiteSpace = 'nowrap';
      mirror.style.width = 'auto';
      mirror.style.maxWidth = 'none';
      var lines = text.split('\n');
      var lineWidth = minWidth;
      for (var i = 0; i < lines.length; i++) {
        mirror.textContent = lines[i].length ? lines[i] : '\u00a0';
        lineWidth = Math.max(lineWidth, mirror.scrollWidth + 4);
      }
      var contentWidth = Math.min(maxWidth, Math.max(minWidth, lineWidth));
      mirror.style.whiteSpace = 'pre-wrap';
      mirror.style.overflowWrap = 'break-word';
      mirror.style.wordBreak = 'break-word';
      mirror.style.width = contentWidth + 'px';
      mirror.style.maxWidth = maxWidth + 'px';
      mirror.textContent = text;
      ta.style.width = contentWidth + 'px';
      ta.style.maxWidth = maxWidth + 'px';
      ta.style.maxHeight = 'none';
      ta.style.height = mirror.scrollHeight + 'px';
    }

    function findNote(id) {
      var stickies = options.getStickies();
      if (!stickies) return null;
      for (var i = 0; i < stickies.length; i++) {
        if (stickies[i].id === id) return stickies[i];
      }
      return null;
    }

    function render() {
      var stickies = options.getStickies() || [];
      boardEl.innerHTML = '';
      stickies.forEach(function (note) {
        var card = document.createElement('div');
        card.className = 'gm-sticky';
        card.style.background = note.color || STICKY_COLORS[0];
        card.style.left = (note.x || 0) + 'px';
        card.style.top = (note.y || 0) + 'px';
        card.dataset.id = note.id;
        card.innerHTML =
          '<button type="button" class="gm-sticky-delete" title="Delete">&times;</button>' +
          '<div class="gm-sticky-note-palette-host"></div>' +
          '<textarea class="gm-sticky-text sheet-input" rows="1"></textarea>';
        var paletteHost = card.querySelector('.gm-sticky-note-palette-host');
        renderNotePalette(paletteHost, note, function () {
          card.style.background = note.color;
          onChange();
        });
        var ta = card.querySelector('.gm-sticky-text');
        ta.value = note.text || '';
        boardEl.appendChild(card);
        autosizeStickyText(ta);
      });
    }

    function addSticky() {
      var stickies = options.getStickies();
      if (!stickies) return;
      stickies.push({
        id: uid('note'),
        text: '',
        color: newColor,
        x: 20 + (stickies.length * 12) % 120,
        y: 20 + (stickies.length * 18) % 80
      });
      onChange();
      render();
    }

    function wireEvents() {
      if (wired) return;
      wired = true;

      boardEl.addEventListener('mousedown', function (e) {
        if (e.target.closest('.gm-sticky-palette-swatch')) return;
        var card = e.target.closest('.gm-sticky');
        if (!card || e.target.classList.contains('gm-sticky-delete')) return;
        if (e.target.classList.contains('gm-sticky-text')) return;
        var note = findNote(card.dataset.id);
        if (!note) return;
        stickyDrag = note;
        var brect = boardEl.getBoundingClientRect();
        stickyOffset.x = e.clientX - brect.left - note.x;
        stickyOffset.y = e.clientY - brect.top - note.y;
      });

      document.addEventListener('mousemove', function (e) {
        if (!stickyDrag) return;
        var brect = boardEl.getBoundingClientRect();
        stickyDrag.x = Math.max(0, e.clientX - brect.left - stickyOffset.x);
        stickyDrag.y = Math.max(0, e.clientY - brect.top - stickyOffset.y);
        var card = boardEl.querySelector('.gm-sticky[data-id="' + stickyDrag.id + '"]');
        if (card) {
          card.style.left = stickyDrag.x + 'px';
          card.style.top = stickyDrag.y + 'px';
        }
      });

      document.addEventListener('mouseup', function () {
        if (!stickyDrag) return;
        stickyDrag = null;
        onChange();
      });

      boardEl.addEventListener('input', function (e) {
        if (!e.target.classList.contains('gm-sticky-text')) return;
        autosizeStickyText(e.target);
        var card = e.target.closest('.gm-sticky');
        var note = findNote(card.dataset.id);
        if (note) {
          note.text = e.target.value;
          onChange();
        }
      });

      boardEl.addEventListener('click', function (e) {
        if (!e.target.classList.contains('gm-sticky-delete')) return;
        var card = e.target.closest('.gm-sticky');
        var stickies = options.getStickies();
        if (!stickies || !card) return;
        var id = card.dataset.id;
        for (var i = stickies.length - 1; i >= 0; i--) {
          if (stickies[i].id === id) {
            stickies.splice(i, 1);
            break;
          }
        }
        onChange();
        render();
      });
    }

    if (options.addButtonEl) {
      options.addButtonEl.addEventListener('click', addSticky);
    }

    if (options.paletteEl) {
      renderPalette(options.paletteEl, STICKY_COLORS, newColor, function (color) {
        newColor = color;
      });
    }

    wireEvents();
    render();

    return {
      render: render,
      addSticky: addSticky
    };
  }

  global.StickyBoard = {
    COLORS: STICKY_COLORS,
    mount: mount
  };
})(window);
