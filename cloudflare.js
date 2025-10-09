addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request) {
  const url = new URL(request.url)
  const PREFIX = '/templeosrs'   // keep this to match your local proxy prefix

  // Only proxy paths that start with the prefix
  if (!url.pathname.startsWith(PREFIX)) {
    return new Response('Not found', { status: 404 })
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  // Build the upstream URL by stripping the prefix
  const targetPath = url.pathname.replace(PREFIX, '') + url.search
  const targetUrl = 'https://templeosrs.com' + targetPath

  // Forward the request to the upstream
  const reqHeaders = new Headers(request.headers)
  reqHeaders.delete('host') // don't forward the host header

  const proxyRequestInit = {
    method: request.method,
    headers: reqHeaders,
    redirect: 'follow'
  }

  // Only attach a body for non-GET/HEAD
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    proxyRequestInit.body = request.body
  }

  const upstreamResp = await fetch(targetUrl, proxyRequestInit)

  // Copy upstream headers and add CORS
  const respHeaders = new Headers(upstreamResp.headers)
  respHeaders.set('Access-Control-Allow-Origin', '*')
  respHeaders.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS')
  respHeaders.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers: respHeaders
  })
}
