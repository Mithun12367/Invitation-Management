
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

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  // Handle browser CORS preflight before processing anything else.
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

    const {
      invitation_id,
      token,
      event_id,
      guest_name,
      response,
      guest_count,
      contact_information,
      invitation_category,
    } = body;

    // ----------------------------------------
    // VALIDATION
    // ----------------------------------------

    if (!event_id || typeof event_id !== "string") {
      return jsonResponse(
        { error: "event_id is required" },
        400
      );
    }

    if (
      !response ||
      !["accepted", "maybe", "declined"].includes(response)
    ) {
      return jsonResponse(
        {
          error:
            "response must be accepted, maybe, or declined",
        },
        400
      );
    }

    if (
      !invitation_category ||
      !["teacher", "public"].includes(invitation_category)
    ) {
      return jsonResponse(
        {
          error:
            "invitation_category must be teacher or public",
        },
        400
      );
    }

    let teacherGuestId: string | null = null;

    if (invitation_category === "teacher") {
      if (!invitation_id || typeof invitation_id !== "string") {
        return jsonResponse(
          { error: "invitation_id is required for teacher RSVPs" },
          400
        );
      }

      if (!token || typeof token !== "string") {
        return jsonResponse(
          { error: "token is required for teacher RSVPs" },
          400
        );
      }
    }

    if (
      guest_count !== undefined &&
      (
        typeof guest_count !== "number" ||
        !Number.isInteger(guest_count) ||
        guest_count < 1 ||
        guest_count > 20
      )
    ) {
      return jsonResponse(
        { error: "guest_count must be an integer between 1 and 20" },
        400
      );
    }

    if (
      guest_name !== undefined &&
      guest_name !== null &&
      typeof guest_name !== "string"
    ) {
      return jsonResponse(
        { error: "guest_name must be a string" },
        400
      );
    }

    // ----------------------------------------
    // SUPABASE CLIENT
    // ----------------------------------------

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

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

    // ----------------------------------------
    // VERIFY TEACHER INVITATION
    // ----------------------------------------

    if (invitation_category === "teacher") {
      const tokenHash = await hashToken(token);

      const { data: invitation, error: invitationError } =
        await supabase
          .from("invitations")
          .select("id, event_id, guest_id, status")
          .eq("id", invitation_id)
          .eq("qr_token_hash", tokenHash)
          .maybeSingle();

      if (invitationError) {
        console.error(
          "Invitation verification error:",
          invitationError
        );

        return jsonResponse(
          {
            error: "Failed to verify invitation",
            details: invitationError.message,
          },
          500
        );
      }

      if (!invitation) {
        return jsonResponse(
          { error: "Invalid invitation or token" },
          403
        );
      }

      if (invitation.event_id !== event_id) {
        return jsonResponse(
          { error: "Invitation does not belong to this event" },
          403
        );
      }

      if (
        invitation.status === "revoked" ||
        invitation.status === "expired"
      ) {
        return jsonResponse(
          { error: "Invitation is no longer valid" },
          403
        );
      }

      teacherGuestId = invitation.guest_id;
    }

    // ----------------------------------------
    // PREPARE RSVP DATA
    // ----------------------------------------

    const rsvpData: Record<string, unknown> = {
      event_id,
      guest_name: guest_name || null,
      response,
      guest_count: guest_count ?? 1,
      contact_information: contact_information || null,
      invitation_category,
    };

    let result;

    // ----------------------------------------
    // TEACHER RSVP
    // One RSVP per invitation
    // ----------------------------------------

    if (invitation_category === "teacher") {
      if (!teacherGuestId) {
        return jsonResponse(
          { error: "Teacher invitation is missing its guest" },
          500
        );
      }

      rsvpData.invitation_id = invitation_id;
      rsvpData.guest_id = teacherGuestId;

      const { data, error } = await supabase
        .from("rsvps")
        .insert(rsvpData)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return jsonResponse(
            { error: "An RSVP has already been submitted for this invitation." },
            409
          );
        }

        console.error("Teacher RSVP submission error:", error);

        return jsonResponse(
          {
            error: "Failed to submit RSVP",
            details: error.message,
          },
          500
        );
      }

      result = data;
    } else {
      // ----------------------------------------
      // PUBLIC RSVP
      // Insert a new public RSVP
      // ----------------------------------------

      const { data, error } = await supabase
        .from("rsvps")
        .insert(rsvpData)
        .select()
        .single();

      if (error) {
        console.error("Public RSVP submission error:", error);

        return jsonResponse(
          {
            error: "Failed to submit RSVP",
            details: error.message,
          },
          500
        );
      }

      result = data;
    }

    // ----------------------------------------
    // SUCCESS
    // ----------------------------------------

    return jsonResponse({
      success: true,
      message: "RSVP submitted successfully",
      rsvp: result,
    });

  } catch (err) {
    console.error("SUBMIT RSVP ERROR:", err);

    return jsonResponse(
      {
        error: "Internal server error",
        details: String(err),
      },
      500
    );
  }
});
