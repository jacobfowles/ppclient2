# Deploy Edge Function Guide

This guide will help you deploy the `manage-users` Edge Function to your Supabase project.

## Step 1: Install Supabase CLI

If you don't have the Supabase CLI installed:

```bash
npm install -g supabase
```

## Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window to authenticate.

## Step 3: Link Your Project

Find your project reference ID in your Supabase dashboard URL:
`https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

Then link your local project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

## Step 4: Deploy the Function

```bash
supabase functions deploy manage-users
```

The function will be deployed to: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/manage-users`

## Step 5: Verify Deployment

1. Go to your Supabase dashboard
2. Navigate to Edge Functions
3. You should see `manage-users` listed
4. Check the logs to ensure it deployed successfully

## Step 6: Test the Function

You can test from the Supabase dashboard or use the test endpoint in your application.

### Test Creating a User

Navigate to Settings → Users in your application and try creating a new user. The function should:
- Generate a random temporary password
- Create the user in Supabase Auth
- Set appropriate metadata (church_id, role, name)
- Return success with the temporary password

## Troubleshooting

### Function Not Found

If you get a 404 error, verify:
- Function was deployed successfully
- You're using the correct project URL
- Function name is exactly `manage-users`

### Authentication Errors

If you get 401/403 errors:
- Ensure the requesting user is authenticated
- Verify the user has `role: 'admin'` in their metadata
- Check that church_id in the request matches the user's church_id

### CORS Errors

CORS headers are already configured in the function. If you still get CORS errors:
- Check browser console for specific error
- Verify the function is deployed correctly
- Try hard refresh (Ctrl+Shift+R)

## Environment Variables

The function automatically has access to these Supabase environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

No additional configuration needed!

## Updating the Function

To update after making changes:

```bash
supabase functions deploy manage-users
```

Changes are deployed immediately.
