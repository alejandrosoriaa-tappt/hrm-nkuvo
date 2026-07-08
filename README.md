# HRM NKUVO — scaffold inicial

Plataforma B2C (Headhunter Relationship Management): un candidato consulta un
directorio curado de reclutadoras en México, da seguimiento a con quién ya
contactó, sube hasta 5 variantes de CV, recibe recomendaciones tipo ATS, y
lleva una agenda de citas.

Este folder fue armado en el scratchpad de una sesión de Claude Code porque la
creación automática del repo `alejandrosoriaa-tappt/hrm-nkuvo` falló (permiso
403 del GitHub App / luego un problema de conexión del conector MCP). Una vez
que el repo exista y esté accesible, este contenido se sube ahí tal cual como
primer commit.

## Decisiones de producto (de la conversación)

- **Modelo**: freemium. Cuenta gratis + checker de CV vs. ATS + directorio
  completo sin datos de contacto + contacto completo de las primeras 5
  reclutadoras. De la reclutadora #6 en adelante requiere suscripción.
- **Precio**: $299 MXN/mes como ancla inicial (comparable: JobbyCRM ~$200 MXN,
  Careerflow ~$480 MXN, Huntr Pro ~$800 MXN — ver hilo de investigación de
  mercado). Más fácil subir precio después que bajarlo.
- **Segmento**: mandos medios (nivel Adecco/Manpower), no el segmento senior
  que ataca LinkedIn Premium. UX simple y rápida para Gen Z/millennial.
- **WhatsApp**: solo links manuales `wa.me` (click-to-chat) en el MVP, no
  envío automatizado — evita temas de opt-in/spam bajo las políticas de
  WhatsApp Business.
- **Legal (México)**: aplica LFPDPPP (Aviso de Privacidad, derechos ARCO) al
  guardar datos de contacto de reclutadoras y candidatos. **Pendiente
  confirmar con un abogado laboral** si listar/facilitar contacto con agencias
  de colocación te obliga a registro ante STPS — las dos IAs consultadas
  (Gemini y ChatGPT) no coincidieron del todo en este punto.
- **Directorio**: no existe una fuente única confiable en México (ni STPS, ni
  cámaras, ni Google Places dan cobertura real) — la curaduría manual es el
  activo real, con un modelo "colaborativo" (usuarios reportan nuevas
  reclutadoras) para escalarlo después.

## Arquitectura

- **Repo**: separado de `Colibri-Collections` (no es un producto de
  Alejandro para NKUVO, es un producto nuevo B2C).
- **Dominio**: `hrm.nkuvo.com` (subdominio de un dominio que ya es propiedad
  del usuario — sin costo extra de dominio).
- **Un solo servicio de Railway** sirve API + frontend estático (`server/`
  hace `express.static` sobre `web/dist`) en vez de dos servicios separados,
  para minimizar cómputo facturable. Se puede separar más adelante si crece.
- **Supabase compartido** (el mismo proyecto que usan Tappt/NKUVO/Kollybry)
  para Auth + Postgres + Storage (CVs) — evita provisionar Postgres aparte en
  Railway, a diferencia del CRM interno de Alejandro que sí usa Postgres de
  Railway por herencia de su propia arquitectura.
- **Tappt**: la integración real que ya funciona en `crm.nkuvo.com`
  (`backend/src/services/tappt.js`) es de una sola vía y un solo número fijo
  (avisa a Alejandro). Para el HRM se necesita notificar al propio candidato
  — **pendiente confirmar con el equipo Tappt** si el mismo endpoint acepta
  destinatarios dinámicos o si hace falta uno B2C nuevo.

## Qué se copió/adaptó del CRM de NKUVO (`Colibri-Collections/crm` y `/backend`)

| Archivo aquí | Origen | Cambios |
|---|---|---|
| `web/src/lib/supabase.js` | `crm/src/lib/supabase.js` | Idéntico |
| `web/src/lib/api.js` | `crm/src/lib/api.js` | Mismo patrón de interceptors; endpoints propios de `hrmAPI` |
| `web/src/store/authStore.js` | `crm/src/store/authStore.js` | + `signUp()` porque el HRM es de alta pública, el CRM no |
| `web/tailwind.config.js` | `crm/tailwind.config.js` | Misma paleta (consistencia de marca NKUVO), prefijo `hrm-` |
| `web/vite.config.js` | `crm/vite.config.js` | Idéntico, puerto distinto |
| `web/public/env.js` | `crm/public/env.js` | Idéntico (inyección de env en runtime sin rebuild) |
| `server/src/middleware/auth.js` | `backend/src/middleware/auth.js` | Idéntico, se quitó el dev-bypass |
| `server/src/services/tappt.js` | `backend/src/services/tappt.js` | `notify_to` dinámico por usuario en vez de fijo |
| `server/src/routes/hrm.js` | `backend/src/routes/crm.js` | Mismo patrón de rutas/tenant scoping; usa Supabase client en vez de pool de `pg` a Railway Postgres |

## Pendiente (no incluido en este scaffold)

- `web/src/components/Layout.jsx`, `LoginPage.jsx`, `SignupPage.jsx` y las
  páginas de directorio/seguimiento/CVs/agenda — falta el diseño de producto
  antes de construir la UI real (esto es estructura, no producto terminado).
- Lógica real del checker ATS (extracción de texto de PDF/DOCX, matching de
  keywords).
- Subida de CV a Supabase Storage + límite de 5 variantes.
- Integración de cobro (Stripe/Conekta/Mercado Pago — no se ha discutido cuál).
- Confirmación legal sobre STPS.
