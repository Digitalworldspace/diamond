# Diamond Portal

A simple, sober white-themed portal for a diamond business, with two panels:

- **Admin panel** — dashboard, stone inventory (matches your spreadsheet
  columns exactly), **Excel bulk import** with smart column matching,
  customer requests, a **Users** page for logins, and **Settings** with a
  real logo file upload (JPEG/PNG).
- **Customer panel** — a stone list with larger images, quick per-stone
  actions (Hold / Confirm), and **bulk actions** (select multiple stones,
  send one request: Hold, Confirm, Request video, Request memo, Request
  certificate).

Everything is **live in both directions**: changes made in the portal save
straight to Supabase, and changes made directly in Supabase (Table Editor,
another admin, a script) appear in the portal automatically — no page
refresh needed.

It's plain HTML/CSS/JS — no build step — so it hosts directly on GitHub
Pages, using **Supabase** for the database and file storage.

Login is a plain `users` table (no Supabase Auth) — manage logins from the
**Users** tab in the admin panel, or directly in Supabase's Table Editor.

> **Security note:** because there's no auth layer, anyone with your
> project's public API key can read/write these tables and the storage
> bucket directly (the key is visible in your deployed page's source).
> Fine for an internal tool used only by people you trust — don't reuse
> these passwords elsewhere, and don't put highly sensitive data in it.

---

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → create a new project.
2. Open **SQL Editor** and run the schema below (one block, top to bottom).
3. Open **Project Settings → API** and copy your **Project URL** and
   **anon public key** into `js/supabase-client.js`:

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

---

## 2. Database schema (SQL)

Run this whole block in the Supabase **SQL Editor**. If you're re-running
this after an earlier version of the portal, it drops the old tables first
(this deletes any stones/data you already added — see the note at the
bottom if you need to keep existing data instead).

```sql
-- ============ Clean slate ============
drop table if exists stone_requests cascade;
drop table if exists stones cascade;
drop table if exists company_settings cascade;
drop table if exists profiles cascade;
drop table if exists users cascade;
drop function if exists is_admin();

-- ============ USERS (plain login table) ============
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

-- ============ STONES — columns match your spreadsheet exactly ============
create table stones (
  id uuid primary key default gen_random_uuid(),
  stone_id text not null unique,       -- STONE ID
  location text,                       -- LOCATION
  shape text,                          -- SHAPE
  cts numeric,                         -- CTS
  size text,                           -- SIZE
  colour text,                         -- COLOUR
  clarity text,                        -- CLARITY
  cut text,                            -- CUT
  polish text,                         -- PO
  symmetry text,                       -- SYM
  fluorescence text,                   -- FLS
  price_per_ct numeric,                -- CT/PR $
  total_price numeric,                 -- TOTAL PRICE $
  measurement text,                    -- MEASURMENT
  table_percent numeric,               -- TABLE %
  depth_percent numeric,               -- DEPTH %
  video_url text,                      -- VIDEO
  report_no text,                      -- REPORT NO
  lab text,                            -- LAB
  company_comment text,                -- COMPANY COMMENT
  image_url text,                      -- IMAGE
  stock_status text not null default 'available'
    check (stock_status in ('available', 'hold', 'confirmed', 'sold')),  -- STOCK STATUS
  certificate_link text,               -- CERTIFICATE LINK
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

insert into company_settings (id) values ('00000000-0000-0000-0000-000000000001');

-- starter admin login — change the password after your first sign-in
insert into users (username, password, full_name, email, role)
values ('admin', 'admin123', 'Admin', 'admin@yourcompany.com', 'admin');

-- ============ STORAGE — for the company logo (and stone photos, if you upload any) ============
insert into storage.buckets (id, name, public)
values ('portal-assets', 'portal-assets', true)
on conflict (id) do nothing;

create policy "Public read portal-assets" on storage.objects
  for select using (bucket_id = 'portal-assets');
create policy "Public upload portal-assets" on storage.objects
  for insert with check (bucket_id = 'portal-assets');
create policy "Public update portal-assets" on storage.objects
  for update using (bucket_id = 'portal-assets');
create policy "Public delete portal-assets" on storage.objects
  for delete using (bucket_id = 'portal-assets');

-- ============ REALTIME — so changes sync live, both directions ============
alter table stones replica identity full;
alter table stone_requests replica identity full;
alter table company_settings replica identity full;
alter table users replica identity full;

alter publication supabase_realtime add table stones;
alter publication supabase_realtime add table stone_requests;
alter publication supabase_realtime add table company_settings;
alter publication supabase_realtime add table users;
```

**Keeping existing data instead of dropping it:** if you already have real
stones in the old `stones` table and don't want to lose them, skip the
`drop table` lines, and instead run `alter table stones add column …` for
each new column you're missing, then rename any old ones (e.g.
`alter table stones rename column carat to cts;`). Ask me and I'll write
the exact migration for your current columns.

---

## 3. Sign in

Go to `index.html`, sign in with `admin` / `admin123`, then:

- **Users** tab → change the admin password (or add a new admin and delete
  the starter one).
- **Users → Add user** for each customer, role `Customer`.

---

## 4. Add stones — one at a time, or in bulk from Excel

**One at a time:** Admin → **Inventory** → **+ Add stone**, fill in the
form (all your spreadsheet fields are there), save.

**In bulk from Excel/CSV:** Admin → **Inventory** → **Import Excel**.

1. Choose your `.xlsx`, `.xls`, or `.csv` file. The first row must be
   column headers.
2. The portal automatically matches your headers to its fields — for
   example a column called `PACKET ID` or `LOT NO` is recognised as
   **Stone ID** automatically, `CTS`/`CARAT`/`WEIGHT` all map to **Cts**,
   `CT/PR $`/`RATE` map to **Price/Ct**, and so on. You'll see every column
   with its matched field in a dropdown — fix anything that guessed wrong,
   or set a column to "Skip" if you don't want to import it.
3. Click **Import stones**. Rows are matched to existing stones by
   **Stone ID** — a matching Stone ID updates that stone, a new one adds a
   new row. Large files are imported in batches automatically.

---

## 5. Upload your logo

Admin → **Settings** → **Upload logo** → choose a JPEG or PNG. It uploads
to Supabase Storage and shows a preview; click **Save changes** to apply it
across the portal.

---

## 6. Live sync, both directions

- Anything you add, edit, or delete **in the portal** (stones, requests,
  users, settings) saves to Supabase immediately — that's just normal
  saving.
- Anything changed **directly in Supabase** — editing a row in Table
  Editor, another admin working at the same time, a script, an import —
  appears in every open portal tab automatically, live, without a refresh.
  This is powered by Supabase Realtime, enabled by the
  `alter publication …` lines in the schema above.

---

## 7. How customers use it

- The **Stones** list shows every stone with a larger image thumbnail,
  shape, cts, colour, clarity, price, and status.
- **Hold** / **Confirm** buttons on each row send a single-stone request.
- Checking multiple rows opens a **bulk action bar** — pick Hold, Confirm,
  Request video, Request memo, or Request certificate, add an optional
  note, and send it for the whole selection at once.
- **My requests** tracks the status (pending / approved / rejected) of
  everything they've sent.
- Requests wait for the admin to **approve** them in the admin **Requests**
  tab before a stone's status changes — the admin stays in control.

The admin **Inventory** tab also has its own bulk actions: select stones
and mark them Available / Hold / Confirmed / Sold, or delete several at
once.

---

## 8. Deploy to GitHub Pages

1. Push this whole folder to a GitHub repository.
2. Repo → **Settings → Pages** → **Deploy from a branch** → your default
   branch, `/ (root)` folder → **Save**.
3. GitHub gives you a URL like `https://your-username.github.io/your-repo/`
   — share that with your team and customers.

---

## File structure

```
diamond-portal/
├── index.html          # login page (checks the `users` table directly)
├── admin.html           # dashboard, inventory + Excel import, requests, users, settings
├── customer.html         # stone list, bulk actions, my requests
├── css/style.css         # shared white/sober theme
├── js/supabase-client.js # your Supabase URL + anon key go here
├── js/auth.js            # login/session helpers + shared utilities
├── js/admin.js           # admin panel logic, incl. Excel import + realtime
├── js/customer.js        # customer panel logic + realtime
└── README.md
```
