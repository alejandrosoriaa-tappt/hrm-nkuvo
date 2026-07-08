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
  user_id             uuid primary key references auth.users(id) on delete cascade,
  status              text not null default 'free'
                        check (status in ('free','active','cancelled','past_due')),
  plan                text default 'suscripcion_mensual', -- único plan: $299 MXN/mes vía Clip
  current_period_end  timestamptz,
  -- Referencias de Clip (nunca almacenamos datos de tarjeta)
  clip_order_id       text,        -- ID del pago/orden en Clip (del postback webhook)
  clip_customer_email text,        -- correo con que el usuario se suscribió en Clip
  cancel_requested_at timestamptz, -- cuándo el usuario solicitó cancelar
  updated_at          timestamptz default now()
);

-- ── Sesión única por dispositivo ─────────────────────────────────────────
-- Un token por usuario activo. Al iniciar sesión se genera uno nuevo y se
-- invalida el anterior. Cada request autenticado compara X-Session-Token
-- contra este registro; si no coincide → 401 "Tu cuenta se abrió en otro
-- dispositivo".
create table if not exists hrm_sessions (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  session_token text not null unique,
  created_at    timestamptz default now(),
  user_agent    text
);

-- ── Rate limit extra: desbloqueos de reclutadora por usuario ──────────────
-- Registra qué reclutadoras ha "desbloqueado" el usuario (visto datos completos).
-- Permite aplicar el límite de 5 gratuitas sin contar IPs.
create table if not exists hrm_unlocked_recruiters (
  user_id       uuid not null references auth.users(id) on delete cascade,
  recruiter_id  uuid not null references hrm_recruiters(id) on delete cascade,
  unlocked_at   timestamptz default now(),
  primary key (user_id, recruiter_id)
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

-- Migración: columnas de Clip agregadas después del schema inicial
-- (seguro correr aunque ya existan, IF NOT EXISTS no aplica a columnas en PG < 15,
--  pero el bloque DO lo maneja)
do $$ begin
  begin alter table hrm_subscriptions add column clip_order_id       text;       exception when duplicate_column then null; end;
  begin alter table hrm_subscriptions add column clip_customer_email text;       exception when duplicate_column then null; end;
  begin alter table hrm_subscriptions add column cancel_requested_at timestamptz; exception when duplicate_column then null; end;
  begin alter table hrm_subscriptions drop column if exists plan; exception when undefined_column then null; end;
  begin alter table hrm_subscriptions add column plan text default 'suscripcion_mensual'; exception when duplicate_column then null; end;
end $$;

-- Reescritura de CV con IA (Pro): cachea el último resultado para no
-- regenerar con Claude cada vez que el usuario abre el modal.
do $$ begin
  begin alter table hrm_cvs add column rewrite_suggestions jsonb;         exception when duplicate_column then null; end;
  begin alter table hrm_cvs add column rewrite_generated_at timestamptz;  exception when duplicate_column then null; end;
end $$;

alter table hrm_sessions enable row level security;
create policy "own_session" on hrm_sessions for all using (auth.uid() = user_id);

alter table hrm_unlocked_recruiters enable row level security;
create policy "own_unlocked" on hrm_unlocked_recruiters for all using (auth.uid() = user_id);
