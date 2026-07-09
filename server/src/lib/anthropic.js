import Anthropic from '@anthropic-ai/sdk'

let client = null

/** API key limpia (trim). Vacía / placeholder → null. */
export function getAnthropicApiKey() {
  const raw = process.env.ANTHROPIC_API_KEY
  if (raw == null) return null
  const key = String(raw).trim()
  if (!key || key === 'sk-ant-...' || key.toLowerCase() === 'changeme') return null
  return key
}

export function anthropicEnabled() {
  return Boolean(getAnthropicApiKey())
}

export function getAnthropicClient() {
  const apiKey = getAnthropicApiKey()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no configurada')
  }
  if (!client) {
    client = new Anthropic({ apiKey })
  }
  return client
}

/** Modelo por defecto; override con ANTHROPIC_MODEL en Railway. */
export function getAnthropicModel() {
  return (process.env.ANTHROPIC_MODEL || 'claude-sonnet-5').trim()
}

/**
 * Llama a Claude y devuelve el texto de la primera parte de tipo text.
 */
export async function createAnthropicMessage({ system, user, max_tokens = 3000, temperature = 0.2 }) {
  const anthropic = getAnthropicClient()
  const message = await anthropic.messages.create({
    model: getAnthropicModel(),
    max_tokens,
    temperature,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const textParts = (message.content || [])
    .filter(part => part?.type === 'text' && part.text)
    .map(part => part.text)
  const rawText = textParts.join('\n').trim()
  if (!rawText) {
    throw new Error('Respuesta vacía de Anthropic')
  }
  return { rawText, message }
}

/** Extrae el primer objeto JSON de un string (tolera markdown fences). */
export function parseJsonFromModelText(rawText) {
  const cleaned = String(rawText)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  const payload = jsonMatch ? jsonMatch[0] : cleaned
  return JSON.parse(payload)
}
