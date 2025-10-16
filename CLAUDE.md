# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a church leadership assessment and team management application built with React, TypeScript, Vite, and Supabase. It helps churches assess their members using a 4-quadrant personality profile system, organize them into teams, and integrate with Planning Center Online.

**Core Features:**
- Leadership assessment tracking using 4-quadrant profiles (Ideas/People × Present/Possible)
- Team and leadership layer management
- Planning Center Online OAuth integration
- Analytics and insights dashboards
- Multi-site church support
- Role-based access control (admin/user)

## Development Commands

### Local Development
```bash
npm run dev          # Start Vite dev server (default: http://localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
```

## Architecture

### Authentication & Security

**Supabase Auth System**: The app uses Supabase Auth for authentication. Authentication logic lives in `src/utils/auth.ts`:
- Built-in Supabase password hashing and validation
- Session management via Supabase Auth with localStorage fallback
- User metadata stored in `auth.users.user_metadata` (church_id, role, first_name, last_name, force_password_change)
- Rate limiting for login attempts (client-side)
- Force password change flow for new users via user_metadata flag
- User management handled by Edge Function (`manage-users`) with service_role access

**Multi-tenant Security**: The app is multi-tenant with strict church-level data isolation:
- Row Level Security (RLS) enforced at Supabase level using JWT claims
- JWT-based RLS policies check `user_metadata.church_id` via `get_user_church_id()` function
- Application-level church_id filtering in all queries via `createSecureChurchQuery()` and `secureQuery()`
- Church access validation via `validateChurchAccess()` before any data operations
- Session church_id set via `setSessionChurchId()` for additional RLS context

**Security Utilities** (`src/lib/supabase.ts`):
- `logSecurityEvent()` - Security event logging
- `SecurityError` - Custom security error class
- `RateLimitError` - Rate limiting error handling
- `canAddUser()` - Enforces user limits based on church plan (basic: 2 users, plus: 10 users)

### Data Model

**Core Tables** (see TypeScript interfaces in `src/lib/supabase.ts`):
- `churches` - Church organizations (multi_site flag, Planning Center credentials)
- `auth.users` - Supabase Auth users with metadata (church_id, role, first_name, last_name, force_password_change in user_metadata)
- `assessments` - Leadership assessments with 4-quadrant profiles
- `teams` - Church teams (can sync with Planning Center teams via planning_center_team_id)
- `leadership_layers` - Hierarchical leadership levels
- `team_assignments` - Links assessments to teams and leadership layers

**Profile System** (`QUADRANT_PROFILES` in `src/lib/supabase.ts`):
- Ideas Present (Blue): Action, Efficiency, Practicality, Systematization
- People Possible (Green): Collaboration, Enthusiasm, Inspiration, Virtue
- People Present (Yellow): Connection, Dependability, Passion, Support
- Ideas Possible (Red): Determination, Energy, Knowledge, Strategy

### Application Structure

**Routing** (`src/App.tsx`): Client-side routing with react-router-dom
- `/` - Dashboard (overview stats and trends)
- `/teams` - Team management with Planning Center sync
- `/people-matching` - Assessment intake form
- `/analytics` - Quadrant distribution charts
- `/results` - Assessment results table with filtering
- `/insights` - Team composition insights
- `/resources` - Static resources page
- `/settings` - User management and Planning Center integration
- `/settings/planning-center/callback` - OAuth callback handler

**Layout**: Responsive layout with mobile-friendly sidebar
- `src/components/Layout/Header.tsx` - Top navigation with menu toggle
- `src/components/Layout/Sidebar.tsx` - Side navigation (collapsible on mobile)

**State Management**: No global state library. State managed via:
- `useAuth()` hook for authentication state (user, churchId, role, forcePasswordChange)
- Component-level useState/useEffect
- Direct Supabase queries in components

### Planning Center Integration

**OAuth Flow**:
1. User initiates connection in Settings page
2. OAuth authorization via Planning Center with PKCE flow
3. Callback to `/settings/planning-center/callback`
4. Token exchange handled by backend API (`api/planning-center/oauth/exchange.ts`)
5. Tokens stored in `churches` table (planning_center_access_token, planning_center_refresh_token)

**Note**: The backend API endpoint in `api/planning-center/oauth/exchange.ts` is a Next.js-style reference implementation. Actual backend implementation may vary.

**Sync Features**:
- Import teams from Planning Center
- Link assessments to Planning Center people via planning_center_person_id
- Bidirectional team membership sync

### Key Utilities

**`src/utils/auth.ts`**:
- Supabase Auth integration (signIn, signOut)
- Session management (Supabase Auth + localStorage fallback)
- Client-side rate limiting for login attempts
- CSRF token generation and validation
- Password change via Supabase Auth API

**`src/utils/pdfExport.ts`**:
- Export assessment results to PDF using jspdf and html2canvas
- Formatted reports with church branding

**`src/utils/nicknames.ts`**:
- Name variation matching (e.g., "Bob" → "Robert")
- Helps link Planning Center people to assessments

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_PLANNING_CENTER_CLIENT_ID=your_pco_client_id
VITE_PLANNING_CENTER_CLIENT_SECRET=your_pco_client_secret
```

**WARNING**: Never commit actual credentials. The Planning Center client secret should be backend-only in production.

## Database Migrations

Supabase migrations are in `supabase/migrations/`. Migrations handle:
- Schema creation and updates
- RLS policies
- Password hash format migrations
- Data integrity constraints

To apply migrations, use Supabase CLI or run through Supabase dashboard.

## Common Patterns

### Using the Church Session Hook

All pages that query church-specific data MUST use the `useChurchSession` hook to prevent race conditions:

```typescript
import { useChurchSession } from '@/hooks/useChurchSession';

const MyPage: React.FC = () => {
  const { churchId } = useAuth();
  const { isReady: sessionReady, sessionStatus, sessionError, initializeSession } = useChurchSession(churchId);

  useEffect(() => {
    // IMPORTANT: Always check sessionReady before loading data
    if (sessionReady && churchId) {
      loadData();
    }
  }, [sessionReady, churchId]);

  // Show error state if session fails
  if (sessionStatus === 'error') {
    return <ErrorDisplay message={sessionError} onRetry={initializeSession} />;
  }

  // Show loading state while initializing
  if (sessionStatus === 'initializing' || !sessionReady) {
    return <LoadingSpinner />;
  }

  // Now safe to render and query data
  return <YourContent />;
};
```

The hook implements a singleton pattern to ensure `setSessionChurchId` is only called once per church, even if multiple pages/components mount simultaneously.

### Making Secure Database Queries

Always use security wrappers when querying data:

```typescript
import { createSecureChurchQuery, validateChurchAccess } from '@/lib/supabase';

// For read operations
const query = createSecureChurchQuery('assessments', churchId, userId);
const { data, error } = await query.select('*');

// For write operations (requires CSRF token)
import { getCSRFToken } from '@/utils/auth';
const csrfToken = getCSRFToken();
const queryBuilder = await secureQuery('teams', churchId, userId, 'insert', csrfToken);
const { data, error } = await queryBuilder.insert({ name: 'New Team', church_id: churchId });
```

### Managing Users

User management is handled by the `manage-users` Edge Function (not direct client queries):

```typescript
// Create a new user (admin only)
const { data, error } = await supabase.functions.invoke('manage-users', {
  body: {
    action: 'create',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
    role: 'user'
  }
});

// Reset user password (admin only)
const { data, error } = await supabase.functions.invoke('manage-users', {
  body: {
    action: 'reset_password',
    user_id: 'uuid',
    temporary_password: 'TempPass123!'
  }
});
```

### Checking User Permissions

```typescript
import { useAuth } from '@/hooks/useAuth';

const { isAdmin, churchId, user } = useAuth();

if (isAdmin) {
  // Admin-only functionality
}
```

### Working with Quadrants

```typescript
import { QUADRANT_PROFILES, QUADRANT_COLORS } from '@/lib/supabase';

// Determine quadrant from profile
const getQuadrant = (profile: string) => {
  for (const [quadrant, profiles] of Object.entries(QUADRANT_PROFILES)) {
    if (profiles.includes(profile as any)) {
      return quadrant;
    }
  }
};

// Get color for quadrant
const color = QUADRANT_COLORS['ideas_present']; // #98D6D7
```

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS with custom theme
- **Charts**: Recharts for analytics visualizations
- **Forms**: React Hook Form with Yup validation
- **Icons**: Lucide React
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth with JWT-based RLS
- **PDF Export**: jsPDF + html2canvas
- **Integrations**: Planning Center Online OAuth

## Security Considerations

- All database queries MUST filter by church_id (multi-tenant isolation)
- JWT-based RLS policies enforce church_id isolation at database level
- User metadata (church_id, role) stored in Supabase Auth and validated in JWT claims
- State-changing operations MUST validate CSRF tokens
- Passwords managed by Supabase Auth (built-in bcrypt hashing)
- Client-side rate limiting on login attempts
- Security event logging for audit trails
- User input sanitization in all security-critical functions
- User management requires Edge Function with service_role access (never exposed to client)
- Anytime you update any project files, you need to tell me specifically what files were changed so I can push that manually to my repo.