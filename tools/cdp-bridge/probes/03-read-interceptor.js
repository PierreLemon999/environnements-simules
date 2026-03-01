/**
 * Probe 03: Read intercepted calls
 *
 * After probe 02 installs interceptors, manually launch a guide in the LL UI,
 * then run this probe to see what methods were called and with what arguments.
 */

const result = {
  url: location.href,
  timestamp: new Date().toISOString(),
};

if (window.__llProbeInterceptor) {
  result.interceptor = {
    totalCalls: window.__llProbeInterceptor.calls.length,
    calls: window.__llProbeInterceptor.calls,
  };

  if (window.__llProbeInterceptor.calls.length === 0) {
    result.hint = 'No calls captured yet. Launch a guide in the LL UI first, then re-run this probe.';
  }
} else {
  result.interceptor = null;
  result.hint = 'Interceptor not installed. Run probe 02 first.';
}

return result;
