
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// Retrieve the server-side key.
function getServerKey(): string | null {
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (
    serviceRoleKey &&
    (serviceRoleKey.startsWith("eyJ") ||
      serviceRoleKey.startsWith("sb_secret_"))
  ) {
    return serviceRoleKey;
  }

  const secretEnv =
    Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();

  if (!secretEnv) return null;

  if (
    secretEnv.startsWith("sb_secret_") ||
    secretEnv.startsWith("eyJ")
  ) {
    return secretEnv;
  }

  try {
    const parsed: unknown = JSON.parse(secretEnv);

    if (typeof parsed === "string") {
      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      const matchingKey = Object.values(parsed).find(
        (value): value is string =>
          typeof value === "string" &&
          (value.startsWith("sb_secret_") ||
            value.startsWith("eyJ")),
      );

      return matchingKey ?? null;
    }
  } catch {
    console.error("Invalid SUPABASE_SECRET_KEYS configuration");
  }

  return null;
}

// Generate SHA-256 hash.
async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Generate a cryptographically secure token.
function generateToken(): string {
  return crypto.randomUUID();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      error: "Method not allowed",
    }, 405);
  }

  try {
    // 1. Environment configuration.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serverKey = getServerKey();

    if (!supabaseUrl || !serverKey) {
      console.error("Missing Supabase server credentials");

      return jsonResponse({
        error: "Server configuration error",
        details: "Missing valid Supabase server credentials",
      }, 500);
    }

    console.log(
      "Server key type:",
      serverKey.startsWith("sb_secret_")
        ? "Secret key"
        : "Legacy JWT key",
    );

    // 2. Validate authorization.
    const authorization = req.headers.get("Authorization");
    const callerApiKey = req.headers.get("apikey");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({
        error: "Missing or invalid authorization token",
      }, 401);
    }

    if (!callerApiKey) {
      return jsonResponse({
        error: "Missing API key",
      }, 401);
    }

    const jwt = authorization.substring(7);

    // 3. Authentication client.
    const authClient = createClient(
      supabaseUrl,
      callerApiKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );

    const { data: userData, error: authError } =
      await authClient.auth.getUser(jwt);

    if (authError || !userData.user) {
      console.error(
        "Authentication failed:",
        authError?.message,
      );

      return jsonResponse({
        error: "Unauthorized",
        details: "Login session is invalid or expired",
      }, 401);
    }

    const user = userData.user;

    // 4. Privileged server-side client.
    const supabaseAdmin = createClient(
      supabaseUrl,
      serverKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );

    // 5. Verify admin permissions.
    const { data: adminRecord, error: roleError } =
      await supabaseAdmin
        .from("admins")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (roleError) {
      console.error(
        "Admin verification failed:",
        roleError.message,
      );

      return jsonResponse({
        error: "Unable to verify permissions",
        details: roleError.message,
      }, 500);
    }

    if (
      !adminRecord ||
      !["admin", "organizer"].includes(adminRecord.role)
    ) {
      return jsonResponse({
        error: "You do not have permission to perform this action",
      }, 403);
    }

    // 6. Parse request.
    const body = await req.json();

    const {
      action,
      event_id,
      teacher_id,
      guest_id,
      teacher_ids,
      invitation_id,
      template_id,
    } = body;

    const selectedGuestId = teacher_id || guest_id;

    // 7. Create invitation.
    async function createInvitation(
      eventId: string,
      guestId: string,
      templateId?: string,
    ) {
      const { data: existing, error: duplicateCheckError } =
        await supabaseAdmin
          .from("invitations")
          .select("id")
          .eq("event_id", eventId)
          .eq("guest_id", guestId)
          .neq("status", "revoked")
          .limit(1)
          .maybeSingle();

      if (duplicateCheckError) {
        throw new Error(
          `Could not check for duplicate invitations: ${duplicateCheckError.message}`,
        );
      }

      if (existing) {
        throw new Error(
          "Duplicate Error: This teacher already has an invitation for this event.",
        );
      }

      // Generate original shareable token.
      const rawToken = generateToken();

      // Generate hash for verification.
      const tokenHash = await hashToken(rawToken);

      const invitationData: Record<string, unknown> = {
        event_id: eventId,
        guest_id: guestId,
        invitation_code: rawToken,
        qr_token_hash: tokenHash,
      };

      if (templateId) {
        invitationData.template_id = templateId;
      }

      console.log("Creating invitation:", {
        event_id: eventId,
        guest_id: guestId,
        has_token: !!rawToken,
        has_hash: !!tokenHash,
      });

      const { data, error } = await supabaseAdmin
        .from("invitations")
        .insert(invitationData)
        .select(
          "id, event_id, guest_id, invitation_code, qr_token_hash, status, created_at",
        )
        .single();

      if (error) {
        console.error(
          "Invitation insertion failed:",
          error.message,
          error.code,
          error.details,
        );

        throw new Error(
          `Invitation database error: ${error.message}`,
        );
      }

      if (!data || !data.invitation_code) {
        throw new Error(
          "Invitation created but shareable token was not returned",
        );
      }

      // Return original token to authorized frontend.
      return {
        ...data,
        shareable_token: data.invitation_code,
      };
    }

    // 8. Process actions.
    switch (action) {

      // Generate one invitation.
      case "generate-token": {
        if (!event_id || !selectedGuestId) {
          return jsonResponse({
            error: "event_id and guest_id are required",
          }, 400);
        }

        const invitation = await createInvitation(
          event_id,
          selectedGuestId,
          template_id,
        );

        return jsonResponse({
          success: true,
          message: "Invitation generated successfully",
          invitation,
          shareable_token: invitation.invitation_code,
        });
      }

      // Regenerate invitation token.
      case "regenerate-token": {
        if (!invitation_id) {
          return jsonResponse({
            error: "invitation_id is required",
          }, 400);
        }

        const rawToken = generateToken();
        const tokenHash = await hashToken(rawToken);

        const { data, error } = await supabaseAdmin
          .from("invitations")
          .update({
            invitation_code: rawToken,
            qr_token_hash: tokenHash,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invitation_id)
          .select(
            "id, event_id, guest_id, invitation_code, qr_token_hash, status, updated_at",
          )
          .single();

        if (error) {
          console.error(
            "Token regeneration failed:",
            error.message,
            error.code,
          );

          return jsonResponse({
            error: "Failed to regenerate invitation token",
            details: error.message,
          }, 500);
        }

        return jsonResponse({
          success: true,
          message: "Invitation token regenerated successfully",
          invitation: {
            ...data,
            shareable_token: data.invitation_code,
          },
          shareable_token: data.invitation_code,
        });
      }

      // Revoke invitation.
      case "revoke-invitation": {
        if (!invitation_id) {
          return jsonResponse({
            error: "invitation_id is required",
          }, 400);
        }

        const { data, error } = await supabaseAdmin
          .from("invitations")
          .update({
            status: "revoked",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invitation_id)
          .select("id, status")
          .single();

        if (error) {
          console.error(
            "Invitation revocation failed:",
            error.message,
          );

          return jsonResponse({
            error: "Failed to revoke invitation",
            details: error.message,
          }, 500);
        }

        return jsonResponse({
          success: true,
          message: "Invitation revoked successfully",
          invitation: data,
        });
      }

      // Permanently delete invitation.
      case "delete-invitation": {
        if (!invitation_id) {
          return jsonResponse({
            error: "invitation_id is required",
          }, 400);
        }

        const { error } = await supabaseAdmin
          .from("invitations")
          .delete()
          .eq("id", invitation_id);

        if (error) {
          return jsonResponse({
            error: "Failed to delete invitation",
            details: error.message,
          }, 500);
        }

        return jsonResponse({
          success: true,
          message: "Invitation deleted successfully",
        });
      }

      // Generate multiple invitations.
      case "bulk-generate": {
        if (!event_id || !Array.isArray(teacher_ids)) {
          return jsonResponse({
            error: "event_id and teacher_ids array are required",
          }, 400);
        }

        if (teacher_ids.length === 0) {
          return jsonResponse({
            error: "teacher_ids cannot be empty",
          }, 400);
        }

        let generated = 0;
        const failures = [];

        for (const teacherId of teacher_ids) {
          try {
            await createInvitation(
              event_id,
              teacherId,
              template_id,
            );

            generated += 1;
          } catch (error) {
            failures.push({
              teacher_id: teacherId,
              error: error instanceof Error
                ? error.message
                : "Unknown error",
            });
          }
        }

        return jsonResponse({
          success: failures.length === 0,
          message: `${generated} invitations generated successfully`,
          generated,
          failed: failures.length,
          failures,
        });
      }

      default: {
        return jsonResponse({
          error: "Invalid action",
          supported_actions: [
            "generate-token",
            "regenerate-token",
            "revoke-invitation",
            "delete-invitation",
            "bulk-generate",
          ],
        }, 400);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(
      "Admin operations error:",
      errorMessage,
    );

    if (/duplicate error|duplicate key|23505/i.test(errorMessage)) {
      return jsonResponse({
        error: "This teacher already has an invitation for this event.",
        code: "DUPLICATE_INVITATION",
      }, 409);
    }

    return jsonResponse({
      error: "Internal server error",
      details: errorMessage,
    }, 500);
  }
});
