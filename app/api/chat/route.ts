import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { createManualToolStreamResponse } from '@/lib/streaming/create-manual-tool-stream'
import { createToolCallingStreamResponse } from '@/lib/streaming/create-tool-calling-stream'
import { Model } from '@/lib/types/models'
import { isProviderEnabled } from '@/lib/utils/registry'

export const maxDuration = 30

// Fallback model selection based on available providers
function getDefaultModel(): Model {
  // Try Google first since it's commonly available
  if (isProviderEnabled('google')) {
    return {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'Google Generative AI',
      providerId: 'google',
      enabled: true,
      toolCallType: 'manual'
    }
  }
  
  // Try OpenAI
  if (isProviderEnabled('openai')) {
    return {
      id: 'gpt-4o-mini',
      name: 'GPT-4o mini',
      provider: 'OpenAI',
      providerId: 'openai',
      enabled: true,
      toolCallType: 'native'
    }
  }
  
  // Try Anthropic
  if (isProviderEnabled('anthropic')) {
    return {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'Anthropic',
      providerId: 'anthropic',
      enabled: true,
      toolCallType: 'native'
    }
  }
  
  // Try Groq
  if (isProviderEnabled('groq')) {
    return {
      id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      name: 'Llama 4 Maverick 17B',
      provider: 'Groq',
      providerId: 'groq',
      enabled: true,
      toolCallType: 'native'
    }
  }
  
  // Default fallback (this should not happen if any provider is configured)
  return {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    providerId: 'openai',
    enabled: true,
    toolCallType: 'native'
  }
}

export async function POST(req: Request) {
  try {
    const { messages, id: chatId } = await req.json()
    const referer = req.headers.get('referer')
    const isSharePage = referer?.includes('/share/')
    const userId = await getCurrentUserId()

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    // Get cookies from the request headers instead of using the cookies() function
    const cookieHeader = req.headers.get('cookie')
    let selectedModel = getDefaultModel()
    let searchMode = false

    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(cookie => {
          const [name, value] = cookie.split('=')
          return [name, decodeURIComponent(value)]
        })
      )

      if (cookies.selectedModel) {
        try {
          const parsedModel = JSON.parse(cookies.selectedModel) as Model
          // Validate that the selected model's provider is enabled
          if (isProviderEnabled(parsedModel.providerId)) {
            selectedModel = parsedModel
          } else {
            console.warn(`Selected model provider ${parsedModel.providerId} is not enabled, using default model`)
          }
        } catch (e) {
          console.error('Failed to parse selected model:', e)
        }
      }

      searchMode = cookies['search-mode'] === 'true'
    }

    // Final check to ensure the selected model's provider is enabled
    if (!isProviderEnabled(selectedModel.providerId)) {
      console.error(`Selected provider ${selectedModel.providerId} is not enabled`)
      return new Response(
        `Selected provider is not enabled: ${selectedModel.providerId}. Please check your environment variables and ensure the API key is set.`,
        {
          status: 400,
          statusText: 'Bad Request'
        }
      )
    }

    const supportsToolCalling = selectedModel.toolCallType === 'native'

    return supportsToolCalling
      ? createToolCallingStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          userId
        })
      : createManualToolStreamResponse({
          messages,
          model: selectedModel,
          chatId,
          searchMode,
          userId
        })
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}