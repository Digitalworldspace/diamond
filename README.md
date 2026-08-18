# Diamond Portal

A simple, sober white-themed portal for a diamond business, with two panels:

- **Admin panel** — dashboard, stone inventory, customer requests, a
  **Users** page to create/edit logins, and a **Settings** page to edit
  every piece of company information.
- **Customer panel** — a stone list with larger images, quick per-stone
  actions (Hold / Confirm), and **bulk actions** (select multiple stones and
  send one request: Hold, Confirm, Request video, Request memo, Request
  certificate).

It's plain HTML/CSS/JS — no build step — so it can be hosted directly on
GitHub Pages, and it uses **Supabase** as the database.

Login is simple on purpose: no Supabase Auth. Usernames and passwords live
in a plain `users` table that you can edit directly in Supabase's **Table
Editor**, or through the **Users** tab inside the admin panel.

> **Security note:** because there's no auth layer, anyone with your
> project's public API key can read and write these tables directly (the
> key is visible in your page's source once deployed). That's fine for an
> internal tool used only by people you trust, but don't reuse these
> passwords anywhere else, and don't put highly sensitive data in it.

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

Paste this whole block into the Supabase **SQL Editor** and run it. It
creates the tables and adds one starter admin login (`admin` /
`admin123` — **change this password right after your first login**, from
the **Users** tab in the admin panel).

```sql
-- ============ USERS (plain login table — edit directly in Table Editor) ============
create table users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  full_name text,
  email text,
  role text not null check (role in ('admin', 'customer')),
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
  customer_id uuid references users(id) on delete cascade,
  customer_name text,
  customer_email text,
  action_type text not null
    check (action_type in ('hold', 'confirm', 'request_video', 'request_memo', 'request_certificate')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz default now()
);

-- seed the single company_settings row so the admin Settings page has something to update
insert into company_settings (id) values ('00000000-0000-0000-0000-000000000001');

-- seed a starter admin login — change the password after your first sign-in
insert into users (username, password, full_name, email, role)
values ('admin', 'admin123', 'Admin', 'admin@yourcompany.com', 'admin');
```

That's it — no Row Level Security setup needed, since there's no auth
session to check against. All four tables are readable/writable using the
anon key, which is what lets the plain login and Table Editor approach
work.

---

## 3. Sign in

Go to `index.html`, sign in with `admin` / `admin123`, then:

- Open the **Users** tab and change the admin password (or add a new admin
  and delete the starter one).
- Add a login for each customer: **Users → Add user**, pick role
  `Customer`, give them a username and password. They sign in at the same
  `index.html` page.

You can also manage the `users` table straight from Supabase's **Table
Editor** if you prefer — it's the same data either way.

---

## 4. Add your stones

Admin → **Inventory** → **Add stone**. Paste an image URL for each stone
(host images anywhere — Supabase Storage, Imgur, your own site, etc.).

---

## 5. Fill in company information

Admin → **Settings** → fill in company name, address, GST/PAN, bank
details, terms, etc. → **Save changes**. This is the single source of
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

That's it — no server, no build step.

---

## File structure

```
diamond-portal/
├── index.html          # login page (checks the `users` table directly)
├── admin.html           # admin panel (dashboard, inventory, requests, users, settings)
├── customer.html         # customer panel (stone list, bulk actions, my requests)
├── css/style.css         # shared white/sober theme
├── js/supabase-client.js # your Supabase URL + anon key go here
├── js/auth.js            # login/session helpers (localStorage-based)
├── js/admin.js           # admin panel logic
├── js/customer.js        # customer panel logic
└── README.md
```
