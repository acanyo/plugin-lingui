import type { IntegrationDefinitions } from './types'
import { validateIntegrationSchema } from '../protocol/generated/validators.js'
import { interactionUrl } from '../events/http'
import { assertSafeJson } from '../protocol/safe-json'
export function validateIntegrations(
  value: unknown,
): asserts value is IntegrationDefinitions | undefined {
  if (value === undefined) return
  assertSafeJson(value, false)
  if (!validateIntegrationSchema(value)) throw new Error('接口与回调配置格式无效（每类最多 32 个）')
  const definitions = value as IntegrationDefinitions
  for (const list of [definitions.apis, definitions.callbacks]) {
    if (new Set(list.map((item) => item.name)).size !== list.length)
      throw new Error('接口或回调名称不能重复')
    if (list.some((item) => !item.label.trim())) throw new Error('接口与回调需要显示名称')
  }
  for (const api of definitions.apis) interactionUrl(api.url)
}
