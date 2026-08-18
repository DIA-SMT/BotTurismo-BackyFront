// Traducción automática ES -> EN de circuitos turísticos vía OpenRouter
// (misma cuenta que usa el bot). Si falta OPENROUTER_API_KEY o el modelo
// falla, se devuelve null y el circuito queda sin inglés: la página pública
// muestra el español como fallback y el admin puede retraducir después.

export interface CircuitTranslationInput {
  name: string
  schedule: string | null
  duration: string | null
  summary: string | null
  description: string | null
  highlights: string[]
}

export interface CircuitTranslationOutput {
  name: string
  schedule: string | null
  duration: string | null
  summary: string | null
  description: string | null
  highlights: string[]
}

const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions'
const defaultModel = 'google/gemini-2.5-flash'

export function isAiTranslationConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
  return JSON.parse(cleaned)
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function translateTouristCircuitContent(
  input: CircuitTranslationInput,
): Promise<CircuitTranslationOutput | null> {
  if (!isAiTranslationConfigured()) return null

  const prompt = [
    'Translate the following Spanish tourism circuit content into natural English for the official tourism website of San Miguel de Tucumán, Argentina.',
    'Keep proper nouns (streets, squares, museums, foods like "empanada" or "sánguche de milanesa") recognizable — translate the descriptive text, not the place names.',
    'Times like "16:00 h" should become 12-hour format like "4:00 PM".',
    'Respond ONLY with a JSON object with exactly these keys: name (string), schedule (string or null), duration (string or null), summary (string or null), description (string or null), highlights (array of strings, same length and order as the input).',
    '',
    `Input JSON: ${JSON.stringify(input)}`,
  ].join('\n')

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    const response = await fetch(openRouterUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_TRANSLATE_MODEL || defaultModel,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) return null

    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = extractJson(content) as Record<string, unknown>
    const name = asOptionalString(parsed.name)
    if (!name) return null

    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []

    return {
      name,
      schedule: asOptionalString(parsed.schedule),
      duration: asOptionalString(parsed.duration),
      summary: asOptionalString(parsed.summary),
      description: asOptionalString(parsed.description),
      highlights,
    }
  } catch (error) {
    console.error('No se pudo traducir el circuito con IA:', error)
    return null
  }
}
