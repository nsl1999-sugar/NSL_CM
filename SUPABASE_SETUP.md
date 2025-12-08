# Supabase Setup Guide

This project uses Supabase for authentication and database. Follow these steps to set up your Supabase project.

## 1. Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in your project details and wait for the project to be created

## 2. Get Your API Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (this is your `VITE_SUPABASE_URL`)
   - **anon public** key (this is your `VITE_SUPABASE_ANON_KEY`)

## 3. Set Up Environment Variables

1. Create a `.env.local` file in the project root (or use `.env` - `.env.local` takes precedence)
2. Add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Note:** 
- Vite automatically loads `.env.local` files
- Environment variables must be prefixed with `VITE_` to be exposed to the client
- `.env.local` is typically gitignored and should not be committed to version control

## 4. Create Database Tables

Go to **SQL Editor** in your Supabase dashboard and run the following SQL:

### Create farmers_table

```sql
CREATE TABLE farmers_table (
  coupon_no TEXT,
  division TEXT,
  section TEXT,
  ryot_number TEXT PRIMARY KEY,
  ryot_name TEXT,
  father_name TEXT,
  village TEXT,
  cane_wt NUMERIC,
  sugar_rate NUMERIC,
  eligible_qty NUMERIC,
  amount NUMERIC
);
```

### Create sales_table

```sql
CREATE TABLE sales_table (
  id SERIAL PRIMARY KEY,
  coupon_no TEXT,
  ryot_number TEXT,
  ryot_name TEXT,
  sugar_qty NUMERIC,
  sugar_rate NUMERIC,
  amount NUMERIC,
  payment_mode TEXT,
  sale_date TIMESTAMP DEFAULT NOW()
);
```

## 5. Set Up Row Level Security (RLS)

Enable RLS and create policies to secure your data:

### For farmers_table

```sql
-- Enable RLS
ALTER TABLE farmers_table ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read farmers"
  ON farmers_table FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated users to insert farmers"
  ON farmers_table FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to delete
CREATE POLICY "Allow authenticated users to delete farmers"
  ON farmers_table FOR DELETE
  TO authenticated
  USING (true);
```

### For sales_table

```sql
-- Enable RLS
ALTER TABLE sales_table ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read sales"
  ON sales_table FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated users to insert sales"
  ON sales_table FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

## 6. Create Users

1. Go to **Authentication** → **Users** in your Supabase dashboard
2. Click "Add user" → "Create new user"
3. Enter email and password for your users
4. Users created here can log in to the application

## 7. Test the Application

1. Start the development server: `npm run dev`
2. Navigate to the login page
3. Log in with one of the users you created
4. Test the upload, collect, and export functionality

## Notes

- All database operations require authentication
- Only users created in Supabase Auth can access the application
- The application uses Row Level Security (RLS) to protect data
- Make sure your `.env` file is in `.gitignore` and never commit it to version control

