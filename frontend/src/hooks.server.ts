import type { Handle } from '@sveltejs/kit';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;

  // Proxy /api/* requests to the backend
  if (path.startsWith('/api/')) {
    const targetUrl = `${BACKEND_URL}${path}${event.url.search}`;
    const headers = new Headers(event.request.headers);
    headers.delete('host');

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
  }

  return resolve(event);
};
