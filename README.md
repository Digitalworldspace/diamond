# Diamond Portal

A simple, sober white-themed portal for a diamond business, with two panels:

- **Admin panel** — dashboard, stone inventory, customer requests, and a
  **Settings** page to edit every piece of company information.
- **Customer panel** — a stone list with larger images, quick per-stone
  actions (Hold / Confirm), and **bulk actions** (select multiple stones and
  send one request: Hold, Confirm, Request video, Request memo, Request
  certificate).

It's plain HTML/CSS/JS — no build step — so it can be hosted directly on
GitHub Pages, and it uses **Supabase** for authentication and the database.

---

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → create a new project.
2. Once it's ready, open **SQL Editor** and run the schema below.
3. Open **Project Settings → API** and copy your **Project URL** and
   **anon public key**.
4. Paste them into `js/supabase-client.js`:

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

---

## 2. Database schema (SQL)

Paste this whole block into the Supabase **SQL Editor** and run it.

```sql
-- ============ PROFILES (links auth users to a role) ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null check (role in ('admin', 'customer')),
  company_name text,
  created_at timestamptz default now()
);

-- ============ COMPANY SETTINGS (single row, admin-editable) ============
create table company_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  company_name text,
  website text,
  email text,
  phone text,
  logo_url text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  gst_number text,
  pan_number text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  terms_conditions text,
  updated_at timestamptz default now()
);

-- ============ STONES (inventory) ============
create table stones (
  id uuid primary key default gen_random_uuid(),
  stone_id text not null unique,
  image_url text,
  shape text,
  carat numeric,
  color text,
  clarity text,
  cut text,
  fluorescence text,
  measurements text,
  certificate_no text,
  lab text,
  price numeric,
  status text not null default 'available'
    check (status in ('available', 'hold', 'confirmed', 'sold')),
  created_at timestamptz default now()
);

-- ============ STONE REQUESTS (customer actions, incl. bulk) ============
create table stone_requests (
  id uuid primary key default gen_random_uuid(),
  stone_id uuid references stones(id) on delete cascade,
  customer_id uuid references profiles(id) on delete cascade,
  customer_name text,
  customer_email text,
  action_type text not null
    check (action_type in ('hold', 'confirm', 'request_video', 'request_memo', 'request_certificate')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz default now()
);

-- ============ Helper: is the current user an admin? ============
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============ Row Level Security ============
alter table profiles enable row level security;
alter table company_settings enable row level security;
alter table stones enable row level security;
alter table stone_requests enable row level security;

-- profiles: a user can read their own row; admins can read all
create policy "read own profile" on profiles for select using (auth.uid() = id or is_admin());
create policy "admin updates profiles" on profiles for update using (is_admin());
create policy "admin inserts profiles" on profiles for insert with check (is_admin());

-- company_settings: any signed-in user can read; only admins can write
create policy "read company settings" on company_settings for select using (auth.role() = 'authenticated');
create policy "admin writes company settings" on company_settings for insert with check (is_admin());
create policy "admin updates company settings" on company_settings for update using (is_admin());

-- stones: any signed-in user can read; only admins can write
create policy "read stones" on stones for select using (auth.role() = 'authenticated');
create policy "admin inserts stones" on stones for insert with check (is_admin());
create policy "admin updates stones" on stones for update using (is_admin());
create policy "admin deletes stones" on stones for delete using (is_admin());

-- stone_requests: customers see + create their own; admins see + update all
create policy "customer reads own requests" on stone_requests for select using (customer_id = auth.uid() or is_admin());
create policy "customer creates own requests" on stone_requests for insert with check (customer_id = auth.uid() or is_admin());
create policy "admin updates requests" on stone_requests for update using (is_admin());

-- seed the single company_settings row so the admin Settings page has something to update
insert into company_settings (id) values ('00000000-0000-0000-0000-000000000001');
```

---

## 3. Create your first admin user

1. In Supabase, go to **Authentication → Users → Add user**, create an
   account with an email and password (turn off "auto confirm" only if you
   want to send a real confirmation email — for testing, leave auto-confirm
   on).
2. Copy the new user's **UID**.
3. In **SQL Editor**, run:

```sql
insert into profiles (id, email, full_name, role)
values ('paste-the-uid-here', 'admin@yourcompany.com', 'Your Name', 'admin');
```

4. Repeat for each **customer**, using `'customer'` as the role instead.
   Customers sign in with the email/password you set for them — there's no
   public sign-up form, since access is meant to be granted by the admin.

---

## 4. Add your stones

Sign in to `admin.html` with your admin account → **Inventory** → **Add
stone**. Paste an image URL for each stone (you can host images anywhere —
Supabase Storage, Imgur, your own site, etc.).

---

## 5. Fill in company information

Sign in as admin → **Settings** → fill in company name, address, GST/PAN,
bank details, terms, etc. → **Save changes**. This is the single source of
truth for your company's information across the portal.

---

## 6. How customers use it

- The **Stones** list shows every stone with a larger image thumbnail,
  shape, carat, color, clarity, price, and status.
- **Hold** / **Confirm** buttons on each row send a single-stone request.
- Checking multiple rows opens a **bulk action bar** at the bottom — pick
  Hold, Confirm, Request video, Request memo, or Request certificate, add
  an optional note, and send it for the whole selection at once.
- **My requests** shows the status (pending / approved / rejected) of
  everything they've sent.
- Requests don't change stone status immediately — they wait for the admin
  to **approve** them in the admin **Requests** tab, keeping the admin in
  control of inventory.

---

## 7. Deploy to GitHub Pages

1. Create a new GitHub repository and push this whole folder to it.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick
   your default branch (e.g. `main`) and the `/ (root)` folder → **Save**.
4. GitHub gives you a URL like `https://your-username.github.io/your-repo/`
   — that's your live portal. Share `…/index.html` (or just the base URL)
   with your admins and customers.

That's it — no server, no build step. Supabase handles authentication and
the database directly from the browser.

---

## File structure

```
diamond-portal/
├── index.html          # login page (admin + customer)
├── admin.html           # admin panel (dashboard, inventory, requests, settings)
├── customer.html         # customer panel (stone list, bulk actions, my requests)
├── css/style.css         # shared white/sober theme
├── js/supabase-client.js # your Supabase URL + anon key go here
├── js/auth.js            # shared login/session helpers
├── js/admin.js           # admin panel logic
├── js/customer.js        # customer panel logic
└── README.md
```

## Notes on security

The anon key is public by design — Supabase's Row Level Security (RLS)
policies above are what actually protect your data (customers can only see
their own requests, only admins can write to inventory/settings, etc.).
Before going live with real customer data, review the RLS policies against
your own business rules.
