import type { IntegrationDefinitions } from '@lingui/renderer'

/** Preserve configured endpoints while retaining new API definitions created for the current request. */
export function mergeGeneratedIntegrations(
  existing?: IntegrationDefinitions,
  generated?: IntegrationDefinitions,
): IntegrationDefinitions | undefined {
  if (!existing) return generated
  if (!generated) return existing
  const merge = <T extends { name: string }>(original: T[], added: T[]) => [
    ...original,
    ...added.filter((item) => !original.some((configured) => configured.name === item.name)),
  ]
  return {
    apis: merge(existing.apis, generated.apis),
    callbacks: merge(existing.callbacks, generated.callbacks),
  }
}
