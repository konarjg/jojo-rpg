(function (global) {
  'use strict';

  var SCHEMA_VERSION = 2;
  var NPC_STORAGE_KEY = 'jojo-gm:npcs';
  var MAX_SNAPSHOTS = 20;

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function emptyMap(name) {
    return { id: uid('map'), name: name || 'Map 1', tokens: [] };
  }

  function emptySession(name) {
    var map = emptyMap('Map 1');
    return {
      id: uid('sess'),
      name: name || 'Session 1',
      createdAt: Date.now(),
      notes: '',
      stickies: [],
      maps: {},
      activeMapId: map.id,
      activeMapScope: 'session'
    };
  }

  function emptyState() {
    var session = emptySession('Session 1');
    session.maps[session.activeMapId] = emptyMap('Map 1');
    session.maps[session.activeMapId].id = session.activeMapId;
    return {
      schemaVersion: SCHEMA_VERSION,
      activeSessionId: session.id,
      autoOpenPlayer: false,
      npcs: [],
      globalMaps: {},
      snapshots: [],
      sessions: {}
    };
  }

  function migrateSession(sess) {
    if (!sess.createdAt) sess.createdAt = Date.now();
    if (!sess.maps) {
      var mapId = uid('map');
      var tokens = (sess.map && sess.map.tokens) ? sess.map.tokens.slice() : [];
      sess.maps = {};
      sess.maps[mapId] = { id: mapId, name: 'Map 1', tokens: tokens };
      sess.activeMapId = mapId;
      sess.activeMapScope = 'session';
      delete sess.map;
    }
    if (!sess.activeMapId || !sess.maps[sess.activeMapId]) {
      var ids = Object.keys(sess.maps);
      if (ids.length) {
        sess.activeMapId = ids[0];
        sess.activeMapScope = 'session';
      } else {
        var fresh = emptyMap('Map 1');
        sess.maps[fresh.id] = fresh;
        sess.activeMapId = fresh.id;
        sess.activeMapScope = 'session';
      }
    }
    if (!sess.activeMapScope) sess.activeMapScope = 'session';
    return sess;
  }

  function loadLegacyNpcs() {
    try {
      var raw = localStorage.getItem(NPC_STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      if (typeof NpcSheet !== 'undefined') {
        return parsed.map(function (n) { return NpcSheet.migrate(n); });
      }
      return parsed;
    } catch (e) {
      return [];
    }
  }

  function migrateState(raw) {
    if (!raw || !raw.sessions) {
      var fresh = emptyState();
      var s = emptySession('Session 1');
      var m = emptyMap('Map 1');
      s.maps[m.id] = m;
      s.activeMapId = m.id;
      fresh.sessions[s.id] = migrateSession(s);
      fresh.activeSessionId = s.id;
      fresh.npcs = loadLegacyNpcs();
      return fresh;
    }

    if (!raw.schemaVersion || raw.schemaVersion < SCHEMA_VERSION) {
      raw.schemaVersion = SCHEMA_VERSION;
    }
    if (!raw.globalMaps) raw.globalMaps = {};
    if (!raw.snapshots) raw.snapshots = [];
    if (!raw.npcs) raw.npcs = loadLegacyNpcs();

    Object.keys(raw.sessions).forEach(function (sid) {
      raw.sessions[sid] = migrateSession(raw.sessions[sid]);
    });

    return raw;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function workspacePayload(state) {
    return {
      schemaVersion: SCHEMA_VERSION,
      activeSessionId: state.activeSessionId,
      autoOpenPlayer: !!state.autoOpenPlayer,
      npcs: deepClone(state.npcs || []),
      globalMaps: deepClone(state.globalMaps || {}),
      snapshots: deepClone(state.snapshots || []),
      sessions: deepClone(state.sessions || {})
    };
  }

  function validateImport(payload) {
    if (!payload || typeof payload !== 'object') return 'Invalid file.';
    if (!payload.sessions || typeof payload.sessions !== 'object') return 'Missing sessions.';
    if (!payload.npcs || !Array.isArray(payload.npcs)) return 'Missing npcs array.';
    return null;
  }

  function createSnapshot(state, name) {
    if (!state.snapshots) state.snapshots = [];
    while (state.snapshots.length >= MAX_SNAPSHOTS) {
      state.snapshots.pop();
    }
    var snap = {
      id: uid('snap'),
      name: name || 'Snapshot',
      createdAt: Date.now(),
      data: workspacePayload(state)
    };
    state.snapshots.unshift(snap);
    return snap;
  }

  function applySnapshotData(state, data) {
    state.schemaVersion = SCHEMA_VERSION;
    state.activeSessionId = data.activeSessionId;
    state.autoOpenPlayer = !!data.autoOpenPlayer;
    state.npcs = deepClone(data.npcs || []);
    state.globalMaps = deepClone(data.globalMaps || {});
    state.sessions = deepClone(data.sessions || {});
    Object.keys(state.sessions).forEach(function (sid) {
      state.sessions[sid] = migrateSession(state.sessions[sid]);
    });
    if (!state.sessions[state.activeSessionId]) {
      var ids = Object.keys(state.sessions);
      state.activeSessionId = ids.length ? ids[0] : null;
    }
    return state;
  }

  function getActiveMapRef(sess) {
    if (!sess) return null;
    migrateSession(sess);
    return { scope: sess.activeMapScope || 'session', id: sess.activeMapId };
  }

  function resolveMap(state, sess, ref) {
    if (!ref) ref = getActiveMapRef(sess);
    if (!ref) return null;
    if (ref.scope === 'global') {
      return state.globalMaps[ref.id] || null;
    }
    return sess.maps[ref.id] || null;
  }

  function getActiveMap(state, sess) {
    return resolveMap(state, sess, getActiveMapRef(sess));
  }

  function getActiveTokens(state, sess) {
    var map = getActiveMap(state, sess);
    return map ? map.tokens : [];
  }

  function setActiveTokens(state, sess, tokens) {
    var map = getActiveMap(state, sess);
    if (map) map.tokens = tokens;
  }

  function persistTokensFromSession(state, sess) {
    var ref = getActiveMapRef(sess);
    var map = resolveMap(state, sess, ref);
    if (!map) return;
    if (ref.scope === 'global') {
      state.globalMaps[ref.id] = map;
    } else {
      sess.maps[ref.id] = map;
    }
  }

  function switchMap(state, sess, scope, mapId) {
    persistTokensFromSession(state, sess);
    sess.activeMapScope = scope;
    sess.activeMapId = mapId;
    return getActiveMap(state, sess);
  }

  function listSessionMaps(sess) {
    migrateSession(sess);
    return Object.values(sess.maps);
  }

  function listGlobalMaps(state) {
    return Object.values(state.globalMaps || {});
  }

  function addSessionMap(sess, name) {
    migrateSession(sess);
    var map = emptyMap(name || 'New map');
    sess.maps[map.id] = map;
    return map;
  }

  function addGlobalMap(state, name, tokens) {
    var map = emptyMap(name || 'Global map');
    if (tokens) map.tokens = tokens.slice();
    state.globalMaps[map.id] = map;
    return map;
  }

  function deleteMap(state, sess, scope, mapId) {
    if (scope === 'global') {
      delete state.globalMaps[mapId];
      if (sess.activeMapScope === 'global' && sess.activeMapId === mapId) {
        var sessionMaps = listSessionMaps(sess);
        if (sessionMaps.length) {
          sess.activeMapScope = 'session';
          sess.activeMapId = sessionMaps[0].id;
        }
      }
      return;
    }
    delete sess.maps[mapId];
    var remaining = listSessionMaps(sess);
    if (!remaining.length) {
      var map = emptyMap('Map 1');
      sess.maps[map.id] = map;
      sess.activeMapId = map.id;
      sess.activeMapScope = 'session';
    } else if (sess.activeMapId === mapId && sess.activeMapScope === 'session') {
      sess.activeMapId = remaining[0].id;
    }
  }

  function exportJson(state, label) {
    var payload = workspacePayload(state);
    payload.exportedAt = Date.now();
    if (label) payload.name = label;
    return JSON.stringify(payload, null, 2);
  }

  function migrateNpcs(npcs) {
    if (!Array.isArray(npcs)) return [];
    if (typeof NpcSheet === 'undefined') return npcs;
    return npcs.map(function (n) { return NpcSheet.migrate(n); });
  }

  global.GmState = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    MAX_SNAPSHOTS: MAX_SNAPSHOTS,
    NPC_STORAGE_KEY: NPC_STORAGE_KEY,
    uid: uid,
    emptyMap: emptyMap,
    emptySession: emptySession,
    emptyState: emptyState,
    migrateState: migrateState,
    migrateSession: migrateSession,
    workspacePayload: workspacePayload,
    validateImport: validateImport,
    createSnapshot: createSnapshot,
    applySnapshotData: applySnapshotData,
    getActiveMapRef: getActiveMapRef,
    resolveMap: resolveMap,
    getActiveMap: getActiveMap,
    getActiveTokens: getActiveTokens,
    setActiveTokens: setActiveTokens,
    persistTokensFromSession: persistTokensFromSession,
    switchMap: switchMap,
    listSessionMaps: listSessionMaps,
    listGlobalMaps: listGlobalMaps,
    addSessionMap: addSessionMap,
    addGlobalMap: addGlobalMap,
    deleteMap: deleteMap,
    exportJson: exportJson,
    migrateNpcs: migrateNpcs,
    deepClone: deepClone
  };
})(typeof window !== 'undefined' ? window : this);
