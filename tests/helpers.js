import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;

function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  return Buffer.from(bytes).toString("base64url");
}

export async function makeKeys(kid = "test-kid") {
  const pair = await subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
  const jwk = await subtle.exportKey("jwk", pair.publicKey);
  return { privateKey: pair.privateKey, jwks: { keys: [{ ...jwk, kid, alg: "RS256", use: "sig" }] }, kid };
}

export async function signToken(keys, claims = {}, { project = "pipoca-central", expiresIn = 3600, kid } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: kid || keys.kid };
  const payload = {
    iss: `https://securetoken.google.com/${project}`,
    aud: project,
    sub: "uid-123",
    iat: now - 10,
    auth_time: now - 10,
    exp: now + expiresIn,
    ...claims,
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = await subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

export function installFetch(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    calls.push({ url, init });
    for (const [pattern, handler] of routes) {
      if (url.includes(pattern)) return handler(url, init);
    }
    return new Response("not mocked: " + url, { status: 599 });
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
}
