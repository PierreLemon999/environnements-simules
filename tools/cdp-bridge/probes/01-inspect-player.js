/**
 * Probe 01: Full inspection of window.LemonPlayer
 *
 * Dumps everything we can find about the LL player:
 * - LemonPlayer object (own props, prototype methods)
 * - Shadow DOM structure
 * - React Query cache (guides list)
 * - Global LL-related variables
 * - React fiber tree hints
 */

const result = {
  url: location.href,
  timestamp: new Date().toISOString(),
};

// 1. window.LemonPlayer
if (window.LemonPlayer) {
  const lp = window.LemonPlayer;
  result.lemonPlayer = {
    exists: true,
    ownKeys: Object.keys(lp),
    protoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(lp)),
    type: typeof lp,
    constructor: lp.constructor?.name,
    // Dump values of simple props
    props: {},
  };
  for (const key of Object.keys(lp)) {
    const val = lp[key];
    const t = typeof val;
    if (t === 'function') {
      result.lemonPlayer.props[key] = `[Function: ${val.name || 'anonymous'}, args: ${val.length}]`;
    } else if (t === 'object' && val !== null) {
      try {
        result.lemonPlayer.props[key] = JSON.parse(JSON.stringify(val));
      } catch {
        result.lemonPlayer.props[key] = `[Object: ${val.constructor?.name || 'unknown'}]`;
      }
    } else {
      result.lemonPlayer.props[key] = val;
    }
  }
  // Also check proto methods
  result.lemonPlayer.protoMethods = {};
  for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(lp))) {
    if (key === 'constructor') continue;
    const val = lp[key];
    if (typeof val === 'function') {
      result.lemonPlayer.protoMethods[key] = `[Function: args=${val.length}]`;
    }
  }
} else {
  result.lemonPlayer = { exists: false };
}

// 2. Shadow DOM inspection
const host = document.getElementById('lemon-learning-player');
if (host) {
  const shadow = host.shadowRoot;
  result.shadowDOM = {
    hostFound: true,
    shadowRootExists: !!shadow,
    shadowRootMode: shadow?.mode,
  };
  if (shadow) {
    // Recursive DOM dump (limited depth)
    function dumpNode(node, depth = 0) {
      if (depth > 5) return { tag: '...truncated...' };
      const info = {
        tag: node.tagName?.toLowerCase() || '#text',
      };
      if (node.id) info.id = node.id;
      if (node.className && typeof node.className === 'string') info.class = node.className;
      if (node.textContent && node.children?.length === 0) {
        const text = node.textContent.trim();
        if (text) info.text = text.substring(0, 100);
      }
      // Check for nested shadow roots
      if (node.shadowRoot) {
        info.nestedShadowRoot = true;
        info.shadowChildren = Array.from(node.shadowRoot.children).map(c => dumpNode(c, depth + 1));
      }
      if (node.children?.length > 0) {
        info.children = Array.from(node.children).map(c => dumpNode(c, depth + 1));
      }
      return info;
    }
    result.shadowDOM.tree = Array.from(shadow.children).map(c => dumpNode(c));
    result.shadowDOM.totalElements = shadow.querySelectorAll('*').length;
    // Look for text content anywhere
    const allText = [];
    shadow.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && el.textContent?.trim()) {
        allText.push({ tag: el.tagName, text: el.textContent.trim().substring(0, 200) });
      }
    });
    result.shadowDOM.textElements = allText;
  }
} else {
  result.shadowDOM = { hostFound: false };
}

// 3. React Query cache (guide list)
try {
  const cache = localStorage.getItem('REACT_QUERY_OFFLINE_CACHE');
  if (cache) {
    const parsed = JSON.parse(cache);
    const queries = parsed.clientState?.queries || [];
    result.reactQueryCache = {
      exists: true,
      queryCount: queries.length,
      queryKeys: queries.map(q => ({
        key: q.queryKey,
        dataType: typeof q.state?.data,
        dataPreview: Array.isArray(q.state?.data)
          ? `Array[${q.state.data.length}]`
          : typeof q.state?.data === 'object'
            ? Object.keys(q.state.data).slice(0, 10)
            : String(q.state?.data).substring(0, 100),
      })),
    };
    // Find guides specifically
    const guideQuery = queries.find(q =>
      JSON.stringify(q.queryKey).toLowerCase().includes('guide')
    );
    if (guideQuery?.state?.data) {
      const guides = Array.isArray(guideQuery.state.data) ? guideQuery.state.data : [];
      result.guides = guides.slice(0, 10).map(g => ({
        id: g.id || g._id,
        name: g.name || g.title,
        steps: g.steps?.length,
        type: g.type,
        // Grab any keys that look useful
        keys: Object.keys(g).slice(0, 20),
      }));
    }
  } else {
    result.reactQueryCache = { exists: false };
  }
} catch (e) {
  result.reactQueryCache = { error: e.message };
}

// 4. Global LL-related variables
result.globals = {};
const llPatterns = ['lemon', 'Lemon', 'LEMON', 'll_', 'LL_', 'guide', 'Guide'];
for (const key of Object.keys(window)) {
  if (llPatterns.some(p => key.includes(p))) {
    const val = window[key];
    const t = typeof val;
    if (t === 'function') {
      result.globals[key] = `[Function: args=${val.length}]`;
    } else if (t === 'object' && val !== null) {
      try {
        result.globals[key] = { type: val.constructor?.name, keys: Object.keys(val).slice(0, 10) };
      } catch {
        result.globals[key] = `[Object]`;
      }
    } else {
      result.globals[key] = val;
    }
  }
}

// 5. React fiber inspection on the player container
if (host) {
  const fiberKey = Object.keys(host).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  result.reactFiber = {
    fiberKeyFound: !!fiberKey,
    fiberKey: fiberKey || null,
  };
  if (fiberKey) {
    const fiber = host[fiberKey];
    // Walk up to find interesting hooks
    function walkFiber(f, depth = 0) {
      if (!f || depth > 15) return [];
      const info = [];
      if (f.type) {
        const name = typeof f.type === 'string' ? f.type : (f.type.name || f.type.displayName || 'Anonymous');
        const hooks = [];
        // Check memoizedState for hooks
        let hookState = f.memoizedState;
        let hookIdx = 0;
        while (hookState && hookIdx < 10) {
          if (hookState.queue?.lastRenderedReducer) {
            hooks.push({ idx: hookIdx, type: 'reducer' });
          }
          if (typeof hookState.memoizedState === 'function') {
            hooks.push({ idx: hookIdx, type: 'callback', name: hookState.memoizedState.name });
          }
          hookState = hookState.next;
          hookIdx++;
        }
        info.push({ component: name, depth, hooksCount: hookIdx, hooks: hooks.slice(0, 5) });
      }
      if (f.child) info.push(...walkFiber(f.child, depth + 1));
      if (f.sibling) info.push(...walkFiber(f.sibling, depth));
      return info;
    }
    result.reactFiber.componentTree = walkFiber(fiber).slice(0, 50);
  }
}

return result;
