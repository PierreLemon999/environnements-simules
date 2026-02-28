import type { Handle } from '@sveltejs/kit';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function proxyToBackend(event: Parameters<Handle>[0]['event'], targetPath: string): Promise<Response> {
  const targetUrl = `${BACKEND_URL}${targetPath}${event.url.search}`;
  const headers = new Headers(event.request.headers);
  headers.delete('host');

  try {
    const response = await fetch(targetUrl, {
      method: event.request.method,
      headers,
      body: event.request.method !== 'GET' && event.request.method !== 'HEAD'
        ? await event.request.arrayBuffer()
        : undefined,
      // @ts-ignore - duplex needed for streaming
      duplex: 'half',
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err) {
    console.error('[SSR Proxy] Backend connection failed:', err);
    return new Response(JSON.stringify({ error: 'Backend unavailable', code: 502 }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;

  // Proxy /api/* requests to the backend
  if (path.startsWith('/api/')) {
    return proxyToBackend(event, path);
  }

  // Proxy /demo-api/* requests to backend's /demo/* (for iframe content)
  if (path.startsWith('/demo-api/')) {
    const rewrittenPath = path.replace(/^\/demo-api/, '/demo');
    return proxyToBackend(event, rewrittenPath);
  }

  // Proxy /uploads/* to backend (static file serving)
  if (path.startsWith('/uploads/')) {
    return proxyToBackend(event, path);
  }

  return resolve(event);
};
