(function (global) {
  'use strict';

  var ROLL_MS = 600;
  var MAX_DICE = 20;
  var SKILL_DICE_MIN = 2;
  var SKILL_DICE_MAX = 5;
  var CATALOG_URL = '/data/jojo-catalog.json';
  var SPECIAL_ATTRS = ['STR', 'PER', 'END', 'CHA', 'INT', 'AGI', 'LCK'];
  var STAND_STATS = [
    { id: 'power', label: 'Power' },
    { id: 'speed', label: 'Speed' },
    { id: 'range', label: 'Range' },
    { id: 'durability', label: 'Durability' },
    { id: 'precision', label: 'Precision' },
    { id: 'developmentPotential', label: 'Dev. Potential' }
  ];
  var FALLBACK_STAND_GRADES = { '∞': 12, A: 10, B: 8, C: 6, D: 4, E: 2, '?': 6, '∅': 0 };
  var catalogPromise = null;

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

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toNumber(value) {
    var n = parseInt(value, 10);
    return isNaN(n) ? 0 : n;
  }

  function clampCount(n) {
    var v = parseInt(n, 10);
    if (isNaN(v) || v < 1) return 1;
    if (v > MAX_DICE) return MAX_DICE;
    return v;
  }

  function clampSkillCount(n) {
    var v = parseInt(n, 10);
    if (isNaN(v) || v < SKILL_DICE_MIN) return SKILL_DICE_MIN;
    if (v > SKILL_DICE_MAX) return SKILL_DICE_MAX;
    return v;
  }

  function computeTn(mode, statValue, skillRank) {
    return toNumber(statValue) + toNumber(skillRank);
  }

  function resolveDie(roll, tn, skillRank, tagged) {
    if (roll === 20) {
      return { roll: roll, successes: 0, complication: 1, kind: 'complication' };
    }
    if (roll === 1 || (tagged && skillRank > 0 && roll <= skillRank)) {
      return { roll: roll, successes: 2, complication: 0, kind: 'crit' };
    }
    if (roll <= tn) {
      return { roll: roll, successes: 1, complication: 0, kind: 'success' };
    }
    return { roll: roll, successes: 0, complication: 0, kind: 'fail' };
  }

  function resolveSkillPool(results, tn, skillRank, tagged) {
    var perDie = [];
    var totalSuccesses = 0;
    var totalComplications = 0;
    results.forEach(function (roll) {
      var resolved = resolveDie(roll, tn, skillRank, tagged);
      perDie.push(resolved);
      totalSuccesses += resolved.successes;
      totalComplications += resolved.complication;
    });
    return {
      totalSuccesses: totalSuccesses,
      totalComplications: totalComplications,
      perDie: perDie
    };
  }

  function resolveDcDie(roll) {
    if (roll === 1) return { roll: roll, damage: 1, effects: 0, kind: 'one' };
    if (roll === 2) return { roll: roll, damage: 2, effects: 0, kind: 'two' };
    if (roll === 5 || roll === 6) return { roll: roll, damage: 1, effects: 1, kind: 'effect' };
    return { roll: roll, damage: 0, effects: 0, kind: 'blank' };
  }

  function resolveDcPool(results) {
    var perDie = [];
    var totalDamage = 0;
    var totalEffects = 0;
    results.forEach(function (roll) {
      var resolved = resolveDcDie(roll);
      perDie.push(resolved);
      totalDamage += resolved.damage;
      totalEffects += resolved.effects;
    });
    return {
      totalDamage: totalDamage,
      totalEffects: totalEffects,
      perDie: perDie
    };
  }

  function d6FaceHtml(value, kind) {
    var pips = D6_PIPS[value] || D6_PIPS[1];
    var cells = [];
    for (var i = 0; i < 9; i++) {
      var on = pips.indexOf(i) >= 0;
      cells.push('<span class="dice-pip' + (on ? ' dice-pip--on' : '') + '"></span>');
    }
    var cls = 'dice-face dice-face--d6' + (kind ? ' dice-face--dc-' + kind : '');
    return '<div class="' + cls + '" data-value="' + value + '"><div class="dice-pip-grid">' + cells.join('') + '</div></div>';
  }

  function d20ShapeSvg(display) {
    return '<svg class="dice-d20-shape" viewBox="0 0 100 100" aria-hidden="true">' +
      '<polygon class="dice-d20-body" points="50,8 92,38 76,88 24,88 8,38"/>' +
      '<text class="dice-d20-num" x="50" y="56" text-anchor="middle" dominant-baseline="middle">' + display + '</text>' +
      '</svg>';
  }

  function d20FaceHtml(value, kind) {
    var cls = 'dice-face dice-face--d20';
    if (kind === 'success') cls += ' dice-face--success';
    if (kind === 'crit') cls += ' dice-face--crit';
    if (kind === 'complication') cls += ' dice-face--complication';
    if (kind === 'fail') cls += ' dice-face--fail';
    return '<div class="' + cls + '" data-value="' + value + '">' +
      d20ShapeSvg(String(value)) +
      '</div>';
  }

  function rollingTileHtml(die) {
    if (die === 'd20') {
      return '<div class="dice-face dice-face--rolling dice-face--d20">' + d20ShapeSvg('?') + '</div>';
    }
    return '<div class="dice-face dice-face--rolling dice-face--d6">?</div>';
  }

  function dieFaceHtml(die, value, kind) {
    return die === 'd6' ? d6FaceHtml(value, kind) : d20FaceHtml(value, kind);
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

  function buildPyramidHtml(die, values, rolling, perDie) {
    var rows = pyramidRowSizes(values.length);
    var html = '<div class="dice-tiles dice-tiles--pyramid' + (rolling ? '' : ' dice-tiles--settled') + '">';
    var idx = 0;
    rows.forEach(function (rowSize) {
      html += '<div class="dice-row">';
      for (var i = 0; i < rowSize; i++) {
        var resolved = perDie && perDie[idx] ? perDie[idx] : null;
        html += rolling ? rollingTileHtml(die) : dieFaceHtml(die, values[idx], resolved ? resolved.kind : null);
        idx++;
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function plural(n, singular, pluralValue) {
    return n === 1 ? singular : (pluralValue || singular + 's');
  }

  function skillSummaryHtml(entry) {
    var successText = entry.totalSuccesses + ' ' + plural(entry.totalSuccesses, 'success', 'successes');
    var complicationText = entry.totalComplications + ' ' + plural(entry.totalComplications, 'complication');
    var meta = entry.label ? '<span>' + escapeHtml(entry.label) + '</span>' : '';
    if (entry.tn != null) {
      meta += '<span>TN ' + escapeHtml(entry.tn) + '</span>';
    }
    return '<div class="dice-resolution dice-resolution--skill">' +
      '<strong>' + successText + ' · ' + complicationText + '</strong>' +
      (meta ? '<div class="dice-resolution-meta">' + meta + '</div>' : '') +
      '</div>';
  }

  function dcSummaryHtml(entry) {
    return '<div class="dice-resolution dice-resolution--dc">' +
      '<strong>' + entry.totalDamage + ' damage · ' + entry.totalEffects + ' ' + plural(entry.totalEffects, 'effect') + '</strong>' +
      '</div>';
  }

  function plainSummaryHtml(entry) {
    var results = entry.results && entry.results.length ? entry.results.join(', ') : '';
    return '<div class="dice-resolution"><strong>' + escapeHtml(entry.count + entry.die) + '</strong>' +
      (results ? '<div class="dice-resolution-meta"><span>Results: ' + escapeHtml(results) + '</span></div>' : '') +
      '</div>';
  }

  function resultHtml(entry, rolling) {
    if (rolling) {
      var placeholders = [];
      for (var i = 0; i < entry.count; i++) {
        placeholders.push(0);
      }
      return buildPyramidHtml(entry.die, placeholders, true);
    }
    var summary = '';
    if (entry.mode === 'skill-test') summary = skillSummaryHtml(entry);
    else if (entry.mode === 'dc') summary = dcSummaryHtml(entry);
    else summary = plainSummaryHtml(entry);
    return summary + buildPyramidHtml(entry.die, entry.results, false, entry.perDie);
  }

  function loadCatalog() {
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch(CATALOG_URL, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('Catalog fetch failed');
        return response.json();
      })
      .catch(function () {
        return { skills: [], standGrades: FALLBACK_STAND_GRADES };
      });
    return catalogPromise;
  }

  function getContext(options, fallbackCatalog) {
    var ctx = {};
    if (typeof options.getContext === 'function') {
      try {
        ctx = options.getContext() || {};
      } catch (e) {
        ctx = {};
      }
    }
    ctx.catalog = ctx.catalog || fallbackCatalog || { skills: [], standGrades: FALLBACK_STAND_GRADES };
    ctx.special = ctx.special || {};
    ctx.skills = ctx.skills || {};
    ctx.standGrades = ctx.standGrades || {};
    return ctx;
  }

  function skillById(catalog, id) {
    var skills = catalog && catalog.skills ? catalog.skills : [];
    for (var i = 0; i < skills.length; i++) {
      if (skills[i].id === id) return skills[i];
    }
    return null;
  }

  function standStatLabel(id) {
    for (var i = 0; i < STAND_STATS.length; i++) {
      if (STAND_STATS[i].id === id) return STAND_STATS[i].label;
    }
    return id;
  }

  function gradeValue(catalog, grade) {
    var grades = catalog && catalog.standGrades ? catalog.standGrades : FALLBACK_STAND_GRADES;
    if (grades[grade] == null) return 0;
    return toNumber(grades[grade]);
  }

  function selectedSkillData(ctx, skillId) {
    var sheetSkill = ctx.skills && ctx.skills[skillId] ? ctx.skills[skillId] : {};
    return {
      rank: toNumber(sheetSkill.rank),
      tagged: !!sheetSkill.tagged
    };
  }

  function makeResults(count, sides) {
    var results = [];
    for (var i = 0; i < count; i++) {
      results.push(rollDie(sides));
    }
    return results;
  }

  function mount(container, options) {
    options = options || {};
    var showBroadcast = !!options.showBroadcast;
    var onBroadcast = typeof options.onBroadcast === 'function' ? options.onBroadcast : null;
    var hasSheetContext = typeof options.getContext === 'function';
    var rolling = false;
    var activeTab = 'skill';
    var fallbackCatalog = { skills: [], standGrades: FALLBACK_STAND_GRADES };

    container.innerHTML =
      '<div class="dice-roller">' +
      '  <div class="dice-tabs" role="tablist" aria-label="Dice modes">' +
      '    <button type="button" class="pick-btn dice-tab dice-tab--active" data-dice-tab="skill">Skill Test</button>' +
      '    <button type="button" class="pick-btn dice-tab" data-dice-tab="quick">Quick Roll / D/C</button>' +
      '  </div>' +
      '  <div class="dice-panel dice-panel--skill">' +
      '    <div class="dice-controls dice-controls--skill">' +
      '      <label class="dice-field">Mode <select class="sheet-input dice-skill-mode"><option value="normal">Normal</option><option value="stand">Stand</option></select></label>' +
      '      <label class="dice-field dice-normal-stat-field">Attribute <select class="sheet-input dice-attr"></select></label>' +
      '      <label class="dice-field dice-stand-stat-field" hidden>Stand stat <select class="sheet-input dice-stand-stat"></select></label>' +
      '      <label class="dice-field dice-manual-stat-field" hidden>Stat value <input type="number" class="sheet-input dice-manual-stat" min="0" value="0"></label>' +
      '      <label class="dice-field">Skill <select class="sheet-input dice-skill"></select></label>' +
      '      <label class="dice-field dice-manual-rank-field" hidden>Skill rank <input type="number" class="sheet-input dice-manual-rank" min="0" value="0"></label>' +
      '      <label class="dice-field dice-manual-tag-field" hidden>Tagged <span class="sheet-toggle"><input type="checkbox" class="dice-manual-tag"> Yes</span></label>' +
      '      <label class="dice-field">TN <output class="dice-tn-output">TN —</output></label>' +
      '      <label class="dice-field">Pool <input type="number" class="sheet-input dice-skill-count dice-count" min="' + SKILL_DICE_MIN + '" max="' + SKILL_DICE_MAX + '" value="2"></label>' +
      '      <button type="button" class="pick-btn dice-skill-roll-btn">Roll</button>' +
      (showBroadcast ? '      <label class="dice-broadcast sheet-toggle"><input type="checkbox" class="dice-broadcast-check"> Show on player view</label>' : '') +
      '    </div>' +
      '    <div class="dice-rules-panel">' +
      '      <span>Normal: attr + skill = TN.</span>' +
      '      <span>Stand: stand grade + skill = TN.</span>' +
      '      <span>d20 ≤ TN = 1 success.</span>' +
      '      <span>Nat 1 or tagged ≤ rank = 2 successes.</span>' +
      '      <span>Nat 20 = complication.</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="dice-panel dice-panel--quick" hidden>' +
      '    <div class="dice-controls dice-controls--quick">' +
      '      <label class="dice-field">Type <select class="sheet-input dice-type"><option value="d20">d20</option><option value="d6">d6</option></select></label>' +
      '      <label class="dice-field">Count <input type="number" class="sheet-input dice-quick-count dice-count" min="1" max="' + MAX_DICE + '" value="1"></label>' +
      '      <button type="button" class="pick-btn dice-quick-roll-btn">Roll</button>' +
      '    </div>' +
      '    <div class="dice-rules-panel dice-dc-rules" hidden>' +
      '      <span>1 → 1 dmg.</span>' +
      '      <span>2 → 2 dmg.</span>' +
      '      <span>3-4 → 0.</span>' +
      '      <span>5-6 → 1 dmg + effect.</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="dice-result-area" aria-live="polite"></div>' +
      '</div>';

    var tabs = container.querySelectorAll('.dice-tab');
    var skillPanel = container.querySelector('.dice-panel--skill');
    var quickPanel = container.querySelector('.dice-panel--quick');
    var skillModeEl = container.querySelector('.dice-skill-mode');
    var attrEl = container.querySelector('.dice-attr');
    var standStatEl = container.querySelector('.dice-stand-stat');
    var normalStatField = container.querySelector('.dice-normal-stat-field');
    var standStatField = container.querySelector('.dice-stand-stat-field');
    var manualStatField = container.querySelector('.dice-manual-stat-field');
    var manualRankField = container.querySelector('.dice-manual-rank-field');
    var manualTagField = container.querySelector('.dice-manual-tag-field');
    var manualStatEl = container.querySelector('.dice-manual-stat');
    var manualRankEl = container.querySelector('.dice-manual-rank');
    var manualTagEl = container.querySelector('.dice-manual-tag');
    var skillEl = container.querySelector('.dice-skill');
    var tnOutput = container.querySelector('.dice-tn-output');
    var skillCountEl = container.querySelector('.dice-skill-count');
    var skillRollBtn = container.querySelector('.dice-skill-roll-btn');
    var typeEl = container.querySelector('.dice-type');
    var countEl = container.querySelector('.dice-quick-count');
    var quickRollBtn = container.querySelector('.dice-quick-roll-btn');
    var resultArea = container.querySelector('.dice-result-area');
    var broadcastCheck = container.querySelector('.dice-broadcast-check');
    var dcRules = container.querySelector('.dice-dc-rules');

    SPECIAL_ATTRS.forEach(function (attr) {
      attrEl.innerHTML += '<option value="' + attr + '">' + attr + '</option>';
    });
    STAND_STATS.forEach(function (stat) {
      standStatEl.innerHTML += '<option value="' + stat.id + '">' + stat.label + '</option>';
    });

    function setActiveTab(tab) {
      activeTab = tab;
      for (var i = 0; i < tabs.length; i++) {
        var active = tabs[i].getAttribute('data-dice-tab') === tab;
        tabs[i].classList.toggle('dice-tab--active', active);
      }
      skillPanel.hidden = tab !== 'skill';
      quickPanel.hidden = tab !== 'quick';
      resultArea.innerHTML = '';
    }

    function currentContext() {
      return getContext(options, fallbackCatalog);
    }

    function availableSkills(ctx) {
      var catalog = ctx.catalog || fallbackCatalog;
      var skills = catalog.skills || [];
      var mode = skillModeEl.value;
      var attr = attrEl.value;
      if (mode === 'stand') return skills.slice();
      return skills.filter(function (skill) {
        return skill.attribute === attr;
      });
    }

    function populateSkills() {
      var ctx = currentContext();
      var skills = availableSkills(ctx);
      var previous = skillEl.value;
      skillEl.innerHTML = '';
      skills.forEach(function (skill) {
        var data = selectedSkillData(ctx, skill.id);
        var suffix = data.tagged ? ' (tagged)' : '';
        skillEl.innerHTML += '<option value="' + escapeHtml(skill.id) + '">' + escapeHtml(skill.name + suffix) + '</option>';
      });
      if (previous) skillEl.value = previous;
      if (!skillEl.value && skills.length > 0) skillEl.value = skills[0].id;
      updateSkillControls();
    }

    function getSkillRollSetup() {
      var ctx = currentContext();
      var catalog = ctx.catalog || fallbackCatalog;
      var mode = skillModeEl.value;
      var skill = skillById(catalog, skillEl.value);
      var skillData = selectedSkillData(ctx, skillEl.value);
      var skillRank = hasSheetContext ? skillData.rank : toNumber(manualRankEl.value);
      var tagged = hasSheetContext ? skillData.tagged : !!manualTagEl.checked;
      var statLabel = '';
      var statValue = 0;
      var statDetail = '';

      if (hasSheetContext && mode === 'normal') {
        statLabel = attrEl.value;
        statValue = toNumber(ctx.special[attrEl.value]);
        statDetail = String(statValue);
      } else if (hasSheetContext && mode === 'stand') {
        var standStat = standStatEl.value;
        var grade = ctx.standGrades[standStat] || 'D';
        statLabel = standStatLabel(standStat);
        statValue = gradeValue(catalog, grade);
        statDetail = grade + ' = ' + statValue;
      } else {
        statLabel = mode === 'stand' ? standStatLabel(standStatEl.value) : attrEl.value;
        statValue = toNumber(manualStatEl.value);
        statDetail = String(statValue);
      }

      return {
        mode: mode,
        skill: skill,
        skillName: skill ? skill.name : 'Skill',
        skillRank: skillRank,
        tagged: tagged,
        statLabel: statLabel,
        statValue: statValue,
        statDetail: statDetail,
        tn: computeTn(mode, statValue, skillRank)
      };
    }

    function updateSkillControls() {
      var mode = skillModeEl.value;
      var setup = getSkillRollSetup();
      normalStatField.hidden = mode !== 'normal';
      standStatField.hidden = mode !== 'stand';
      manualStatField.hidden = hasSheetContext;
      manualRankField.hidden = hasSheetContext;
      manualTagField.hidden = hasSheetContext;
      skillRollBtn.disabled = !skillEl.value;
      if (!skillEl.value) {
        tnOutput.textContent = 'TN —';
        return;
      }
      tnOutput.textContent = 'TN ' + setup.tn + ' = ' + setup.statDetail + ' + ' + setup.skillRank;
    }

    function updateQuickRules() {
      dcRules.hidden = typeEl.value !== 'd6';
    }

    function showSettled(entry) {
      resultArea.innerHTML = resultHtml(entry, false);
    }

    function renderResults(entry, animate) {
      if (animate) {
        resultArea.innerHTML = resultHtml(entry, true);
        setTimeout(function () {
          showSettled(entry);
        }, ROLL_MS);
      } else {
        showSettled(entry);
      }
    }

    function finishRoll(entry, button) {
      renderResults(entry, true);
      setTimeout(function () {
        rolling = false;
        button.disabled = false;
        if (showBroadcast && broadcastCheck && broadcastCheck.checked && onBroadcast) {
          onBroadcast(entry);
        }
      }, ROLL_MS);
    }

    function doSkillRoll() {
      if (rolling) return;
      if (hasSheetContext) populateSkills();
      var count = clampSkillCount(skillCountEl.value);
      skillCountEl.value = String(count);
      var setup = getSkillRollSetup();
      if (!skillEl.value) return;
      rolling = true;
      skillRollBtn.disabled = true;

      var results = makeResults(count, 20);
      var resolved = resolveSkillPool(results, setup.tn, setup.skillRank, setup.tagged);
      var entry = {
        mode: 'skill-test',
        rollMode: setup.mode,
        label: setup.statLabel + ' + ' + setup.skillName,
        die: 'd20',
        count: count,
        results: results,
        tn: setup.tn,
        skillRank: setup.skillRank,
        tagged: setup.tagged,
        totalSuccesses: resolved.totalSuccesses,
        totalComplications: resolved.totalComplications,
        perDie: resolved.perDie,
        time: Date.now()
      };
      finishRoll(entry, skillRollBtn);
    }

    function doQuickRoll() {
      if (rolling) return;
      rolling = true;
      quickRollBtn.disabled = true;

      var die = typeEl.value === 'd6' ? 'd6' : 'd20';
      var count = clampCount(countEl.value);
      countEl.value = String(count);
      var results = makeResults(count, die === 'd6' ? 6 : 20);
      var entry = {
        mode: die === 'd6' ? 'dc' : 'plain',
        die: die,
        count: count,
        results: results,
        time: Date.now()
      };
      if (die === 'd6') {
        var resolved = resolveDcPool(results);
        entry.totalDamage = resolved.totalDamage;
        entry.totalEffects = resolved.totalEffects;
        entry.perDie = resolved.perDie;
      }
      finishRoll(entry, quickRollBtn);
    }

    for (var t = 0; t < tabs.length; t++) {
      tabs[t].addEventListener('click', function () {
        setActiveTab(this.getAttribute('data-dice-tab'));
      });
    }
    skillRollBtn.addEventListener('click', doSkillRoll);
    quickRollBtn.addEventListener('click', doQuickRoll);
    skillModeEl.addEventListener('change', function () {
      populateSkills();
      updateSkillControls();
    });
    attrEl.addEventListener('change', populateSkills);
    standStatEl.addEventListener('change', updateSkillControls);
    skillEl.addEventListener('change', updateSkillControls);
    manualStatEl.addEventListener('input', updateSkillControls);
    manualRankEl.addEventListener('input', updateSkillControls);
    manualTagEl.addEventListener('change', updateSkillControls);
    skillCountEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSkillRoll();
    });
    typeEl.addEventListener('change', updateQuickRules);
    countEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doQuickRoll();
    });
    updateQuickRules();
    populateSkills();
    if (!hasSheetContext) {
      loadCatalog().then(function (catalog) {
        fallbackCatalog = catalog || fallbackCatalog;
        populateSkills();
      });
    }

    return {
      roll: function () {
        if (activeTab === 'skill') doSkillRoll();
        else doQuickRoll();
      }
    };
  }

  global.DiceRoller = {
    mount: mount,
    MAX_DICE: MAX_DICE,
    computeTn: computeTn,
    resolveDie: resolveDie,
    resolveSkillPool: resolveSkillPool,
    resolveDcDie: resolveDcDie,
    resolveDcPool: resolveDcPool
  };
})(typeof window !== 'undefined' ? window : this);
