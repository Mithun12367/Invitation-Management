
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getServerKey(): string | null {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (
    serviceRoleKey &&
    (serviceRoleKey.startsWith("eyJ") ||
      serviceRoleKey.startsWith("sb_secret_"))
  ) {
    return serviceRoleKey;
  }

  const secretEnv = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();
  if (!secretEnv) return null;

  if (secretEnv.startsWith("sb_secret_") || secretEnv.startsWith("eyJ")) {
    return secretEnv;
  }

  try {
    const parsed: unknown = JSON.parse(secretEnv);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed).find(
        (value): value is string =>
          typeof value === "string" &&
          (value.startsWith("sb_secret_") || value.startsWith("eyJ")),
      ) ?? null;
    }
  } catch {
    console.error("Invalid SUPABASE_SECRET_KEYS configuration");
  }

  return null;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405
    );
  }

  try {
    const body = await req.json();
    const token = body?.token;

    if (!token || typeof token !== "string") {
      return jsonResponse(
        { error: "Missing or invalid token" },
        400
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = getServerKey();

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");

      return jsonResponse(
        { error: "Server configuration error" },
        500
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
    );

    const tokenHash = await hashToken(token);

    const { data: invitation, error: invError } = await supabase
      .from("invitations")
      .select(`
        id,
        event_id,
        guest_id,
        template_id,
        status,
        qr_image_url,
        letter_content,
        animation_url,
        landing_page_config,
        created_at,
        guest:guests (
          id,
          full_name,
          designation,
          department,
          personalized_message
        ),
        event:events (
          id,
          title,
          description,
          event_date,
          starts_at,
          ends_at,
          countdown_at,
          event_timezone,
          venue,
          address,
          organizer,
          poster_url,
          background_music_url
        )
      `)
      .eq("qr_token_hash", tokenHash)
      .maybeSingle();

    if (invError) {
      console.error("Invitation lookup error:", invError);

      return jsonResponse(
        {
          error: "Failed to retrieve invitation",
          details: invError.message,
        },
        500
      );
    }

    if (!invitation) {
      return jsonResponse(
        { error: "Invitation not found" },
        404
      );
    }

    if (invitation.status === "revoked") {
      return jsonResponse(
        { error: "This invitation has been revoked" },
        403
      );
    }

    if (invitation.status === "expired") {
      return jsonResponse(
        { error: "This invitation has expired" },
        403
      );
    }

    const { data: existingRsvp, error: rsvpError } = await supabase
      .from("rsvps")
      .select("id")
      .eq("guest_id", invitation.guest_id)
      .eq("event_id", invitation.event_id)
      .eq("invitation_category", "teacher")
      .limit(1)
      .maybeSingle();

    if (rsvpError) {
      console.error("Invitation RSVP lookup error:", rsvpError);

      return jsonResponse(
        {
          error: "Failed to retrieve RSVP status",
          details: rsvpError.message,
        },
        500
      );
    }

    const eventData = invitation.event as
      | Record<string, unknown>
      | null;

    const { error: scanError } = await supabase
      .from("qr_scans")
      .insert({
        invitation_id: invitation.id,
        event_id: eventData?.id ?? null,
        invitation_category: "teacher",
      });

    if (scanError) {
      console.error(
        "QR scan recording error:",
        scanError.message
      );
    }

    const teacher = invitation.guest;

    return jsonResponse({
      valid: true,
      rsvp_submitted: Boolean(existingRsvp),
      invitation: {
        ...invitation,
        teacher,
      },
      teacher,
      event: eventData,
    });

  } catch (err) {
    console.error("VALIDATE INVITATION ERROR:", err);

    return jsonResponse(
      {
        error: "Internal server error",
        details: err instanceof Error
          ? err.message
          : String(err),
      },
      500
    );
  }
});
