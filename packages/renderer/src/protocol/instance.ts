import type { ComponentInstance, LinguiDocument, State, ThemeTokens } from './types'
import { assertSafeJson, resolveDocument, validateDocument } from './validate'
import { validateTheme } from '../theme-core/tokens'
import { pureTheme } from '../theme-core/themes'
import { writePath } from '../interaction-runtime/pointer'
export function createInstance(
  document: LinguiDocument,
  theme: ThemeTokens = pureTheme,
): ComponentInstance {
  return {
    schemaVersion: 'lingui.instance/1',
    document: validateDocument(document),
    parameters: Object.fromEntries(document.parameters.map((item) => [item.key, item.default])),
    theme: validateTheme(theme),
  }
}
export function validateInstance(input: unknown): ComponentInstance {
  assertSafeJson(input)
  const instance = input as ComponentInstance
  if (
    !instance ||
    instance.schemaVersion !== 'lingui.instance/1' ||
    Object.keys(instance).some(
      (key) =>
        ![
          'schemaVersion',
          'templateId',
          'templateVersion',
          'document',
          'parameters',
          'theme',
        ].includes(key),
    )
  )
    throw new Error('文章组件实例格式或版本无效')
  if (
    instance.templateId !== undefined &&
    (typeof instance.templateId !== 'string' || instance.templateId.length > 80)
  )
    throw new Error('模板标识无效')
  if (
    instance.templateVersion !== undefined &&
    (!Number.isInteger(instance.templateVersion) || instance.templateVersion < 1)
  )
    throw new Error('模板版本无效')
  const document = validateDocument(instance.document)
  validateTheme(instance.theme)
  const normalized = { ...instance, document }
  parameterState(normalized)
  return JSON.parse(JSON.stringify(normalized))
}
export function parameterState(instance: ComponentInstance): State {
  const state = resolveDocument(instance.document).state
  if (
    !instance.parameters ||
    typeof instance.parameters !== 'object' ||
    Array.isArray(instance.parameters)
  )
    throw new Error('实例参数格式无效')
  const declared = new Set(instance.document.parameters.map((parameter) => parameter.key))
  if (Object.keys(instance.parameters).some((key) => !declared.has(key)))
    throw new Error('存在未定义的组件参数')
  for (const parameter of instance.document.parameters) {
    const value = instance.parameters[parameter.key] ?? parameter.default
    if (typeof value !== parameter.type || (typeof value === 'string' && value.length > 16000))
      throw new Error(`参数 ${parameter.label} 类型无效`)
    if (
      typeof value === 'number' &&
      (!Number.isFinite(value) ||
        (parameter.min !== undefined && value < parameter.min) ||
        (parameter.max !== undefined && value > parameter.max))
    )
      throw new Error(`参数 ${parameter.label} 超出范围`)
    writePath(state, parameter.path, value)
  }
  return state
}
export function encodeInstance(instance: ComponentInstance): string {
  return JSON.stringify(validateInstance(instance))
}
export function decodeInstance(text: string): ComponentInstance {
  if (text.length > 262144) throw new Error('文章组件数据过大')
  return validateInstance(JSON.parse(text))
}
