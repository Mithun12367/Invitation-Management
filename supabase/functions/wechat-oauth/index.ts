import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providerError(payload: Record<string, unknown>): string | null {
  if (typeof payload.errcode !== "number" || payload.errcode === 0) return null;
  return typeof payload.errmsg === "string"
    ? payload.errmsg
    : "WeChat rejected the authorization.";
}

async function readProviderResponse(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  if (!isRecord(body)) {
    return jsonResponse({ error: "Request body must be an object." }, 400);
  }

  const appId = Deno.env.get("WECHAT_APP_ID")?.trim();
  const appSecret = Deno.env.get("WECHAT_APP_SECRET")?.trim();
  if (!appId || !appSecret) {
    return jsonResponse({ error: "WeChat OAuth is not configured on the server." }, 503);
  }

  if (body.action === "authorize") {
    if (typeof body.redirect_uri !== "string" || typeof body.state !== "string") {
      return jsonResponse({ error: "A redirect URI and state are required." }, 400);
    }

    const requestOrigin = request.headers.get("origin");
    let redirectUri: URL;
    try {
      redirectUri = new URL(body.redirect_uri);
    } catch {
      return jsonResponse({ error: "The redirect URI is invalid." }, 400);
    }
    if (
      !requestOrigin ||
      redirectUri.origin !== requestOrigin ||
      !redirectUri.pathname.startsWith("/public/") ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(body.state)
    ) {
      return jsonResponse({ error: "The OAuth redirect or state is invalid." }, 400);
    }

    const authorization = new URLSearchParams({
      appid: appId,
      redirect_uri: redirectUri.toString(),
      response_type: "code",
      scope: "snsapi_userinfo",
      state: body.state,
    });
    return jsonResponse({
      authorizationUrl: `https://open.weixin.qq.com/connect/oauth2/authorize?${authorization.toString()}#wechat_redirect`,
    });
  }

  if (body.action !== "profile" || typeof body.code !== "string" || body.code.length > 512) {
    return jsonResponse({ error: "A valid OAuth code is required." }, 400);
  }

  const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  tokenUrl.search = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    code: body.code,
    grant_type: "authorization_code",
  }).toString();

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(tokenUrl);
  } catch {
    return jsonResponse({ error: "Could not connect to WeChat." }, 502);
  }
  const tokenData = await readProviderResponse(tokenResponse);
  if (!tokenResponse.ok || !tokenData) {
    return jsonResponse({ error: "WeChat returned an invalid token response." }, 502);
  }
  const tokenError = providerError(tokenData);
  if (tokenError) return jsonResponse({ error: `WeChat authorization failed: ${tokenError}` }, 400);
  if (typeof tokenData.access_token !== "string" || typeof tokenData.openid !== "string") {
    return jsonResponse({ error: "WeChat did not return a usable access token." }, 502);
  }

  const profileUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
  profileUrl.search = new URLSearchParams({
    access_token: tokenData.access_token,
    openid: tokenData.openid,
    lang: "zh_CN",
  }).toString();

  let profileResponse: Response;
  try {
    profileResponse = await fetch(profileUrl);
  } catch {
    return jsonResponse({ error: "Could not retrieve the WeChat profile." }, 502);
  }
  const profile = await readProviderResponse(profileResponse);
  if (!profileResponse.ok || !profile) {
    return jsonResponse({ error: "WeChat returned an invalid profile response." }, 502);
  }
  const profileError = providerError(profile);
  if (profileError) return jsonResponse({ error: `WeChat profile lookup failed: ${profileError}` }, 400);
  if (typeof profile.nickname !== "string" || !profile.nickname.trim()) {
    return jsonResponse({ error: "WeChat did not provide a display name." }, 404);
  }

  return jsonResponse({ nickname: profile.nickname.trim() });
});
