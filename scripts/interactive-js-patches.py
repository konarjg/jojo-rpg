"""JS patches applied when building the interactive sheet from printable templates."""

PATCHES: list[tuple[str, str]] = [
    (
        "document.getElementById('picker-preview').innerHTML = '<em class=\"text-jojo-cream/50\">Select an item</em>';",
        "document.getElementById('picker-preview').innerHTML = '<em>Select an item</em>';",
    ),
    (
        """      btn.className = 'w-full text-left px-2 py-1.5 rounded text-sm border border-transparent hover:border-jojo-gold/40 hover:bg-jojo-bg/50' + (item.disabled ? ' opacity-40' : '');
      btn.textContent = item.name || item.label;
      if (item.disabled) btn.disabled = true;
      btn.addEventListener('click', function () {
        if (item.disabled) return;
        pickerSelected = item;
        document.getElementById('picker-confirm').disabled = false;
        document.getElementById('picker-preview').innerHTML = previewFn ? previewFn(item) : (item.description || item.effect || '');
        list.querySelectorAll('button').forEach(function (b) { b.classList.remove('border-jojo-magenta'); });
        btn.classList.add('border-jojo-magenta');""",
        """      btn.className = 'picker-list-item' + (item.disabled ? ' row-locked' : '');
      btn.textContent = item.name || item.label;
      if (item.disabled) btn.disabled = true;
      btn.addEventListener('click', function () {
        if (item.disabled) return;
        pickerSelected = item;
        document.getElementById('picker-confirm').disabled = false;
        document.getElementById('picker-preview').innerHTML = previewFn ? previewFn(item) : (item.description || item.effect || '');
        list.querySelectorAll('button').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');""",
    ),
    (
        """  function renderSpecial() {
    const grid = document.getElementById('special-grid');
    grid.innerHTML = '';
    const spent = getSpecialPointsSpent(state);
    document.getElementById('special-budget').textContent = 'Points spent: ' + spent + ' / ' + CREATION_SPECIAL_POINTS + ' (at creation)';
    const eff = getEffectiveSpecial(state);
    document.getElementById('special-effective').textContent = 'Effective: ' + RULES.specialAttributes.map(function (a) { return a + ' ' + eff[a]; }).join(', ');
    RULES.specialAttributes.forEach(function (attr) {
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center gap-1 bg-jojo-bg/50 rounded p-2';
      wrap.innerHTML = '<span class="w-8 font-bold">' + attr + '</span>';
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−'; minus.className = 'w-7 h-7 rounded bg-jojo-panel border border-jojo-gold/30';
      minus.addEventListener('click', function () {
        if (state.special[attr] > SPECIAL_MIN) { state.special[attr]--; scheduleSave(); renderAll(); }
      });
      const val = document.createElement('span');
      val.className = 'w-8 text-center font-mono';
      val.textContent = state.special[attr];
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+'; plus.className = 'w-7 h-7 rounded bg-jojo-panel border border-jojo-gold/30';
      plus.addEventListener('click', function () {
        const max = (state.race === 'vampire' && (attr === 'CHA' || attr === 'PER')) ? 10 : SPECIAL_MAX;
        if (state.special[attr] < max) { state.special[attr]++; scheduleSave(); renderAll(); }
      });
      wrap.appendChild(minus); wrap.appendChild(val); wrap.appendChild(plus);
      grid.appendChild(wrap);
    });
  }""",
        """  function renderSpecial() {
    const grid = document.getElementById('special-grid');
    grid.innerHTML = '';
    const spent = getSpecialPointsSpent(state);
    document.getElementById('special-budget').textContent = 'Points spent: ' + spent + ' / ' + CREATION_SPECIAL_POINTS + ' (at creation)';
    const eff = getEffectiveSpecial(state);
    document.getElementById('special-effective').textContent = 'Effective: ' + RULES.specialAttributes.map(function (a) { return a + ' ' + eff[a]; }).join(', ');
    RULES.specialAttributes.forEach(function (attr) {
      const row = document.createElement('div');
      row.className = 'field-row';
      const label = document.createElement('span');
      label.textContent = attr;
      const controls = document.createElement('span');
      controls.className = 'stat-control';
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−'; minus.className = 'stat-btn';
      minus.addEventListener('click', function () {
        if (state.special[attr] > SPECIAL_MIN) { state.special[attr]--; scheduleSave(); renderAll(); }
      });
      const val = document.createElement('span');
      val.textContent = state.special[attr];
      val.style.minWidth = '1.5em';
      val.style.textAlign = 'center';
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+'; plus.className = 'stat-btn';
      plus.addEventListener('click', function () {
        const max = (state.race === 'vampire' && (attr === 'CHA' || attr === 'PER')) ? 10 : SPECIAL_MAX;
        if (state.special[attr] < max) { state.special[attr]++; scheduleSave(); renderAll(); }
      });
      controls.appendChild(minus); controls.appendChild(val); controls.appendChild(plus);
      row.appendChild(label); row.appendChild(controls);
      grid.appendChild(row);
    });
  }""",
    ),
    (
        """  function renderSkills() {
    const grid = document.getElementById('skills-grid');
    grid.innerHTML = '';
    const unspent = getUnspentSkillRanks(state);
    document.getElementById('skills-budget').textContent = 'Unspent skill ranks: ' + unspent + ' | Tag limit: ' + getTagSkillLimit(state);
    RULES.skills.forEach(function (s) {
      const sk = state.skills[s.id] || { rank: 0, tagged: false };
      const locked = s.locked && ((s.id === 'hamon' && !state.hamonUnlocked) || (s.id === 'spin' && !state.spinUnlocked));
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 py-0.5' + (locked ? ' opacity-50' : '');
      const tag = document.createElement('input');
      tag.type = 'checkbox';
      tag.checked = sk.tagged;
      tag.title = 'Tag skill';
      tag.disabled = locked;
      tag.addEventListener('change', function () {
        sk.tagged = tag.checked;
        if (sk.tagged && sk.rank < 2) sk.rank = 2;
        state.skills[s.id] = sk;
        scheduleSave(); renderAll();
      });
      const name = document.createElement('span');
      name.className = 'flex-1';
      name.textContent = s.name + ' (' + s.attribute + ')' + (locked ? ' 🔒' : '');
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−'; minus.className = 'w-6 h-6 text-xs rounded border border-jojo-gold/30';
      minus.disabled = locked || sk.rank <= 0;
      minus.addEventListener('click', function () {
        if (sk.rank > 0) { sk.rank--; if (sk.tagged && sk.rank < 2) sk.tagged = false; scheduleSave(); renderAll(); }
      });
      const rank = document.createElement('span');
      rank.className = 'w-6 text-center';
      rank.textContent = sk.rank;
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+'; plus.className = 'w-6 h-6 text-xs rounded border border-jojo-gold/30';
      const maxRank = getLevel(state) === 1 ? CREATION_SKILL_MAX : ADVANCEMENT_SKILL_MAX;
      plus.disabled = locked || sk.rank >= maxRank;
      plus.addEventListener('click', function () {
        if (sk.rank < maxRank) { sk.rank++; scheduleSave(); renderAll(); }
      });
      row.appendChild(tag); row.appendChild(name); row.appendChild(minus); row.appendChild(rank); row.appendChild(plus);
      grid.appendChild(row);
    });
  }""",
        """  function buildSkillCell(s) {
      const sk = state.skills[s.id] || { rank: 0, tagged: false };
      const locked = s.locked && ((s.id === 'hamon' && !state.hamonUnlocked) || (s.id === 'spin' && !state.spinUnlocked));
      const nameTd = document.createElement('td');
      const tag = document.createElement('input');
      tag.type = 'checkbox';
      tag.checked = sk.tagged;
      tag.title = 'Tag skill';
      tag.disabled = locked;
      tag.addEventListener('change', function () {
        sk.tagged = tag.checked;
        if (sk.tagged && sk.rank < 2) sk.rank = 2;
        state.skills[s.id] = sk;
        scheduleSave(); renderAll();
      });
      nameTd.appendChild(tag);
      nameTd.appendChild(document.createTextNode(' ' + s.name + (locked ? ' 🔒' : '')));
      const rankTd = document.createElement('td');
      if (locked) rankTd.className = 'row-locked';
      const controls = document.createElement('span');
      controls.className = 'stat-control';
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−'; minus.className = 'stat-btn';
      minus.disabled = locked || sk.rank <= 0;
      minus.addEventListener('click', function () {
        if (sk.rank > 0) { sk.rank--; if (sk.tagged && sk.rank < 2) sk.tagged = false; scheduleSave(); renderAll(); }
      });
      const rank = document.createElement('span');
      rank.textContent = sk.rank;
      rank.style.minWidth = '1.2em';
      rank.style.textAlign = 'center';
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+'; plus.className = 'stat-btn';
      const maxRank = getLevel(state) === 1 ? CREATION_SKILL_MAX : ADVANCEMENT_SKILL_MAX;
      plus.disabled = locked || sk.rank >= maxRank;
      plus.addEventListener('click', function () {
        if (sk.rank < maxRank) { sk.rank++; scheduleSave(); renderAll(); }
      });
      controls.appendChild(minus); controls.appendChild(rank); controls.appendChild(plus);
      rankTd.appendChild(controls);
      return { nameTd: nameTd, rankTd: rankTd };
    }

  function renderSkills() {
    const grid = document.getElementById('skills-grid');
    grid.innerHTML = '';
    const unspent = getUnspentSkillRanks(state);
    document.getElementById('skills-budget').textContent = 'Unspent skill ranks: ' + unspent + ' | Tag limit: ' + getTagSkillLimit(state);
    for (let i = 0; i < RULES.skills.length; i += 2) {
      const tr = document.createElement('tr');
      const left = buildSkillCell(RULES.skills[i]);
      tr.appendChild(left.nameTd);
      tr.appendChild(left.rankTd);
      if (i + 1 < RULES.skills.length) {
        const right = buildSkillCell(RULES.skills[i + 1]);
        tr.appendChild(right.nameTd);
        tr.appendChild(right.rankTd);
      } else {
        tr.appendChild(document.createElement('td'));
        tr.appendChild(document.createElement('td'));
      }
      grid.appendChild(tr);
    }
  }""",
    ),
    (
        """  function renderDerived() {
    const d = calculateDerived(state);
    if (state.currentHp == null) state.currentHp = d.maxHp;
    document.getElementById('field-current-hp').value = state.currentHp;
    document.getElementById('derived-stats').innerHTML =
      '<div>Max HP: <strong>' + d.maxHp + '</strong></div>' +
      '<div>Initiative: <strong>' + d.initiative + '</strong></div>' +
      '<div>Defense: <strong>' + d.defense + '</strong></div>' +
      '<div>Carry: <strong>' + d.carry + ' lbs</strong></div>' +
      '<div>Luck Points: <strong>' + d.luckPoints + '</strong></div>' +
      '<div>Melee Bonus: <strong>+' + d.meleeBonus + ' D/C</strong></div>';
  }""",
        """  function renderDerived() {
    const d = calculateDerived(state);
    if (state.currentHp == null) state.currentHp = d.maxHp;
    document.getElementById('field-current-hp').value = state.currentHp;
    document.getElementById('field-hp-max').textContent = d.maxHp;
    document.getElementById('field-initiative').textContent = d.initiative;
    document.getElementById('field-defense').textContent = d.defense;
    document.getElementById('field-carry-max').textContent = d.carry;
    document.getElementById('field-carry-max-p3').textContent = d.carry;
    document.getElementById('field-luck').textContent = d.luckPoints;
    document.getElementById('field-melee-bonus').textContent = '+' + d.meleeBonus + ' D/C';
    if (document.getElementById('field-trinket').value !== (state.equipment.trinket || '')) {
      document.getElementById('field-trinket').value = state.equipment.trinket || '';
    }
  }""",
    ),
    (
        """  function renderDr() {
    const dr = aggregateEquipmentDr(state);
    let html = '<table class="sheet-table w-full"><tr><th></th><th>Head</th><th>Torso</th><th>Arm</th><th>Leg</th></tr>';
    html += '<tr><td>Physical</td><td>' + dr.physical.head + '</td><td>' + dr.physical.torso + '</td><td>' + dr.physical.arm + '</td><td>' + dr.physical.leg + '</td></tr>';
    html += '<tr><td>Energy</td><td>' + dr.energy.head + '</td><td>' + dr.energy.torso + '</td><td>' + dr.energy.arm + '</td><td>' + dr.energy.leg + '</td></tr>';
    html += '<tr><td>Sunlight</td><td colspan="4">' + dr.sunlight.head + '</td></tr>';
    html += '<tr><td>Poison</td><td colspan="4">' + dr.poison + '</td></tr></table>';
    document.getElementById('dr-table').innerHTML = html;
  }""",
        """  function renderDr() {
    const dr = aggregateEquipmentDr(state);
    document.getElementById('dr-phys-head').textContent = dr.physical.head;
    document.getElementById('dr-phys-torso').textContent = dr.physical.torso;
    document.getElementById('dr-phys-arm').textContent = dr.physical.arm;
    document.getElementById('dr-phys-leg').textContent = dr.physical.leg;
    document.getElementById('dr-en-head').textContent = dr.energy.head;
    document.getElementById('dr-en-torso').textContent = dr.energy.torso;
    document.getElementById('dr-en-arm').textContent = dr.energy.arm;
    document.getElementById('dr-en-leg').textContent = dr.energy.leg;
    document.getElementById('dr-poison').textContent = dr.poison;
    document.getElementById('dr-sunlight').textContent = dr.sunlight.head;
  }""",
    ),
    (
        "return '<p class=\"text-green-300/90\"><strong>Benefit:</strong> ' + trait.benefit + '</p>' +\n      (trait.penalty ? '<p class=\"mt-1 text-red-300/90\"><strong>Penalty:</strong> ' + trait.penalty + '</p>' : '');",
        "return '<p><strong>Benefit:</strong> ' + trait.benefit + '</p>' +\n      (trait.penalty ? '<p><strong>Penalty:</strong> ' + trait.penalty + '</p>' : '');",
    ),
    (
        """      table.className = 'sheet-table w-full text-sm';
      table.innerHTML = '<tr><th>Trait</th><th>Benefit</th><th>Penalty</th><th></th></tr>';""",
        """      table.className = 'sheet-table';
      table.innerHTML = '<tr><th>Trait</th><th>Benefit</th><th>Penalty / Notes</th><th></th></tr>';""",
    ),
    (
        "clear.type = 'button'; clear.textContent = '×'; clear.className = 'text-red-400 ml-1';",
        "clear.type = 'button'; clear.textContent = '×'; clear.className = 'pick-btn';",
    ),
    (
        """    table.className = 'sheet-table w-full text-sm';
    table.innerHTML = '<tr><th>Slot</th><th>Perk</th><th>Rank</th><th>Effect</th><th></th></tr>';""",
        """    table.className = 'sheet-table';
    table.innerHTML = '<tr><th>Perk Name</th><th>Rank</th><th>Effect / Notes</th><th>Level Taken</th><th></th></tr>';""",
    ),
    (
        "if (locked) tr.className = 'opacity-40';",
        "if (locked) tr.className = 'row-locked';",
    ),
    (
        "effectCell.className = 'text-xs opacity-90';",
        "effectCell.className = '';",
    ),
    (
        "if (item.reason && item.disabled) html += '<p class=\"text-red-400 mt-1\">' + item.reason + '</p>';",
        "if (item.reason && item.disabled) html += '<p class=\"validation-error\">' + item.reason + '</p>';",
    ),
    (
        """  function renderEquipment() {
    const area = document.getElementById('equipment-area');
    area.innerHTML = '';
    const packWrap = document.createElement('div');
    packWrap.className = 'mb-3';
    const currentPack = RULES.starterPacks.find(function (p) { return p.id === state.equipment.starterPack; });
    const packBtn = document.createElement('button');
    packBtn.type = 'button';
    packBtn.className = 'pick-btn text-sm';
    packBtn.textContent = currentPack ? 'Starter pack: ' + currentPack.name : 'Choose starter pack...';
    packBtn.addEventListener('click', function () {
      openPicker(RULES.starterPacks.map(function (p) { return { id: p.id, name: p.name, pack: p }; }), function (item) {
        state.equipment.starterPack = item.id;
        applyStarterPack(item.pack);
        scheduleSave(); renderAll();
      }, function (item) {
        const p = item.pack;
        return '<strong>' + p.name + '</strong><p class="mt-1">' + p.description + '</p>';
      });
    });
    packWrap.appendChild(packBtn);
    if (currentPack) {
      const detail = document.createElement('div');
      detail.className = 'selection-detail mt-1';
      detail.textContent = currentPack.description;
      packWrap.appendChild(detail);
    }
    area.appendChild(packWrap);
    ['primary', 'secondary', 'melee'].forEach(function (slot) {
      const block = document.createElement('div');
      block.className = 'mb-2';
      const label = document.createElement('div');
      label.className = 'text-xs opacity-70 capitalize mb-1';
      label.textContent = slot + ' weapon';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'pick-btn text-sm w-full';
      const wid = state.equipment.weapons[slot];
      const w = wid ? RULES.weapons.find(function (x) { return x.id === wid; }) : null;
      btn.textContent = w ? w.name : 'Choose weapon...';
      btn.addEventListener('click', function () {
        openPicker(RULES.weapons.map(function (w) { return { id: w.id, name: w.name, weapon: w }; }), function (item) {
          state.equipment.weapons[slot] = item.id;
          scheduleSave(); renderAll();
        }, function (item) { return previewWeaponHtml(item.weapon); });
      });
      block.appendChild(label);
      block.appendChild(btn);
      if (w) {
        const det = document.createElement('div');
        det.className = 'selection-detail';
        det.innerHTML = previewWeaponHtml(w);
        addDetailLink(det, w.name, previewWeaponHtml(w));
        block.appendChild(det);
      }
      area.appendChild(block);
    });
    const trinket = document.createElement('label');
    trinket.className = 'block text-sm mt-2';
    trinket.innerHTML = 'Trinket <input id="field-trinket" class="sheet-input mt-1">';
    area.appendChild(trinket);
    document.getElementById('field-trinket').value = state.equipment.trinket || '';
    document.getElementById('field-trinket').addEventListener('input', function (e) {
      state.equipment.trinket = e.target.value;
      scheduleSave();
    });
    const wealth = document.createElement('label');
    wealth.className = 'block text-sm mt-2';
    wealth.innerHTML = 'Wealth <input id="field-wealth" type="number" min="0" class="sheet-input w-32 mt-1">';
    area.appendChild(wealth);
    document.getElementById('field-wealth').value = state.equipment.wealth || 0;
    document.getElementById('field-wealth').addEventListener('input', function (e) {
      state.equipment.wealth = parseInt(e.target.value, 10) || 0;
      scheduleSave();
    });
    const armorHeader = document.createElement('div');
    armorHeader.className = 'mt-3 text-sm font-semibold';
    armorHeader.textContent = 'Armor';
    area.appendChild(armorHeader);
    const armorBtn = document.createElement('button');
    armorBtn.type = 'button';
    armorBtn.className = 'mt-1 pick-btn text-sm';
    armorBtn.textContent = '+ Add armor';
    armorBtn.addEventListener('click', function () {
      openPicker(RULES.armor.map(function (a) { return { id: a.id, name: a.name, armor: a }; }), function (item) {
        state.equipment.armor.push({ id: item.id });
        scheduleSave(); renderAll();
      }, function (item) { return previewArmorHtml(item.armor); });
    });
    area.appendChild(armorBtn);
    state.equipment.armor.forEach(function (entry, idx) {
      const a = RULES.armor.find(function (x) { return x.id === entry.id; });
      const block = document.createElement('div');
      block.className = 'selection-detail mt-1 flex justify-between gap-2';
      const text = document.createElement('div');
      text.innerHTML = '<strong>' + (a ? a.name : entry.id) + '</strong>' + (a ? previewArmorHtml(a) : '');
      block.appendChild(text);
      const acts = document.createElement('div');
      if (a) addDetailLink(acts, a.name, previewArmorHtml(a));
      const rm = document.createElement('button');
      rm.type = 'button'; rm.textContent = '×'; rm.className = 'text-red-400';
      rm.addEventListener('click', function () { state.equipment.armor.splice(idx, 1); scheduleSave(); renderAll(); });
      acts.appendChild(rm);
      block.appendChild(acts);
      area.appendChild(block);
    });
    if (state.equipment.consumables && state.equipment.consumables.length) {
      const ch = document.createElement('div');
      ch.className = 'mt-3 text-sm font-semibold';
      ch.textContent = 'Consumables';
      area.appendChild(ch);
      state.equipment.consumables.forEach(function (entry) {
        const c = RULES.consumables.find(function (x) { return x.id === entry.id; });
        if (!c) return;
        const block = document.createElement('div');
        block.className = 'selection-detail mt-1 text-sm';
        block.innerHTML = '<strong>' + c.name + '</strong> ×' + (entry.qty || 1) + previewConsumableHtml(c);
        area.appendChild(block);
      });
    }
  }""",
        """  function weaponPicker(slot, label) {
      const wid = state.equipment.weapons[slot];
      const w = wid ? RULES.weapons.find(function (x) { return x.id === wid; }) : null;
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + label + '</td>';
      const weaponTd = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'pick-btn';
      btn.textContent = w ? w.name : 'Choose weapon...';
      btn.addEventListener('click', function () {
        openPicker(RULES.weapons.map(function (w) { return { id: w.id, name: w.name, weapon: w }; }), function (item) {
          state.equipment.weapons[slot] = item.id;
          scheduleSave(); renderAll();
        }, function (item) { return previewWeaponHtml(item.weapon); });
      });
      weaponTd.appendChild(btn);
      if (w) addDetailLink(weaponTd, w.name, previewWeaponHtml(w));
      tr.appendChild(weaponTd);
      const dmgTd = document.createElement('td');
      dmgTd.textContent = w ? w.damage + ' D/C' : '___ D/C';
      tr.appendChild(dmgTd);
      const rangeTd = document.createElement('td');
      rangeTd.textContent = w && w.range ? String(w.range) : (w && w.fireRate ? 'FR ' + w.fireRate : '___');
      tr.appendChild(rangeTd);
      const ammoTd = document.createElement('td');
      ammoTd.textContent = '___ / ___';
      tr.appendChild(ammoTd);
      const notesTd = document.createElement('td');
      notesTd.className = 'write-line';
      notesTd.innerHTML = '&nbsp;';
      tr.appendChild(notesTd);
      return tr;
    }

  function renderEquipment() {
    const area = document.getElementById('equipment-area');
    area.innerHTML = '';
    const currentPack = RULES.starterPacks.find(function (p) { return p.id === state.equipment.starterPack; });
    const packBtn = document.createElement('button');
    packBtn.type = 'button';
    packBtn.className = 'pick-btn';
    packBtn.textContent = currentPack ? 'Starter pack: ' + currentPack.name : 'Choose starter pack...';
    packBtn.addEventListener('click', function () {
      openPicker(RULES.starterPacks.map(function (p) { return { id: p.id, name: p.name, pack: p }; }), function (item) {
        state.equipment.starterPack = item.id;
        applyStarterPack(item.pack);
        scheduleSave(); renderAll();
      }, function (item) {
        const p = item.pack;
        return '<strong>' + p.name + '</strong><p>' + p.description + '</p>';
      });
    });
    area.appendChild(packBtn);
    if (currentPack) {
      const detail = document.createElement('span');
      detail.className = 'selection-detail';
      detail.style.display = 'inline-block';
      detail.style.marginLeft = '0.5em';
      detail.textContent = currentPack.description;
      area.appendChild(detail);
    }

    const weaponsBody = document.getElementById('weapons-body');
    weaponsBody.innerHTML = '';
    weaponsBody.appendChild(weaponPicker('primary', 'Primary'));
    weaponsBody.appendChild(weaponPicker('secondary', 'Secondary'));
    weaponsBody.appendChild(weaponPicker('melee', 'Melee'));
    const thrownTr = document.createElement('tr');
    thrownTr.innerHTML = '<td>Thrown / Explosive</td><td class="write-line">&nbsp;</td><td>___ D/C</td><td>___</td><td>___</td><td class="write-line">&nbsp;</td>';
    weaponsBody.appendChild(thrownTr);

    const armorBody = document.getElementById('armor-body');
    armorBody.innerHTML = '';
    const armorRows = Math.max(4, state.equipment.armor.length);
    for (let i = 0; i < armorRows; i++) {
      const entry = state.equipment.armor[i];
      const tr = document.createElement('tr');
      if (entry) {
        const a = RULES.armor.find(function (x) { return x.id === entry.id; });
        const itemTd = document.createElement('td');
        itemTd.textContent = a ? a.name : entry.id;
        if (a) addDetailLink(itemTd, a.name, previewArmorHtml(a));
        const rm = document.createElement('button');
        rm.type = 'button'; rm.textContent = '×'; rm.className = 'pick-btn';
        rm.addEventListener('click', function () {
          state.equipment.armor.splice(i, 1);
          scheduleSave(); renderAll();
        });
        itemTd.appendChild(rm);
        tr.appendChild(itemTd);
        const physTd = document.createElement('td');
        physTd.textContent = a ? String(a.physicalDr) : '___';
        tr.appendChild(physTd);
        const enTd = document.createElement('td');
        enTd.textContent = a ? String(a.energyDr) : '___';
        tr.appendChild(enTd);
        const locTd = document.createElement('td');
        locTd.textContent = a && a.locations.length ? a.locations.join(', ') : '';
        tr.appendChild(locTd);
        const noteTd = document.createElement('td');
        noteTd.className = 'write-line';
        noteTd.innerHTML = '&nbsp;';
        tr.appendChild(noteTd);
      } else {
        tr.innerHTML = '<td class="write-line">&nbsp;</td><td>___</td><td>___</td><td class="write-line">&nbsp;</td><td class="write-line">&nbsp;</td>';
      }
      armorBody.appendChild(tr);
    }

    const consumablesBody = document.getElementById('consumables-body');
    consumablesBody.innerHTML = '';
    const consumableMap = {};
    (state.equipment.consumables || []).forEach(function (entry) {
      consumableMap[entry.id] = (consumableMap[entry.id] || 0) + (entry.qty || 1);
    });
    RULES.consumables.forEach(function (c) {
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      nameTd.textContent = c.name;
      addDetailLink(nameTd, c.name, previewConsumableHtml(c));
      const qtyTd = document.createElement('td');
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '0';
      qtyInput.className = 'sheet-input';
      qtyInput.style.width = '3em';
      qtyInput.value = consumableMap[c.id] || 0;
      qtyInput.addEventListener('change', function () {
        const qty = parseInt(qtyInput.value, 10) || 0;
        state.equipment.consumables = state.equipment.consumables.filter(function (e) { return e.id !== c.id; });
        if (qty > 0) state.equipment.consumables.push({ id: c.id, qty: qty });
        scheduleSave();
      });
      qtyTd.appendChild(qtyInput);
      tr.appendChild(nameTd);
      tr.appendChild(qtyTd);
      consumablesBody.appendChild(tr);
    });
    for (let j = 0; j < 4; j++) {
      const emptyTr = document.createElement('tr');
      emptyTr.innerHTML = '<td class="write-line">&nbsp;</td><td>___</td>';
      consumablesBody.appendChild(emptyTr);
    }

    if (document.getElementById('field-wealth').value !== String(state.equipment.wealth || 0)) {
      document.getElementById('field-wealth').value = state.equipment.wealth || 0;
    }
  }""",
    ),
    (
        """  function renderStand() {
    const area = document.getElementById('stand-area');
    document.getElementById('field-has-stand').checked = state.stand.hasStand;
    area.classList.toggle('hidden', !state.stand.hasStand);
    if (!state.stand.hasStand) return;
    area.innerHTML = '';
    const budget = getStandBudget(state);
    const sum = getStandGradeSum(state);
    const budgetP = document.createElement('p');
    budgetP.className = 'text-sm';
    budgetP.textContent = 'Stand budget: ' + sum + ' / ' + budget;
    area.appendChild(budgetP);
    const gradeKeys = ['power', 'speed', 'range', 'durability', 'precision', 'developmentPotential'];
    const gradeLabels = ['Power', 'Speed', 'Range', 'Durability', 'Precision', 'Dev. Potential'];
    const grades = Object.keys(RULES.standGrades);
    gradeKeys.forEach(function (key, i) {
      const row = document.createElement('label');
      row.className = 'flex items-center gap-2 text-sm';
      row.innerHTML = gradeLabels[i] + ' ';
      const sel = document.createElement('select');
      sel.className = 'bg-jojo-bg border border-jojo-gold/30 rounded px-2';
      grades.forEach(function (g) {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g + ' (' + RULES.standGrades[g] + ')';
        if (state.stand.grades[key] === g) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () {
        state.stand.grades[key] = sel.value;
        scheduleSave(); renderAll();
      });
      row.appendChild(sel);
      area.appendChild(row);
    });
    const dur = RULES.standGrades[state.stand.grades.durability] || 0;
    const spd = RULES.standGrades[state.stand.grades.speed] || 0;
    const level = getLevel(state);
    const derived = document.createElement('div');
    derived.className = 'text-sm mt-2 grid grid-cols-2 gap-1';
    derived.innerHTML =
      '<div>Stand HP: ' + (dur + level) + '</div>' +
      '<div>Stand DR: ' + Math.floor(dur / 4) + '</div>' +
      '<div>Stand Defense: ' + (spd >= 10 ? 2 : 1) + '</div>' +
      '<div>Init bonus: +' + Math.floor(spd / 4) + '</div>';
    area.appendChild(derived);
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'Stand name';
    nameInput.className = 'w-full mt-2 bg-jojo-bg border border-jojo-gold/30 rounded px-2 py-1';
    nameInput.value = state.stand.name || '';
    nameInput.addEventListener('input', function () { state.stand.name = nameInput.value; scheduleSave(); });
    area.appendChild(nameInput);
  }""",
        """  function renderStand() {
    document.getElementById('field-has-stand').checked = state.stand.hasStand;
    document.getElementById('stand-area').classList.toggle('hidden', !state.stand.hasStand);
    if (!state.stand.hasStand) return;

    const budget = getStandBudget(state);
    const sum = getStandGradeSum(state);
    document.getElementById('stand-budget').textContent = 'Stand budget: ' + sum + ' / ' + budget;

    const gradeKeys = ['power', 'speed', 'range', 'durability', 'precision', 'developmentPotential'];
    const grades = Object.keys(RULES.standGrades);
    gradeKeys.forEach(function (key) {
      const box = document.querySelector('.stat-box[data-grade="' + key + '"]');
      const gradeEl = document.getElementById('grade-' + key);
      if (!box || !gradeEl) return;
      let sel = box.querySelector('select');
      if (!sel) {
        sel = document.createElement('select');
        sel.className = 'sheet-input';
        grades.forEach(function (g) {
          const opt = document.createElement('option');
          opt.value = g;
          opt.textContent = g;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', function () {
          state.stand.grades[key] = sel.value;
          scheduleSave(); renderAll();
        });
        gradeEl.innerHTML = '';
        gradeEl.appendChild(sel);
      }
      sel.value = state.stand.grades[key] || 'D';
    });

    const dur = RULES.standGrades[state.stand.grades.durability] || 0;
    const spd = RULES.standGrades[state.stand.grades.speed] || 0;
    const rng = RULES.standGrades[state.stand.grades.range] || 0;
    const level = getLevel(state);
    const standHp = dur + level;
    document.getElementById('field-stand-hp-max').textContent = standHp;
    document.getElementById('field-stand-hp-current').textContent = standHp;
    document.getElementById('field-stand-defense').textContent = spd >= 10 ? 2 : 1;
    document.getElementById('field-stand-dr').textContent = Math.floor(dur / 4);
    document.getElementById('field-stand-init').textContent = '+' + Math.floor(spd / 4);
    document.getElementById('field-stand-range-band').textContent = rng >= 10 ? 'Long' : (rng >= 6 ? 'Medium' : 'Close');
    document.getElementById('field-stand-name').value = state.stand.name || '';
    document.getElementById('field-stand-user').textContent = state.name || '—';
    document.getElementById('field-stand-abilities').value = state.stand.abilities || '';

    document.querySelectorAll('.stand-type-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.type === (state.stand.type || 'Close-Range'));
    });

    const attacksBody = document.getElementById('stand-attacks-body');
    attacksBody.innerHTML = '';
    const attacks = state.stand.attacks && state.stand.attacks.length ? state.stand.attacks : [{ name: '', stat: 'P', damage: '', range: '', notes: '' }];
    while (attacks.length < 4) attacks.push({ name: '', stat: '', damage: '', range: '', notes: '' });
    attacks.slice(0, 4).forEach(function (atk, idx) {
      const tr = document.createElement('tr');
      ['name', 'stat', 'damage', 'range', 'notes'].forEach(function (field) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'sheet-input';
        input.style.width = '100%';
        input.value = atk[field] || (field === 'stat' && idx === 0 ? 'P / Pr' : '');
        input.addEventListener('input', function () {
          if (!state.stand.attacks[idx]) state.stand.attacks[idx] = {};
          state.stand.attacks[idx][field] = input.value;
          scheduleSave();
        });
        td.appendChild(input);
        tr.appendChild(td);
      });
      attacksBody.appendChild(tr);
    });
  }""",
    ),
    (
        """  function renderProgression() {
    const level = getLevel(state);
    document.getElementById('field-level').textContent = level;
    const next = getNextLevelXp(level);
    document.getElementById('field-next-xp').textContent = level < 20 || state.xp < next ? 'Next level at ' + next + ' XP' : '';
    const emptyPerks = [];
    for (let i = 1; i <= getPerkSlotCount(state); i++) {
      if (i <= level && !state.perkSlots[i]) emptyPerks.push(i);
    }
    document.getElementById('progression-summary').textContent =
      getUnspentSkillRanks(state) + ' unspent skill ranks' +
      (emptyPerks.length ? ' | Empty perk slots: level ' + emptyPerks.join(', ') : '');
  }""",
        """  function renderProgression() {
    const level = getLevel(state);
    document.getElementById('field-level').textContent = level;
    document.getElementById('field-level-p2').textContent = level;
    document.getElementById('field-name-p2').textContent = state.name || '—';
    document.getElementById('field-name-p3').textContent = state.name || '—';
    const next = getNextLevelXp(level);
    document.getElementById('field-next-xp').textContent = level < 20 || state.xp < next ? 'Next level at ' + next + ' XP' : '';
    const emptyPerks = [];
    for (let i = 1; i <= getPerkSlotCount(state); i++) {
      if (i <= level && !state.perkSlots[i]) emptyPerks.push(i);
    }
    document.getElementById('progression-summary').textContent =
      getUnspentSkillRanks(state) + ' unspent skill ranks' +
      (emptyPerks.length ? ' | Empty perk slots: level ' + emptyPerks.join(', ') : '');
  }""",
    ),
    (
        """  function renderValidation() {
    const issues = validateCharacter(state);
    const list = document.getElementById('validation-list');
    list.innerHTML = issues.length ? issues.map(function (i) {
      const color = i.type === 'error' ? 'text-red-400' : i.type === 'warn' ? 'text-yellow-400' : 'text-jojo-cream/70';
      return '<li class="' + color + '">' + i.msg + '</li>';
    }).join('') : '<li class="text-green-400">No issues</li>';
  }""",
        """  function renderValidation() {
    const issues = validateCharacter(state);
    const list = document.getElementById('validation-list');
    list.innerHTML = issues.length ? issues.map(function (i) {
      const cls = i.type === 'error' ? 'validation-error' : i.type === 'warn' ? 'validation-warn' : 'validation-info';
      return '<li class="' + cls + '">' + i.msg + '</li>';
    }).join('') : '<li class="validation-ok">No issues</li>';
  }""",
    ),
    (
        """  function appendGuideStep(container, step, status) {
    const colors = { done: 'border-green-500', pending: 'border-yellow-500/50', blocked: 'border-red-500' };
    const div = document.createElement('div');
    div.className = 'rounded border-l-4 pl-3 py-2 ' + (colors[status] || colors.pending);
    div.innerHTML = '<strong>' + step.title + '</strong><p class="text-sm text-jojo-cream/80 mt-1">' + step.description + '</p>' +
      '<button type="button" class="text-xs text-jojo-magenta mt-1 underline go-section" data-section="' + step.section + '">Go to section</button>';
    container.appendChild(div);
  }""",
        """  function appendGuideStep(container, step, status) {
    const div = document.createElement('div');
    div.className = 'guide-step ' + (status || 'pending');
    div.innerHTML = '<strong>' + step.title + '</strong><p>' + step.description + '</p>' +
      '<button type="button" class="pick-btn go-section" data-section="' + step.section + '">Go to section</button>';
    container.appendChild(div);
  }""",
    ),
    (
        """    document.getElementById('guide-steps').addEventListener('click', function (e) {
      if (e.target.classList.contains('go-section')) {
        const id = 'section-' + (e.target.dataset.section === 'race' ? 'race' : e.target.dataset.section);
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    });""",
        """    document.getElementById('guide-steps').addEventListener('click', function (e) {
      if (e.target.classList.contains('go-section')) {
        const sectionMap = { race: 'page-2', special: 'page-1', skills: 'page-1', perks: 'page-2', derived: 'page-1', equipment: 'page-3', stand: 'page-4' };
        const pageId = sectionMap[e.target.dataset.section] || 'page-1';
        const el = document.getElementById(pageId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    });
    document.getElementById('btn-add-armor').addEventListener('click', function () {
      openPicker(RULES.armor.map(function (a) { return { id: a.id, name: a.name, armor: a }; }), function (item) {
        state.equipment.armor.push({ id: item.id });
        scheduleSave(); renderAll();
      }, function (item) { return previewArmorHtml(item.armor); });
    });
    document.getElementById('field-trinket').addEventListener('input', function (e) {
      state.equipment.trinket = e.target.value;
      scheduleSave();
    });
    document.getElementById('field-wealth').addEventListener('input', function (e) {
      state.equipment.wealth = parseInt(e.target.value, 10) || 0;
      scheduleSave();
    });
    document.getElementById('field-stand-name').addEventListener('input', function (e) {
      state.stand.name = e.target.value;
      scheduleSave();
    });
    document.getElementById('field-stand-abilities').addEventListener('input', function (e) {
      state.stand.abilities = e.target.value;
      scheduleSave();
    });
    document.querySelectorAll('.stand-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.stand.type = btn.dataset.type;
        scheduleSave(); renderAll();
      });
    });""",
    ),
    (
        """  function syncFields() {
    document.getElementById('field-name').value = state.name || '';
    renderRacePicker();
    document.getElementById('field-xp').value = state.xp || 0;
    document.getElementById('hamon-unlocked').checked = state.hamonUnlocked;
    document.getElementById('spin-unlocked').checked = state.spinUnlocked;
  }""",
        """  function syncFields() {
    document.getElementById('field-name').value = state.name || '';
    renderRacePicker();
    document.getElementById('field-xp').value = state.xp || 0;
    document.getElementById('hamon-unlocked').checked = state.hamonUnlocked;
    document.getElementById('spin-unlocked').checked = state.spinUnlocked;
    document.getElementById('field-trinket').value = state.equipment.trinket || '';
    document.getElementById('field-wealth').value = state.equipment.wealth || 0;
    document.getElementById('field-stand-name').value = state.stand.name || '';
    document.getElementById('field-stand-abilities').value = state.stand.abilities || '';
    document.getElementById('field-has-stand').checked = state.stand.hasStand;
  }""",
    ),
]
