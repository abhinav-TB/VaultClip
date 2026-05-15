interface WorkerEnv {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>
  }
}

const HUGGING_FACE_ORIGIN = 'https://huggingface.co'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, ETag',
  'Cross-Origin-Resource-Policy': 'cross-origin',
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/hf/')) {
      return proxyHuggingFaceModelFile(request, url)
    }

    const response = await env.ASSETS.fetch(request)
    const headers = new Headers(response.headers)
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}

async function proxyHuggingFaceModelFile(request: Request, url: URL) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: CORS_HEADERS,
    })
  }

  const upstreamUrl = new URL(`${HUGGING_FACE_ORIGIN}${url.pathname.slice('/hf'.length)}${url.search}`)
  const upstreamHeaders = new Headers()
  const range = request.headers.get('Range')
  if (range) upstreamHeaders.set('Range', range)

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    redirect: 'follow',
  })
  const responseHeaders = new Headers(upstreamResponse.headers)

  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    responseHeaders.set(header, value)
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  })
}
