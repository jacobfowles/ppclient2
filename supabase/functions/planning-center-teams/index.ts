import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Get Planning Center access token, automatically refreshing if expired
 */
async function getPlanningCenterAccessToken(supabaseAdmin: any, churchId: number): Promise<string> {
  // Get current tokens from database
  const { data: church, error } = await supabaseAdmin
    .from("churches")
    .select("planning_center_access_token, planning_center_token_expires_at, planning_center_refresh_token")
    .eq("id", churchId)
    .single();

  if (error || !church) {
    throw new Error("Failed to get church Planning Center credentials");
  }

  if (!church.planning_center_access_token) {
    throw new Error("No Planning Center access token found. Please connect Planning Center.");
  }

  // Check if token is expired or will expire in the next 5 minutes
  const expiresAt = new Date(church.planning_center_token_expires_at);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt > fiveMinutesFromNow) {
    // Token is still valid
    return church.planning_center_access_token;
  }

  // Token is expired or about to expire - refresh it
  console.log("Planning Center token expired or expiring soon, refreshing...");

  if (!church.planning_center_refresh_token) {
    throw new Error("No refresh token available. Please reconnect Planning Center.");
  }

  // Get Planning Center credentials from environment
  const clientId = Deno.env.get("PLANNING_CENTER_CLIENT_ID");
  const clientSecret = Deno.env.get("PLANNING_CENTER_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Planning Center credentials not configured");
  }

  // Use refresh token to get new access token
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
    throw new Error("Failed to refresh token. Please reconnect Planning Center.");
  }

  const tokenData = await tokenResponse.json();

  // Calculate expiration
  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

  // Update the church record with new tokens
  await supabaseAdmin
    .from("churches")
    .update({
      planning_center_access_token: tokenData.access_token,
      planning_center_refresh_token: tokenData.refresh_token,
      planning_center_token_expires_at: newExpiresAt,
    })
    .eq("id", churchId);

  console.log("Token refreshed successfully");
  return tokenData.access_token;
}

/**
 * Make an authenticated request to Planning Center API
 */
async function fetchPlanningCenterApi(
  supabaseAdmin: any,
  churchId: number,
  endpoint: string,
  options: any = {}
): Promise<Response> {
  const accessToken = await getPlanningCenterAccessToken(supabaseAdmin, churchId);

  const response = await fetch(`https://api.planningcenteronline.com${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  // If we get a 401, try refreshing one more time
  if (response.status === 401) {
    console.log("Got 401 from Planning Center, attempting token refresh...");

    // Force a refresh by temporarily updating the expiration
    await supabaseAdmin
      .from("churches")
      .update({ planning_center_token_expires_at: new Date(0).toISOString() })
      .eq("id", churchId);

    const newAccessToken = await getPlanningCenterAccessToken(supabaseAdmin, churchId);

    // Retry the request
    return await fetch(`https://api.planningcenteronline.com${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        "Authorization": `Bearer ${newAccessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  return response;
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

    const { action, church_id } = await req.json();

    // Verify church_id matches requesting user's church
    if (church_id !== requestingUserChurchId) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot access other churches" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    switch (action) {
      case "fetch-teams": {
        // Fetch service types first
        const serviceTypesResponse = await fetchPlanningCenterApi(
          supabaseAdmin,
          church_id,
          "/services/v2/service_types?per_page=100"
        );

        if (!serviceTypesResponse.ok) {
          throw new Error("Failed to fetch service types from Planning Center");
        }

        const serviceTypesData = await serviceTypesResponse.json();
        const serviceTypes = serviceTypesData.data || [];

        // Fetch teams for each service type
        const allTeams: any[] = [];

        for (const serviceType of serviceTypes) {
          const teamsResponse = await fetchPlanningCenterApi(
            supabaseAdmin,
            church_id,
            `/services/v2/service_types/${serviceType.id}/teams?per_page=100`
          );

          if (teamsResponse.ok) {
            const teamsData = await teamsResponse.json();
            const teams = (teamsData.data || []).map((team: any) => ({
              id: team.id,
              name: team.attributes.name,
              sequence: team.attributes.sequence,
              service_type_id: serviceType.id,
              service_type_name: serviceType.attributes.name,
            }));
            allTeams.push(...teams);
          }
        }

        // Get existing teams from database to mark which are already imported
        const { data: existingTeams } = await supabaseAdmin
          .from("teams")
          .select("planning_center_team_id")
          .eq("church_id", church_id)
          .not("planning_center_team_id", "is", null);

        const existingTeamIds = new Set(
          (existingTeams || []).map((t: any) => t.planning_center_team_id)
        );

        const teamsWithImportStatus = allTeams.map((team) => ({
          ...team,
          already_imported: existingTeamIds.has(team.id),
        }));

        return new Response(
          JSON.stringify({
            success: true,
            teams: teamsWithImportStatus,
            service_types: serviceTypes.map((st: any) => ({
              id: st.id,
              name: st.attributes.name,
              sequence: st.attributes.sequence,
            })),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "import-teams": {
        const { team_ids } = await req.json();

        if (!team_ids || !Array.isArray(team_ids)) {
          return new Response(
            JSON.stringify({ success: false, error: "team_ids array is required" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }

        // Import each team
        const imported = [];
        for (const teamId of team_ids) {
          // Get team details from Planning Center
          const teamResponse = await fetchPlanningCenterApi(
            supabaseAdmin,
            church_id,
            `/services/v2/teams/${teamId}`
          );

          if (teamResponse.ok) {
            const teamData = await teamResponse.json();
            const team = teamData.data;

            // Insert into database
            const { data: newTeam, error } = await supabaseAdmin
              .from("teams")
              .insert({
                church_id: church_id,
                name: team.attributes.name,
                planning_center_team_id: team.id,
              })
              .select()
              .single();

            if (!error && newTeam) {
              imported.push(newTeam);
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            imported_count: imported.length,
            teams: imported,
          }),
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
    console.error("Error in planning-center-teams function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
