import Anthropic from '@anthropic-ai/sdk'

let client = null

export function anthropicEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export function getAnthropicClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}
