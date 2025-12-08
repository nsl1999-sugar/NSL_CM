# Technical Documentation: NSL Sugars Coupon Management System

## 1. Project Overview

### Problem Statement
The NSL Sugars Coupon Management System addresses the need for a digital solution to manage sugar distribution to farmers (ryots) in an agricultural cooperative setting. The system replaces manual record-keeping with an automated workflow that tracks farmer eligibility, processes sugar collections, and generates sales reports.

### Target Users
- **Administrators**: Users with admin role who can upload new season data and reset the system
- **Operators**: Authenticated users who process daily sugar collections from farmers
- **Managers**: Users who generate and download sales reports for analysis

### End-to-End System Flow
1. **Season Setup**: Admin uploads Excel file containing farmer data (coupon numbers, ryot numbers, eligible quantities, rates)
2. **Daily Operations**: Operators search for farmers by coupon/ryot number, add them to collection list, and record sales transactions
3. **Reporting**: Users generate date-range-based sales reports exported as Excel files
4. **Season Reset**: Admin can reset the system for a new season, optionally backing up existing data

---

## 2. Frontend Architecture

### Framework and Build Tools
- **Build Tool**: Vite 5.4.19 (fast development server and optimized production builds)
- **Framework**: React 18.3.1 with TypeScript 5.8.3
- **UI Library**: shadcn/ui (Radix UI primitives with Tailwind CSS styling)
- **Styling**: Tailwind CSS 3.4.17 with custom theme configuration
- **Routing**: React Router DOM 6.30.1
- **State Management**: 
  - React hooks (useState, useEffect) for local component state
  - React Query (@tanstack/react-query) for server state caching and synchronization
  - localStorage for persisting user role between sessions

### Main Screens and Purpose

#### Login Page (`/`)
- **Purpose**: User authentication entry point
- **Features**:
  - Email/password authentication via Supabase Auth
  - Automatic session check on mount (redirects if already logged in)
  - Fetches user role from `profiles` table after successful login
  - Stores role in localStorage for quick access
  - Configuration validation (checks for Supabase env variables)

#### Dashboard (`/dashboard`)
- **Purpose**: Central navigation hub after authentication
- **Features**:
  - Three main action cards: Collect Sugar, Sales Report, Upload Excel
  - Logout functionality
  - Protected route (requires authentication)

#### Collect Sugar (`/collect-sugar`)
- **Purpose**: Process daily sugar collection transactions
- **Features**:
  - Search by coupon number or ryot number
  - Real-time farmer lookup from `farmers_table`
  - Duplicate detection (prevents adding same farmer twice)
  - Status tracking (NEW vs ALREADY COLLECTED)
  - Batch payment confirmation with payment mode selection (Cash/QR)
  - Real-time totals calculation (sugar quantity and amount)
  - Inserts records into `sales_table` upon confirmation

#### Sales Report (`/sales-report`)
- **Purpose**: Generate and download sales reports
- **Features**:
  - Date range picker (from/to dates)
  - Queries `sales_table` filtered by `sale_date`
  - Excel export using XLSX library
  - Formatted columns: Coupon No, Ryot No, Name, Sugar Qty, Rate, Amount, Payment Mode, Date

#### Upload Excel (`/upload-excel`)
- **Purpose**: Admin-only feature to upload new season data
- **Features**:
  - Drag-and-drop file upload interface
  - Excel file parsing (supports .xls, .xlsx, .csv)
  - Column mapping: Maps Excel columns to database schema
  - Backup option before reset (downloads existing data as Excel)
  - Calls `reset_farmers_and_sales` RPC function to clear tables
  - Batch insertion (800 records per batch) for performance
  - Role-based access control (admin only)

### State Management Architecture

The application uses a **hybrid state management approach**:

1. **Local Component State**: React `useState` for UI state (form inputs, loading states, selected files)
2. **Server State**: React Query for Supabase data fetching and caching
3. **Session State**: Supabase Auth session managed by `supabase.auth.getSession()` and `onAuthStateChange`
4. **Persistent State**: localStorage for user role (cached to avoid repeated database queries)

**No global state management library** (Redux, Zustand, etc.) is used, as the application's state needs are simple and component-scoped.

### Excel File Upload Flow

The Excel upload process (`UploadExcel.tsx`) works as follows:

1. **File Selection**:
   - User selects/drops Excel file
   - File validation (type checking: `.xls`, `.xlsx`, `.csv`)
   - File stored in component state

2. **File Parsing**:
   - Uses `XLSX` library to read file as ArrayBuffer
   - Converts first worksheet to JSON array
   - Maps Excel columns to `FarmerRow` interface:
     - Column 3 → `coupon_no`
     - Column 1 → `division`
     - Column 2 → `section`
     - Column 4 → `ryot_number` (primary key)
     - Column 5 → `ryot_name`
     - Column 6 → `father_name`
     - Column 7 → `village`
     - Column 8 → `cane_wt`
     - Column 9 → `eligible_qty`
     - Column 10 → `sugar_rate` (defaults to 31.5 if missing)
     - Column 11 → `amount`

3. **Data Validation**:
   - Skips empty rows
   - Requires `ryot_number` (primary key)
   - Deduplicates by `ryot_number` (first occurrence wins)

4. **Database Operations**:
   - Optional backup download (exports current `farmers_table` to Excel)
   - Calls `reset_farmers_and_sales` RPC function (deletes all farmers and sales)
   - Batch inserts parsed farmers (800 per batch) into `farmers_table`

---

## 3. Backend Design

### No Traditional Backend

**This application has NO traditional backend server.** There is no Node.js/Express, Python/Django, or any other server-side application running.

### Supabase as Backend Replacement

Supabase serves as a **Backend-as-a-Service (BaaS)** and handles all backend responsibilities:

1. **Authentication**: Supabase Auth manages user accounts, sessions, and JWT tokens
2. **Database**: PostgreSQL database with REST API and real-time subscriptions
3. **API Layer**: Auto-generated REST endpoints for all tables
4. **Security**: Row Level Security (RLS) policies enforce data access rules
5. **Database Functions**: PostgreSQL functions (like `reset_farmers_and_sales`) for complex operations

### Why This Architecture?

**Advantages**:
- **Rapid Development**: No need to build and maintain backend infrastructure
- **Cost Efficiency**: No server hosting costs (Supabase free tier available)
- **Scalability**: Supabase handles database scaling automatically
- **Security**: Built-in authentication and RLS reduce security implementation burden
- **Real-time Capabilities**: Supabase provides real-time subscriptions (not used in this app, but available)

**Trade-offs**:
- **Limited Custom Business Logic**: Complex server-side logic requires Supabase Edge Functions (not used here)
- **Vendor Lock-in**: Application is tightly coupled to Supabase
- **Frontend-Exposed Keys**: Anon key is in frontend code (mitigated by RLS)

---

## 4. Supabase Architecture

### Authentication Flow

1. **User Login**:
   - Frontend calls `supabase.auth.signInWithPassword({ email, password })`
   - Supabase validates credentials against `auth.users` table
   - Returns JWT session token if valid
   - Session stored in browser (localStorage/sessionStorage)

2. **Session Management**:
   - `ProtectedRoute` component checks session on mount via `supabase.auth.getSession()`
   - Listens to auth state changes via `onAuthStateChange` event
   - Redirects to login if session is invalid/expired

3. **Role Fetching**:
   - After login, frontend queries `profiles` table using authenticated user's ID
   - Role stored in localStorage for quick access (cached to reduce database queries)

### Profiles Table and Role Management

The `profiles` table (not explicitly defined in setup docs, but referenced in code) likely has this structure:

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT -- 'admin' or other roles
);
```

**Role Usage**:
- Admin role (`role = 'admin'`) is checked in `UploadExcel` component
- Non-admin users are blocked from uploading Excel files (frontend check + RLS enforcement)
- Role is cached in localStorage but re-fetched on page load for security

**Note**: The setup documentation doesn't include `profiles` table creation. This must be created manually in Supabase with appropriate RLS policies allowing users to read their own profile.

### Farmers Table Purpose

**Table**: `farmers_table`

**Schema**:
- `ryot_number` (TEXT, PRIMARY KEY): Unique identifier for each farmer
- `coupon_no` (TEXT): Coupon number associated with farmer
- `division`, `section`, `village` (TEXT): Organizational hierarchy
- `ryot_name`, `father_name` (TEXT): Farmer identification
- `cane_wt`, `eligible_qty`, `sugar_rate`, `amount` (NUMERIC): Financial and quantity data

**Purpose**: Stores master data for all farmers eligible for sugar collection in the current season. This is the source of truth for farmer information during collection operations.

### Sales Table Purpose

**Table**: `sales_table`

**Schema**:
- `id` (SERIAL PRIMARY KEY): Auto-incrementing transaction ID
- `coupon_no`, `ryot_number`, `ryot_name` (TEXT): Links to farmer
- `sugar_qty`, `sugar_rate`, `amount` (NUMERIC): Transaction details
- `payment_mode` (TEXT): 'cash' or 'qr'
- `sale_date` (TIMESTAMP): Auto-set to current timestamp on insert

**Purpose**: Transaction log of all sugar sales. Each record represents one collection event. Used for reporting and preventing duplicate collections.

### Row Level Security (RLS) Philosophy

RLS is **PostgreSQL's built-in security feature** that filters rows at the database level based on the authenticated user's context.

**Current RLS Policies**:

1. **farmers_table**:
   - `SELECT`: All authenticated users can read all farmers
   - `INSERT`: All authenticated users can insert farmers
   - `DELETE`: All authenticated users can delete farmers (used by reset function)

2. **sales_table**:
   - `SELECT`: All authenticated users can read all sales
   - `INSERT`: All authenticated users can insert sales

**Philosophy**: The current policies are **permissive** - any authenticated user can perform these operations. This works for a small, trusted team but may need refinement for larger deployments.

### Admin-Only Access Enforcement

Admin-only features are enforced at **two layers**:

1. **Frontend Layer** (`UploadExcel.tsx`):
   - Checks `localStorage.getItem("userRole")` for 'admin'
   - Shows error toast if non-admin tries to upload
   - UI may hide/disable upload button for non-admins

2. **Database Layer** (RLS - should be implemented):
   - **Currently missing**: RLS policies should restrict `DELETE` on `farmers_table` and `sales_table` to admin role only
   - The `reset_farmers_and_sales` RPC function should check user role before executing
   - **Recommendation**: Add RLS policies that check `profiles.role = 'admin'` for destructive operations

**Security Gap**: Currently, any authenticated user could potentially call `reset_farmers_and_sales` RPC if they know the function name, as there's no role check in the database function (assuming it exists but isn't shown in setup docs).

---

## 5. Data Flow

### Login to Dashboard Flow

1. User enters email/password on Login page
2. `handleLogin` calls `supabase.auth.signInWithPassword()`
3. Supabase validates credentials and returns session + JWT token
4. `fetchUserRole()` queries `profiles` table: `SELECT role FROM profiles WHERE id = session.user.id`
5. Role stored in localStorage: `localStorage.setItem("userRole", role)`
6. User redirected to `/dashboard` via `navigate("/dashboard")`
7. `ProtectedRoute` wraps Dashboard and validates session on mount
8. Dashboard renders with three action cards

### Upload Excel → Parse → Insert Flow

1. **File Selection**: User selects Excel file (drag-drop or file picker)
2. **Admin Check**: Component checks `userRole === 'admin'` (from localStorage + re-fetch)
3. **Backup Modal**: User chooses to download backup or skip
4. **Backup Download** (if selected):
   - Query: `SELECT * FROM farmers_table`
   - Convert to Excel using XLSX library
   - Download as `farmers_backup.xlsx`
5. **File Parsing**:
   - Read file as ArrayBuffer
   - Parse with XLSX: `XLSX.read(data, { type: "array" })`
   - Convert first sheet to JSON: `XLSX.utils.sheet_to_json()`
   - Map columns to `FarmerRow` objects
   - Deduplicate by `ryot_number`
6. **Reset Database**:
   - Call: `supabase.rpc("reset_farmers_and_sales")`
   - This function (must exist in Supabase) deletes all rows from `farmers_table` and `sales_table`
7. **Batch Insert**:
   - Split farmers array into batches of 800
   - For each batch: `supabase.from("farmers_table").insert(batch)`
   - RLS policies allow INSERT for authenticated users
8. **Success**: Toast notification shows number of records uploaded

### Sales Entry Workflow

1. **Search**: Operator enters coupon number or ryot number in Collect Sugar page
2. **Lookup**: 
   - First query: `SELECT * FROM farmers_table WHERE ryot_number = lookupValue`
   - If no match: `SELECT * FROM farmers_table WHERE coupon_no = lookupValue`
3. **Duplicate Check**: 
   - Check local state: Is farmer already in `entries` array?
   - Check database: `SELECT id FROM sales_table WHERE ryot_number = farmer.ryot_number`
4. **Add to List**: 
   - If not duplicate, add farmer to local `entries` state
   - Status set to "NEW" or "ALREADY COLLECTED" based on database check
5. **Payment Confirmation**:
   - Operator selects payment method (Cash/QR)
   - Clicks "Confirm Payment"
   - Filter entries: Only "NEW" status entries are processed
   - Final duplicate check: Query `sales_table` for all ryot_numbers in batch
   - Insert: `INSERT INTO sales_table (coupon_no, ryot_number, ryot_name, sugar_qty, sugar_rate, amount, payment_mode) VALUES (...)`
   - Update local state: Mark inserted entries as "ALREADY COLLECTED"

### Reset Season Workflow

The reset workflow is triggered during Excel upload:

1. User uploads new Excel file (admin only)
2. Optional backup download
3. `reset_farmers_and_sales()` RPC function executes:
   ```sql
   -- Pseudocode (actual function must be created in Supabase)
   DELETE FROM sales_table;
   DELETE FROM farmers_table;
   ```
4. New farmer data inserted from Excel
5. System ready for new season

**Note**: The `reset_farmers_and_sales` function must be created in Supabase SQL Editor. It should:
- Be a PostgreSQL function with `SECURITY DEFINER` (runs with elevated privileges to bypass RLS)
- Delete all rows from both tables
- Return success/error status

---

## 6. Security Model

### Anon Key Usage and Safety

The **anon key** (`VITE_SUPABASE_ANON_KEY`) is exposed in the frontend code. This is **safe** because:

1. **RLS Enforcement**: Even with the anon key, users can only access data allowed by RLS policies
2. **Authentication Required**: Most operations require an authenticated session (JWT token), not just the anon key
3. **Limited Scope**: Anon key alone cannot bypass RLS - it's just an identifier for the Supabase project

**How it works**:
- Anon key is sent with every request to identify the Supabase project
- Supabase checks the user's JWT token (from `signInWithPassword`) to determine identity
- RLS policies evaluate based on the authenticated user's context, not the anon key

**Best Practice**: The anon key should still be kept private (not committed to public repos) to prevent abuse, but exposure doesn't compromise data security if RLS is properly configured.

### Frontend-Only Security (No Backend)

The application relies entirely on **Supabase's security model**:

1. **Authentication**: Supabase Auth validates credentials and issues JWT tokens
2. **Authorization**: RLS policies enforce what data users can access/modify
3. **API Security**: Supabase's REST API validates JWT tokens and applies RLS automatically

**Why this works**:
- **Database-Level Security**: RLS policies are evaluated in PostgreSQL, not in application code
- **Token Validation**: Supabase validates JWT tokens server-side before executing queries
- **No Client-Side Bypass**: Even if a malicious user modifies frontend code, they cannot bypass RLS without a valid admin JWT

**Limitation**: Complex business logic (e.g., "user can only delete their own records") requires RLS policies. The current permissive policies may need tightening for production.

### RLS Protection Mechanism

RLS works by **automatically adding WHERE clauses** to every query based on policies:

**Example**:
```sql
-- User queries: SELECT * FROM farmers_table
-- Supabase automatically adds: WHERE [RLS policy condition]
-- If policy is: USING (auth.role() = 'authenticated')
-- Final query: SELECT * FROM farmers_table WHERE auth.role() = 'authenticated'
```

**Current Protection**:
- Unauthenticated users: **Blocked** (no policies allow anonymous access)
- Authenticated users: **Allowed** to read/insert/delete (permissive policies)

**Gap**: No distinction between admin and regular users in RLS. Admin-only operations rely on frontend checks, which can be bypassed.

### Non-Admin Attempt Scenarios

**Scenario 1: Non-admin tries to upload Excel**
- Frontend check: `isAdmin` variable is `false`
- `handleUpload()` shows error toast: "Admin only"
- Upload button may be disabled
- **Bypass Risk**: If user modifies frontend code or calls API directly, they could attempt upload
- **Database Protection**: If `reset_farmers_and_sales` RPC has no role check, it might execute (security gap)

**Scenario 2: Non-admin tries to delete farmers**
- Current RLS: Allows DELETE for all authenticated users
- **Risk**: Any authenticated user could delete all farmers if they know the API
- **Mitigation Needed**: RLS policy should restrict DELETE to admins only

**Recommendation**: Implement RLS policies that check `profiles.role`:
```sql
-- Example (needs to be implemented)
CREATE POLICY "Only admins can delete farmers"
  ON farmers_table FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
```

---

## 7. Deployment

### Hosting on Vercel

The application is designed for deployment on **Vercel** (or similar static hosting):

1. **Build Process**:
   - Vite builds static assets: `npm run build`
   - Output: `dist/` directory with HTML, CSS, JS bundles
   - Vercel detects Vite and runs build automatically

2. **Deployment Steps**:
   - Connect GitHub repository to Vercel
   - Vercel detects `package.json` and builds using `vite build`
   - Static files served via CDN

3. **Environment Variables**:
   - Set in Vercel dashboard: Project Settings → Environment Variables
   - Add: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Vercel injects these at build time (available in browser via `import.meta.env`)

### Environment Variables

**Required Variables**:
- `VITE_SUPABASE_URL`: Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous/public key

**Vite Convention**:
- Variables prefixed with `VITE_` are exposed to client code
- Accessible via `import.meta.env.VITE_SUPABASE_URL`
- `.env.local` for local development (gitignored)
- Vercel environment variables for production

**Security Note**: These are public variables (exposed in browser), but safe due to RLS as explained in Security section.

### Frontend-to-Supabase Connection in Production

1. **Client Initialization** (`src/lib/supabase.ts`):
   ```typescript
   const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );
   ```

2. **Request Flow**:
   - Frontend makes API calls: `supabase.from("farmers_table").select()`
   - Supabase JS client sends HTTPS requests to `VITE_SUPABASE_URL/rest/v1/...`
   - Headers include: `apikey: VITE_SUPABASE_ANON_KEY` and `Authorization: Bearer <JWT>`
   - Supabase validates JWT and applies RLS
   - Returns filtered data

3. **No CORS Issues**: Supabase CORS is configured in Supabase dashboard to allow requests from Vercel domain

---

## 8. Limitations & Future Improvements

### Current Limitations

1. **No Server-Side Validation**:
   - Excel parsing happens in browser (limited by browser memory for large files)
   - No server-side data validation before database insert
   - **Impact**: Large Excel files (>10MB) may cause browser crashes

2. **Permissive RLS Policies**:
   - All authenticated users can delete farmers (security risk)
   - No role-based RLS enforcement for admin operations
   - **Impact**: Accidental or malicious data deletion possible

3. **No Audit Trail**:
   - No logging of who performed which operations
   - No history of data changes
   - **Impact**: Cannot track who uploaded data or made changes

4. **LocalStorage Role Caching**:
   - Role cached in localStorage (can be manually modified)
   - Role re-fetched on page load, but not on every operation
   - **Impact**: Stale role data if admin changes user role in database

5. **No Offline Support**:
   - Requires internet connection for all operations
   - No service worker or PWA capabilities
   - **Impact**: Cannot use system in areas with poor connectivity

6. **Limited Error Handling**:
   - Basic error toasts, but no retry mechanisms
   - No error logging service integration
   - **Impact**: Difficult to debug production issues

7. **No Data Export for Farmers**:
   - Can export sales reports, but no way to export current farmers list
   - **Impact**: Manual backup requires database access

### When Backend or Edge Functions Are Required

A traditional backend or Supabase Edge Functions would be needed for:

1. **Large File Processing**:
   - Excel files >10MB should be processed server-side
   - **Solution**: Upload file to Supabase Storage, trigger Edge Function to parse and insert

2. **Complex Business Logic**:
   - Multi-step transactions with rollback
   - Data validation requiring external APIs
   - **Solution**: Edge Function or backend API endpoint

3. **Scheduled Jobs**:
   - Daily report generation
   - Data cleanup tasks
   - **Solution**: Supabase Cron Jobs or external scheduler calling Edge Function

4. **Advanced Security**:
   - Rate limiting per user
   - IP whitelisting
   - **Solution**: Backend middleware or Edge Function with rate limiting

5. **Integration with External Systems**:
   - SMS notifications
   - Payment gateway integration
   - **Solution**: Backend API or Edge Function (to keep API keys secret)

6. **Real-time Notifications**:
   - Push notifications to operators
   - **Solution**: Supabase Realtime + Edge Function or backend WebSocket server

### Planned Features / Scalability Notes

**Recommended Improvements**:

1. **Enhanced RLS Policies**:
   - Role-based DELETE restrictions
   - User-specific data access (if needed for multi-tenant)
   - Audit logging table with RLS

2. **Database Function Improvements**:
   - `reset_farmers_and_sales` should check user role
   - Add transaction support (BEGIN/COMMIT/ROLLBACK)
   - Return detailed error messages

3. **Frontend Enhancements**:
   - Implement React Query for all data fetching (currently mixed with direct Supabase calls)
   - Add loading states and optimistic updates
   - Implement error boundaries for better error handling

4. **Performance Optimizations**:
   - Pagination for large farmer lists (if search feature expands)
   - Virtual scrolling for large tables
   - Lazy loading of routes

5. **User Experience**:
   - Search/filter functionality in Collect Sugar page
   - Bulk operations (select multiple farmers)
   - Print receipts for collections

6. **Monitoring & Analytics**:
   - Integrate error tracking (Sentry, LogRocket)
   - Add analytics for usage patterns
   - Dashboard with key metrics (total collections, revenue, etc.)

**Scalability Considerations**:

- **Current Capacity**: Suitable for small to medium operations (<10,000 farmers, <100 daily transactions)
- **Bottlenecks**: 
  - Excel upload with >50,000 rows may be slow (browser processing)
  - No pagination in sales report (could timeout with large date ranges)
- **Scaling Path**: 
  - Move Excel processing to Edge Function for large files
  - Add pagination and cursor-based navigation
  - Consider database indexing on frequently queried columns (`ryot_number`, `coupon_no`, `sale_date`)

---

## Appendix: Key Files Reference

- **Entry Point**: `src/main.tsx` - React app initialization
- **Routing**: `src/App.tsx` - Route definitions and providers
- **Supabase Client**: `src/lib/supabase.ts` - Supabase client initialization
- **Auth Guard**: `src/components/ProtectedRoute.tsx` - Authentication wrapper
- **Pages**: `src/pages/*.tsx` - Main application screens
- **UI Components**: `src/components/ui/*.tsx` - shadcn/ui component library
- **Build Config**: `vite.config.ts` - Vite configuration
- **Environment**: `.env.local` - Local environment variables (gitignored)

---

*Document generated for senior engineering review. Last updated: [Current Date]*
