# Update User Metadata for Supabase Auth Migration

## Problem
After migrating from `church_users` table to Supabase Auth, existing users don't have `church_id` and `role` in their `user_metadata`. This causes a 401 error when trying to access the Edge Functions.

## Solution: Update User Metadata via Supabase Dashboard

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/lijzdyjqaetdjgiqazsj

2. **Go to Authentication → Users**
   - Click on "Authentication" in the left sidebar
   - Click on "Users"

3. **Find Your User**
   - Look for your email address in the users list
   - Your user ID is: `318cd6b8-aaf8-4988-a564-0ba3aa2ee103`

4. **Edit User Metadata**
   - Click on your user
   - Scroll down to "Raw User Meta Data" section
   - Click "Edit"
   - Add the following JSON (replace with your actual values):

```json
{
  "church_id": 33,
  "role": "admin",
  "first_name": "Josh",
  "last_name": "Your Last Name"
}
```

5. **Save Changes**
   - Click "Save" or "Update"

6. **Log Out and Log Back In**
   - Go back to your application
   - Log out completely
   - Log back in with your credentials

## Verify It Worked

After logging back in, open the browser console and run:
```javascript
const { data } = await supabase.auth.getUser();
console.log(data.user.user_metadata);
```

You should see your `church_id` and `role` in the output.

## Alternative: SQL Script to Update All Existing Users

If you have multiple users that need updating, you can create a Supabase SQL function to migrate metadata from the old system. However, since `church_users` table has been dropped, you'll need to do this manually via the dashboard.
