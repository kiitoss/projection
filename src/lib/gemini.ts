import { GoogleGenerativeAI } from '@google/generative-ai'
import i18next from 'i18next'

export async function generateWithGemini(
  apiKey: string,
  prompt: string,
  context: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: import.meta.env.VITE_GEMINI_MODEL })

  const fullPrompt = context ? `${context}\n\n---\n\n${prompt}` : prompt
  const result = await model.generateContent(fullPrompt)
  return result.response.text()
}

export async function testGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: import.meta.env.VITE_GEMINI_MODEL })
    await model.generateContent('Say "ok"')
    return true
  } catch {
    return false
  }
}

export function buildProjectContext(params: {
  projectName: string
  longDescription: string | null
  keyPoints: string[]
  chaosContents: { title: string; content: string }[]
  todos: { content: string; completed: boolean; urgent: boolean }[]
}): string {
  const { t } = i18next
  const parts: string[] = []

  parts.push(`${t('geminiContext.project')} ${params.projectName}`)

  if (params.longDescription) {
    parts.push(`\n${t('geminiContext.description')}\n${params.longDescription}`)
  }

  if (params.keyPoints.length > 0) {
    parts.push(`\n${t('geminiContext.keyPoints')}\n${params.keyPoints.map(p => `• ${p}`).join('\n')}`)
  }

  if (params.chaosContents.length > 0) {
    for (const chaos of params.chaosContents) {
      parts.push(`\n${t('geminiContext.notes', { title: chaos.title })}\n${chaos.content}`)
    }
  }

  const activeTodos = params.todos.filter(todo => !todo.completed)
  if (activeTodos.length > 0) {
    parts.push(
      `\n${t('geminiContext.activeTodos')}\n${activeTodos.map(todo => `${todo.urgent ? `[${t('geminiContext.urgent')}] ` : ''}• ${todo.content}`).join('\n')}`,
    )
  }

  return parts.join('\n')
}
