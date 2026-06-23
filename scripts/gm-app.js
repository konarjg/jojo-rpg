(function () {
  'use strict';

  var IS_PLAYER_VIEW = /[?&]view=player(?:&|$)/.test(window.location.search);
  var STORAGE_KEY = 'jojo-gm:campaign';
  var SHARE_KEY = 'jojo-gm:share';
  var CHANNEL_NAME = 'jojo-gm';
  var RULES_CHAPTER_STORAGE_KEY = 'jojo-gm:rules-chapter';
  var PANEL_STORAGE_KEY = 'jojo-gm:panels';
  var TOKEN_TYPES = [
    { id: 'player', label: 'Player', className: 'gm-token--player' },
    { id: 'npc', label: 'NPC', className: 'gm-token--npc' },
    { id: 'boss', label: 'Boss', className: 'gm-token--boss' },
    { id: 'cover', label: 'Cover', className: 'gm-token--cover' },
    { id: 'obstacle', label: 'Obstacle', className: 'gm-token--obstacle' }
  ];

  var NPC_CATALOG = [];
  var selectedNpcId = null;
  var npcEditId = null;

  var channel = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    channel = null;
  }

  var state = null;
  var selectedTokenType = 'player';
  var selectedTokenIds = {};
  var mapMode = 'select';
  var cursorGhost = null;
  var GRID_SIZE = 48;
  var MAP_COLS = 24;
  var MAP_ROWS = 18;
  var MIN_GRID_PX = 16;
  var TOKEN_INSET = 2;
  var dragState = null;
  var marquee = null;
  var marqueeEl = null;
  var dragOffset = { x: 0, y: 0 };
  var playerWindow = null;
  var mapSyncTimer = null;
  var currentRulesChapterIndex = 0;
  var dragMoved = false;
  var panelState = { notes: true, map: true, npc: true };
  var mapResizeFrame = null;

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function emptySession(name) {
    var sess = GmState.emptySession(name);
    var map = GmState.emptyMap('Map 1');
    sess.maps[map.id] = map;
    sess.activeMapId = map.id;
    return sess;
  }

  function emptyState() {
    return GmState.emptyState();
  }

  function syncNpcCatalogFromState() {
    NPC_CATALOG = GmState.migrateNpcs(state.npcs || []);
  }

  function syncStateNpcsFromCatalog() {
    state.npcs = NPC_CATALOG.slice();
  }

  function findNpc(id) {
    return NPC_CATALOG.find(function (n) { return n.id === id; });
  }

  function loadState() {
    if (window.JOJO_INITIAL_WORKSPACE) {
      try {
        var ws = window.JOJO_INITIAL_WORKSPACE;
        var merged = emptyState();
        merged.activeSessionId = ws.activeSessionId || merged.activeSessionId;
        merged.autoOpenPlayer = !!ws.autoOpenPlayer;
        merged.npcs = ws.npcs || [];
        merged.globalMaps = ws.globalMaps || {};
        merged.sessions = ws.sessions || {};
        merged.snapshots = ws.snapshots || [];
        return GmState.migrateState(merged);
      } catch (e) { /* fall through */ }
    }
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return GmState.migrateState(JSON.parse(raw));
      }
    } catch (e) { /* ignore */ }
    var fresh = emptyState();
    var s = emptySession('Session 1');
    fresh.sessions[s.id] = s;
    fresh.activeSessionId = s.id;
    return fresh;
  }

  function saveState() {
    syncStateNpcsFromCatalog();
    if (window.JojoGmStorage && typeof window.JojoGmStorage.save === 'function') {
      try {
        window.JojoGmStorage.save(GmState.workspacePayload(state));
      } catch (e) { /* ignore */ }
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
    pushShareSnapshot();
  }

  function getActiveTokens() {
    return GmState.getActiveTokens(state, activeSession());
  }

  function setActiveTokens(tokens) {
    GmState.setActiveTokens(state, activeSession(), tokens);
  }

  function persistActiveMapTokens() {
    GmState.persistTokensFromSession(state, activeSession());
  }

  function activeSession() {
    return state.sessions[state.activeSessionId];
  }

  function pushShareSnapshot() {
    var sess = activeSession();
    if (!sess) return;
    persistActiveMapTokens();
    var payload = {
      type: 'map',
      tokens: getActiveTokens().slice(),
      roll: null
    };
    try {
      localStorage.setItem(SHARE_KEY, JSON.stringify(payload));
    } catch (e) { /* ignore */ }
    broadcast(payload);
  }

  function broadcast(msg) {
    if (channel) {
      try { channel.postMessage(msg); } catch (e) { /* ignore */ }
    }
  }

  function scheduleMapSync() {
    if (mapSyncTimer) clearTimeout(mapSyncTimer);
    mapSyncTimer = setTimeout(function () {
      saveState();
      pushServerMapShareIfActive();
    }, 100);
  }

  function pushServerMapShareIfActive() {
    if (window.JOJO_STORAGE_MODE !== 'server') return;
    if (!window.__jojoMapShareActive) return;
    document.dispatchEvent(new CustomEvent('jojo-map-share-sync'));
  }

  function setPlayerStatus(connected) {
    var el = document.getElementById('gm-player-status');
    if (!el) return;
    el.textContent = connected ? 'Player view: connected' : 'Player view: not open';
    el.classList.toggle('gm-status--ok', connected);
    el.classList.toggle('gm-status--warn', !connected);
  }

  function openPlayerView() {
    var url = window.location.pathname.split('/').pop() + '?view=player';
    if (playerWindow && !playerWindow.closed) {
      playerWindow.focus();
      return;
    }
    playerWindow = window.open(url, 'jojo-gm-player', 'width=960,height=720,resizable=yes');
    setTimeout(function () { pingPlayer(); }, 500);
  }

  function pingPlayer() {
    broadcast({ type: 'ping' });
    var sess = activeSession();
    if (sess) {
      persistActiveMapTokens();
      broadcast({ type: 'map', tokens: getActiveTokens().slice() });
    }
  }

  function initChannelListeners() {
    if (!channel) return;
    channel.onmessage = function (ev) {
      if (ev.data && ev.data.type === 'pong') {
        setPlayerStatus(true);
      }
    };
    setInterval(function () {
      if (playerWindow && !playerWindow.closed) {
        pingPlayer();
      } else {
        setPlayerStatus(false);
      }
    }, 3000);
  }

  /* ---- Rules modal (same pattern as character sheet) ---- */

  function showRulesChapter(index) {
    var chapters = document.querySelectorAll('.rules-chapter');
    if (!chapters.length) return;
    if (index < 0 || index >= chapters.length) return;
    currentRulesChapterIndex = index;
    chapters.forEach(function (el, i) {
      el.classList.toggle('rules-chapter--active', i === index);
    });
    document.querySelectorAll('.rules-toc-link').forEach(function (btn, i) {
      btn.classList.toggle('rules-toc-link--active', i === index);
    });
    var sel = document.getElementById('rules-chapter-select');
    if (sel) sel.value = String(index);
    var prev = document.getElementById('btn-rules-prev');
    var next = document.getElementById('btn-rules-next');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === chapters.length - 1;
    var content = document.getElementById('rules-content');
    if (content) content.scrollTop = 0;
    try { localStorage.setItem(RULES_CHAPTER_STORAGE_KEY, String(index)); } catch (e) { /* ignore */ }
  }

  function closeRules() {
    var rulesModal = document.getElementById('rules-modal');
    var overlay = document.getElementById('modal-overlay');
    if (rulesModal) rulesModal.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
  }

  function openRules() {
    var overlay = document.getElementById('modal-overlay');
    var rulesModal = document.getElementById('rules-modal');
    if (!overlay || !rulesModal) return;
    overlay.classList.remove('hidden');
    rulesModal.classList.remove('hidden');
    showRulesChapter(currentRulesChapterIndex);
  }

  function initRulesModal() {
    var btnRules = document.getElementById('btn-rules');
    var overlay = document.getElementById('modal-overlay');
    if (!btnRules || !overlay) return;

    var start = 0;
    try {
      var saved = parseInt(localStorage.getItem(RULES_CHAPTER_STORAGE_KEY), 10);
      var count = document.querySelectorAll('.rules-chapter').length;
      if (!isNaN(saved) && saved >= 0 && saved < count) start = saved;
    } catch (e) { /* ignore */ }
    currentRulesChapterIndex = start;
    showRulesChapter(start);

    document.querySelectorAll('.rules-toc-link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showRulesChapter(parseInt(btn.getAttribute('data-rules-index'), 10) || 0);
      });
    });
    var prev = document.getElementById('btn-rules-prev');
    var next = document.getElementById('btn-rules-next');
    var sel = document.getElementById('rules-chapter-select');
    if (prev) prev.addEventListener('click', function () { showRulesChapter(currentRulesChapterIndex - 1); });
    if (next) next.addEventListener('click', function () { showRulesChapter(currentRulesChapterIndex + 1); });
    if (sel) sel.addEventListener('change', function (e) {
      showRulesChapter(parseInt(e.target.value, 10) || 0);
    });
    btnRules.addEventListener('click', openRules);
    var btnClose = document.getElementById('btn-rules-close');
    if (btnClose) btnClose.addEventListener('click', closeRules);
    overlay.addEventListener('click', function () {
      closeRules();
      closeNpcModal();
    });
  }

  /* ---- Session / stickies ---- */

  function loadPanelState() {
    try {
      var raw = localStorage.getItem(PANEL_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            notes: parsed.notes !== false,
            map: parsed.map !== false,
            npc: parsed.npc !== false
          };
        }
      }
    } catch (e) { /* ignore */ }
    return { notes: true, map: true, npc: true };
  }

  function savePanelState() {
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panelState));
    } catch (e) { /* ignore */ }
  }

  function openPanelCount() {
    var count = 0;
    if (panelState.notes) count++;
    if (panelState.map) count++;
    if (panelState.npc) count++;
    return count;
  }

  function setPanelOpen(panelId, open) {
    if (!open && openPanelCount() <= 1) return;
    panelState[panelId] = !!open;
    applyPanelLayout();
    savePanelState();
  }

  function togglePanel(panelId) {
    setPanelOpen(panelId, !panelState[panelId]);
  }

  function applyPanelLayout() {
    var layout = document.getElementById('gm-layout');
    if (!layout) return;
    var openCount = openPanelCount();
    ['notes', 'map', 'npc'].forEach(function (panelId) {
      var col = layout.querySelector('.gm-column[data-panel="' + panelId + '"]');
      if (col) {
        col.classList.toggle('gm-column--closed', !panelState[panelId]);
      }
    });
    layout.classList.toggle('gm-layout--solo', openCount === 1);
    document.querySelectorAll('.gm-panel-toggle[data-panel]').forEach(function (btn) {
      var id = btn.dataset.panel;
      var isOpen = !!panelState[id];
      btn.classList.toggle('gm-panel-toggle--active', isOpen);
      btn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
    });
    scheduleMapRelayout();
  }

  function initPanelLayout() {
    panelState = loadPanelState();
    if (!panelState.notes && !panelState.map && !panelState.npc) {
      panelState = { notes: true, map: true, npc: true };
    }
    applyPanelLayout();
    document.querySelectorAll('.gm-panel-toggle[data-panel], .gm-panel-close[data-panel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        togglePanel(btn.dataset.panel);
      });
    });
  }

  function renderSessionSelect() {
    var sel = document.getElementById('gm-session-select');
    if (!sel) return;
    sel.innerHTML = '';
    Object.values(state.sessions).forEach(function (sess) {
      var opt = document.createElement('option');
      opt.value = sess.id;
      opt.textContent = sess.name;
      if (sess.id === state.activeSessionId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  var gmStickyBoard = null;

  function initGmStickyBoard() {
    if (gmStickyBoard || typeof window.StickyBoard === 'undefined') return;
    var board = document.getElementById('gm-sticky-board');
    if (!board) return;
    gmStickyBoard = window.StickyBoard.mount(board, {
      getStickies: function () {
        var sess = activeSession();
        return sess ? sess.stickies : [];
      },
      onChange: function () { saveState(); },
      addButtonEl: document.getElementById('gm-add-sticky'),
      paletteEl: document.getElementById('gm-sticky-color-palette')
    });
  }

  function renderStickies() {
    if (gmStickyBoard) gmStickyBoard.render();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---- Map ---- */

  function syncMapGrid(canvas) {
    if (!canvas) return GRID_SIZE;
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (w < 8 || h < 8) return GRID_SIZE;
    var grid = Math.floor(Math.min(w / MAP_COLS, h / MAP_ROWS));
    if (grid < MIN_GRID_PX) grid = MIN_GRID_PX;
    canvas.style.setProperty('--gm-grid-size', grid + 'px');
    return grid;
  }

  function readGridSize(canvas) {
    if (!canvas) return GRID_SIZE;
    var raw = getComputedStyle(canvas).getPropertyValue('--gm-grid-size').trim();
    var parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return syncMapGrid(canvas);
  }

  function scheduleMapRelayout() {
    if (mapResizeFrame) cancelAnimationFrame(mapResizeFrame);
    mapResizeFrame = requestAnimationFrame(function () {
      mapResizeFrame = null;
      var canvas = document.getElementById('gm-map-canvas');
      if (!canvas) return;
      syncMapGrid(canvas);
      renderMap('gm-map-canvas', true);
    });
  }

  function pointerToCell(localX, localY, canvas) {
    var grid = readGridSize(canvas);
    return {
      col: Math.min(MAP_COLS - 1, Math.max(0, Math.floor(localX / grid))),
      row: Math.min(MAP_ROWS - 1, Math.max(0, Math.floor(localY / grid)))
    };
  }

  function cellOrigin(col, row, canvas) {
    var grid = readGridSize(canvas);
    return {
      x: col * grid,
      y: row * grid,
      grid: grid
    };
  }

  function tokenPixel(tok, canvas) {
    var origin = cellOrigin(tok.col, tok.row, canvas);
    return {
      left: origin.x + TOKEN_INSET,
      top: origin.y + TOKEN_INSET
    };
  }

  function normalizeToken(tok, canvas) {
    syncMapGrid(canvas);
    if (tok.col == null || tok.row == null) {
      var grid = readGridSize(canvas);
      var col = Math.max(0, Math.floor((tok.x || 0) / grid));
      var row = Math.max(0, Math.floor((tok.y || 0) / grid));
      var snapped = pointerToCell(col * grid, row * grid, canvas);
      tok.col = snapped.col;
      tok.row = snapped.row;
    } else {
      tok.col = Math.min(MAP_COLS - 1, Math.max(0, tok.col));
      tok.row = Math.min(MAP_ROWS - 1, Math.max(0, tok.row));
    }
    var pos = tokenPixel(tok, canvas);
    tok.x = pos.left;
    tok.y = pos.top;
  }

  function clearTokenSelection() {
    selectedTokenIds = {};
  }

  function isTokenSelected(id) {
    return !!selectedTokenIds[id];
  }

  function toggleTokenSelection(id) {
    if (selectedTokenIds[id]) {
      delete selectedTokenIds[id];
    } else {
      selectedTokenIds[id] = true;
    }
  }

  function selectSingleToken(id) {
    selectedTokenIds = {};
    selectedTokenIds[id] = true;
  }

  function hasTokenSelection() {
    for (var key in selectedTokenIds) {
      if (Object.prototype.hasOwnProperty.call(selectedTokenIds, key)) return true;
    }
    return false;
  }

  function tokenBounds(tok, canvas) {
    var origin = cellOrigin(tok.col, tok.row, canvas);
    var tokenSize = origin.grid - TOKEN_INSET * 2;
    return {
      left: origin.x + TOKEN_INSET,
      top: origin.y + TOKEN_INSET,
      right: origin.x + TOKEN_INSET + tokenSize,
      bottom: origin.y + TOKEN_INSET + tokenSize
    };
  }

  function normalizeRect(m) {
    return {
      left: Math.min(m.x1, m.x2),
      top: Math.min(m.y1, m.y2),
      right: Math.max(m.x1, m.x2),
      bottom: Math.max(m.y1, m.y2)
    };
  }

  function rectsIntersect(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function updateMarqueeDisplay() {
    if (!marqueeEl || !marquee) return;
    var box = normalizeRect(marquee);
    marqueeEl.style.left = box.left + 'px';
    marqueeEl.style.top = box.top + 'px';
    marqueeEl.style.width = (box.right - box.left) + 'px';
    marqueeEl.style.height = (box.bottom - box.top) + 'px';
    marqueeEl.classList.remove('hidden');
  }

  function hideMarquee() {
    if (marqueeEl) marqueeEl.classList.add('hidden');
  }

  function applyMarqueeSelection() {
    var sess = activeSession();
    var canvas = document.getElementById('gm-map-canvas');
    if (!sess || !canvas || !marquee) return;
    var box = normalizeRect(marquee);
    getActiveTokens().forEach(function (tok) {
      normalizeToken(tok, canvas);
      if (rectsIntersect(box, tokenBounds(tok, canvas))) {
        selectedTokenIds[tok.id] = true;
      }
    });
  }

  function startTokenDrag(tok) {
    if (!isTokenSelected(tok.id)) {
      selectSingleToken(tok.id);
    }
    var entries = [];
    getActiveTokens().forEach(function (t) {
      if (isTokenSelected(t.id)) {
        entries.push({ tok: t, startCol: t.col, startRow: t.row });
      }
    });
    dragState = {
      entries: entries,
      anchorCol: tok.col,
      anchorRow: tok.row
    };
    dragMoved = false;
  }

  function tokenMeta(typeId) {
    for (var i = 0; i < TOKEN_TYPES.length; i++) {
      if (TOKEN_TYPES[i].id === typeId) return TOKEN_TYPES[i];
    }
    return TOKEN_TYPES[0];
  }

  function paletteSwatchClass(typeId) {
    return 'gm-palette-swatch ' + tokenMeta(typeId).className;
  }

  function updateMapModeUI() {
    var canvas = document.getElementById('gm-map-canvas');
    var hint = document.getElementById('gm-token-hint');
    var selectBtn = document.getElementById('gm-mode-select');
    var meta = tokenMeta(selectedTokenType);

    if (canvas) {
      canvas.classList.toggle('gm-map-canvas--place', mapMode === 'place');
      canvas.classList.toggle('gm-map-canvas--select', mapMode === 'select');
    }
    if (hint) {
      var mapName = getActiveMapName();
      hint.textContent = mapMode === 'place'
        ? 'Map: ' + mapName + ' — Placing ' + meta.label + ' — click map to place, Esc or right-click to cancel'
        : 'Map: ' + mapName + ' — Select / move tokens — Ctrl+click or drag to multi-select. Right-click map to cancel.';
    }
    if (selectBtn) {
      selectBtn.classList.remove('gm-palette-btn--active');
    }
    var palette = document.getElementById('gm-token-palette');
    if (palette) {
      palette.querySelectorAll('.gm-palette-btn[data-type]').forEach(function (btn) {
        var isActive = mapMode === 'place' && btn.dataset.type === selectedTokenType;
        btn.classList.toggle('gm-palette-btn--active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }
    if (mapMode !== 'place') {
      hidePlacementHover();
    }
  }

  function enterPlacementMode(typeId) {
    selectedTokenType = typeId;
    clearTokenSelection();
    mapMode = 'place';
    updateMapModeUI();
    renderMap('gm-map-canvas', true);
  }

  function exitPlacementMode() {
    mapMode = 'select';
    updateMapModeUI();
    hidePlacementHover();
  }

  function hidePlacementHover() {
    if (cursorGhost) cursorGhost.classList.add('hidden');
  }

  function updateCursorGhostClass() {
    if (!cursorGhost) return;
    var meta = tokenMeta(selectedTokenType);
    cursorGhost.className = 'gm-cursor-token gm-token ' + meta.className;
    cursorGhost.textContent = '';
  }

  function updatePlacementHover(e) {
    var canvas = document.getElementById('gm-map-canvas');
    if (!canvas || mapMode !== 'place') return;
    var rect = canvas.getBoundingClientRect();
    var localX = e.clientX - rect.left;
    var localY = e.clientY - rect.top;
    var inside = localX >= 0 && localY >= 0 && localX <= rect.width && localY <= rect.height;
    if (!inside) {
      hidePlacementHover();
      return;
    }
    var cell = pointerToCell(localX, localY, canvas);
    var origin = cellOrigin(cell.col, cell.row, canvas);
    updateCursorGhostClass();
    if (cursorGhost) {
      cursorGhost.style.left = (origin.x + TOKEN_INSET) + 'px';
      cursorGhost.style.top = (origin.y + TOKEN_INSET) + 'px';
      cursorGhost.classList.remove('hidden');
    }
  }

  function renderMap(containerId, interactive) {
    var canvas = document.getElementById(containerId);
    var sess = activeSession();
    if (!canvas || !sess) return;
    syncMapGrid(canvas);
    canvas.querySelectorAll('.gm-token:not(.gm-cursor-token)').forEach(function (el) {
      el.remove();
    });
    getActiveTokens().forEach(function (tok) {
      normalizeToken(tok, canvas);
      var meta = tokenMeta(tok.type);
      var pos = tokenPixel(tok, canvas);
      var el = document.createElement('div');
      el.className = 'gm-token ' + meta.className + (isTokenSelected(tok.id) ? ' gm-token--selected' : '');
      el.style.left = pos.left + 'px';
      el.style.top = pos.top + 'px';
      el.dataset.id = tok.id;
      el.title = meta.label;
      el.setAttribute('aria-label', meta.label);
      if (interactive) {
        el.addEventListener('mousedown', function (e) {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          exitPlacementMode();
          if (e.ctrlKey || e.metaKey) {
            toggleTokenSelection(tok.id);
            dragState = null;
            renderMap(containerId, interactive);
            return;
          }
          startTokenDrag(tok);
          renderMap(containerId, interactive);
        });
      }
      canvas.appendChild(el);
    });
  }

  function placeToken(localX, localY) {
    var canvas = document.getElementById('gm-map-canvas');
    if (!canvas || !activeSession()) return;
    var cell = pointerToCell(localX, localY, canvas);
    var pos = tokenPixel({ col: cell.col, row: cell.row }, canvas);
    var tokens = getActiveTokens();
    tokens.push({
      id: uid('tok'),
      type: selectedTokenType,
      col: cell.col,
      row: cell.row,
      x: pos.left,
      y: pos.top
    });
    scheduleMapSync();
    renderMap('gm-map-canvas', true);
  }

  function removeSelectedToken() {
    if (!hasTokenSelection()) return;
    if (!activeSession()) return;
    setActiveTokens(getActiveTokens().filter(function (t) { return !isTokenSelected(t.id); }));
    clearTokenSelection();
    scheduleMapSync();
    renderMap('gm-map-canvas', true);
  }

  function mapSelectValue(scope, mapId) {
    return scope + ':' + mapId;
  }

  function parseMapSelectValue(val) {
    if (!val) return null;
    var idx = val.indexOf(':');
    if (idx < 0) return null;
    return { scope: val.slice(0, idx), id: val.slice(idx + 1) };
  }

  function getActiveMapName() {
    var map = GmState.getActiveMap(state, activeSession());
    return map ? map.name : 'Map';
  }

  function renderMapSelect() {
    var sel = document.getElementById('gm-map-select');
    var sess = activeSession();
    if (!sel || !sess) return;
    persistActiveMapTokens();
    sel.innerHTML = '';
    var sessionGroup = document.createElement('optgroup');
    sessionGroup.label = 'This session';
    GmState.listSessionMaps(sess).forEach(function (map) {
      var opt = document.createElement('option');
      opt.value = mapSelectValue('session', map.id);
      opt.textContent = map.name;
      sessionGroup.appendChild(opt);
    });
    sel.appendChild(sessionGroup);
    var globalGroup = document.createElement('optgroup');
    globalGroup.label = 'Global';
    GmState.listGlobalMaps(state).forEach(function (map) {
      var opt = document.createElement('option');
      opt.value = mapSelectValue('global', map.id);
      opt.textContent = map.name;
      globalGroup.appendChild(opt);
    });
    sel.appendChild(globalGroup);
    var ref = GmState.getActiveMapRef(sess);
    sel.value = mapSelectValue(ref.scope, ref.id);
  }

  function switchToSelectedMap() {
    var sel = document.getElementById('gm-map-select');
    var sess = activeSession();
    if (!sel || !sess) return;
    var parsed = parseMapSelectValue(sel.value);
    if (!parsed) return;
    clearTokenSelection();
    GmState.switchMap(state, sess, parsed.scope, parsed.id);
    saveState();
    updateMapModeUI();
    renderMap('gm-map-canvas', true);
  }

  function addMap() {
    var sess = activeSession();
    if (!sess) return;
    persistActiveMapTokens();
    var name = prompt('New map name:', 'Map ' + (GmState.listSessionMaps(sess).length + 1));
    if (!name) return;
    var map = GmState.addSessionMap(sess, name);
    GmState.switchMap(state, sess, 'session', map.id);
    clearTokenSelection();
    saveState();
    renderMapSelect();
    updateMapModeUI();
    renderMap('gm-map-canvas', true);
  }

  function renameActiveMap() {
    var sess = activeSession();
    var map = GmState.getActiveMap(state, sess);
    if (!map) return;
    var name = prompt('Map name:', map.name);
    if (!name) return;
    map.name = name;
    saveState();
    renderMapSelect();
    updateMapModeUI();
  }

  function deleteActiveMap() {
    var sess = activeSession();
    if (!sess) return;
    var ref = GmState.getActiveMapRef(sess);
    var map = GmState.getActiveMap(state, sess);
    if (!map) return;
    if (ref.scope === 'session' && GmState.listSessionMaps(sess).length <= 1) {
      alert('Keep at least one map in this session.');
      return;
    }
    if (!confirm('Delete map “' + map.name + '”?')) return;
    clearTokenSelection();
    GmState.deleteMap(state, sess, ref.scope, ref.id);
    saveState();
    renderMapSelect();
    updateMapModeUI();
    renderMap('gm-map-canvas', true);
  }

  function saveMapAsGlobal() {
    var sess = activeSession();
    if (!sess) return;
    persistActiveMapTokens();
    var map = GmState.getActiveMap(state, sess);
    if (!map) return;
    var name = prompt('Global map name:', map.name);
    if (!name) return;
    var globalMap = GmState.addGlobalMap(state, name, map.tokens);
    GmState.switchMap(state, sess, 'global', globalMap.id);
    clearTokenSelection();
    saveState();
    renderMapSelect();
    updateMapModeUI();
    renderMap('gm-map-canvas', true);
  }

  function initMapToolbar() {
    var sel = document.getElementById('gm-map-select');
    if (sel) sel.addEventListener('change', switchToSelectedMap);
    var addBtn = document.getElementById('gm-map-add');
    if (addBtn) addBtn.addEventListener('click', addMap);
    var renameBtn = document.getElementById('gm-map-rename');
    if (renameBtn) renameBtn.addEventListener('click', renameActiveMap);
    var deleteBtn = document.getElementById('gm-map-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteActiveMap);
    var globalBtn = document.getElementById('gm-map-global');
    if (globalBtn) globalBtn.addEventListener('click', saveMapAsGlobal);
  }

  function initMapEditor() {
    var canvas = document.getElementById('gm-map-canvas');
    if (!canvas) return;

    cursorGhost = document.createElement('div');
    cursorGhost.id = 'gm-cursor-token';
    cursorGhost.className = 'gm-cursor-token gm-token hidden';
    cursorGhost.setAttribute('aria-hidden', 'true');
    canvas.appendChild(cursorGhost);

    marqueeEl = document.createElement('div');
    marqueeEl.id = 'gm-map-marquee';
    marqueeEl.className = 'gm-map-marquee hidden';
    marqueeEl.setAttribute('aria-hidden', 'true');
    canvas.appendChild(marqueeEl);

    canvas.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || mapMode !== 'select') return;
      var tokenEl = e.target.closest('.gm-token');
      if (tokenEl && !tokenEl.classList.contains('gm-cursor-token')) return;
      var rect = canvas.getBoundingClientRect();
      var localX = e.clientX - rect.left;
      var localY = e.clientY - rect.top;
      if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return;
      if (!(e.ctrlKey || e.metaKey)) clearTokenSelection();
      marquee = { x1: localX, y1: localY, x2: localX, y2: localY };
      dragMoved = false;
      updateMarqueeDisplay();
      e.preventDefault();
    });

    canvas.addEventListener('click', function (e) {
      if (dragMoved) return;
      var tokenEl = e.target.closest('.gm-token');
      if (tokenEl && !tokenEl.classList.contains('gm-cursor-token')) return;
      var rect = canvas.getBoundingClientRect();
      var localX = e.clientX - rect.left;
      var localY = e.clientY - rect.top;
      if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return;
      if (mapMode === 'select') return;
      clearTokenSelection();
      placeToken(localX, localY);
    });

    canvas.addEventListener('mousemove', function (e) {
      updatePlacementHover(e);
    });

    canvas.addEventListener('mouseleave', function () {
      hidePlacementHover();
    });

    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      exitPlacementMode();
      clearTokenSelection();
      renderMap('gm-map-canvas', true);
    });

    window.addEventListener('mousemove', function (e) {
      if (marquee && canvas) {
        var rect = canvas.getBoundingClientRect();
        marquee.x2 = e.clientX - rect.left;
        marquee.y2 = e.clientY - rect.top;
        if (Math.abs(marquee.x2 - marquee.x1) > 4 || Math.abs(marquee.y2 - marquee.y1) > 4) {
          dragMoved = true;
        }
        updateMarqueeDisplay();
        return;
      }
      if (dragState && canvas) {
        dragMoved = true;
        var rect = canvas.getBoundingClientRect();
        var cell = pointerToCell(e.clientX - rect.left, e.clientY - rect.top, canvas);
        var dCol = cell.col - dragState.anchorCol;
        var dRow = cell.row - dragState.anchorRow;
        dragState.entries.forEach(function (entry) {
          var grid = readGridSize(canvas);
          var targetCol = entry.startCol + dCol;
          var targetRow = entry.startRow + dRow;
          var snapped = pointerToCell(targetCol * grid, targetRow * grid, canvas);
          entry.tok.col = snapped.col;
          entry.tok.row = snapped.row;
          var pos = tokenPixel(entry.tok, canvas);
          entry.tok.x = pos.left;
          entry.tok.y = pos.top;
        });
        renderMap('gm-map-canvas', true);
      }
    });

    window.addEventListener('mouseup', function () {
      if (marquee) {
        if (Math.abs(marquee.x2 - marquee.x1) > 4 || Math.abs(marquee.y2 - marquee.y1) > 4) {
          applyMarqueeSelection();
        }
        marquee = null;
        hideMarquee();
        renderMap('gm-map-canvas', true);
      }
      if (dragState) {
        dragState = null;
        scheduleMapSync();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) return;
        if (mapMode === 'place') {
          exitPlacementMode();
          renderMap('gm-map-canvas', true);
        } else {
          clearTokenSelection();
          renderMap('gm-map-canvas', true);
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) return;
        removeSelectedToken();
      }
    });

    var selectBtn = document.getElementById('gm-mode-select');
    if (selectBtn) {
      selectBtn.addEventListener('click', function () {
        exitPlacementMode();
        renderMap('gm-map-canvas', true);
      });
    }

    var palette = document.getElementById('gm-token-palette');
    if (palette) {
      TOKEN_TYPES.forEach(function (t) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pick-btn gm-palette-btn';
        btn.dataset.type = t.id;
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = '<span class="' + paletteSwatchClass(t.id) + '" aria-hidden="true"></span><span>' + t.label + '</span>';
        btn.addEventListener('click', function () {
          if (mapMode === 'place' && selectedTokenType === t.id) {
            exitPlacementMode();
          } else {
            enterPlacementMode(t.id);
          }
          renderMap('gm-map-canvas', true);
        });
        palette.appendChild(btn);
      });
    }

    updateMapModeUI();

    document.getElementById('gm-remove-token').addEventListener('click', removeSelectedToken);

    if (typeof ResizeObserver !== 'undefined') {
      var mapResizeObserver = new ResizeObserver(function () {
        scheduleMapRelayout();
      });
      mapResizeObserver.observe(canvas);
    }
  }

  /* ---- NPC panel ---- */

  function showNpcPreview(npc) {
    var preview = document.getElementById('gm-npc-preview');
    var editBtn = document.getElementById('gm-npc-edit');
    var deleteBtn = document.getElementById('gm-npc-delete');
    if (!preview) return;
    if (!npc) {
      preview.innerHTML = '<em>Add or select an NPC</em>';
      if (editBtn) editBtn.disabled = true;
      if (deleteBtn) deleteBtn.disabled = true;
      return;
    }
    preview.innerHTML = NpcSheet.renderBlockHtml(npc);
    if (editBtn) editBtn.disabled = false;
    if (deleteBtn) deleteBtn.disabled = false;
  }

  function renderNpcList(filter) {
    var list = document.getElementById('gm-npc-list');
    if (!list) return;
    var q = (filter || '').toLowerCase();
    list.innerHTML = '';
    NPC_CATALOG.filter(function (npc) {
      return !q || NpcSheet.searchText(npc).indexOf(q) >= 0;
    }).forEach(function (npc) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gm-npc-item pick-btn' + (selectedNpcId === npc.id ? ' gm-npc-item--active' : '');
      btn.textContent = npc.name;
      btn.addEventListener('click', function () {
        selectedNpcId = npc.id;
        showNpcPreview(npc);
        renderNpcList(document.getElementById('gm-npc-search').value);
      });
      list.appendChild(btn);
    });
    if (selectedNpcId && !findNpc(selectedNpcId)) {
      selectedNpcId = null;
      showNpcPreview(null);
    }
  }

  function closeNpcModal() {
    var modal = document.getElementById('npc-modal');
    var overlay = document.getElementById('modal-overlay');
    if (modal) modal.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
    npcEditId = null;
  }

  function openNpcModal(editId) {
    npcEditId = editId || null;
    var title = document.getElementById('npc-modal-title');
    var overlay = document.getElementById('modal-overlay');
    var modal = document.getElementById('npc-modal');
    if (!title || !overlay || !modal) return;
    if (editId) {
      var npc = findNpc(editId);
      if (!npc) return;
      title.textContent = 'Edit NPC';
      NpcSheet.fillForm(npc);
    } else {
      title.textContent = 'Add NPC';
      NpcSheet.fillForm(NpcSheet.emptyNpc());
    }
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    var nameEl = document.getElementById('npc-f-name');
    if (nameEl) nameEl.focus();
  }

  function saveNpcForm() {
    var data = NpcSheet.collectFromForm();
    if (!data.name) {
      alert('NPC name is required.');
      return;
    }
    if (npcEditId) {
      var existing = findNpc(npcEditId);
      if (existing) {
        var id = existing.id;
        Object.keys(data).forEach(function (key) {
          existing[key] = data[key];
        });
        existing.id = id;
        selectedNpcId = id;
      }
    } else {
      data.id = uid('npc');
      NPC_CATALOG.push(data);
      selectedNpcId = data.id;
    }
    saveState();
    closeNpcModal();
    renderNpcList(document.getElementById('gm-npc-search').value);
    showNpcPreview(findNpc(selectedNpcId));
  }

  function deleteSelectedNpc() {
    if (!selectedNpcId) return;
    var npc = findNpc(selectedNpcId);
    if (!npc) return;
    if (!confirm('Delete NPC “' + npc.name + '”?')) return;
    NPC_CATALOG = NPC_CATALOG.filter(function (n) { return n.id !== selectedNpcId; });
    selectedNpcId = null;
    saveState();
    renderNpcList(document.getElementById('gm-npc-search').value);
    showNpcPreview(null);
  }

  function initNpcPanel() {
    document.getElementById('gm-npc-add').addEventListener('click', function () { openNpcModal(null); });
    document.getElementById('gm-npc-edit').addEventListener('click', function () {
      if (selectedNpcId) openNpcModal(selectedNpcId);
    });
    document.getElementById('gm-npc-delete').addEventListener('click', deleteSelectedNpc);
    document.getElementById('gm-npc-search').addEventListener('input', function (e) {
      renderNpcList(e.target.value);
    });
    document.getElementById('npc-modal-close').addEventListener('click', closeNpcModal);
    document.getElementById('npc-modal-cancel').addEventListener('click', closeNpcModal);
    document.getElementById('npc-modal-save').addEventListener('click', saveNpcForm);
    NpcSheet.bindForm();
  }

  /* ---- Dice broadcast ---- */

  function broadcastRoll(entry) {
    var msg = {
      type: 'roll',
      die: entry.die,
      count: entry.count,
      results: entry.results.slice()
    };
    broadcast(msg);
    if (window.JOJO_STORAGE_MODE === 'server') {
      document.dispatchEvent(new CustomEvent('jojo-roll-broadcast', { detail: msg }));
    }
    try {
      var snap = JSON.parse(localStorage.getItem(SHARE_KEY) || '{}');
      snap.roll = msg;
      localStorage.setItem(SHARE_KEY, JSON.stringify(snap));
    } catch (e) { /* ignore */ }
  }

  /* ---- Snapshots & backup ---- */

  function renderSnapshotSelect() {
    var sel = document.getElementById('gm-snapshot-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Snapshots —</option>';
    (state.snapshots || []).forEach(function (snap) {
      var opt = document.createElement('option');
      opt.value = snap.id;
      var d = new Date(snap.createdAt);
      opt.textContent = snap.name + ' (' + d.toLocaleString() + ')';
      sel.appendChild(opt);
    });
  }

  function refreshAllUi() {
    renderSessionSelect();
    renderStickies();
    renderMapSelect();
    renderSnapshotSelect();
    updateMapModeUI();
    renderMap('gm-map-canvas', true);
    var searchEl = document.getElementById('gm-npc-search');
    renderNpcList(searchEl ? searchEl.value : '');
    showNpcPreview(selectedNpcId ? findNpc(selectedNpcId) : null);
    var autoOpen = document.getElementById('gm-auto-open-player');
    if (autoOpen) autoOpen.checked = !!state.autoOpenPlayer;
  }

  function saveSnapshot() {
    var name = prompt('Snapshot name:', 'Snapshot ' + ((state.snapshots || []).length + 1));
    if (!name) return;
    persistActiveMapTokens();
    syncStateNpcsFromCatalog();
    if ((state.snapshots || []).length >= GmState.MAX_SNAPSHOTS) {
      if (!confirm('Snapshot limit (' + GmState.MAX_SNAPSHOTS + ') reached. Oldest will be removed. Continue?')) return;
    }
    GmState.createSnapshot(state, name);
    saveState();
    renderSnapshotSelect();
  }

  function restoreSnapshot() {
    var sel = document.getElementById('gm-snapshot-select');
    if (!sel || !sel.value) {
      alert('Select a snapshot first.');
      return;
    }
    var snap = (state.snapshots || []).find(function (s) { return s.id === sel.value; });
    if (!snap) return;
    if (!confirm('Restore snapshot “' + snap.name + '”? Current workspace will be replaced.')) return;
    persistActiveMapTokens();
    GmState.applySnapshotData(state, snap.data);
    syncNpcCatalogFromState();
    clearTokenSelection();
    saveState();
    refreshAllUi();
    pushShareSnapshot();
  }

  function deleteSnapshot() {
    var sel = document.getElementById('gm-snapshot-select');
    if (!sel || !sel.value) {
      alert('Select a snapshot first.');
      return;
    }
    var snap = (state.snapshots || []).find(function (s) { return s.id === sel.value; });
    if (!snap) return;
    if (!confirm('Delete snapshot “' + snap.name + '”?')) return;
    state.snapshots = (state.snapshots || []).filter(function (s) { return s.id !== snap.id; });
    saveState();
    renderSnapshotSelect();
  }

  function exportWorkspaceJson() {
    persistActiveMapTokens();
    syncStateNpcsFromCatalog();
    var label = prompt('Export label (optional):', 'GM backup');
    if (label === null) return;
    var json = GmState.exportJson(state, label || undefined);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'jojo-gm-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importWorkspaceJson(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var payload = JSON.parse(reader.result);
        var data = payload.data && typeof payload.data === 'object' && payload.data.sessions
          ? payload.data
          : payload;
        var err = GmState.validateImport(data);
        if (err) {
          alert(err);
          return;
        }
        var normalized = {
          schemaVersion: data.schemaVersion || GmState.SCHEMA_VERSION,
          activeSessionId: data.activeSessionId,
          autoOpenPlayer: !!data.autoOpenPlayer,
          npcs: GmState.deepClone(data.npcs),
          globalMaps: GmState.deepClone(data.globalMaps || {}),
          sessions: GmState.deepClone(data.sessions)
        };
        Object.keys(normalized.sessions).forEach(function (sid) {
          normalized.sessions[sid] = GmState.migrateSession(normalized.sessions[sid]);
        });

        if (!confirm('Apply imported workspace? This replaces your current campaign data.')) {
          return;
        }

        GmState.applySnapshotData(state, normalized);
        syncNpcCatalogFromState();
        saveState();
        refreshAllUi();
        alert('Imported workspace applied.');
      } catch (e) {
        var message = e && e.message ? e.message : 'Import failed.';
        alert(message);
      }
    };
    reader.readAsText(file);
  }

  function initImportToolbar() {
    var importInput = document.getElementById('gm-import-json');
    if (importInput) {
      importInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (file) importWorkspaceJson(file);
        e.target.value = '';
      });
    }
    var importBtn = document.getElementById('gm-import-json-btn');
    if (importBtn) {
      importBtn.addEventListener('click', function () {
        if (importInput) importInput.click();
      });
    }
  }

  /* ---- GM init ---- */

  function initGmView() {
    state = loadState();
    syncNpcCatalogFromState();
    if (!state.sessions[state.activeSessionId]) {
      var ids = Object.keys(state.sessions);
      if (ids.length) state.activeSessionId = ids[0];
      else {
        var s = emptySession('Session 1');
        state.sessions[s.id] = s;
        state.activeSessionId = s.id;
      }
    }

    renderSessionSelect();
    initGmStickyBoard();
    renderMapSelect();
    renderSnapshotSelect();
    renderMap('gm-map-canvas', true);
    renderNpcList('');
    showNpcPreview(null);
    initNpcPanel();
    initMapEditor();
    initMapToolbar();
    initImportToolbar();
    initPanelLayout();
    initRulesModal();
    initChannelListeners();

    document.getElementById('gm-session-select').addEventListener('change', function (e) {
      persistActiveMapTokens();
      state.activeSessionId = e.target.value;
      clearTokenSelection();
      saveState();
      renderStickies();
      renderMapSelect();
      updateMapModeUI();
      renderMap('gm-map-canvas', true);
      pushShareSnapshot();
    });

    document.getElementById('gm-add-session').addEventListener('click', function () {
      var name = prompt('Session name:', 'Session ' + (Object.keys(state.sessions).length + 1));
      if (!name) return;
      var sess = emptySession(name);
      state.sessions[sess.id] = sess;
      state.activeSessionId = sess.id;
      saveState();
      renderSessionSelect();
      renderStickies();
      renderMapSelect();
      updateMapModeUI();
      renderMap('gm-map-canvas', true);
    });

    document.getElementById('gm-rename-session').addEventListener('click', function () {
      var sess = activeSession();
      if (!sess) return;
      var name = prompt('Rename session:', sess.name);
      if (!name) return;
      sess.name = name;
      saveState();
      renderSessionSelect();
    });

    document.getElementById('gm-delete-session').addEventListener('click', function () {
      var ids = Object.keys(state.sessions);
      if (ids.length <= 1) {
        alert('Keep at least one session.');
        return;
      }
      var sess = activeSession();
      if (!confirm('Delete session “' + sess.name + '”?')) return;
      delete state.sessions[sess.id];
      state.activeSessionId = Object.keys(state.sessions)[0];
      saveState();
      renderSessionSelect();
      renderStickies();
      renderMapSelect();
      updateMapModeUI();
      renderMap('gm-map-canvas', true);
    });

    var openPlayerBtn = document.getElementById('gm-open-player');
    if (openPlayerBtn) openPlayerBtn.addEventListener('click', openPlayerView);

    var autoOpen = document.getElementById('gm-auto-open-player');
    if (autoOpen) {
      autoOpen.checked = !!state.autoOpenPlayer;
      autoOpen.addEventListener('change', function (e) {
        state.autoOpenPlayer = e.target.checked;
        saveState();
      });
      if (state.autoOpenPlayer) openPlayerView();
    }

    if (typeof DiceRoller !== 'undefined') {
      var diceRoot = document.getElementById('gm-dice-root');
      if (diceRoot) {
        DiceRoller.mount(diceRoot, { showBroadcast: true, onBroadcast: broadcastRoll });
      }
    }

    setPlayerStatus(false);
  }

  /* ---- Player view ---- */

  function renderPlayerMap(tokens) {
    var canvas = document.getElementById('player-map-canvas');
    if (!canvas) return;
    syncMapGrid(canvas);
    canvas.innerHTML = '';
    (tokens || []).forEach(function (tok) {
      normalizeToken(tok, canvas);
      var meta = tokenMeta(tok.type);
      var pos = tokenPixel(tok, canvas);
      var el = document.createElement('div');
      el.className = 'gm-token ' + meta.className;
      el.style.left = pos.left + 'px';
      el.style.top = pos.top + 'px';
      el.title = meta.label;
      el.setAttribute('aria-label', meta.label);
      canvas.appendChild(el);
    });
  }

  function renderRollBanner(roll) {
    var banner = document.getElementById('player-roll-banner');
    if (!banner || !roll) {
      if (banner) banner.classList.add('hidden');
      return;
    }
    var parts = roll.results ? roll.results.join(', ') : '';
    var text = roll.count + (roll.die || 'd20') + ' → ' + parts;
    banner.textContent = text;
    banner.classList.remove('hidden');
  }

  function initPlayerView() {
    document.title = 'JoJo RPG — Player View';
    try {
      var snap = JSON.parse(localStorage.getItem(SHARE_KEY) || '{}');
      if (snap.tokens) renderPlayerMap(snap.tokens);
      if (snap.roll) renderRollBanner(snap.roll);
    } catch (e) { /* ignore */ }

    if (channel) {
      channel.onmessage = function (ev) {
        var msg = ev.data;
        if (!msg || !msg.type) return;
        if (msg.type === 'ping') {
          channel.postMessage({ type: 'pong' });
        } else if (msg.type === 'map') {
          renderPlayerMap(msg.tokens);
          try {
            var snap = JSON.parse(localStorage.getItem(SHARE_KEY) || '{}');
            snap.tokens = msg.tokens;
            localStorage.setItem(SHARE_KEY, JSON.stringify(snap));
          } catch (e) { /* ignore */ }
        } else if (msg.type === 'roll') {
          renderRollBanner(msg);
          try {
            var snap2 = JSON.parse(localStorage.getItem(SHARE_KEY) || '{}');
            snap2.roll = msg;
            localStorage.setItem(SHARE_KEY, JSON.stringify(snap2));
          } catch (e) { /* ignore */ }
        }
      };
      channel.postMessage({ type: 'pong' });
    }

    var playerCanvas = document.getElementById('player-map-canvas');
    if (playerCanvas && typeof ResizeObserver !== 'undefined') {
      var playerResizeFrame = null;
      new ResizeObserver(function () {
        if (playerResizeFrame) cancelAnimationFrame(playerResizeFrame);
        playerResizeFrame = requestAnimationFrame(function () {
          playerResizeFrame = null;
          try {
            var snap = JSON.parse(localStorage.getItem(SHARE_KEY) || '{}');
            if (snap.tokens) renderPlayerMap(snap.tokens);
          } catch (e) { /* ignore */ }
        });
      }).observe(playerCanvas);
    }
  }

  function init() {
    if (IS_PLAYER_VIEW) {
      initPlayerView();
    } else {
      initGmView();
    }
  }

  window.__jojoGmBridge = {
    getState: function () { return state; },
    getActiveSession: activeSession
  };

  init();
})();
