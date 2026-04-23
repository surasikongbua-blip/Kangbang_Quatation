# คู่มือสร้าง Supabase Project ใหม่สำหรับ Kang Bang

เอกสารนี้เขียนจากโค้ดในโปรเจ็กต์ `E:\HTML\Kangbang_Quatation-main` โดยตรง เพื่อให้สร้าง Supabase ใหม่แล้วต่อเว็บกลับมาใช้งานได้ทีละขั้น

## สิ่งที่ต้องเตรียม

1. บัญชี Supabase
2. อีเมล Google ที่จะใช้ตั้งค่า OAuth ถ้าต้องการล็อกอินด้วย Google
3. URL ที่ใช้เปิดเว็บจริง
   - ถ้าใช้ GitHub Pages ตามโค้ดเดิม: `https://surasikongbua-blip.github.io/Kangbang_Quatation/`
4. รูปไฟล์ที่เคยอยู่ใน Supabase Storage ถ้ายังมีเก็บไว้
   - โลโก้บริษัท
   - รูปธนาคาร
   - QR ชำระเงิน

## ภาพรวมว่าต้องทำอะไรบ้าง

1. สร้าง Supabase project ใหม่
2. คัดลอก Project URL และ Anon Key ใหม่
3. สร้างตารางฐานข้อมูล
4. เปิด RLS และสร้าง policy
5. สร้าง Storage bucket และอัปโหลดไฟล์
6. ตั้งค่า Authentication
7. สร้างผู้ใช้สำหรับเข้าใช้งาน
8. แก้ค่า URL/Key ในไฟล์เว็บ
9. ทดสอบ login, ลูกค้า, สินค้า, ออกเอกสาร, หน้าชำระเงิน

## Step 1: สร้าง Project ใหม่

1. เข้า [Supabase Dashboard](https://supabase.com/dashboard)
2. กด `New project`
3. เลือก Organization
4. กรอกข้อมูลดังนี้
   - `Name`: ตั้งชื่อโปรเจ็กต์ เช่น `kangbang-quotation`
   - `Database Password`: ตั้งรหัสผ่านแล้วจดเก็บไว้
   - `Region`: เลือกที่ใกล้ผู้ใช้ที่สุด
5. กด `Create new project`
6. รอจนโปรเจ็กต์พร้อมใช้งาน

## Step 2: คัดลอก Project URL และ Anon Key

1. เข้าเมนู `Project Settings`
2. เข้าแท็บ `API`
3. จดค่า 2 ตัวนี้ไว้
   - `Project URL`
   - `anon public key`

จะใช้ 2 ค่านี้ตอนแก้ไฟล์หน้าเว็บ

## Step 3: สร้างตารางฐานข้อมูล

1. เข้าเมนู `SQL Editor`
2. กด `New query`
3. วาง SQL ด้านล่างทั้งหมด
4. กด `Run`

```sql
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  contact_email text,
  display_name text,
  payment_accounts jsonb,
  payment_qr_url text,
  payment_notes text,
  sig_seller text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  unit text not null,
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  name text not null,
  address text,
  email text,
  tax_id text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_user_phone_unique unique (user_id, phone)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null check (doc_type in ('quotation', 'receipt', 'delivery')),
  doc_number text not null unique,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'cancelled')),
  issue_date date not null,
  valid_until date,
  ref_doc_id uuid references public.documents(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_address text,
  customer_email text,
  customer_tax_id text,
  subtotal numeric(12,2) not null default 0,
  vat_percent numeric(5,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  discount_before_vat numeric(12,2) not null default 0,
  discount_after_vat numeric(12,2) not null default 0,
  discount_before_json text,
  discount_after_json text,
  shipping numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  sort_order integer not null default 0,
  product_id uuid references public.products(id) on delete set null,
  product_code text,
  product_name text not null,
  description text,
  unit text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_user_id on public.customers(user_id);
create index if not exists idx_customers_name on public.customers(name);
create index if not exists idx_documents_created_at on public.documents(created_at desc);
create index if not exists idx_documents_doc_type on public.documents(doc_type);
create index if not exists idx_documents_status on public.documents(status);
create index if not exists idx_document_items_document_id on public.document_items(document_id);

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_document_items_updated_at on public.document_items;
create trigger trg_document_items_updated_at
before update on public.document_items
for each row execute function public.set_updated_at();
```

## Step 4: เปิด RLS และสร้าง Policy

หน้าเว็บนี้เรียก Supabase จาก browser ตรงๆ ดังนั้น RLS ต้องตั้งให้ถูก

1. ใน `SQL Editor` เปิด query ใหม่
2. วาง SQL ด้านล่าง
3. กด `Run`

```sql
alter table public.user_profiles enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.documents enable row level security;
alter table public.document_items enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "products_all_authenticated_select" on public.products;
create policy "products_all_authenticated_select"
on public.products
for select
to authenticated
using (true);

drop policy if exists "products_all_authenticated_insert" on public.products;
create policy "products_all_authenticated_insert"
on public.products
for insert
to authenticated
with check (true);

drop policy if exists "products_all_authenticated_update" on public.products;
create policy "products_all_authenticated_update"
on public.products
for update
to authenticated
using (true)
with check (true);

drop policy if exists "products_all_authenticated_delete" on public.products;
create policy "products_all_authenticated_delete"
on public.products
for delete
to authenticated
using (true);

drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own"
on public.customers
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "customers_insert_own" on public.customers;
create policy "customers_insert_own"
on public.customers
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own"
on public.customers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "customers_delete_own" on public.customers;
create policy "customers_delete_own"
on public.customers
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "documents_all_authenticated_select" on public.documents;
create policy "documents_all_authenticated_select"
on public.documents
for select
to authenticated
using (true);

drop policy if exists "documents_all_authenticated_insert" on public.documents;
create policy "documents_all_authenticated_insert"
on public.documents
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "documents_all_authenticated_update" on public.documents;
create policy "documents_all_authenticated_update"
on public.documents
for update
to authenticated
using (true)
with check (created_by = auth.uid());

drop policy if exists "documents_all_authenticated_delete" on public.documents;
create policy "documents_all_authenticated_delete"
on public.documents
for delete
to authenticated
using (true);

drop policy if exists "document_items_all_authenticated_select" on public.document_items;
create policy "document_items_all_authenticated_select"
on public.document_items
for select
to authenticated
using (true);

drop policy if exists "document_items_all_authenticated_insert" on public.document_items;
create policy "document_items_all_authenticated_insert"
on public.document_items
for insert
to authenticated
with check (true);

drop policy if exists "document_items_all_authenticated_update" on public.document_items;
create policy "document_items_all_authenticated_update"
on public.document_items
for update
to authenticated
using (true)
with check (true);

drop policy if exists "document_items_all_authenticated_delete" on public.document_items;
create policy "document_items_all_authenticated_delete"
on public.document_items
for delete
to authenticated
using (true);
```

## Step 5: สร้าง Storage Buckets

จากโค้ดนี้มีอย่างน้อย 2 bucket ที่เกี่ยวข้อง

1. `company-assets`
   - ใช้เก็บโลโก้บริษัท
   - ใช้เก็บ QR จ่ายเงิน
2. `Image`
   - ใช้เก็บรูปโลโก้ธนาคารในหน้า `payment.html`

### 5.1 สร้าง bucket `company-assets`

1. เข้าเมนู `Storage`
2. กด `New bucket`
3. ตั้งชื่อ `company-assets`
4. เปิด `Public bucket`
5. กด `Create bucket`

### 5.2 สร้าง bucket `Image`

1. กด `New bucket`
2. ตั้งชื่อ `Image`
3. เปิด `Public bucket`
4. กด `Create bucket`

### 5.3 สร้าง policy สำหรับอัปโหลด QR

เปิด `SQL Editor` แล้วรัน:

```sql
drop policy if exists "company_assets_public_read" on storage.objects;
create policy "company_assets_public_read"
on storage.objects
for select
to public
using (bucket_id in ('company-assets', 'Image'));

drop policy if exists "company_assets_auth_upload" on storage.objects;
create policy "company_assets_auth_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'qr'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "company_assets_auth_update" on storage.objects;
create policy "company_assets_auth_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'qr'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'qr'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "company_assets_auth_delete" on storage.objects;
create policy "company_assets_auth_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = 'qr'
  and (storage.foldername(name))[2] = auth.uid()::text
);
```

### 5.4 อัปโหลดไฟล์ที่หน้าเว็บต้องใช้

อัปโหลดไฟล์ public ให้ครบอย่างน้อยตามนี้

#### Bucket `Image`

สร้างไฟล์เหล่านี้ใน bucket `Image`

- `KBank.png`
- `SCB.png`
- `bbl.png`
- `KTB.png`
- `Bay.png`
- `TTB.png`
- `GSB.png`
- `BAAC.png`
- `PP.png`

#### Bucket `company-assets`

อัปโหลดโลโก้บริษัทไว้ใน path ตัวอย่างนี้

- `logos/<ชื่อไฟล์โลโก้>.png`

หมายเหตุ: โค้ดเก่าอ้างไฟล์ตรงๆ ด้วย URL เดิมของโปรเจ็กต์เก่า ถ้าจะใช้ไฟล์ชื่อใหม่หรือ path ใหม่ ต้องแก้ URL ในโค้ดด้วย

## Step 6: ตั้งค่า Authentication

### 6.1 เปิด Email Login

1. เข้า `Authentication`
2. เข้า `Providers`
3. เปิด `Email`
4. เปิดใช้งาน `Email/Password`

### 6.2 ตั้งค่า Site URL และ Redirect URL

1. เข้า `Authentication`
2. เข้า `URL Configuration`
3. ตั้งค่า:
   - `Site URL`: URL หลักของเว็บ เช่น `https://surasikongbua-blip.github.io/Kangbang_Quatation/`
   - `Redirect URLs`: เพิ่มอย่างน้อย
     - `https://surasikongbua-blip.github.io/Kangbang_Quatation/dashboard.html`
     - ถ้ามี domain อื่น ให้ใส่เพิ่มให้ครบ

### 6.3 ตั้งค่า Google Login

ถ้าไม่ใช้ Google ข้ามส่วนนี้ได้

1. เข้า `Authentication` > `Providers` > `Google`
2. เปิด Google provider
3. เอา callback URL จาก Supabase ไปใส่ใน Google Cloud Console
4. เอา `Client ID` และ `Client Secret` จาก Google มาใส่ใน Supabase
5. Save

## Step 7: สร้างผู้ใช้สำหรับเข้าเว็บ

วิธีง่ายสุด:

1. เข้า `Authentication` > `Users`
2. กด `Add user`
3. กรอก email และ password
4. สร้าง user

จากนั้นใช้ email/password นี้ล็อกอินหน้า `index.html`

## Step 8: แก้ค่า Project URL และ Anon Key ในไฟล์เว็บ

นำค่าใหม่จาก Step 2 ไปแทนในไฟล์ต่อไปนี้

- `E:\HTML\Kangbang_Quatation-main\index.html`
- `E:\HTML\Kangbang_Quatation-main\dashboard.html`
- `E:\HTML\Kangbang_Quatation-main\customers.html`
- `E:\HTML\Kangbang_Quatation-main\products.html`
- `E:\HTML\Kangbang_Quatation-main\document-new.html`
- `E:\HTML\Kangbang_Quatation-main\document-view.html`
- `E:\HTML\Kangbang_Quatation-main\payment.html`
- `E:\HTML\Kangbang_Quatation-main\settings.html`
- `E:\HTML\Kangbang_Quatation-main\js\supabase.js`

ค่าที่ต้องแทนมีลักษณะนี้

```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_NEW_ANON_KEY'
```

และใน `settings.html` ใช้ชื่อตัวแปร:

```js
const SB_URL = 'https://YOUR-PROJECT.supabase.co'
const SB_KEY = 'YOUR_NEW_ANON_KEY'
```

## Step 9: แก้ URL รูป public ที่ยังอ้างโปรเจ็กต์เก่า

ตอนนี้มีหลายจุดที่อ้าง URL ของ Supabase project เดิมตรงๆ เช่น

- `settings.html`
- `payment.html`
- `document-view.html`

ต้องเปลี่ยน URL เหล่านี้ให้ชี้ไป project ใหม่ของคุณ

รูปแบบใหม่จะเป็นประมาณนี้:

```text
https://YOUR-NEW-PROJECT.supabase.co/storage/v1/object/public/company-assets/logos/your-logo.png
https://YOUR-NEW-PROJECT.supabase.co/storage/v1/object/public/Image/KBank.png
```

## Step 10: ทดสอบระบบทีละหน้า

หลังตั้งค่าครบ ให้ทดสอบตามลำดับนี้

1. เปิด `index.html`
2. ล็อกอินด้วย email/password
3. เปิด `settings.html`
   - บันทึกเบอร์โทร
   - อัปโหลด QR
4. เปิด `products.html`
   - เพิ่มสินค้า 1 รายการ
5. เปิด `customers.html`
   - เพิ่มลูกค้า 1 รายการ
6. เปิด `document-new.html`
   - สร้างใบเสนอราคา
7. เปิด `document-view.html`
   - ตรวจดูรายการสินค้า ยอดรวม และลายเซ็น
8. เปิด `payment.html`
   - ตรวจว่ารูปโลโก้ธนาคารและ QR แสดงผล
9. เปิด `dashboard.html`
   - ตรวจว่าเอกสารขึ้นในรายการ

## เช็กลิสต์แก้ปัญหา ถ้าล็อกอินได้แต่หน้าอื่น error

### อาการ: login ได้ แต่หน้า dashboard ว่าง

ให้เช็ก:

- ตาราง `documents` ถูกสร้างแล้ว
- RLS ของ `documents` และ `document_items` ถูกสร้างแล้ว

### อาการ: บันทึกสินค้าไม่ได้

ให้เช็ก:

- ตาราง `products` มีจริง
- `code` ต้องไม่ซ้ำ

### อาการ: บันทึกลูกค้าไม่ได้

ให้เช็ก:

- ตาราง `customers` มีจริง
- unique `(user_id, phone)` มีอยู่

### อาการ: อัปโหลด QR ไม่ได้

ให้เช็ก:

- bucket `company-assets` มีจริง
- bucket เป็น public
- storage policy สำหรับ upload ถูกสร้างแล้ว

### อาการ: รูปธนาคารหรือโลโก้ไม่ขึ้น

ให้เช็ก:

- มีไฟล์จริงใน Storage
- URL ในโค้ดเปลี่ยนเป็น project ใหม่แล้ว
- bucket เป็น public

### อาการ: Google login เด้งกลับไม่ถูกหน้า

ให้เช็ก:

- `Authentication` > `URL Configuration`
- `Redirect URLs` มี `.../dashboard.html`
- Google Cloud Console ใส่ callback URL จาก Supabase ถูกต้อง

## หมายเหตุสำคัญ

1. โปรเจ็กต์นี้ hardcode `SUPABASE_URL` และ `ANON_KEY` ไว้หลายไฟล์
2. โปรเจ็กต์นี้เป็นเว็บ static ที่เรียก Supabase จากฝั่ง browser ตรงๆ จึงต้องพึ่ง RLS มาก
3. ถ้าต้องการลดงานตอนย้ายรอบถัดไป ควรรวม config ไปไว้ไฟล์เดียว
4. ถ้าไม่มีไฟล์ Storage เก่าอยู่แล้ว หน้าเว็บยังทำงานได้บางส่วน แต่รูปโลโก้และรูปธนาคารจะหาย

## ตำแหน่งไฟล์อ้างอิงในโปรเจ็กต์

- หน้า login: `E:\HTML\Kangbang_Quatation-main\index.html`
- หน้า dashboard: `E:\HTML\Kangbang_Quatation-main\dashboard.html`
- หน้าลูกค้า: `E:\HTML\Kangbang_Quatation-main\customers.html`
- หน้าสินค้า: `E:\HTML\Kangbang_Quatation-main\products.html`
- หน้าออกเอกสาร: `E:\HTML\Kangbang_Quatation-main\document-new.html`
- หน้าดูเอกสาร: `E:\HTML\Kangbang_Quatation-main\document-view.html`
- หน้าชำระเงิน: `E:\HTML\Kangbang_Quatation-main\payment.html`
- หน้าตั้งค่า: `E:\HTML\Kangbang_Quatation-main\settings.html`
- shared supabase client: `E:\HTML\Kangbang_Quatation-main\js\supabase.js`

## งานถัดไปที่แนะนำ

หลังสร้าง Supabase ใหม่เสร็จ แนะนำทำต่ออีก 2 อย่าง

1. ย้ายค่า Supabase URL/Key ให้เหลือจุดแก้เดียว
2. เปลี่ยน URL รูป public ที่ hardcode อยู่ ให้ประกอบจาก `SUPABASE_URL` อัตโนมัติ
