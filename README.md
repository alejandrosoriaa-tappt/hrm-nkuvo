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

- **Modelo (actualizado 18 jul 2026)**: freemium + un solo plan de pago
  único. Cuenta gratis: directorio completo sin datos de contacto + contacto
  completo de las primeras 5 reclutadoras + score gratis de ATS Checker y
  LinkedIn Score (diagnóstico, sin el "cómo arreglarlo" ni el análisis con
  IA). Un pago único de **$99 MXN da acceso a TODO por 30 días**: contacto
  ilimitado con todas las reclutadoras, ATS Checker con IA (hasta 5 usos) y
  LinkedIn Score con IA por industria (hasta 5 usos). No es suscripción
  recurrente — al vencer, el usuario paga de nuevo si quiere seguir. Esto
  reemplazó el modelo anterior de Pro $299 MXN/mes + pack CV IA $149 sueltos.
- **LinkedIn Score**: el usuario exporta su perfil como PDF ("Más" → "Guardar
  en PDF" en LinkedIn) o pega el texto — nunca se hace scraping de LinkedIn
  (viola sus términos). El score de completitud (gratis) se basa en el
  criterio público "All-Star" de LinkedIn; el análisis por industria usa
  Claude. Metodología pública y transparente en `/metodologia-linkedin`
  (qué es oficial vs. consenso de la industria, y qué no se puede saber:
  el algoritmo real de ranking de LinkedIn no es público).
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

## Pendiente

- Confirmación legal sobre STPS (aún abierta, ver nota en Decisiones de producto).
- Crear el bucket `linkedin` en Supabase Storage y el link de pago único
  `CLIP_BUNDLE_LINK` en Clip (ver `db/migrate.md`) antes de que el plan
  $99/30 días funcione en producción.
