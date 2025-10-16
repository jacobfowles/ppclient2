import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resend API helper
async function sendEmail(to: string, subject: string, html: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not configured - skipping email");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Purpose Paradigm <welcome@purposeparadigm.org>",
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return { success: false, error };
    }

    const data = await response.json();
    console.log("Email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the JWT token from the Authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("Authorization header present:", !!authHeader);

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Extract JWT and get user directly from admin client
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    console.log("Auth check:", { authError, hasUser: !!requestingUser, userId: requestingUser?.id });
    console.log("User metadata:", requestingUser?.user_metadata);

    if (authError || !requestingUser) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", details: authError?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const requestingUserChurchId = requestingUser.user_metadata?.church_id;
    const requestingUserRole = requestingUser.user_metadata?.role;

    console.log("User access:", { churchId: requestingUserChurchId, role: requestingUserRole });

    if (requestingUserRole !== "admin") {
      console.error("User is not admin:", { role: requestingUserRole, metadata: requestingUser.user_metadata });
      return new Response(
        JSON.stringify({ success: false, error: "Only administrators can manage users", role: requestingUserRole }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const { action, email, first_name, last_name, church_id, user_id, new_password } = await req.json();

    if (church_id !== requestingUserChurchId) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot manage users from other churches" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    switch (action) {
      case "create": {
        const tempPassword = generatePassword(12);

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            church_id,
            role: "user",
            force_password_change: true,
            first_name,
            last_name,
            name: `${first_name} ${last_name}`,
          },
        });

        if (createError) {
          console.error("Error creating user:", createError);
          return new Response(
            JSON.stringify({ success: false, error: createError.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        // Send welcome email with temporary password
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
            <p>Hello ${first_name},</p>

            <p>Your church administrator has created a user account for you in Purpose Paradigm. When you log in, you'll unlock powerful insights into your ministry's strengths, strategically build high-performing teams, and empower leadership through dynamic data visualizations and seamless assignment capabilities!</p>

            <p>Here is your login information:</p>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Website:</strong> <a href="https://dashboard.purposeparadigm.org" style="color: #007bff; text-decoration: none;">https://dashboard.purposeparadigm.org</a></p>
              <p style="margin: 5px 0;"><strong>Username:</strong> ${email}</p>
              <p style="margin: 5px 0;"><strong>Password:</strong> ${tempPassword}</p>
            </div>

            <p>Note that this temporary password is only good for your first login. When you log in you will be asked to choose your permanent password.</p>

            <p>Please do not reply to this email as it is sent from an unmonitored address. If you have any questions or need assistance logging in, please contact your church administrator.</p>
          </div>
        `;

        const emailResult = await sendEmail(
          email,
          "Welcome to Purpose Paradigm!",
          emailHtml
        );

        if (!emailResult.success) {
          console.warn("Email sending failed, but user was created:", emailResult.error);
          // User was created, so return success with temp password for manual sharing
          return new Response(
            JSON.stringify({
              success: true,
              user: newUser.user,
              temporary_password: tempPassword,
              email_sent: false,
              message: `User created successfully. Email service unavailable - please share this temporary password securely: ${tempPassword}`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            user: newUser.user,
            email_sent: true,
            message: `User created successfully! Welcome email sent to ${email}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "delete": {
        if (!user_id) {
          return new Response(
            JSON.stringify({ success: false, error: "user_id is required" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        const { data: userToDelete, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);

        if (getUserError || !userToDelete) {
          return new Response(
            JSON.stringify({ success: false, error: "User not found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
          );
        }

        if (userToDelete.user.user_metadata?.church_id !== church_id) {
          return new Response(
            JSON.stringify({ success: false, error: "Cannot delete users from other churches" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
          );
        }

        if (userToDelete.user.user_metadata?.role === "admin") {
          const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers();
          const churchAdmins = allUsers.filter(
            (u) => u.user_metadata?.church_id === church_id && u.user_metadata?.role === "admin"
          );

          if (churchAdmins.length <= 1) {
            return new Response(
              JSON.stringify({ success: false, error: "Cannot delete the last administrator" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
            );
          }
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

        if (deleteError) {
          console.error("Error deleting user:", deleteError);
          return new Response(
            JSON.stringify({ success: false, error: deleteError.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "User deleted successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "reset_password": {
        if (!user_id || !new_password) {
          return new Response(
            JSON.stringify({ success: false, error: "user_id and new_password are required" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        const { data: userToReset, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);

        if (getUserError || !userToReset) {
          return new Response(
            JSON.stringify({ success: false, error: "User not found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
          );
        }

        if (userToReset.user.user_metadata?.church_id !== church_id) {
          return new Response(
            JSON.stringify({ success: false, error: "Cannot reset password for users from other churches" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
          );
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          password: new_password,
          user_metadata: {
            ...userToReset.user.user_metadata,
            force_password_change: true,
          },
        });

        if (updateError) {
          console.error("Error resetting password:", updateError);
          return new Response(
            JSON.stringify({ success: false, error: updateError.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Password reset successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "list": {
        const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) {
          return new Response(
            JSON.stringify({ success: false, error: listError.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        const churchUsers = allUsers
          .filter((u) => u.user_metadata?.church_id === church_id)
          .map((u) => ({
            id: u.id,
            email: u.email,
            first_name: u.user_metadata?.first_name,
            last_name: u.user_metadata?.last_name,
            role: u.user_metadata?.role || "user",
            created_at: u.created_at,
            last_login: u.last_sign_in_at,
          }));

        return new Response(
          JSON.stringify({ success: true, users: churchUsers }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in manage-users function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function generatePassword(length: number): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
}
