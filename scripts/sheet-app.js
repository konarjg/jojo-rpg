(function () {
  'use strict';

  const CATALOG = JSON.parse(document.getElementById('jojo-catalog').textContent);
  const STORAGE_KEY = 'jojo-rpg:characters';
  const SCHEMA = 2;

  let state = null;
  let allCharacters = {};
  let saveTimer = null;
  let pickerCallback = null;

  const SPECIAL = ['STR', 'PER', 'END', 'CHA', 'INT', 'AGI', 'LCK'];
  const DR_LOCS = ['head', 'torso', 'arm', 'leg'];
  const WEAPON_SLOTS = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'melee', label: 'Melee' },
    { key: 'thrown', label: 'Thrown / Explosive' }
  ];
  const STAND_GRADES = ['∞', 'A', 'B', 'C', 'D', 'E', '?', '∅'];
  const AMMO_TYPES = ['.38 / Revolver', '9mm', 'Rifle', 'Shotgun Shells', 'Energy Cell', 'Grenades'];

  const PAGES = [
    { id: 'page-1', label: 'Page 1 — Attributes & Skills' },
    { id: 'page-2', label: 'Page 2 — Traits & Perks' },
    { id: 'page-3', label: 'Page 3 — Equipment & Inventory' },
    { id: 'page-4', label: 'Page 4 — Stand Sheet' }
  ];
  const PAGE_STORAGE_KEY = 'jojo-rpg:sheet-page';
  const RULES_CHAPTER_STORAGE_KEY = 'jojo-rpg:rules-chapter';
  let currentPageIndex = 0;
  let currentRulesChapterIndex = 0;

  function showPage(index) {
    if (index < 0 || index >= PAGES.length) return;
    currentPageIndex = index;
    PAGES.forEach(function (p, i) {
      const el = document.getElementById(p.id);
      if (el) el.classList.toggle('sheet-page--active', i === index);
    });
    const sel = document.getElementById('page-select');
    if (sel) sel.value = String(index);
    const prev = document.getElementById('btn-page-prev');
    const next = document.getElementById('btn-page-next');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === PAGES.length - 1;
    try { localStorage.setItem(PAGE_STORAGE_KEY, String(index)); } catch (e) { /* ignore */ }
    window.scrollTo(0, 0);
  }

  function initPageNav() {
    const sel = document.getElementById('page-select');
    if (sel && sel.options.length === 0) {
      PAGES.forEach(function (p, i) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = p.label;
        sel.appendChild(opt);
      });
    }
    let start = 0;
    try {
      const saved = parseInt(localStorage.getItem(PAGE_STORAGE_KEY), 10);
      if (!isNaN(saved) && saved >= 0 && saved < PAGES.length) start = saved;
    } catch (e) { /* ignore */ }
    showPage(start);
  }

  function uid() {
    return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function emptyState() {
    const skills = {};
    CATALOG.skills.forEach(function (s) {
      skills[s.id] = { rank: '', tagged: false };
    });
    const dr = { physical: {}, energy: {}, poison: '', sunlight: '' };
    DR_LOCS.forEach(function (l) {
      dr.physical[l] = '';
      dr.energy[l] = '';
    });
    const ammo = {};
    AMMO_TYPES.forEach(function (t) { ammo[t] = ''; });
    return {
      id: uid(),
      schemaVersion: SCHEMA,
      name: '',
      race: 'human',
      level: '',
      xp: '',
      nextLevel: '',
      special: (function () {
        const o = {};
        SPECIAL.forEach(function (a) { o[a] = ''; });
        return o;
      })(),
      derived: {
        hpCurrent: '', hpMax: '', initiative: '', defense: '',
        carryUsed: '', carryMax: '', luck: '', meleeBonus: '', trinket: ''
      },
      dr: dr,
      skills: skills,
      hamonUnlocked: false,
      spinUnlocked: false,
      spinApproved: false,
      traits: [],
      perks: [],
      standDev: [{ level: '', ability: '', dp: '' }, { level: '', ability: '', dp: '' }, { level: '', ability: '', dp: '' }, { level: '', ability: '', dp: '' }, { level: '', ability: '', dp: '' }],
      wealth: '',
      weapons: { primary: null, secondary: null, melee: null, thrown: null },
      armor: [],
      inventory: [{ name: '', qty: '', weight: '', notes: '' }],
      consumables: {},
      ammo: ammo,
      books: [],
      stand: {
        name: '', user: '', type: 'Close-Range',
        grades: { power: 'D', speed: 'D', range: 'D', durability: 'D', precision: 'D', developmentPotential: 'D' },
        hpCurrent: '', hpMax: '', defense: '', dr: '', initBonus: '', rangeBand: '',
        attacks: [
          { name: '', stat: '', damage: '', range: '', notes: '' },
          { name: '', stat: '', damage: '', range: '', notes: '' },
          { name: '', stat: '', damage: '', range: '', notes: '' },
          { name: '', stat: '', damage: '', range: '', notes: '' }
        ],
        abilities: ['', '', '', '']
      }
    };
  }

  function abilitySlots(raw) {
    const slots = ['', '', '', ''];
    if (Array.isArray(raw)) {
      for (let i = 0; i < 4; i++) {
        if (raw[i] != null) slots[i] = String(raw[i]);
      }
    }
    return slots;
  }

  function findPerk(id) { return CATALOG.perks.find(function (p) { return p.id === id; }); }
  function findWeapon(id) { return CATALOG.weapons.find(function (w) { return w.id === id; }); }
  function findArmor(id) { return CATALOG.armor.find(function (a) { return a.id === id; }); }
  function findConsumable(id) { return CATALOG.consumables.find(function (c) { return c.id === id; }); }
  function findBook(id) { return CATALOG.books.find(function (b) { return b.id === id; }); }
  function findTrait(id) { return CATALOG.traits.human.find(function (t) { return t.id === id; }); }

  function scheduleSave() {
    const el = document.getElementById('save-status');
    if (el) el.textContent = 'Saving...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        allCharacters[state.id] = state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA, activeId: state.id, characters: allCharacters }));
        if (el) el.textContent = 'Saved';
      } catch (e) {
        if (el) el.textContent = 'Save failed';
      }
    }, 300);
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { activeId: null, characters: {} };
      const data = JSON.parse(raw);
      return data.characters ? data : { activeId: data.activeId, characters: data.characters || {} };
    } catch (e) {
      return { activeId: null, characters: {} };
    }
  }

  function mergeState(saved) {
    const base = emptyState();
    if (!saved || typeof saved !== 'object') return base;
    base.id = saved.id || base.id;
    base.name = saved.name || '';
    base.race = saved.race === 'vampire' ? 'vampire' : 'human';
    ['level', 'xp', 'nextLevel', 'wealth'].forEach(function (k) {
      if (saved[k] != null) base[k] = saved[k];
    });
    if (saved.special) Object.assign(base.special, saved.special);
    if (saved.derived) Object.assign(base.derived, saved.derived);
    if (saved.dr) {
      if (saved.dr.physical) Object.assign(base.dr.physical, saved.dr.physical);
      if (saved.dr.energy) Object.assign(base.dr.energy, saved.dr.energy);
      base.dr.poison = saved.dr.poison || '';
      base.dr.sunlight = saved.dr.sunlight || '';
    }
    if (saved.skills) {
      Object.keys(saved.skills).forEach(function (k) {
        if (base.skills[k]) base.skills[k] = saved.skills[k];
      });
    }
    base.hamonUnlocked = !!saved.hamonUnlocked;
    base.spinUnlocked = !!saved.spinUnlocked;
    base.spinApproved = !!saved.spinApproved;
    base.traits = Array.isArray(saved.traits) ? saved.traits.slice(0, 2) : [];
    base.perks = Array.isArray(saved.perks) ? saved.perks : [];
    if (saved.weapons) base.weapons = Object.assign(base.weapons, saved.weapons);
    base.armor = Array.isArray(saved.armor) ? saved.armor : [];
    base.inventory = Array.isArray(saved.inventory) && saved.inventory.length ? saved.inventory : base.inventory;
    base.consumables = saved.consumables || {};
    if (saved.ammo) Object.assign(base.ammo, saved.ammo);
    base.books = Array.isArray(saved.books) ? saved.books : [];
    if (saved.stand) {
      base.stand = Object.assign(base.stand, saved.stand);
      if (saved.stand.grades) base.stand.grades = Object.assign(base.stand.grades, saved.stand.grades);
      if (Array.isArray(saved.stand.attacks) && saved.stand.attacks.length) {
        base.stand.attacks = saved.stand.attacks;
      }
    }
    base.stand.abilities = abilitySlots(base.stand.abilities);
    if (saved.standDev) base.standDev = saved.standDev;
    return base;
  }

  function setRace(race) {
    if (state.race === race) return;
    if (state.traits.length && !confirm('Changing race clears chosen traits. Continue?')) return;
    state.race = race;
    state.traits = [];
    scheduleSave();
    renderAll();
  }

  function openPicker(title, items, onSelect, previewFn) {
    pickerCallback = onSelect;
    window._pickerItems = items;
    window._pickerPreview = previewFn;
    window._pickerSelected = null;
    document.getElementById('picker-title').textContent = title;
    document.getElementById('picker-search').value = '';
    document.getElementById('picker-preview').innerHTML = '<em>Select an item to preview</em>';
    document.getElementById('picker-confirm').disabled = true;
    renderPickerList('');
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('card-picker-modal').classList.remove('hidden');
  }

  function closePicker() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('card-picker-modal').classList.add('hidden');
    pickerCallback = null;
  }

  function renderPickerList(q) {
    const list = document.getElementById('picker-list');
    list.innerHTML = '';
    const query = q.toLowerCase();
    window._pickerItems.filter(function (item) {
      return !query || (item.label || '').toLowerCase().includes(query);
    }).forEach(function (item) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-list-item';
      btn.textContent = item.label;
      btn.addEventListener('click', function () {
        window._pickerSelected = item;
        document.getElementById('picker-confirm').disabled = false;
        list.querySelectorAll('.picker-list-item').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        document.getElementById('picker-preview').innerHTML = window._pickerPreview ? window._pickerPreview(item.data) : '';
      });
      list.appendChild(btn);
    });
  }

  function previewPerk(p) {
    if (!p) return '';
    let html = '<p><strong>' + p.name + '</strong> (ranks ' + p.ranks + ')</p><p>' + p.effect + '</p>';
    if (p.requirements && p.requirements.notes) html += '<p><em>Requires: ' + p.requirements.notes + '</em></p>';
    return html;
  }

  function previewWeapon(w) {
    if (!w) return '';
    return '<p><strong>' + w.name + '</strong></p><p>' +
      [w.damage ? w.damage + ' D/C' : '', w.effects, w.range ? 'Range ' + w.range : '', w.fireRate ? 'FR ' + w.fireRate : '', w.notes].filter(Boolean).join(' · ') +
      '</p>';
  }

  function previewArmor(a) {
    if (!a) return '';
    return '<p><strong>' + a.name + '</strong></p><p>Physical DR ' + a.physicalDr + ' · Energy DR ' + a.energyDr + '</p><p>Covers: ' + (a.locations && a.locations.length ? a.locations.join(', ') : '—') + '</p>';
  }

  function previewConsumable(c) {
    if (!c) return '';
    return '<p><strong>' + c.name + '</strong></p><p>' + c.effect + '</p>';
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatTraitBenefit(text) {
    if (!text) return '';
    const parts = String(text).split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length <= 1) return '<p>' + escapeHtml(text) + '</p>';
    return '<ul class="trait-benefit-list">' + parts.map(function (part) {
      return '<li>' + escapeHtml(part) + '</li>';
    }).join('') + '</ul>';
  }

  function previewTrait(t) {
    if (!t) return '';
    let html = '<p><strong>' + escapeHtml(t.name) + '</strong></p>' + formatTraitBenefit(t.benefit);
    if (t.penalty) html += '<p class="trait-penalty-line"><em>Penalty: ' + escapeHtml(t.penalty) + '</em></p>';
    return html;
  }

  function descBlock(html) {
    const d = document.createElement('div');
    d.className = 'item-description';
    d.innerHTML = html;
    return d;
  }

  function pickBtn(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function textInput(value, onInput, opts) {
    opts = opts || {};
    const input = document.createElement('input');
    input.type = opts.type || 'text';
    input.className = 'sheet-input';
    if (opts.width) input.style.width = opts.width;
    input.value = value != null ? value : '';
    input.addEventListener('input', function () { onInput(input.value); });
    return input;
  }

  function renderPage1Fields() {
    document.getElementById('field-name').value = state.name;
    document.getElementById('field-level').value = state.level;
    document.getElementById('field-xp').value = state.xp;
    document.getElementById('field-next-xp').value = state.nextLevel;
    SPECIAL.forEach(function (a) {
      document.getElementById('special-' + a).value = state.special[a];
    });
    document.getElementById('field-hp-current').value = state.derived.hpCurrent;
    document.getElementById('field-hp-max').value = state.derived.hpMax;
    document.getElementById('field-initiative').value = state.derived.initiative;
    document.getElementById('field-defense').value = state.derived.defense;
    document.getElementById('field-carry-used').value = state.derived.carryUsed;
    document.getElementById('field-carry-max').value = state.derived.carryMax;
    document.getElementById('field-luck').value = state.derived.luck;
    document.getElementById('field-melee-bonus').value = state.derived.meleeBonus;
    document.getElementById('field-trinket').value = state.derived.trinket;
    DR_LOCS.forEach(function (l) {
      document.getElementById('dr-phys-' + l).value = state.dr.physical[l];
      document.getElementById('dr-en-' + l).value = state.dr.energy[l];
    });
    document.getElementById('dr-poison').value = state.dr.poison;
    document.getElementById('dr-sunlight').value = state.dr.sunlight;
    document.getElementById('hamon-unlocked').checked = state.hamonUnlocked;
    document.getElementById('spin-unlocked').checked = state.spinUnlocked;
    document.getElementById('spin-approved').checked = state.spinApproved;
    document.getElementById('spin-approved-wrap').classList.toggle('hidden', state.race !== 'vampire');
    document.querySelectorAll('.race-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.race === state.race);
    });
  }

  function isSkillLocked(sk) {
    if (!sk.locked) return false;
    if (sk.id === 'hamon') return !state.hamonUnlocked;
    if (sk.id === 'spin') {
      if (!state.spinUnlocked) return true;
      if (state.race === 'vampire' && !state.spinApproved) return true;
      return false;
    }
    return sk.locked;
  }

  function renderSkills() {
    const tbody = document.getElementById('skills-grid');
    tbody.innerHTML = '';
    for (let i = 0; i < CATALOG.skills.length; i += 2) {
      const tr = document.createElement('tr');
      for (let j = 0; j < 2; j++) {
        const sk = CATALOG.skills[i + j];
        if (!sk) {
          tr.appendChild(document.createElement('td'));
          tr.appendChild(document.createElement('td'));
          continue;
        }
        const data = state.skills[sk.id] || { rank: '', tagged: false };
        const nameTd = document.createElement('td');
        const tag = document.createElement('input');
        tag.type = 'checkbox';
        tag.checked = data.tagged;
        tag.title = 'Tag skill';
        tag.addEventListener('change', function () {
          data.tagged = tag.checked;
          state.skills[sk.id] = data;
          scheduleSave();
        });
        nameTd.appendChild(tag);
        nameTd.appendChild(document.createTextNode(' ' + sk.name + (isSkillLocked(sk) ? ' 🔒' : '')));
        const rankTd = document.createElement('td');
        rankTd.appendChild(textInput(data.rank, function (v) {
          data.rank = v;
          state.skills[sk.id] = data;
          scheduleSave();
        }, { width: '3em' }));
        tr.appendChild(nameTd);
        tr.appendChild(rankTd);
      }
      tbody.appendChild(tr);
    }
  }

  function renderTraits() {
    const raceArea = document.getElementById('traits-race-area');
    const addArea = document.getElementById('traits-additional-area');
    document.getElementById('section-additional-traits').classList.toggle('hidden', state.race === 'vampire');

    if (state.race === 'vampire') {
      const v = CATALOG.traits.vampire;
      raceArea.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'sheet-table';
      table.innerHTML = '<tr><th>Trait</th><th>Benefit</th><th>Penalty / Notes</th></tr>';
      const tr = document.createElement('tr');
      const benefit = v.benefits.map(function (b) { return '• ' + b; }).join('<br>');
      tr.innerHTML = '<td><strong>' + v.name + '</strong></td><td colspan="2"><div class="item-description">' + benefit + '</div></td>';
      table.appendChild(tr);
      raceArea.appendChild(table);
      addArea.innerHTML = '';
    } else {
      raceArea.innerHTML = '<p class="item-description">Humans have no fixed race trait — choose up to two traits below.</p>';
      addArea.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'sheet-table traits-table';
      table.innerHTML = '<tr><th>Trait</th><th>Benefit</th><th>Penalty / Notes</th></tr>';
      for (let i = 0; i < 2; i++) {
        const tid = state.traits[i];
        const t = tid ? findTrait(tid) : null;
        const tr = document.createElement('tr');
        const nameTd = document.createElement('td');
        if (t) {
          nameTd.appendChild(document.createTextNode(t.name + ' '));
          nameTd.appendChild(pickBtn('Change', function () { openTraitPicker(i); }));
          nameTd.appendChild(pickBtn('×', function () { state.traits.splice(i, 1); scheduleSave(); renderTraits(); }));
        } else {
          nameTd.appendChild(pickBtn('Choose trait…', function () { openTraitPicker(i); }));
        }
        const benTd = document.createElement('td');
        const penTd = document.createElement('td');
        if (t) {
          benTd.appendChild(descBlock(formatTraitBenefit(t.benefit)));
          if (t.penalty) {
            penTd.appendChild(descBlock('<p>' + escapeHtml(t.penalty) + '</p>'));
          } else {
            benTd.colSpan = 2;
          }
        } else {
          benTd.textContent = '—';
          penTd.textContent = '—';
        }
        tr.appendChild(nameTd);
        tr.appendChild(benTd);
        if (!t || t.penalty) tr.appendChild(penTd);
        table.appendChild(tr);
      }
      addArea.appendChild(table);
    }
  }

  function openTraitPicker(slot) {
    window._pickerItems = CATALOG.traits.human.map(function (t) {
      const taken = state.traits.indexOf(t.id) >= 0 && state.traits[slot] !== t.id;
      return { label: t.name + (taken ? ' (taken)' : ''), data: t, disabled: taken };
    }).filter(function (x) { return !x.disabled; });
    openPicker('Choose trait', window._pickerItems, function (item) {
      while (state.traits.length <= slot) state.traits.push(null);
      state.traits[slot] = item.data.id;
      state.traits = state.traits.filter(Boolean).slice(0, 2);
      scheduleSave();
      renderTraits();
    }, previewTrait);
  }

  function renderPerks() {
    const area = document.getElementById('perks-area');
    area.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'sheet-table';
    table.innerHTML = '<tr><th>Perk Name</th><th>Rank</th><th>Effect / Notes</th><th>Level Taken</th><th></th></tr>';
    state.perks.forEach(function (entry, idx) {
      const p = findPerk(entry.id);
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.appendChild(document.createTextNode(p ? p.name : entry.id));
      nameTd.appendChild(pickBtn('Change', function () { openPerkPicker(idx); }));
      const rankTd = document.createElement('td');
      rankTd.appendChild(textInput(entry.rank, function (v) { entry.rank = v; scheduleSave(); }, { width: '3em' }));
      const effectTd = document.createElement('td');
      if (p) effectTd.appendChild(descBlock(previewPerk(p)));
      const lvlTd = document.createElement('td');
      lvlTd.appendChild(textInput(entry.levelTaken, function (v) { entry.levelTaken = v; scheduleSave(); }, { width: '3em' }));
      const actTd = document.createElement('td');
      actTd.appendChild(pickBtn('×', function () { state.perks.splice(idx, 1); scheduleSave(); renderPerks(); }));
      tr.appendChild(nameTd);
      tr.appendChild(rankTd);
      tr.appendChild(effectTd);
      tr.appendChild(lvlTd);
      tr.appendChild(actTd);
      table.appendChild(tr);
    });
    area.appendChild(table);
    area.appendChild(pickBtn('+ Add perk', openPerkPickerNew));
  }

  function openPerkPickerNew() {
    openPerkPicker(state.perks.length);
  }

  function openPerkPicker(idx) {
    window._pickerItems = CATALOG.perks.map(function (p) {
      return { label: p.name, data: p };
    });
    openPicker('Choose perk', window._pickerItems, function (item) {
      const row = { id: item.data.id, rank: '1', levelTaken: '' };
      if (idx >= state.perks.length) state.perks.push(row);
      else state.perks[idx] = row;
      scheduleSave();
      renderPerks();
    }, previewPerk);
  }

  function renderStandDev() {
    const tbody = document.getElementById('stand-dev-body');
    tbody.innerHTML = '';
    state.standDev.forEach(function (row, idx) {
      const tr = document.createElement('tr');
      ['level', 'ability', 'dp'].forEach(function (key) {
        const td = document.createElement('td');
        td.appendChild(textInput(row[key], function (v) { row[key] = v; scheduleSave(); }));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function renderWeapons() {
    const tbody = document.getElementById('weapons-body');
    tbody.innerHTML = '';
    WEAPON_SLOTS.forEach(function (slot) {
      const wid = state.weapons[slot.key];
      const w = wid ? findWeapon(wid) : null;
      const tr = document.createElement('tr');
      const slotTd = document.createElement('td');
      slotTd.textContent = slot.label;
      const weaponTd = document.createElement('td');
      if (w) {
        weaponTd.appendChild(document.createTextNode(w.name + ' '));
        weaponTd.appendChild(pickBtn('Change', function () { openWeaponPicker(slot.key); }));
        weaponTd.appendChild(pickBtn('Clear', function () {
          state.weapons[slot.key] = null;
          scheduleSave();
          renderWeapons();
        }));
      } else {
        weaponTd.appendChild(pickBtn('Choose weapon…', function () { openWeaponPicker(slot.key); }));
      }
      const dmgTd = document.createElement('td');
      dmgTd.appendChild(textInput(w ? (w.damage || '') : '', function (v) { if (w) w._customDamage = v; }, { width: '4em' }));
      const rangeTd = document.createElement('td');
      rangeTd.textContent = w ? (w.range || w.fireRate || '—') : '___';
      const ammoTd = document.createElement('td');
      ammoTd.appendChild(textInput('', function () {}, { width: '5em' }));
      const notesTd = document.createElement('td');
      if (w) notesTd.appendChild(descBlock(previewWeapon(w)));
      tr.appendChild(slotTd);
      tr.appendChild(weaponTd);
      tr.appendChild(dmgTd);
      tr.appendChild(rangeTd);
      tr.appendChild(ammoTd);
      tr.appendChild(notesTd);
      tbody.appendChild(tr);
    });
  }

  function openWeaponPicker(slotKey) {
    window._pickerItems = CATALOG.weapons.map(function (w) {
      return { label: w.name, data: w };
    });
    openPicker('Choose weapon', window._pickerItems, function (item) {
      state.weapons[slotKey] = item.data.id;
      scheduleSave();
      renderWeapons();
    }, previewWeapon);
  }

  function renderArmor() {
    const tbody = document.getElementById('armor-body');
    tbody.innerHTML = '';
    state.armor.forEach(function (entry, idx) {
      const a = findArmor(entry.id);
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.appendChild(document.createTextNode(a ? a.name : entry.id + ' '));
      nameTd.appendChild(pickBtn('Change', function () { openArmorPicker(idx); }));
      nameTd.appendChild(pickBtn('Remove', function () { state.armor.splice(idx, 1); scheduleSave(); renderArmor(); }));
      const physTd = document.createElement('td');
      physTd.textContent = a ? a.physicalDr : '';
      const enTd = document.createElement('td');
      enTd.textContent = a ? a.energyDr : '';
      const locTd = document.createElement('td');
      locTd.textContent = a && a.locations ? a.locations.join(', ') : '';
      const noteTd = document.createElement('td');
      if (a) noteTd.appendChild(descBlock(previewArmor(a)));
      tr.appendChild(nameTd);
      tr.appendChild(physTd);
      tr.appendChild(enTd);
      tr.appendChild(locTd);
      tr.appendChild(noteTd);
      tbody.appendChild(tr);
    });
    for (let i = state.armor.length; i < 2; i++) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="write-line">&nbsp;</td><td>___</td><td>___</td><td></td><td></td>';
      tbody.appendChild(tr);
    }
  }

  function openArmorPicker(idx) {
    window._pickerItems = CATALOG.armor.map(function (a) { return { label: a.name, data: a }; });
    openPicker('Choose armor', window._pickerItems, function (item) {
      if (idx >= state.armor.length) state.armor.push({ id: item.data.id });
      else state.armor[idx] = { id: item.data.id };
      scheduleSave();
      renderArmor();
    }, previewArmor);
  }

  function renderInventory() {
    const tbody = document.getElementById('inventory-body');
    tbody.innerHTML = '';
    state.inventory.forEach(function (row, idx) {
      const tr = document.createElement('tr');
      ['name', 'qty', 'weight', 'notes'].forEach(function (key) {
        const td = document.createElement('td');
        td.appendChild(textInput(row[key], function (v) { row[key] = v; scheduleSave(); }));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function renderConsumables() {
    const tbody = document.getElementById('consumables-body');
    tbody.innerHTML = '';
    CATALOG.consumables.forEach(function (c) {
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.textContent = c.name;
      const qtyTd = document.createElement('td');
      qtyTd.appendChild(textInput(state.consumables[c.id] || '', function (v) {
        if (v) state.consumables[c.id] = v;
        else delete state.consumables[c.id];
        scheduleSave();
      }, { width: '3em' }));
      const descTd = document.createElement('td');
      descTd.colSpan = 1;
      descTd.appendChild(descBlock(c.effect));
      tr.appendChild(nameTd);
      tr.appendChild(qtyTd);
      tr.appendChild(descTd);
      tbody.appendChild(tr);
    });
  }

  function renderAmmo() {
    AMMO_TYPES.forEach(function (type) {
      const el = document.getElementById('ammo-' + slug(type));
      if (el) el.value = state.ammo[type] || '';
    });
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function renderBooks() {
    const tbody = document.getElementById('books-body');
    tbody.innerHTML = '';
    state.books.forEach(function (entry, idx) {
      const b = findBook(entry.id);
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.textContent = b ? b.name : entry.id;
      const readTd = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!entry.read;
      cb.addEventListener('change', function () { entry.read = cb.checked; scheduleSave(); });
      readTd.appendChild(cb);
      const effTd = document.createElement('td');
      if (b) effTd.appendChild(descBlock(b.effect));
      const actTd = document.createElement('td');
      actTd.appendChild(pickBtn('×', function () { state.books.splice(idx, 1); scheduleSave(); renderBooks(); }));
      tr.appendChild(nameTd);
      tr.appendChild(readTd);
      tr.appendChild(effTd);
      tr.appendChild(actTd);
      tbody.appendChild(tr);
    });
  }

  function renderStand() {
    document.getElementById('field-stand-name').value = state.stand.name;
    document.getElementById('field-stand-user').value = state.stand.user;
    document.getElementById('field-stand-hp-current').value = state.stand.hpCurrent;
    document.getElementById('field-stand-hp-max').value = state.stand.hpMax;
    document.getElementById('field-stand-defense').value = state.stand.defense;
    document.getElementById('field-stand-dr').value = state.stand.dr;
    document.getElementById('field-stand-init').value = state.stand.initBonus;
    document.getElementById('field-stand-range-band').value = state.stand.rangeBand;
    document.querySelectorAll('.stand-type-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.type === state.stand.type);
    });
    CATALOG.standStats.forEach(function (key) {
      const sel = document.getElementById('grade-' + key);
      if (sel) sel.value = state.stand.grades[key] || 'D';
    });
    const atkBody = document.getElementById('stand-attacks-body');
    atkBody.innerHTML = '';
    state.stand.attacks.forEach(function (atk, idx) {
      const tr = document.createElement('tr');
      ['name', 'stat', 'damage', 'range', 'notes'].forEach(function (key) {
        const td = document.createElement('td');
        td.appendChild(textInput(atk[key], function (v) { atk[key] = v; scheduleSave(); }));
        tr.appendChild(td);
      });
      atkBody.appendChild(tr);
    });
    state.stand.abilities = abilitySlots(state.stand.abilities);
    state.stand.abilities.forEach(function (line, idx) {
      const el = document.getElementById('stand-ability-' + idx);
      if (el) el.value = line;
    });
  }

  function showRulesChapter(index) {
    const chapters = document.querySelectorAll('.rules-chapter');
    if (!chapters.length) return;
    if (index < 0 || index >= chapters.length) return;
    currentRulesChapterIndex = index;
    chapters.forEach(function (el, i) {
      el.classList.toggle('rules-chapter--active', i === index);
    });
    document.querySelectorAll('.rules-toc-link').forEach(function (btn, i) {
      btn.classList.toggle('rules-toc-link--active', i === index);
    });
    const sel = document.getElementById('rules-chapter-select');
    if (sel) sel.value = String(index);
    const prev = document.getElementById('btn-rules-prev');
    const next = document.getElementById('btn-rules-next');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === chapters.length - 1;
    const content = document.getElementById('rules-content');
    if (content) content.scrollTop = 0;
    try { localStorage.setItem(RULES_CHAPTER_STORAGE_KEY, String(index)); } catch (e) { /* ignore */ }
  }

  function closeRules() {
    document.getElementById('rules-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  function closeDice() {
    var diceModal = document.getElementById('dice-modal');
    if (diceModal) diceModal.classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  function openDice() {
    closePicker();
    closeRules();
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('dice-modal').classList.remove('hidden');
  }

  function openRules() {
    closePicker();
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('rules-modal').classList.remove('hidden');
    showRulesChapter(currentRulesChapterIndex);
  }

  function initRulesModal() {
    let start = 0;
    try {
      const saved = parseInt(localStorage.getItem(RULES_CHAPTER_STORAGE_KEY), 10);
      const count = document.querySelectorAll('.rules-chapter').length;
      if (!isNaN(saved) && saved >= 0 && saved < count) start = saved;
    } catch (e) { /* ignore */ }
    currentRulesChapterIndex = start;
    showRulesChapter(start);

    document.querySelectorAll('.rules-toc-link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showRulesChapter(parseInt(btn.getAttribute('data-rules-index'), 10) || 0);
      });
    });
    document.getElementById('btn-rules-prev').addEventListener('click', function () {
      showRulesChapter(currentRulesChapterIndex - 1);
    });
    document.getElementById('btn-rules-next').addEventListener('click', function () {
      showRulesChapter(currentRulesChapterIndex + 1);
    });
    document.getElementById('rules-chapter-select').addEventListener('change', function (e) {
      showRulesChapter(parseInt(e.target.value, 10) || 0);
    });
  }

  function renderCharSelect() {
    const sel = document.getElementById('char-select');
    const deleteBtn = document.getElementById('btn-delete-char');
    sel.innerHTML = '';
    Object.values(allCharacters).forEach(function (c) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name || 'Unnamed';
      if (c.id === state.id) opt.selected = true;
      sel.appendChild(opt);
    });
    if (deleteBtn) deleteBtn.hidden = Object.keys(allCharacters).length <= 1;
  }

  function deleteCurrentCharacter() {
    const name = state.name || 'Unnamed';
    if (!confirm('Delete character “' + name + '”? This cannot be undone.')) return;
    allCharacters[state.id] = state;
    delete allCharacters[state.id];
    const ids = Object.keys(allCharacters);
    if (ids.length === 0) {
      state = emptyState();
      allCharacters[state.id] = state;
    } else {
      state = mergeState(allCharacters[ids[0]]);
    }
    scheduleSave();
    renderAll();
  }

  function renderAll() {
    renderPage1Fields();
    renderSkills();
    renderTraits();
    renderPerks();
    renderStandDev();
    document.getElementById('field-name-p2').value = state.name;
    document.getElementById('field-level-p2').value = state.level;
    document.getElementById('field-name-p3').value = state.name;
    document.getElementById('field-wealth').value = state.wealth;
    document.getElementById('field-carry-used-p3').value = state.derived.carryUsed;
    document.getElementById('field-carry-max-p3').value = state.derived.carryMax;
    renderWeapons();
    renderArmor();
    renderInventory();
    renderConsumables();
    renderAmmo();
    renderBooks();
    renderStand();
    renderCharSelect();
  }

  function bindStaticFields() {
    document.getElementById('field-name').addEventListener('input', function (e) {
      state.name = e.target.value;
      scheduleSave();
      renderCharSelect();
    });
    ['level', 'xp', 'nextLevel'].forEach(function (key) {
      const id = key === 'nextLevel' ? 'field-next-xp' : 'field-' + key;
      document.getElementById(id).addEventListener('input', function (e) {
        state[key === 'nextLevel' ? 'nextLevel' : key] = e.target.value;
        scheduleSave();
      });
    });
    SPECIAL.forEach(function (a) {
      document.getElementById('special-' + a).addEventListener('input', function (e) {
        state.special[a] = e.target.value;
        scheduleSave();
      });
    });
    const derivedMap = {
      'field-hp-current': 'hpCurrent', 'field-hp-max': 'hpMax', 'field-initiative': 'initiative',
      'field-defense': 'defense', 'field-carry-used': 'carryUsed', 'field-carry-max': 'carryMax',
      'field-luck': 'luck', 'field-melee-bonus': 'meleeBonus', 'field-trinket': 'trinket'
    };
    Object.keys(derivedMap).forEach(function (id) {
      document.getElementById(id).addEventListener('input', function (e) {
        state.derived[derivedMap[id]] = e.target.value;
        scheduleSave();
      });
    });
    DR_LOCS.forEach(function (l) {
      document.getElementById('dr-phys-' + l).addEventListener('input', function (e) {
        state.dr.physical[l] = e.target.value;
        scheduleSave();
      });
      document.getElementById('dr-en-' + l).addEventListener('input', function (e) {
        state.dr.energy[l] = e.target.value;
        scheduleSave();
      });
    });
    document.getElementById('dr-poison').addEventListener('input', function (e) {
      state.dr.poison = e.target.value;
      scheduleSave();
    });
    document.getElementById('dr-sunlight').addEventListener('input', function (e) {
      state.dr.sunlight = e.target.value;
      scheduleSave();
    });
    document.querySelectorAll('.race-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setRace(btn.dataset.race); });
    });
    document.getElementById('hamon-unlocked').addEventListener('change', function (e) {
      state.hamonUnlocked = e.target.checked;
      scheduleSave();
      renderSkills();
    });
    document.getElementById('spin-unlocked').addEventListener('change', function (e) {
      state.spinUnlocked = e.target.checked;
      scheduleSave();
      renderSkills();
    });
    document.getElementById('spin-approved').addEventListener('change', function (e) {
      state.spinApproved = e.target.checked;
      scheduleSave();
      renderSkills();
    });
    document.getElementById('field-name-p2').addEventListener('input', function (e) { state.name = e.target.value; scheduleSave(); });
    document.getElementById('field-level-p2').addEventListener('input', function (e) { state.level = e.target.value; scheduleSave(); });
    document.getElementById('field-name-p3').addEventListener('input', function (e) { state.name = e.target.value; scheduleSave(); });
    document.getElementById('field-wealth').addEventListener('input', function (e) { state.wealth = e.target.value; scheduleSave(); });
    document.getElementById('field-carry-used-p3').addEventListener('input', function (e) {
      state.derived.carryUsed = e.target.value;
      scheduleSave();
    });
    document.getElementById('field-carry-max-p3').addEventListener('input', function (e) {
      state.derived.carryMax = e.target.value;
      scheduleSave();
    });
    document.getElementById('btn-add-armor').addEventListener('click', function () {
      openArmorPicker(state.armor.length);
    });
    document.getElementById('btn-add-inventory').addEventListener('click', function () {
      state.inventory.push({ name: '', qty: '', weight: '', notes: '' });
      scheduleSave();
      renderInventory();
    });
    document.getElementById('btn-add-book').addEventListener('click', function () {
      window._pickerItems = CATALOG.books.map(function (b) { return { label: b.name, data: b }; });
      openPicker('Add book / key item', window._pickerItems, function (item) {
        state.books.push({ id: item.data.id, read: false });
        scheduleSave();
        renderBooks();
      }, function (b) { return '<p><strong>' + b.name + '</strong></p><p>' + b.effect + '</p>'; });
    });
    AMMO_TYPES.forEach(function (type) {
      const el = document.getElementById('ammo-' + slug(type));
      if (el) el.addEventListener('input', function (e) {
        state.ammo[type] = e.target.value;
        scheduleSave();
      });
    });
    document.getElementById('field-stand-name').addEventListener('input', function (e) { state.stand.name = e.target.value; scheduleSave(); });
    document.getElementById('field-stand-user').addEventListener('input', function (e) { state.stand.user = e.target.value; scheduleSave(); });
    ['hpCurrent', 'hpMax', 'defense', 'dr', 'initBonus', 'rangeBand'].forEach(function (key) {
      const idMap = { hpCurrent: 'field-stand-hp-current', hpMax: 'field-stand-hp-max', defense: 'field-stand-defense', dr: 'field-stand-dr', initBonus: 'field-stand-init', rangeBand: 'field-stand-range-band' };
      document.getElementById(idMap[key]).addEventListener('input', function (e) {
        state.stand[key] = e.target.value;
        scheduleSave();
      });
    });
    document.querySelectorAll('.stand-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.stand.type = btn.dataset.type;
        scheduleSave();
        renderStand();
      });
    });
    CATALOG.standStats.forEach(function (key) {
      const sel = document.getElementById('grade-' + key);
      if (sel) sel.addEventListener('change', function () {
        state.stand.grades[key] = sel.value;
        scheduleSave();
      });
    });
    for (let idx = 0; idx < 4; idx++) {
      const abilityEl = document.getElementById('stand-ability-' + idx);
      if (!abilityEl) continue;
      abilityEl.addEventListener('input', function (e) {
        state.stand.abilities = abilitySlots(state.stand.abilities);
        state.stand.abilities[idx] = e.target.value;
        scheduleSave();
      });
    }
    document.getElementById('picker-search').addEventListener('input', function (e) {
      renderPickerList(e.target.value);
    });
    document.getElementById('picker-cancel').addEventListener('click', closePicker);
    document.getElementById('picker-confirm').addEventListener('click', function () {
      if (window._pickerSelected && pickerCallback) pickerCallback(window._pickerSelected);
      closePicker();
    });
    document.getElementById('modal-overlay').addEventListener('click', function () {
      closeRules();
      closeDice();
      closePicker();
    });
    document.getElementById('btn-dice').addEventListener('click', openDice);
    var diceClose = document.getElementById('btn-dice-close');
    if (diceClose) diceClose.addEventListener('click', closeDice);
    if (typeof DiceRoller !== 'undefined') {
      var diceRoot = document.getElementById('dice-modal-root');
      if (diceRoot) DiceRoller.mount(diceRoot);
    }
    document.getElementById('btn-rules').addEventListener('click', openRules);
    document.getElementById('btn-rules-close').addEventListener('click', closeRules);
    document.getElementById('btn-page-prev').addEventListener('click', function () {
      showPage(currentPageIndex - 1);
    });
    document.getElementById('btn-page-next').addEventListener('click', function () {
      showPage(currentPageIndex + 1);
    });
    document.getElementById('page-select').addEventListener('change', function (e) {
      showPage(parseInt(e.target.value, 10) || 0);
    });
    document.getElementById('char-select').addEventListener('change', function (e) {
      allCharacters[state.id] = state;
      state = mergeState(allCharacters[e.target.value]);
      scheduleSave();
      renderAll();
    });
    document.getElementById('btn-new-char').addEventListener('click', function () {
      allCharacters[state.id] = state;
      state = emptyState();
      allCharacters[state.id] = state;
      scheduleSave();
      renderAll();
    });
    document.getElementById('btn-delete-char').addEventListener('click', deleteCurrentCharacter);
    document.getElementById('btn-export').addEventListener('click', function () {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (state.name || 'character') + '.json';
      a.click();
    });
    document.getElementById('btn-import').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          state = mergeState(JSON.parse(reader.result));
          allCharacters[state.id] = state;
          scheduleSave();
          renderAll();
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    window.addEventListener('beforeunload', function () {
      allCharacters[state.id] = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA, activeId: state.id, characters: allCharacters }));
    });
  }

  function init() {
    const stored = loadAll();
    allCharacters = stored.characters || {};
    if (stored.activeId && allCharacters[stored.activeId]) {
      state = mergeState(allCharacters[stored.activeId]);
    } else if (Object.keys(allCharacters).length) {
      state = mergeState(allCharacters[Object.keys(allCharacters)[0]]);
    } else {
      state = emptyState();
      allCharacters[state.id] = state;
    }
    initRulesModal();
    bindStaticFields();
    initPageNav();
    renderAll();
  }

  init();
})();
