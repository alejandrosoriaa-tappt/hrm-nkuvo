# Migración de base de datos — HRM NKUVO

## Cómo aplicar el schema a Supabase

El esquema completo está en `db/schema.sql`. Aplícalo **una sola vez** en el
SQL Editor de Supabase (mismo proyecto que Tappt/NKUVO).

### Opción 1 — SQL Editor en el dashboard de Supabase (recomendada)

1. Ve a `https://supabase.com/dashboard/project/<tu-project-id>/sql`
2. Copia el contenido de `db/schema.sql`
3. Pega y ejecuta

### Opción 2 — psql desde terminal

```bash
# Obtén la connection string desde Supabase > Settings > Database > URI
psql "$DATABASE_URL" -f db/schema.sql
```

### Opción 3 — Supabase CLI

```bash
supabase db push   # si tienes el CLI instalado y el proyecto vinculado
```

---

## Tablas creadas

| Tabla | Descripción |
|-------|------------|
| `hrm_recruiters` | Directorio curado de reclutadoras |
| `hrm_contacts` | Seguimiento de contacto candidato↔reclutadora |
| `hrm_cvs` | Metadatos de CVs (archivo en Storage bucket `cvs`) |
| `hrm_appointments` | Agenda de citas |
| `hrm_subscriptions` | Plan de cada usuario (free / active / cancelled) |
| `hrm_sessions` | Token activo por usuario (sesión única por dispositivo) |
| `hrm_unlocked_recruiters` | Tracking de reclutadoras con datos desbloqueados (freemium) |
| `hrm_usage_events` | Conteo de usos de IA limitados del plan (ATS rewrite, LinkedIn IA — 5x/mes) |
| `hrm_linkedin_profiles` | Perfil de LinkedIn del usuario (PDF o texto pegado) + score + análisis IA |

## Supabase Storage — buckets `cvs` y `linkedin`

Crea los buckets **manualmente** en `Storage > New bucket`:
- Nombre: `cvs` — **Privado** (no público) — el backend usa service_role para subir/bajar archivos
- Nombre: `linkedin` — **Privado** — PDFs exportados de LinkedIn ("Más" → "Guardar en PDF")

## Variables de entorno en Railway

Configúralas en `Railway > Service > Variables`:

```
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Cuentas demo (para ventas/redes): estos correos se tratan como Pro sin
# pasar por Clip. Deben registrarse normal en /signup, y una vez con ese
# correo en la lista, ven todo desbloqueado automáticamente.
DEMO_EMAILS=demo1@nkuvo.com,demo2@nkuvo.com

# SMTP (para envío de CVs por correo)
SMTP_HOST=smtp.gmail.com       # o tu proveedor
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu@email.com
SMTP_PASS=tu_app_password      # Gmail: contraseña de aplicación, no la de cuenta

# Sugerir con IA — ATS Checker y LinkedIn Score (plan $99/30 días). Sin esta
# key, el ATS rewrite responde con heurísticas y LinkedIn IA responde 503;
# con key usa Claude (claude-sonnet-5 por defecto).
ANTHROPIC_API_KEY=sk-ant-...
# Opcional: override de modelo
# ANTHROPIC_MODEL=claude-sonnet-5
# Opcional: límite mensual de usos de IA del plan (ATS rewrite / LinkedIn IA). Default 5.
# AI_USAGE_MONTHLY_LIMIT=5

# Tappt — recordatorios de citas por WhatsApp (mismas keys que nkuvo-crm-backend).
# notify_to = teléfono del candidato (user_metadata.telefono), no un número fijo.
# Primer contacto / >14 días sin WA → use_template (Tappt usa TAPPT_TEMPLATE_PRO).
TAPPT_API_URL=https://www.tappt.lat
TAPPT_API_KEY=
# Opcional: nombre lógico de plantilla (Tappt mapea a TAPPT_TEMPLATE_PRO)
# HRM_WA_TEMPLATE=appointment_confirmation

# Clip (billing) — plan único $99 MXN / 30 días (reemplaza el viejo modelo
# de suscripción $299/mes + pack $149 suelto, descontinuado 18 jul 2026).
# Link de PAGO ÚNICO (no suscripción) — crear en el dashboard de Clip como
# checkout de un solo cobro, no como link de suscripción recurrente.
CLIP_BUNDLE_LINK=https://pago.clip.mx/v2/pago/<crear-en-clip>
# Secret para proteger el endpoint de webhook (pon cualquier string largo y aleatorio)
CLIP_WEBHOOK_SECRET=cambia_esto_por_un_secret_aleatorio

# (Opcional) dominio custom
PORT=3000
```

## Configurar el Postback Webhook en Clip

1. Entra al dashboard de Clip → **Panel de desarrolladores** → **Postback Webhook**
2. Agrega la URL:
   ```
   https://hrm.nkuvo.com/api/hrm/billing/webhook?secret=<TU_CLIP_WEBHOOK_SECRET>
   ```
3. Guarda. Clip enviará notificaciones a esa URL cada vez que haya un pago exitoso.

> No hay cobro recurrente que cancelar: el plan es un pago único de 30 días.
> Al vencer, el usuario simplemente puede pagar de nuevo si quiere seguir.
```

## Datos iniciales de reclutadoras

El directorio arranca vacío. Inserta reclutadoras curadas manualmente:

```sql
insert into hrm_recruiters (nombre, industria, email, telefono, sitio_web, ciudad, fuente)
values
  ('Adecco México',  'Generalista',    'reclutamiento@adecco.com.mx', '55 1234 5678', 'https://www.adecco.com.mx', 'CDMX',      'curado'),
  ('Manpower México','Generalista',    'contacto@manpower.com.mx',    '55 9876 5432', 'https://www.manpower.com.mx','CDMX',     'curado'),
  ('Michael Page',   'Mandos medios',  null,                           null,            'https://www.michaelpage.com.mx','CDMX', 'curado');
```
