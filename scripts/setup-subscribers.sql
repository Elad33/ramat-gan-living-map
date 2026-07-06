-- טבלת נרשמים לעדכוני אירועים — המפה החיה של רמת גן
-- הרצה: SQL Editor בפרויקט RamatGanMap (או אוטומטית דרך ה-Management API)

create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email = lower(email) and length(email) <= 254),
  source     text not null default 'map-popup',
  created_at timestamptz not null default now()
);

-- RLS פעיל בלי אף policy ציבורית: רק service_role (מהשרת שלנו) יכול לקרוא/לכתוב.
alter table public.subscribers enable row level security;

comment on table public.subscribers is
  'נרשמים לעדכוני אירועים מהמפה החיה. כתיבה דרך api/subscribe.js בלבד (service role).';

-- הטבלה נוצרת דרך ה-Management API, שם ברירות המחדל לא מעניקות הרשאות —
-- הפונקציה שלנו (service_role) צריכה גישה מפורשת:
grant usage on schema public to service_role;
grant all on table public.subscribers to service_role;
