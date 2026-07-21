(function (global) {
  'use strict';

  var SCHEMA = 2;
  var NPC_TYPES = [
    { id: 'normal', label: 'Normal' },
    { id: 'notable', label: 'Notable' },
    { id: 'major', label: 'Major' },
    { id: 'creature', label: 'Creature' }
  ];
  var STAND_TYPES = ['Close-Range', 'Remote', 'Automatic', 'Colony', 'Tool'];
  var STAND_GRADES = ['∞', 'A', 'B', 'C', 'D', 'E', '?', '∅'];
  var SPECIAL_KEYS = ['str', 'per', 'end', 'cha', 'int', 'agi', 'lck'];
  var SPECIAL_LABELS = { str: 'S', per: 'P', end: 'E', cha: 'C', int: 'I', agi: 'A', lck: 'L' };

  function typeLabel(typeId) {
    for (var i = 0; i < NPC_TYPES.length; i++) {
      if (NPC_TYPES[i].id === typeId) return NPC_TYPES[i].label;
    }
    return 'Normal';
  }

  function emptyNpc() {
    return {
      schema: SCHEMA,
      scope: 'global',
      sessionId: '',
      name: '',
      level: '',
      npcType: 'normal',
      xp: '',
      statMode: 'special',
      special: { str: '', per: '', end: '', cha: '', int: '', agi: '', lck: '', extra: '' },
      creature: { body: '', mind: '', melee: '', guns: '', other: '' },
      combat: { hp: '', initiative: '', defense: '', luck: '' },
      dr: { phys: '', energy: '', poison: '', sun: '', extra: '' },
      attacks: '',
      hasStand: false,
      stand: {
        name: '', type: 'Close-Range',
        power: 'D', speed: 'D', range: 'D', durability: 'D', precision: 'D', dp: 'D',
        hp: '', defense: '', dr: '',
        attacks: ''
      },
      abilities: ''
    };
  }

  function migrate(raw) {
    if (!raw) return emptyNpc();
    if (raw.schema === SCHEMA) {
      var npc = emptyNpc();
      Object.keys(npc).forEach(function (key) {
        if (raw[key] !== undefined) npc[key] = raw[key];
      });
      if (raw.special) npc.special = Object.assign({}, emptyNpc().special, raw.special);
      if (raw.creature) npc.creature = Object.assign({}, emptyNpc().creature, raw.creature);
      if (raw.combat) npc.combat = Object.assign({}, emptyNpc().combat, raw.combat);
      if (raw.dr) npc.dr = Object.assign({}, emptyNpc().dr, raw.dr);
      if (raw.stand) npc.stand = Object.assign({}, emptyNpc().stand, raw.stand);
      if (npc.npcType === 'creature') npc.statMode = 'creature';
      return npc;
    }
    return {
      schema: SCHEMA,
      scope: 'global',
      sessionId: '',
      id: raw.id,
      name: raw.name || '',
      level: '',
      npcType: 'normal',
      xp: '',
      statMode: 'special',
      special: emptyNpc().special,
      creature: emptyNpc().creature,
      combat: emptyNpc().combat,
      dr: emptyNpc().dr,
      attacks: '',
      hasStand: false,
      stand: emptyNpc().stand,
      abilities: raw.body || ''
    };
  }

  function val(field) {
    return (field || '').trim();
  }

  function joinParts(parts) {
    return parts.filter(function (p) { return p; }).join(' | ');
  }

  function fixHeading(npc) {
    var name = escapeHtml(npc.name || 'Unnamed');
    var level = val(npc.level);
    var typePart = typeLabel(npc.npcType);
    var xp = val(npc.xp);
    if (xp) typePart += ' (' + escapeHtml(xp) + ' XP)';
    if (level) return name + ' — Level ' + escapeHtml(level) + ', ' + typePart;
    return name + ' — ' + typePart;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderSpecialLine(npc) {
    var parts = SPECIAL_KEYS.map(function (k) {
      var v = val(npc.special[k]);
      return v ? SPECIAL_LABELS[k] + ' ' + escapeHtml(v) : '';
    }).filter(Boolean);
    var extra = val(npc.special.extra);
    if (extra) parts.push(escapeHtml(extra));
    return parts.length ? '<p class="stat-line">' + parts.join(' | ') + '</p>' : '';
  }

  function renderCreatureLine(npc) {
    var c = npc.creature;
    var guns = val(c.guns) ? 'Guns ' + escapeHtml(c.guns) : 'Guns —';
    return '<p class="stat-line">' + joinParts([
      val(c.body) ? 'BODY ' + escapeHtml(c.body) : '',
      val(c.mind) ? 'MIND ' + escapeHtml(c.mind) : '',
      val(c.melee) ? 'Melee ' + escapeHtml(c.melee) : '',
      guns,
      val(c.other) ? 'Other ' + escapeHtml(c.other) : ''
    ]) + '</p>';
  }

  function renderCombatLine(npc) {
    var c = npc.combat;
    return '<p class="stat-line">' + joinParts([
      val(c.hp) ? 'HP ' + escapeHtml(c.hp) : '',
      val(c.initiative) ? 'Initiative ' + escapeHtml(c.initiative) : '',
      val(c.defense) ? 'Defense ' + escapeHtml(c.defense) : '',
      val(c.luck) ? 'Luck ' + escapeHtml(c.luck) : ''
    ]) + '</p>';
  }

  function renderDrLine(npc) {
    var d = npc.dr;
    if (npc.statMode === 'creature') {
      return '<p class="stat-line">' + joinParts([
        val(d.phys) ? 'PHYS DR ' + escapeHtml(d.phys) : '',
        val(d.energy) ? 'ENERGY DR ' + escapeHtml(d.energy) : '',
        val(d.poison) ? 'POISON DR ' + escapeHtml(d.poison) : '',
        val(d.sun) ? 'SUN DR ' + escapeHtml(d.sun) : ''
      ]) + '</p>';
    }
    var parts = [];
    if (val(d.phys)) parts.push('PHYS DR ' + escapeHtml(d.phys));
    if (val(d.energy)) parts.push('ENERGY DR ' + escapeHtml(d.energy));
    if (val(d.extra)) parts.push(escapeHtml(d.extra));
    return parts.length ? '<p class="stat-line">' + parts.join(' | ') + '</p>' : '';
  }

  function renderStandBlock(npc) {
    if (!npc.hasStand) return '';
    var s = npc.stand;
    var standTitle = escapeHtml(val(s.name) || 'Unnamed Stand');
    var standType = val(s.type) ? ' (' + escapeHtml(s.type) + ')' : '';
    var html = '<p><strong>Stand — ' + standTitle + standType + ':</strong></p>';
    html += '<p class="stat-line">' + joinParts([
      'Power ' + escapeHtml(s.power || '?'),
      'Speed ' + escapeHtml(s.speed || '?'),
      'Range ' + escapeHtml(s.range || '?'),
      'Durability ' + escapeHtml(s.durability || '?'),
      'Precision ' + escapeHtml(s.precision || '?'),
      'DP ' + escapeHtml(s.dp || '?')
    ]) + '</p>';
    var standCombat = joinParts([
      val(s.hp) ? 'Stand HP ' + escapeHtml(s.hp) : '',
      val(s.defense) ? 'Stand Defense ' + escapeHtml(s.defense) : '',
      val(s.dr) ? 'Stand DR ' + escapeHtml(s.dr) : ''
    ]);
    if (standCombat) html += '<p class="stat-line">' + standCombat + '</p>';
    if (val(s.attacks)) {
      html += '<p><strong>Stand Attacks:</strong> ' + escapeHtml(s.attacks) + '</p>';
    }
    return html;
  }

  function renderBlockHtml(npc) {
    var data = migrate(npc);
    var html = '<div class="npc-block"><h3>' + fixHeading(data) + '</h3>';
    if (data.statMode === 'creature') {
      html += renderCreatureLine(data);
    } else {
      html += renderSpecialLine(data);
    }
    var combat = renderCombatLine(data);
    if (combat) html += combat;
    var dr = renderDrLine(data);
    if (dr) html += dr;
    if (val(data.attacks)) {
      html += '<p><strong>Attacks:</strong> ' + escapeHtml(data.attacks) + '</p>';
    }
    html += renderStandBlock(data);
    if (val(data.abilities)) {
      var abilityParts = splitPipeList(data.abilities);
      var abilityText = abilityParts.length > 1 ? abilityParts.join(' ') : data.abilities;
      html += '<p><strong>Abilities:</strong> ' + escapeHtml(abilityText.trim()) + '</p>';
    }
    html += '</div>';
    return html;
  }

  function searchText(npc) {
    var data = migrate(npc);
    var parts = [data.name, data.level, data.npcType, data.xp, data.attacks, data.abilities];
    if (data.statMode === 'creature') {
      Object.keys(data.creature).forEach(function (k) { parts.push(data.creature[k]); });
    } else {
      Object.keys(data.special).forEach(function (k) { parts.push(data.special[k]); });
    }
    Object.keys(data.combat).forEach(function (k) { parts.push(data.combat[k]); });
    Object.keys(data.dr).forEach(function (k) { parts.push(data.dr[k]); });
    if (data.hasStand) {
      parts.push(data.stand.name, data.stand.type, data.stand.attacks);
    }
    return parts.join(' ').toLowerCase();
  }

  function splitPipeList(text) {
    return String(text || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function joinPipeList(items) {
    return items.map(function (s) { return s.trim(); }).filter(Boolean).join(' | ');
  }

  function attackListRoot(listId) {
    return document.getElementById(listId);
  }

  function appendAttackRow(ul, value, placeholder, multiline) {
    var li = document.createElement('li');
    li.className = 'gm-attack-list-item';
    var input;
    if (multiline) {
      input = document.createElement('textarea');
      input.className = 'sheet-input gm-attack-input gm-attack-input--multiline';
      input.rows = 2;
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'sheet-input gm-attack-input';
    }
    input.placeholder = placeholder || 'UNARMED TN 11, 4 D/C';
    input.value = value || '';
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'pick-btn gm-attack-remove';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '\u00d7';
    li.appendChild(input);
    li.appendChild(removeBtn);
    ul.appendChild(li);
  }

  function fillAttackList(listId, text, placeholder, multiline) {
    var root = attackListRoot(listId);
    if (!root) return;
    var ul = root.querySelector('.gm-attack-list-items');
    if (!ul) return;
    ul.innerHTML = '';
    var items = splitPipeList(text);
    if (!items.length) {
      appendAttackRow(ul, '', placeholder, multiline);
      return;
    }
    items.forEach(function (line) {
      appendAttackRow(ul, line, placeholder, multiline);
    });
  }

  function collectAttackList(listId) {
    var root = attackListRoot(listId);
    if (!root) return '';
    var inputs = root.querySelectorAll('.gm-attack-input');
    var items = [];
    for (var i = 0; i < inputs.length; i++) {
      var v = inputs[i].value.trim();
      if (v) items.push(v);
    }
    return joinPipeList(items);
  }

  function bindAttackList(listId, placeholder, multiline) {
    var root = attackListRoot(listId);
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';
    var addBtn = root.querySelector('.gm-attack-add');
    var ul = root.querySelector('.gm-attack-list-items');
    if (addBtn && ul) {
      addBtn.addEventListener('click', function () {
        appendAttackRow(ul, '', placeholder, multiline);
        var inputs = ul.querySelectorAll('.gm-attack-input');
        if (inputs.length) inputs[inputs.length - 1].focus();
      });
    }
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('.gm-attack-remove');
      if (!btn || !root.contains(btn)) return;
      var item = btn.closest('.gm-attack-list-item');
      if (item) item.remove();
    });
  }

  function field(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function setField(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value != null ? value : '';
  }

  function collectFromForm() {
    var npc = emptyNpc();
    npc.name = field('npc-f-name');
    npc.level = field('npc-f-level');
    npc.npcType = field('npc-f-type') || 'normal';
    npc.xp = field('npc-f-xp');
    npc.statMode = npc.npcType === 'creature' ? 'creature' : 'special';

    SPECIAL_KEYS.forEach(function (k) {
      npc.special[k] = field('npc-f-' + k);
    });
    npc.special.extra = field('npc-f-special-extra');

    npc.creature.body = field('npc-f-body');
    npc.creature.mind = field('npc-f-mind');
    npc.creature.melee = field('npc-f-melee');
    npc.creature.guns = field('npc-f-guns');
    npc.creature.other = field('npc-f-other');

    npc.combat.hp = field('npc-f-hp');
    npc.combat.initiative = field('npc-f-initiative');
    npc.combat.defense = field('npc-f-defense');
    npc.combat.luck = field('npc-f-luck');

    npc.dr.phys = field('npc-f-dr-phys');
    npc.dr.energy = field('npc-f-dr-energy');
    npc.dr.poison = field('npc-f-dr-poison');
    npc.dr.sun = field('npc-f-dr-sun');
    npc.dr.extra = field('npc-f-dr-extra');

    npc.attacks = collectAttackList('npc-f-attacks-list');
    npc.abilities = collectAttackList('npc-f-abilities-list');

    var hasStandEl = document.getElementById('npc-f-has-stand');
    npc.hasStand = hasStandEl ? hasStandEl.checked : false;
    npc.stand.name = field('npc-f-stand-name');
    npc.stand.type = field('npc-f-stand-type') || 'Close-Range';
    ['power', 'speed', 'range', 'durability', 'precision', 'dp'].forEach(function (k) {
      npc.stand[k] = field('npc-f-stand-' + k) || 'D';
    });
    npc.stand.hp = field('npc-f-stand-hp');
    npc.stand.defense = field('npc-f-stand-defense');
    npc.stand.dr = field('npc-f-stand-dr');
    npc.stand.attacks = collectAttackList('npc-f-stand-attacks-list');
    return npc;
  }

  function fillForm(npc) {
    var data = migrate(npc);
    setField('npc-f-name', data.name);
    setField('npc-f-level', data.level);
    setField('npc-f-type', data.npcType);
    setField('npc-f-xp', data.xp);

    SPECIAL_KEYS.forEach(function (k) {
      setField('npc-f-' + k, data.special[k]);
    });
    setField('npc-f-special-extra', data.special.extra);

    setField('npc-f-body', data.creature.body);
    setField('npc-f-mind', data.creature.mind);
    setField('npc-f-melee', data.creature.melee);
    setField('npc-f-guns', data.creature.guns);
    setField('npc-f-other', data.creature.other);

    setField('npc-f-hp', data.combat.hp);
    setField('npc-f-initiative', data.combat.initiative);
    setField('npc-f-defense', data.combat.defense);
    setField('npc-f-luck', data.combat.luck);

    setField('npc-f-dr-phys', data.dr.phys);
    setField('npc-f-dr-energy', data.dr.energy);
    setField('npc-f-dr-poison', data.dr.poison);
    setField('npc-f-dr-sun', data.dr.sun);
    setField('npc-f-dr-extra', data.dr.extra);

    fillAttackList('npc-f-attacks-list', data.attacks);
    fillAttackList('npc-f-abilities-list', data.abilities, 'TIME STOP (2 AP, 1×/fight): …', true);

    var hasStandEl = document.getElementById('npc-f-has-stand');
    if (hasStandEl) hasStandEl.checked = !!data.hasStand;
    setField('npc-f-stand-name', data.stand.name);
    setField('npc-f-stand-type', data.stand.type);
    ['power', 'speed', 'range', 'durability', 'precision', 'dp'].forEach(function (k) {
      setField('npc-f-stand-' + k, data.stand[k]);
    });
    setField('npc-f-stand-hp', data.stand.hp);
    setField('npc-f-stand-defense', data.stand.defense);
    setField('npc-f-stand-dr', data.stand.dr);
    fillAttackList('npc-f-stand-attacks-list', data.stand.attacks, 'MUDA: Power TN 10, 6 D/C physical');
    updateFormVisibility();
  }

  function updateFormVisibility() {
    var typeEl = document.getElementById('npc-f-type');
    var isCreature = typeEl && typeEl.value === 'creature';
    var specialSec = document.getElementById('npc-f-special-section');
    var creatureSec = document.getElementById('npc-f-creature-section');
    var drCreature = document.getElementById('npc-f-dr-creature');
    var drSpecial = document.getElementById('npc-f-dr-special');
    if (specialSec) specialSec.classList.toggle('hidden', isCreature);
    if (creatureSec) creatureSec.classList.toggle('hidden', !isCreature);
    if (drCreature) drCreature.classList.toggle('hidden', !isCreature);
    if (drSpecial) drSpecial.classList.toggle('hidden', isCreature);

    var hasStandEl = document.getElementById('npc-f-has-stand');
    var standFields = document.getElementById('npc-f-stand-fields');
    if (standFields && hasStandEl) {
      standFields.classList.toggle('hidden', !hasStandEl.checked);
    }
  }

  function bindForm() {
    var typeEl = document.getElementById('npc-f-type');
    if (typeEl) typeEl.addEventListener('change', updateFormVisibility);
    var hasStandEl = document.getElementById('npc-f-has-stand');
    if (hasStandEl) hasStandEl.addEventListener('change', updateFormVisibility);
    bindAttackList('npc-f-attacks-list');
    bindAttackList('npc-f-stand-attacks-list', 'MUDA: Power TN 10, 6 D/C physical');
    bindAttackList('npc-f-abilities-list', 'TIME STOP (2 AP, 1×/fight): …', true);
  }

  global.NpcSheet = {
    SCHEMA: SCHEMA,
    NPC_TYPES: NPC_TYPES,
    STAND_TYPES: STAND_TYPES,
    STAND_GRADES: STAND_GRADES,
    emptyNpc: emptyNpc,
    migrate: migrate,
    renderBlockHtml: renderBlockHtml,
    searchText: searchText,
    collectFromForm: collectFromForm,
    fillForm: fillForm,
    bindForm: bindForm,
    updateFormVisibility: updateFormVisibility
  };
})(typeof window !== 'undefined' ? window : this);
