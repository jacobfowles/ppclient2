import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Verify the requesting user
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const requestingUserChurchId = requestingUser.user_metadata?.church_id;
    const requestingUserRole = requestingUser.user_metadata?.role;

    if (requestingUserRole !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Only administrators can refresh tokens" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const { church_id } = await req.json();

    // Verify church_id matches requesting user's church
    if (church_id !== requestingUserChurchId) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot refresh tokens for other churches" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Get current church Planning Center credentials
    const { data: church, error: churchError } = await supabaseAdmin
      .from("churches")
      .select("planning_center_refresh_token, planning_center_client_id")
      .eq("id", church_id)
      .single();

    if (churchError || !church) {
      return new Response(
        JSON.stringify({ success: false, error: "Church not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (!church.planning_center_refresh_token) {
      return new Response(
        JSON.stringify({ success: false, error: "No refresh token available. Please reconnect Planning Center." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get Planning Center credentials from environment
    const clientId = Deno.env.get("PLANNING_CENTER_CLIENT_ID");
    const clientSecret = Deno.env.get("PLANNING_CENTER_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Planning Center credentials not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Use refresh token to get new access token
    console.log("Refreshing Planning Center token for church:", church_id);

    const tokenResponse = await fetch("https://api.planningcenteronline.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: church.planning_center_refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token refresh failed:", errorText);

      // If refresh token is invalid, clear all Planning Center data
      if (tokenResponse.status === 400 || tokenResponse.status === 401) {
        await supabaseAdmin
          .from("churches")
          .update({
            planning_center_access_token: null,
            planning_center_refresh_token: null,
            planning_center_token_expires_at: null,
            planning_center_connected_at: null,
            planning_center_client_id: null,
            planning_center_app_id: null,
          })
          .eq("id", church_id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Refresh token expired or invalid. Please reconnect Planning Center.",
            needs_reconnect: true
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Failed to refresh token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();

    // Calculate expiration (typically 7200 seconds = 2 hours)
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Update the church record with new tokens
    const { error: updateError } = await supabaseAdmin
      .from("churches")
      .update({
        planning_center_access_token: tokenData.access_token,
        planning_center_refresh_token: tokenData.refresh_token, // PCO provides a new refresh token
        planning_center_token_expires_at: expiresAt,
      })
      .eq("id", church_id);

    if (updateError) {
      console.error("Failed to update tokens:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save new tokens" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Token refreshed successfully for church:", church_id);

    return new Response(
      JSON.stringify({
        success: true,
        access_token: tokenData.access_token,
        expires_at: expiresAt,
        message: "Token refreshed successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in planning-center-refresh function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
