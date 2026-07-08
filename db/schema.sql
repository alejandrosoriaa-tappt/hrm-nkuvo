-- HRM NKUVO — esquema borrador (Supabase Postgres, mismo proyecto que Tappt/NKUVO)
-- Pendiente de revisión antes de aplicar. Usa auth.users de Supabase como
-- fuente de identidad (no hay tabla de usuarios propia).

create table if not exists hrm_recruiters (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  industria     text,           -- especialidad: mandos medios, ejecutivo, IT, etc.
  sitio_web     text,
  email         text,
  telefono      text,
  ciudad        text,
  fuente        text,           -- 'curado' | 'colaborativo' (quién lo agregó)
  created_at    timestamptz default now()
);

create table if not exists hrm_contacts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  recruiter_id      uuid not null references hrm_recruiters(id) on delete cascade,
  status            text not null default 'contactado' check (status in ('contactado','en_proceso','respuesta','descartado')),
  notas             text,
  fecha_contacto    timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (user_id, recruiter_id)
);

create table if not exists hrm_cvs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  nombre        text not null,          -- ej. "CV - Gerencia Comercial"
  storage_path  text not null,          -- ruta en bucket 'cvs' de Supabase Storage
  ats_score     int,                    -- resultado del último check
  created_at    timestamptz default now()
);
-- Límite de 5 variantes por usuario: se valida en el backend antes del insert
-- (no hay forma limpia de expresarlo como constraint sin un trigger).

create table if not exists hrm_appointments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  recruiter_id  uuid references hrm_recruiters(id) on delete set null,
  descripcion   text,
  fecha_cita    timestamptz not null,
  completado    boolean default false,
  created_at    timestamptz default now()
);

create table if not exists hrm_subscriptions (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  status        text not null default 'free' check (status in ('free','active','cancelled','past_due')),
  plan          text default 'basico',       -- $299 MXN/mes acordado como ancla inicial
  current_period_end timestamptz,
  updated_at    timestamptz default now()
);

-- RLS: cada usuario solo ve lo suyo. hrm_recruiters es de lectura pública
-- (el gating de contacto/email se hace en el backend, no en RLS, porque
-- depende de "cuántos ha desbloqueado" — lógica de negocio, no de fila).
alter table hrm_contacts enable row level security;
alter table hrm_cvs enable row level security;
alter table hrm_appointments enable row level security;
alter table hrm_subscriptions enable row level security;

create policy "own_contacts" on hrm_contacts for all using (auth.uid() = user_id);
create policy "own_cvs" on hrm_cvs for all using (auth.uid() = user_id);
create policy "own_appointments" on hrm_appointments for all using (auth.uid() = user_id);
create policy "own_subscription" on hrm_subscriptions for select using (auth.uid() = user_id);
