// Backend API endpoint for Planning Center OAuth token exchange
// This should be implemented in your backend framework (Node.js/Express, Next.js API routes, etc.)

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// Environment variables (backend only)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!; // Service role key for admin operations
const PLANNING_CENTER_CLIENT_ID = process.env.PLANNING_CENTER_CLIENT_ID!;
const PLANNING_CENTER_CLIENT_SECRET = process.env.PLANNING_CENTER_CLIENT_SECRET!; // Secret stays on backend
const JWT_SECRET = process.env.JWT_SECRET!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TokenExchangeRequest {
  code: string;
  state: string;
  redirect_uri: string;
}

interface PlanningCenterTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  application?: {
    id: string;
    name: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let userId: string;
    let churchId: number;

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.sub;
      churchId = decoded.church_id;
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Invalid JWT token' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body: TokenExchangeRequest = await req.json();
    const { code, state, redirect_uri } = body;

    if (!code || !state || !redirect_uri) {
      return NextResponse.json(
        { success: false, error: 'Bad Request', message: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 3. Validate state parameter
    const stateMatch = state.match(/^church_(\d+)_\d+$/);
    if (!stateMatch || parseInt(stateMatch[1]) !== churchId) {
      return NextResponse.json(
        { success: false, error: 'Invalid State', message: 'OAuth state does not match current church' },
        { status: 400 }
      );
    }

    // 4. Verify user has admin permissions for this church
    // Get user from Supabase Auth
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'User not found' },
        { status: 403 }
      );
    }

    // Check user's church_id and role from metadata
    const userChurchId = authUser.user_metadata?.church_id;
    const userRole = authUser.user_metadata?.role;

    if (userChurchId !== churchId || userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden', message: 'Only church administrators can connect Planning Center' },
        { status: 403 }
      );
    }

    // 5. Exchange authorization code for tokens
    const tokenResponse = await fetch('https://api.planningcenteronline.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: PLANNING_CENTER_CLIENT_ID,
        client_secret: PLANNING_CENTER_CLIENT_SECRET,
        code: code,
        redirect_uri: redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('Planning Center token exchange failed:', errorData);

      return NextResponse.json(
        {
          success: false,
          error: 'Token Exchange Failed',
          message: errorData.error_description || 'Failed to exchange authorization code for access token'
        },
        { status: 400 }
      );
    }

    const tokenData: PlanningCenterTokenResponse = await tokenResponse.json();

    // 6. Calculate token expiration
    const expiresAt = tokenData.expires_in ?
      new Date(Date.now() + tokenData.expires_in * 1000).toISOString() :
      null;

    // 7. Store credentials securely in database
    const { error: updateError } = await supabaseAdmin
      .from('churches')
      .update({
        planning_center_client_id: PLANNING_CENTER_CLIENT_ID,
        planning_center_access_token: tokenData.access_token, // In production, encrypt this
        planning_center_refresh_token: tokenData.refresh_token, // In production, encrypt this
        planning_center_token_expires_at: expiresAt,
        planning_center_connected_at: new Date().toISOString(),
        planning_center_app_id: tokenData.application?.id || null,
      })
      .eq('id', churchId);

    if (updateError) {
      console.error('Failed to save Planning Center credentials:', updateError);
      return NextResponse.json(
        { success: false, error: 'Database Error', message: 'Failed to save Planning Center credentials' },
        { status: 500 }
      );
    }

    // 8. Return success response (without sensitive data)
    return NextResponse.json({
      success: true,
      message: 'Planning Center connected successfully',
      connected_at: new Date().toISOString(),
      app_id: tokenData.application?.id || null,
    });

  } catch (error) {
    console.error('Planning Center OAuth exchange error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Additional endpoint for token refresh
export async function PATCH(req: NextRequest) {
  try {
    // Similar authentication and validation logic...

    // Use refresh_token to get new access_token
    // Update database with new tokens
    // Return success response

    return NextResponse.json({
      success: true,
      message: 'Planning Center token refreshed successfully',
    });
  } catch (error) {
    console.error('Planning Center token refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error', message: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}