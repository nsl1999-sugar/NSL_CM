# NSL Sugars Coupon Management System

## Project Overview

The **NSL Sugars Coupon Management System** is a web-based application designed to manage seasonal sugar distribution to farmers (ryots).  
It digitizes farmer records, sugar eligibility, daily sales transactions, and report generation, replacing manual and paper-based workflows.

The application is deployed as a normal website and uses **Supabase** for authentication and database services.

---

## Key Features

- Secure login using email and password
- Admin-only upload of farmer data via Excel
- Seasonal data reset for new sugar seasons
- Search farmers by coupon number or ryot number
- Record daily sugar sales (cash / QR)
- Prevent duplicate sugar collection
- Download sales reports as Excel files
- Fully frontend-based with database-level security

---

## Tech Stack

- **Frontend**: React + TypeScript
- **Build Tool**: Vite
- **UI & Styling**: Tailwind CSS, shadcn/ui
- **Backend Services**: Supabase (Authentication, PostgreSQL, RLS)
- **Hosting**: Vercel

---

## How the Application Works

1. User opens the website and logs in.
2. Authentication is handled by Supabase.
3. After login, admin users can:
   - Upload Excel files to load farmer data for the season
   - Record daily sugar sales
   - Download sales reports
4. All data is stored securely in Supabase.
5. Access control is enforced using **Row Level Security (RLS)**.
6. No traditional backend server is used.

---

## User Access Model

- Only users created in **Supabase Authentication** can log in.
- Admin privileges are managed through a `profiles` table.
- Admin-only actions are enforced both in the frontend and database.

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
