import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { nicknameMap } from './nicknameMap.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req)=>{
  console.log('Function called with method:', req.method);
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

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
    console.log('Attempting to verify JWT...');

    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    console.log('JWT verification result:', {
      hasUser: !!requestingUser,
      hasError: !!authError,
      errorMessage: authError?.message
    });

    if (authError || !requestingUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", details: authError?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const requestingUserChurchId = requestingUser.user_metadata?.church_id;
    const requestingUserRole = requestingUser.user_metadata?.role;

    console.log('User authenticated:', {
      userId: requestingUser.id,
      churchId: requestingUserChurchId,
      role: requestingUserRole,
      metadata: requestingUser.user_metadata
    });

    if (requestingUserRole !== "admin") {
      console.error('Role check failed:', {
        expectedRole: 'admin',
        actualRole: requestingUserRole,
        userMetadata: requestingUser.user_metadata
      });
      return new Response(
        JSON.stringify({ success: false, error: "Only administrators can access people matching", actualRole: requestingUserRole }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    console.log('Role check passed - user is admin');

    const body = await req.json();
    console.log('Body parsed successfully:', body);
    const { church_id, assessment_ids, pco_list_id, refresh_list } = body;

    console.log('Extracted parameters:', {
      church_id,
      assessment_ids_count: assessment_ids?.length,
      pco_list_id,
      refresh_list
    });

    // Verify church_id matches requesting user's church
    console.log('Verifying church access:', {
      requestChurchId: church_id,
      userChurchId: requestingUserChurchId,
      match: church_id === requestingUserChurchId
    });

    if (church_id !== requestingUserChurchId) {
      console.error('Church access denied:', {
        requestChurchId: church_id,
        userChurchId: requestingUserChurchId
      });
      return new Response(
        JSON.stringify({ success: false, error: "Cannot access other churches", requestedChurch: church_id, userChurch: requestingUserChurchId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    console.log('Church access verified');

    if (!church_id || !assessment_ids || !Array.isArray(assessment_ids)) {
      console.error('Missing required parameters:', {
        has_church_id: !!church_id,
        has_assessment_ids: !!assessment_ids,
        is_assessment_ids_array: Array.isArray(assessment_ids)
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!pco_list_id) {
      console.error('No Planning Center list ID provided');
      return new Response(JSON.stringify({
        success: false,
        error: 'No Planning Center list ID provided. Please configure the list ID in People Matching settings.'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Get assessments that need matching
    const { data: assessments, error: assessmentError } = await supabaseAdmin
      .from('assessments')
      .select('id, first_name, last_name, email, phone')
      .eq('church_id', church_id)
      .in('id', assessment_ids)
      .is('planning_center_person_id', null);

    if (assessmentError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch assessments'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Add computed name field to assessments
    const assessmentsWithName = (assessments || []).map((assessment)=>({
        ...assessment,
        name: `${assessment.first_name || ''} ${assessment.last_name || ''}`.trim()
      }));

    console.log(`Processing ${assessmentsWithName.length} assessments`);
    console.log(`Total assessments to process: ${assessment_ids.length}`);

    // Get Planning Center credentials including refresh token
    const { data: churchData, error: credError } = await supabaseAdmin
      .from('churches')
      .select('planning_center_access_token, planning_center_refresh_token, planning_center_token_expires_at, planning_center_client_id')
      .eq('id', church_id)
      .single();

    if (credError || !churchData?.planning_center_access_token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Planning Center not connected for this church'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Check if token is expired and refresh if needed
    let accessToken = churchData.planning_center_access_token;
    if (churchData.planning_center_token_expires_at && churchData.planning_center_refresh_token) {
      const expiresAt = new Date(churchData.planning_center_token_expires_at);
      const now = new Date();
      const isExpired = now >= expiresAt;
      const willExpireSoon = expiresAt.getTime() - now.getTime() < 300000; // 5 minutes

      if (isExpired || willExpireSoon) {
        console.log('Planning Center token expired or expiring soon, refreshing...');
        const refreshResult = await refreshPlanningCenterToken(
          churchData.planning_center_refresh_token,
          churchData.planning_center_client_id
        );

        if (refreshResult.success) {
          accessToken = refreshResult.access_token;
          // Update the database with new tokens
          const { error: updateError } = await supabaseAdmin
            .from('churches')
            .update({
              planning_center_access_token: refreshResult.access_token,
              planning_center_refresh_token: refreshResult.refresh_token,
              planning_center_token_expires_at: refreshResult.expires_at
            })
            .eq('id', church_id);

          if (updateError) {
            console.error('Failed to update refreshed tokens:', updateError);
          } else {
            console.log('Successfully refreshed and updated Planning Center tokens');
          }
        } else {
          console.error('Failed to refresh Planning Center token:', refreshResult.error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Planning Center token expired and could not be refreshed. Please reconnect in Settings.'
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
    }

    // Fetch people from Planning Center List
    console.log('Fetching people from Planning Center list...');
    const peopleData = await fetchPlanningCenterPeopleFromList(accessToken, pco_list_id, refresh_list);

    if (!peopleData.success) {
      console.error('Failed to fetch Planning Center people:', peopleData.error);
      return new Response(JSON.stringify({
        success: false,
        error: `Planning Center List error: ${peopleData.error}. Please ensure the list exists and has people added to it in Planning Center.`
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Process matches using the matching algorithm
    console.log(`Processing matches for ${assessmentsWithName.length} assessments against ${peopleData.people.length} people`);
    const matchResults = processMatches(assessmentsWithName, peopleData.people, peopleData.included);
    console.log(`Returning ${matchResults.perfectMatches.length} perfect matches and ${matchResults.regularMatches.length} regular matches`);

    return new Response(JSON.stringify({
      success: true,
      matches: matchResults.regularMatches,
      perfectMatches: matchResults.perfectMatches,
      regularMatches: matchResults.regularMatches,
      list_info: {
        list_id: peopleData.listId,
        people_count: peopleData.people.length
      },
      processed_count: assessmentsWithName.length
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Function error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

async function refreshPlanningCenterToken(refreshToken, clientId) {
  try {
    console.log('Refreshing Planning Center access token...');

    const clientSecret = Deno.env.get("PLANNING_CENTER_CLIENT_SECRET");
    if (!clientSecret) {
      throw new Error("Planning Center client secret not configured");
    }

    const response = await fetch('https://api.planningcenteronline.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(()=>({}));
      console.error('Planning Center token refresh error:', response.status, errorData);
      return {
        success: false,
        error: `Token refresh failed (${response.status}): ${JSON.stringify(errorData)}`
      };
    }

    const tokenData = await response.json();
    const expiresIn = tokenData.expires_in || 7200; // Default to 2 hours
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    console.log('Successfully refreshed Planning Center token');
    return {
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refreshToken,
      expires_at: expiresAt
    };
  } catch (error) {
    console.error('Error refreshing Planning Center token:', error);
    return {
      success: false,
      error: 'Failed to refresh Planning Center token'
    };
  }
}

async function refreshPlanningCenterList(accessToken, listId) {
  try {
    console.log(`Refreshing Planning Center list: ${listId}`);
    const refreshResponse = await fetch(`https://api.planningcenteronline.com/people/v2/lists/${listId}/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    console.log(`List refresh response status: ${refreshResponse.status}`);
    if (!refreshResponse.ok) {
      const errorData = await refreshResponse.json().catch(()=>({}));
      console.error('Planning Center List refresh error:', refreshResponse.status, errorData);
      return {
        success: false,
        error: `Failed to refresh Planning Center list (${refreshResponse.status}): ${JSON.stringify(errorData)}`
      };
    }

    console.log(`Successfully refreshed Planning Center list: ${listId}`);
    return {
      success: true
    };
  } catch (error) {
    console.error('Error refreshing Planning Center list:', error);
    return {
      success: false,
      error: 'Failed to refresh Planning Center list'
    };
  }
}

async function fetchPlanningCenterPeopleFromList(accessToken, listId, shouldRefresh = false) {
  try {
    if (!listId) {
      return {
        success: false,
        error: 'No Planning Center list ID provided. Please configure the list ID in People Matching settings.'
      };
    }

    console.log(`Fetching people from Planning Center list: ${listId}`);

    if (shouldRefresh) {
      console.log('Refreshing list before fetching...');
      const refreshResult = await refreshPlanningCenterList(accessToken, listId);
      if (!refreshResult.success) {
        console.warn('List refresh failed, continuing with fetch:', refreshResult.error);
      } else {
        console.log('List refreshed successfully');
      }
    }

    let allPeople = [];
    let allIncluded = [];
    let nextUrl = `https://api.planningcenteronline.com/people/v2/lists/${listId}/people?include=emails,phone_numbers&per_page=100`;
    let pageCount = 0;

    while(nextUrl){
      pageCount++;
      console.log(`Fetching page ${pageCount}: ${nextUrl}`);

      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      console.log(`Page ${pageCount} response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(()=>({}));
        console.error('Planning Center List API error:', response.status, errorData);
        return {
          success: false,
          error: `Failed to fetch people from Planning Center list (${response.status}): ${JSON.stringify(errorData)}`
        };
      }

      const data = await response.json();
      allPeople = allPeople.concat(data.data || []);
      allIncluded = allIncluded.concat(data.included || []);

      console.log(`Page ${pageCount}: +${data.data?.length || 0} people (total: ${allPeople.length})`);

      nextUrl = data.links?.next || null;

      if (pageCount > 100) {
        console.warn('Stopping pagination after 100 pages for safety');
        break;
      }
    }

    console.log(`Pagination complete: Fetched ${allPeople.length} people across ${pageCount} pages`);
    console.log(`Total included data: ${allIncluded.length} records`);

    return {
      success: true,
      people: allPeople,
      included: allIncluded,
      listId: listId
    };
  } catch (error) {
    console.error('Error fetching Planning Center people from list:', error);
    return {
      success: false,
      error: 'Failed to fetch people from Planning Center list'
    };
  }
}

function processMatches(assessments, people, included) {
  try {
    console.log('Starting processMatches with:', {
      assessments_count: assessments.length,
      people_count: people.length,
      included_count: included.length
    });

    const emailMap = new Map();
    const phoneMap = new Map();
    const peopleByEmail = new Map();
    const peopleByPhone = new Map();

    included.forEach((item)=>{
      try {
        if (item.attributes?.address) {
          const email = item.attributes.address.toLowerCase();
          emailMap.set(item.id, email);
        } else if (item.attributes?.number) {
          const phone = normalizePhone(item.attributes.number);
          phoneMap.set(item.id, phone);
        }
      } catch (error) {
        console.error('Error processing included item:', error);
      }
    });

    const peopleByName = new Map();
    people.forEach((person, index)=>{
      try {
        if (person?.relationships?.emails?.data) {
          person.relationships.emails.data.forEach((emailRef)=>{
            const email = emailMap.get(emailRef.id);
            if (email) {
              if (!peopleByEmail.has(email)) peopleByEmail.set(email, []);
              peopleByEmail.get(email).push({
                person,
                index,
                emails: [],
                phones: []
              });
            }
          });
        }

        if (person?.relationships?.phone_numbers?.data) {
          person.relationships.phone_numbers.data.forEach((phoneRef)=>{
            const phone = phoneMap.get(phoneRef.id);
            if (phone) {
              if (!peopleByPhone.has(phone)) peopleByPhone.set(phone, []);
              peopleByPhone.get(phone).push({
                person,
                index,
                emails: [],
                phones: []
              });
            }
          });
        }

        const normalizedName = normalizeName(person.attributes?.name || '');
        if (normalizedName) {
          if (!peopleByName.has(normalizedName)) peopleByName.set(normalizedName, []);
          peopleByName.get(normalizedName).push(person);

          const nameParts = normalizedName.split(' ');
          if (nameParts.length >= 2) {
            const firstName = nameParts[0];
            const lastName = nameParts[nameParts.length - 1];
            const nicknames = nicknameMap[firstName] || [];

            nicknames.forEach((nickname)=>{
              const nicknameFullName = `${nickname} ${lastName}`;
              if (!peopleByName.has(nicknameFullName)) peopleByName.set(nicknameFullName, []);
              peopleByName.get(nicknameFullName).push(person);
            });
          }
        }
      } catch (error) {
        console.error('Error indexing person:', error);
      }
    });

    console.log(`Built lookup indexes: ${peopleByEmail.size} unique emails, ${peopleByPhone.size} unique phones, ${peopleByName.size} unique names`);

    const matches = [];

    for (const assessment of assessments){
      let bestMatch = null;
      let bestScore = 0;
      let confidence = 'no_match_found';

      const normalizedAssessmentName = normalizeName(assessment.name || '');
      const exactNameMatches = peopleByName.get(normalizedAssessmentName);

      if (exactNameMatches && exactNameMatches.length > 0) {
        for (const person of exactNameMatches){
          const personEmails = person.relationships?.emails?.data?.map((e)=>emailMap.get(e.id)).filter(Boolean) || [];
          const personPhones = person.relationships?.phone_numbers?.data?.map((p)=>phoneMap.get(p.id)).filter(Boolean) || [];
          const normalizedPersonName = normalizeName(person.attributes?.name || '');

          const isExactMatch = normalizedAssessmentName === normalizedPersonName;
          const assessmentParts = normalizedAssessmentName.split(' ');
          const personParts = normalizedPersonName.split(' ');
          let isNicknameMatch = false;

          if (assessmentParts.length >= 2 && personParts.length >= 2) {
            const assessmentFirst = assessmentParts[0];
            const assessmentLast = assessmentParts[assessmentParts.length - 1];
            const personFirst = personParts[0];
            const personLast = personParts[personParts.length - 1];
            isNicknameMatch = assessmentLast === personLast && areNicknames(assessmentFirst, personFirst);
          }

          const emailMatches = assessment.email && personEmails.some((email)=>email.toLowerCase() === assessment.email.toLowerCase());
          const phoneMatches = assessment.phone && personPhones.some((phone)=>normalizePhone(phone) === normalizePhone(assessment.phone));

          if ((isExactMatch || isNicknameMatch) && (emailMatches || phoneMatches)) {
            bestScore = 60;
            bestMatch = {
              person,
              emails: personEmails,
              phones: personPhones,
              score: bestScore
            };
            break;
          } else if ((isExactMatch || isNicknameMatch) && bestScore < 35) {
            bestScore = 35;
            bestMatch = {
              person,
              emails: personEmails,
              phones: personPhones,
              score: bestScore
            };
          }
        }
      }

      if (bestScore < 60 && assessment.email) {
        const emailMatches = peopleByEmail.get(assessment.email.toLowerCase());
        if (emailMatches) {
          for (const match of emailMatches){
            const person = match.person;
            const personEmails = person.relationships?.emails?.data?.map((e)=>emailMap.get(e.id)).filter(Boolean) || [];
            const personPhones = person.relationships?.phone_numbers?.data?.map((p)=>phoneMap.get(p.id)).filter(Boolean) || [];

            const nameSimilarity = calculateSimilarity(normalizeName(assessment.name || ''), normalizeName(person.attributes?.name || ''));

            if (nameSimilarity >= 0.7) {
              bestScore = 50;
            } else if (nameSimilarity >= 0.4) {
              bestScore = 30;
            } else {
              bestScore = 15;
            }

            bestMatch = {
              person,
              emails: personEmails,
              phones: personPhones,
              score: bestScore
            };
            break;
          }
        }
      }

      if (bestScore < 35 && assessment.phone) {
        const normalizedPhone = normalizePhone(assessment.phone);
        const phoneMatches = peopleByPhone.get(normalizedPhone);
        if (phoneMatches) {
          for (const match of phoneMatches){
            const person = match.person;
            const personEmails = person.relationships?.emails?.data?.map((e)=>emailMap.get(e.id)).filter(Boolean) || [];
            const personPhones = person.relationships?.phone_numbers?.data?.map((p)=>phoneMap.get(p.id)).filter(Boolean) || [];

            const nameSimilarity = calculateSimilarity(normalizeName(assessment.name || ''), normalizeName(person.attributes?.name || ''));

            if (nameSimilarity >= 0.7) {
              bestScore = 40;
            } else if (nameSimilarity >= 0.4) {
              bestScore = 25;
            } else {
              bestScore = 10;
            }

            bestMatch = {
              person,
              emails: personEmails,
              phones: personPhones,
              score: bestScore
            };
            break;
          }
        }
      }

      if (bestScore < 25) {
        const peopleToCheck = people.slice(0, Math.min(1000, people.length));
        for (const person of peopleToCheck){
          try {
            if (!person || !person.id) continue;
            let score = 0;

            const personEmails = person.relationships?.emails?.data?.map((e)=>emailMap.get(e.id)).filter(Boolean) || [];
            const personPhones = person.relationships?.phone_numbers?.data?.map((p)=>phoneMap.get(p.id)).filter(Boolean) || [];

            const normalizedAssessmentName = normalizeName(assessment.name || '');
            const normalizedPersonName = normalizeName(person.attributes?.name || '');

            if (normalizedAssessmentName && normalizedPersonName) {
              const nameSimilarity = calculateSimilarity(normalizedAssessmentName, normalizedPersonName);
              score += Math.round(nameSimilarity * 30);
            }

            if (assessment.email && personEmails.length > 0) {
              const assessmentDomain = getEmailDomain(assessment.email);
              const hasMatchingDomain = personEmails.some((email)=>getEmailDomain(email) === assessmentDomain);
              const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'mail.com', 'protonmail.com'];
              const isCommonDomain = commonDomains.includes(assessmentDomain.toLowerCase());

              if (hasMatchingDomain && assessmentDomain && !isCommonDomain) {
                score += 10;
              }
            }

            if (assessment.phone && personPhones.length > 0) {
              const assessmentLast7 = getPhoneLast7(assessment.phone);
              const hasMatchingLast7 = personPhones.some((phone)=>getPhoneLast7(phone) === assessmentLast7);
              if (hasMatchingLast7 && assessmentLast7.length === 7) {
                score += 15;
              }
            }

            if (score > bestScore) {
              bestScore = score;
              bestMatch = {
                person,
                emails: personEmails,
                phones: personPhones,
                score
              };
            }
          } catch (personError) {
            console.error('Error processing person:', personError);
          }
        }
      }

      if (bestScore >= 55) {
        confidence = 'highest_confidence';
      } else if (bestScore >= 35) {
        confidence = 'high_confidence';
      } else if (bestScore >= 25) {
        confidence = 'medium_confidence';
      } else {
        confidence = 'no_match_found';
      }

      let isPerfectMatch = false;
      if (bestMatch && bestScore >= 55) {
        const nameSimilarity = calculateSimilarity(normalizeName(assessment.name || ''), normalizeName(bestMatch.person.attributes?.name || ''));
        const hasExactEmail = assessment.email && bestMatch.emails.some((email)=>email.toLowerCase() === assessment.email.toLowerCase());
        const hasExactPhone = assessment.phone && bestMatch.phones.some((phone)=>normalizePhone(phone) === normalizePhone(assessment.phone));
        isPerfectMatch = nameSimilarity >= 0.95 && (hasExactEmail || hasExactPhone);
      }

      matches.push({
        assessment,
        match: bestMatch,
        confidence,
        score: bestScore,
        isPerfectMatch
      });
    }

    const perfectMatches = matches.filter((match)=>match.isPerfectMatch);
    const MIN_SCORE_THRESHOLD = 25;
    const regularMatches = matches.filter((match)=>!match.isPerfectMatch && match.score >= MIN_SCORE_THRESHOLD && match.match !== null);

    console.log(`Filtering: ${matches.length} total matches -> ${perfectMatches.length} perfect + ${regularMatches.length} regular (${matches.length - perfectMatches.length - regularMatches.length} filtered out as low quality)`);

    const confidenceOrder = {
      'highest_confidence': 4,
      'high_confidence': 3,
      'medium_confidence': 2,
      'no_match_found': 1
    };

    regularMatches.sort((a, b)=>{
      const aOrder = confidenceOrder[a.confidence];
      const bOrder = confidenceOrder[b.confidence];
      if (aOrder !== bOrder) {
        return bOrder - aOrder;
      }
      return b.score - a.score;
    });

    return {
      perfectMatches,
      regularMatches,
      allMatches: matches
    };
  } catch (error) {
    console.error('Error in processMatches:', error);
    throw error;
  }
}

function calculateSimilarity(str1, str2) {
  try {
    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  } catch (error) {
    console.error('Error in calculateSimilarity:', error);
    return 0;
  }
}

function levenshteinDistance(str1, str2) {
  try {
    const matrix = Array(str2.length + 1).fill(null).map(()=>Array(str1.length + 1).fill(null));
    for(let i = 0; i <= str1.length; i++){
      matrix[0][i] = i;
    }
    for(let j = 0; j <= str2.length; j++){
      matrix[j][0] = j;
    }
    for(let j = 1; j <= str2.length; j++){
      for(let i = 1; i <= str1.length; i++){
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + substitutionCost);
      }
    }
    return matrix[str2.length][str1.length];
  } catch (error) {
    console.error('Error in levenshteinDistance:', error);
    return 999;
  }
}

function areNicknames(name1, name2) {
  const n1 = name1.toLowerCase();
  const n2 = name2.toLowerCase();
  if (n1 === n2) return true;
  const n1Nicknames = nicknameMap[n1] || [];
  const n2Nicknames = nicknameMap[n2] || [];
  return n1Nicknames.includes(n2) || n2Nicknames.includes(n1);
}

function normalizeName(name) {
  if (!name) return '';
  const titles = ['dr', 'mr', 'mrs', 'ms', 'rev', 'pastor', 'father', 'mother', 'brother', 'sister'];
  let normalized = name.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = normalized.split(' ');
  const filteredWords = words.filter((word)=>!titles.includes(word));
  return filteredWords.join(' ');
}

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return digits.length > 0 ? `+${digits}` : '';
}

function getEmailDomain(email) {
  if (!email) return '';
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
}

function getPhoneLast7(phone) {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-7) : digits;
}
