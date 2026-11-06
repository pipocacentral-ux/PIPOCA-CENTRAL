const ALLOWED_PATHS = [
  /^search\/(movie|tv|person|multi)$/,
  /^(movie|tv)\/\d+$/,
  /^(movie|tv)\/\d+\/(credits|aggregate_credits|videos|watch\/providers|similar|recommendations|external_ids|images|release_dates|content_ratings)$/,
  /^tv\/\d+\/season\/\d+$/,
  /^person\/\d+$/,
  /^person\/\d+\/(combined_credits|movie_credits|tv_credits|images)$/,
  /^trending\/(movie|tv|person|all)\/(day|week)$/,
  /^discover\/(movie|tv)$/,
  /^genre\/(movie|tv)\/list$/,
  /^movie\/(popular|top_rated|now_playing|upcoming)$/,
  /^tv\/(popular|top_rated|on_the_air|airing_today)$/,
  /^configuration$/,
  /^watch\/providers\/(movie|tv|regions)$/,
];

const CACHE_SECONDS = 600;

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function reply(data, status, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

async function sameSecret(a, b) {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

function upstreamUrl(path, searchParams, env) {
  const params = new URLSearchParams();
  for (const [key, value] of searchParams) {
    if (key.toLowerCase() === "api_key") continue;
    params.append(key, value);
  }
  if (!params.has("language")) params.set("language", "pt-BR");
  params.set("include_adult", "false");
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.search = params.toString();
  return url;
}

export default {
  async fetch(request, env, ctx) {
    const origin = (request.headers.get("Origin") || "").replace(/\/+$/, "");
    const origins = allowedOrigins(env);
    const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const internal = await sameSecret(bearer, env.INTERNAL_SECRET);

    let cors = {};
    if (origin) {
      if (!origins.includes(origin)) return reply({ error: "Origem não autorizada" }, 403);
      cors = corsHeaders(origin);
    } else if (!internal) {
      return reply({ error: "Acesso não autorizado" }, 403);
    }

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET") return reply({ error: "Método não permitido" }, 405, cors);

    const url = new URL(request.url);
    if (url.pathname === "/health") return reply({ ok: true }, 200, cors);

    const match = url.pathname.match(/^\/tmdb\/(.+)$/);
    const path = match ? match[1].replace(/\/+$/, "") : "";
    if (!path || !ALLOWED_PATHS.some((re) => re.test(path))) return reply({ error: "Rota não permitida" }, 404, cors);
    if (!env.TMDB_API_KEY) return reply({ error: "TMDB_API_KEY não configurada no Worker" }, 503, cors);

    const target = upstreamUrl(path, url.searchParams, env);
    const cacheKey = new Request(target.toString(), { method: "GET" });
    const cache = caches.default;

    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
      headers.set("X-Cache", "HIT");
      return new Response(cached.body, { status: cached.status, headers });
    }

    const key = env.TMDB_API_KEY;
    const upstreamHeaders = { Accept: "application/json" };
    if (key.startsWith("eyJ")) upstreamHeaders.Authorization = `Bearer ${key}`;
    else target.searchParams.set("api_key", key);

    let upstream;
    try {
      upstream = await fetch(target.toString(), { headers: upstreamHeaders, signal: AbortSignal.timeout(9000) });
    } catch {
      return reply({ error: "TMDB não respondeu" }, 504, cors);
    }

    const body = await upstream.text();
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${upstream.ok ? CACHE_SECONDS : 30}`,
      "X-Cache": "MISS",
      ...cors,
    };
    const response = new Response(body, { status: upstream.status, headers });

    if (upstream.ok) {
      const storable = new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
      });
      ctx.waitUntil(cache.put(cacheKey, storable));
    }
    return response;
  },
};
