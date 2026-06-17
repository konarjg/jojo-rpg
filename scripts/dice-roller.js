(function (global) {
  'use strict';

  var ROLL_MS = 600;
  var MAX_DICE = 20;

  var D6_PIPS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  function clampCount(n) {
    var v = parseInt(n, 10);
    if (isNaN(v) || v < 1) return 1;
    if (v > MAX_DICE) return MAX_DICE;
    return v;
  }

  function d6FaceHtml(value) {
    var pips = D6_PIPS[value] || D6_PIPS[1];
    var cells = [];
    for (var i = 0; i < 9; i++) {
      var on = pips.indexOf(i) >= 0;
      cells.push('<span class="dice-pip' + (on ? ' dice-pip--on' : '') + '"></span>');
    }
    return '<div class="dice-face dice-face--d6" data-value="' + value + '"><div class="dice-pip-grid">' + cells.join('') + '</div></div>';
  }

  function d20ShapeSvg(display) {
    return '<svg class="dice-d20-shape" viewBox="0 0 100 100" aria-hidden="true">' +
      '<polygon class="dice-d20-body" points="50,8 92,38 76,88 24,88 8,38"/>' +
      '<text class="dice-d20-num" x="50" y="56" text-anchor="middle" dominant-baseline="middle">' + display + '</text>' +
      '</svg>';
  }

  function d20FaceHtml(value) {
    return '<div class="dice-face dice-face--d20" data-value="' + value + '">' +
      d20ShapeSvg(String(value)) +
      '</div>';
  }

  function rollingTileHtml(die) {
    if (die === 'd20') {
      return '<div class="dice-face dice-face--rolling dice-face--d20">' + d20ShapeSvg('?') + '</div>';
    }
    return '<div class="dice-face dice-face--rolling dice-face--d6">?</div>';
  }

  function dieFaceHtml(die, value) {
    return die === 'd6' ? d6FaceHtml(value) : d20FaceHtml(value);
  }

  function pyramidRowSizes(count) {
    if (count <= 0) return [];
    if (count <= 3) return [count];
    var rows = [];
    var remaining = count;
    while (remaining > 0) {
      var take = Math.min(3, remaining);
      rows.push(take);
      remaining -= take;
    }
    return rows;
  }

  function buildPyramidHtml(die, values, rolling) {
    var rows = pyramidRowSizes(values.length);
    var html = '<div class="dice-tiles dice-tiles--pyramid' + (rolling ? '' : ' dice-tiles--settled') + '">';
    var idx = 0;
    rows.forEach(function (rowSize) {
      html += '<div class="dice-row">';
      for (var i = 0; i < rowSize; i++) {
        html += rolling ? rollingTileHtml(die) : dieFaceHtml(die, values[idx++]);
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function mount(container, options) {
    options = options || {};
    var showBroadcast = !!options.showBroadcast;
    var onBroadcast = typeof options.onBroadcast === 'function' ? options.onBroadcast : null;
    var rolling = false;

    container.innerHTML =
      '<div class="dice-roller">' +
      '  <div class="dice-controls">' +
      '    <label class="dice-field">Type ' +
      '      <select class="sheet-input dice-type"><option value="d20">d20</option><option value="d6">d6</option></select>' +
      '    </label>' +
      '    <label class="dice-field">Count <input type="number" class="sheet-input dice-count" min="1" max="' + MAX_DICE + '" value="1"></label>' +
      '    <button type="button" class="pick-btn dice-roll-btn">Roll</button>' +
      (showBroadcast ? '    <label class="dice-broadcast sheet-toggle"><input type="checkbox" class="dice-broadcast-check"> Show on player view</label>' : '') +
      '  </div>' +
      '  <div class="dice-result-area" aria-live="polite"></div>' +
      '</div>';

    var typeEl = container.querySelector('.dice-type');
    var countEl = container.querySelector('.dice-count');
    var rollBtn = container.querySelector('.dice-roll-btn');
    var resultArea = container.querySelector('.dice-result-area');
    var broadcastCheck = container.querySelector('.dice-broadcast-check');

    function showSettled(entry) {
      resultArea.innerHTML = buildPyramidHtml(entry.die, entry.results, false);
    }

    function renderResults(entry, animate) {
      if (animate) {
        var placeholders = [];
        for (var i = 0; i < entry.count; i++) {
          placeholders.push(0);
        }
        resultArea.innerHTML = buildPyramidHtml(entry.die, placeholders, true);
        setTimeout(function () {
          showSettled(entry);
        }, ROLL_MS);
      } else {
        showSettled(entry);
      }
    }

    function doRoll() {
      if (rolling) return;
      rolling = true;
      rollBtn.disabled = true;

      var die = typeEl.value === 'd6' ? 'd6' : 'd20';
      var count = clampCount(countEl.value);
      countEl.value = String(count);
      var sides = die === 'd6' ? 6 : 20;
      var results = [];
      for (var i = 0; i < count; i++) {
        results.push(rollDie(sides));
      }
      var entry = {
        die: die,
        count: count,
        results: results,
        time: Date.now()
      };

      renderResults(entry, true);

      setTimeout(function () {
        rolling = false;
        rollBtn.disabled = false;
        if (showBroadcast && broadcastCheck && broadcastCheck.checked && onBroadcast) {
          onBroadcast(entry);
        }
      }, ROLL_MS);
    }

    rollBtn.addEventListener('click', doRoll);
    countEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doRoll();
    });

    return {
      roll: doRoll
    };
  }

  global.DiceRoller = { mount: mount, MAX_DICE: MAX_DICE };
})(typeof window !== 'undefined' ? window : this);
