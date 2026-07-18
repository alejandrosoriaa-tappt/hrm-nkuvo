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

-- Pack "CV IA + ATS Checker" ($149 MXN, pago único vía Clip, sin suscripción).
-- No toca "status" (eso sigue siendo solo del plan mensual Pro).
do $$ begin
  begin alter table hrm_subscriptions add column cv_pack_purchased_at timestamptz; exception when duplicate_column then null; end;
  begin alter table hrm_subscriptions add column cv_pack_order_id     text;        exception when duplicate_column then null; end;
end $$;

-- ── Plan único $99 MXN / 30 días (18 jul 2026) ─────────────────────────────
-- Reemplaza el modelo anterior (Pro $299/mes + pack CV IA $149 sueltos):
-- un solo pago único de $99 da acceso a TODO (directorio completo, ATS
-- Checker con IA hasta 5x/mes, LinkedIn Score con IA) durante 30 días.
-- No es suscripción recurrente en Clip — al vencer, el usuario paga de
-- nuevo si quiere seguir. status/current_period_end ya existían y se
-- reusan; current_period_start es nuevo (marca el inicio de la ventana de
-- 30 días, para poder contar el uso de IA "5x/mes" desde ahí).
do $$ begin
  begin alter table hrm_subscriptions add column current_period_start timestamptz; exception when duplicate_column then null; end;
end $$;

-- Contador de usos de funciones con IA limitadas dentro del plan (ej. ATS
-- Checker con IA: 5x/mes). Se cuenta con created_at >= current_period_start.
create table if not exists hrm_usage_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('ats_rewrite','linkedin_ai')),
  created_at  timestamptz default now()
);
alter table hrm_usage_events enable row level security;
create policy "own_usage_events" on hrm_usage_events for all using (auth.uid() = user_id);

-- ── LinkedIn Score ──────────────────────────────────────────────────────
-- Un perfil "activo" por usuario (se sobreescribe al volver a subir/pegar).
-- El score heurístico (gratis) usa solo texto; el análisis por industria
-- con IA requiere plan activo. Ver web/src/pages/MetodologiaLinkedInPage.jsx
-- para la metodología pública de estos criterios.
create table if not exists hrm_linkedin_profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  storage_path       text,           -- PDF exportado de LinkedIn en bucket 'linkedin' (o null si fue texto pegado)
  raw_text           text not null,  -- texto plano extraído (o pegado directamente)
  industria          text,           -- industria elegida por el usuario para el análisis con IA
  heuristic_score    int,
  heuristic_checks   jsonb,
  ai_suggestions     jsonb,
  ai_generated_at    timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
alter table hrm_linkedin_profiles enable row level security;
create policy "own_linkedin_profile" on hrm_linkedin_profiles for all using (auth.uid() = user_id);

-- ── Venta suelta del directorio ($99 MXN, pago único, SIN cuenta) ──────────
-- Landing pública /directorio: solo correo + pago con Clip, sin login. El
-- comprador nunca se vuelve un usuario de auth.users — se identifica por
-- order_ref (va en el "reference" del link de Clip) y se le entrega un
-- download_token de un solo uso tras el webhook de pago confirmado.
create table if not exists hrm_directory_purchases (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  order_ref       text not null unique,
  status          text not null default 'pending' check (status in ('pending','paid')),
  clip_order_id   text,
  download_token  text unique,   -- deprecado 18 jul 2026, ver nota abajo
  downloaded_at   timestamptz,   -- deprecado 18 jul 2026, ver nota abajo
  amount          int default 99,
  created_at      timestamptz default now()
);
-- Sin RLS: solo se accede desde el backend con service_role (no hay sesión
-- de usuario que lo posea al momento de comprar — se le crea una al pagar,
-- ver columnas de abajo).

-- 18 jul 2026: la compra suelta ($99, solo correo) dejó de entregar un
-- Excel de un solo uso y ahora da acceso completo de 30 días a la app
-- (directorio + ATS Checker + LinkedIn Score), sin pedir contraseña. Al
-- confirmarse el pago se crea (o reusa) una cuenta de auth.users para ese
-- correo vía supabase.auth.admin.generateLink, y se activa el plan en
-- hrm_subscriptions para user_id. magic_token_hash es de un solo uso y
-- expira rápido (Supabase Auth) — el frontend lo consume con
-- supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) para loguear
-- sin contraseña. download_token/downloaded_at ya no se usan para nada
-- nuevo (se dejan por historial de compras previas al cambio).
do $$ begin
  begin alter table hrm_directory_purchases add column user_id          uuid references auth.users(id); exception when duplicate_column then null; end;
  begin alter table hrm_directory_purchases add column magic_token_hash text;                             exception when duplicate_column then null; end;
  begin alter table hrm_directory_purchases add column magic_token_type text default 'magiclink';         exception when duplicate_column then null; end;
end $$;
