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

## Supabase Storage — bucket `cvs`

Crea el bucket **manualmente** en `Storage > New bucket`:
- Nombre: `cvs`
- **Privado** (no público) — el backend usa service_role para subir/bajar archivos

## Variables de entorno en Railway

Configúralas en `Railway > Service > Variables`:

```
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# SMTP (para envío de CVs por correo)
SMTP_HOST=smtp.gmail.com       # o tu proveedor
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu@email.com
SMTP_PASS=tu_app_password      # Gmail: contraseña de aplicación, no la de cuenta

# Reescritura de CV con IA (Pro)
ANTHROPIC_API_KEY=sk-ant-...

# Clip (billing)
# Link de suscripción generado desde el dashboard de Clip
CLIP_SUBSCRIPTION_LINK=https://pago.clip.mx/v2/suscripcion/eaadea41-f533-4902-8fb3-a1836c57b83f
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
3. Guarda. Clip enviará notificaciones a esa URL cada vez que haya un pago exitoso,
   renovación, fallo o cancelación.

> **Cancelaciones manuales**: cuando un usuario solicite cancelar desde la app,
> recibirás la notificación y debes entrar al panel de Clip >
> Pagos Recurrentes > encontrar al suscriptor > Eliminar de la suscripción.
> El equipo de soporte de NKUVO lo atiende vía WhatsApp (wa.me/5215658732336).
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
