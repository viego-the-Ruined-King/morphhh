import { Model } from '@/lib/types/models'
import { getBaseUrl } from '@/lib/utils/url'
import { isProviderEnabled } from '@/lib/utils/registry'
import defaultModels from './default-models.json'

export function validateModel(model: any): model is Model {
  return (
    typeof model.id === 'string' &&
    typeof model.name === 'string' &&
    typeof model.provider === 'string' &&
    typeof model.providerId === 'string' &&
    typeof model.enabled === 'boolean' &&
    (model.toolCallType === 'native' || model.toolCallType === 'manual') &&
    (model.toolCallModel === undefined ||
      typeof model.toolCallModel === 'string')
  )
}

export async function getModels(): Promise<Model[]> {
  try {
    // Get the base URL using the centralized utility function
    const baseUrlObj = await getBaseUrl()

    // Construct the models.json URL
    const modelUrl = new URL('/config/models.json', baseUrlObj)
    console.log('Attempting to fetch models from:', modelUrl.toString())

    let models: Model[] = []

    try {
      const response = await fetch(modelUrl, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        console.warn(
          `HTTP error when fetching models: ${response.status} ${response.statusText}`
        )
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const text = await response.text()

      // Check if the response starts with HTML doctype
      if (text.trim().toLowerCase().startsWith('<!doctype')) {
        console.warn('Received HTML instead of JSON when fetching models')
        throw new Error('Received HTML instead of JSON')
      }

      const config = JSON.parse(text)
      if (Array.isArray(config.models) && config.models.every(validateModel)) {
        console.log('Successfully loaded models from URL')
        models = config.models
      } else {
        throw new Error('Invalid model configuration format')
      }
    } catch (error: any) {
      // Fallback to default models if fetch fails
      console.warn(
        'Fetch failed, falling back to default models:',
        error.message || 'Unknown error'
      )

      if (
        Array.isArray(defaultModels.models) &&
        defaultModels.models.every(validateModel)
      ) {
        console.log('Successfully loaded default models')
        models = defaultModels.models
      } else {
        console.warn('Default models are also invalid, returning empty array')
        return []
      }
    }

    // Filter models to only include those with enabled providers
    const enabledModels = models.filter(model => {
      const isEnabled = isProviderEnabled(model.providerId)
      if (!isEnabled) {
        console.log(`Provider ${model.providerId} is not enabled, skipping model ${model.name}`)
      }
      return isEnabled && model.enabled
    })

    console.log(`Returning ${enabledModels.length} enabled models out of ${models.length} total models`)
    return enabledModels

  } catch (error) {
    console.warn('Failed to load models:', error)
    return []
  }
}