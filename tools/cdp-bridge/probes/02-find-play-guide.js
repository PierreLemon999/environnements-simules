/**
 * Probe 02: Hunt for any way to launch a guide
 *
 * Strategies:
 * - Intercept internal React dispatch/setState calls
 * - Look for URL parameters the player recognizes
 * - Check for postMessage listeners
 * - Inspect event listeners on the player host
 * - Look for any "play", "start", "launch", "open" methods in the fiber tree
 */

const result = {
  url: location.href,
  strategies: {},
};

// Strategy 1: Check if LemonPlayer.set() or mergeConfig() accept guide-related params
if (window.LemonPlayer) {
  const lp = window.LemonPlayer;
  result.strategies.configInspection = {};

  // Check current config
  if (lp.config) {
    try {
      result.strategies.configInspection.currentConfig = JSON.parse(JSON.stringify(lp.config));
    } catch {
      result.strategies.configInspection.currentConfig = Object.keys(lp.config);
    }
  }

  // Check if set() source reveals params
  if (typeof lp.set === 'function') {
    result.strategies.configInspection.setSource = lp.set.toString().substring(0, 500);
  }
  if (typeof lp.mergeConfig === 'function') {
    result.strategies.configInspection.mergeConfigSource = lp.mergeConfig.toString().substring(0, 500);
  }
  if (typeof lp.start === 'function') {
    result.strategies.configInspection.startSource = lp.start.toString().substring(0, 500);
  }
  if (typeof lp.startAsync === 'function') {
    result.strategies.configInspection.startAsyncSource = lp.startAsync.toString().substring(0, 500);
  }
}

// Strategy 2: Check window message listeners (postMessage API)
result.strategies.messageListeners = {
  note: 'Cannot enumerate addEventListener listeners, but checking known patterns',
};
// Check if there's a BroadcastChannel
if (typeof BroadcastChannel !== 'undefined') {
  result.strategies.broadcastChannel = true;
}

// Strategy 3: Look for URL hash/query params the player might use
result.strategies.urlParams = {
  currentURL: location.href,
  hash: location.hash,
  search: location.search,
  params: Object.fromEntries(new URLSearchParams(location.search)),
};

// Strategy 4: Deep dive into React fiber tree - find any "play" or "guide" related functions
const host = document.getElementById('lemon-learning-player');
if (host) {
  const fiberKey = Object.keys(host).find(k => k.startsWith('__reactFiber$'));
  if (fiberKey) {
    const fiber = host[fiberKey];
    const findings = [];

    function searchFiber(f, depth = 0, path = '') {
      if (!f || depth > 20) return;

      const name = f.type
        ? (typeof f.type === 'string' ? f.type : (f.type.name || f.type.displayName || '?'))
        : '?';
      const currentPath = path ? `${path} > ${name}` : name;

      // Check memoizedProps for callbacks
      if (f.memoizedProps && typeof f.memoizedProps === 'object') {
        for (const [key, val] of Object.entries(f.memoizedProps)) {
          if (typeof val === 'function') {
            const fnName = val.name || 'anon';
            const lower = (key + fnName).toLowerCase();
            if (lower.includes('play') || lower.includes('guide') || lower.includes('launch') ||
                lower.includes('start') || lower.includes('open') || lower.includes('navigate')) {
              findings.push({
                path: currentPath,
                propKey: key,
                fnName,
                source: val.toString().substring(0, 300),
              });
            }
          }
        }
      }

      // Check hooks (memoizedState chain)
      let hookState = f.memoizedState;
      let hookIdx = 0;
      while (hookState && hookIdx < 20) {
        const ms = hookState.memoizedState;
        if (typeof ms === 'function') {
          const fnName = ms.name || 'anon';
          const lower = fnName.toLowerCase();
          if (lower.includes('play') || lower.includes('guide') || lower.includes('launch') ||
              lower.includes('start') || lower.includes('open') || lower.includes('select')) {
            findings.push({
              path: currentPath,
              hookIdx,
              fnName,
              source: ms.toString().substring(0, 300),
            });
          }
        }
        // Check if hook state is an object with relevant methods
        if (ms && typeof ms === 'object' && !Array.isArray(ms)) {
          for (const [key, val] of Object.entries(ms)) {
            if (typeof val === 'function') {
              const lower = (key + (val.name || '')).toLowerCase();
              if (lower.includes('play') || lower.includes('guide') || lower.includes('launch') ||
                  lower.includes('start') || lower.includes('dispatch')) {
                findings.push({
                  path: currentPath,
                  hookIdx,
                  stateKey: key,
                  fnName: val.name || 'anon',
                  source: val.toString().substring(0, 300),
                });
              }
            }
          }
        }
        hookState = hookState.next;
        hookIdx++;
      }

      if (f.child) searchFiber(f.child, depth + 1, currentPath);
      if (f.sibling) searchFiber(f.sibling, depth, path);
    }

    searchFiber(fiber);
    result.strategies.fiberSearch = {
      findingsCount: findings.length,
      findings: findings.slice(0, 30),
    };
  }
}

// Strategy 5: Check for custom events the player listens to
result.strategies.customEvents = {};
if (host) {
  // Try dispatching a known event pattern and see if anything reacts
  // (passive check - just look for getEventListeners equivalent)
  const events = typeof getEventListeners === 'function' ? getEventListeners(host) : 'getEventListeners not available (not in CDP console context)';
  result.strategies.customEvents.hostListeners = events;
}

// Strategy 6: Check for Redux/Zustand/other state stores
result.strategies.stateStores = {};
if (window.__REDUX_DEVTOOLS_EXTENSION__) {
  result.strategies.stateStores.redux = true;
}
// Check for any store-like globals
for (const key of Object.keys(window)) {
  const lower = key.toLowerCase();
  if (lower.includes('store') || lower.includes('state') || lower.includes('redux') || lower.includes('zustand')) {
    result.strategies.stateStores[key] = typeof window[key];
  }
}

// Strategy 7: Monkey-patch to intercept next guide launch
// Set up an interceptor that will capture the next call
result.strategies.interceptorReady = false;
if (window.LemonPlayer && !window.__llProbeInterceptor) {
  // We'll patch common methods to log calls
  window.__llProbeInterceptor = { calls: [] };
  const methodsToWatch = ['set', 'start', 'startAsync', 'mergeConfig', 'show', 'render'];
  for (const method of methodsToWatch) {
    if (typeof window.LemonPlayer[method] === 'function') {
      const original = window.LemonPlayer[method].bind(window.LemonPlayer);
      window.LemonPlayer[method] = function (...args) {
        window.__llProbeInterceptor.calls.push({
          method,
          args: JSON.parse(JSON.stringify(args)),
          timestamp: Date.now(),
        });
        return original(...args);
      };
    }
  }
  result.strategies.interceptorReady = true;
  result.strategies.interceptorNote = 'Interceptor installed. Launch a guide manually in the UI, then run probe 03 to see captured calls.';
}

return result;
