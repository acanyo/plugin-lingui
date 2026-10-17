import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const require = createRequire(new URL('../packages/renderer/package.json', import.meta.url))
const Ajv = require('ajv/dist/2020').default
const standalone = require('ajv/dist/standalone').default
const dir = new URL('../packages/renderer/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('schemas/catalog.json', dir), 'utf8'))
const ajv = new Ajv({ strict: false, discriminator: true, code: { source: true, esm: true } })
ajv.addSchema(catalog)
ajv.addSchema({ ...catalog, $id: 'urn:lingui:node-validation', $ref: '#/$defs/anyComponent' })
ajv.addSchema({ ...catalog, $id: 'urn:lingui:integration-validation', $ref: '#/$defs/integrations' })
let source = standalone(ajv, { validateNode: 'urn:lingui:node-validation', validateIntegrationSchema: 'urn:lingui:integration-validation' })
source = source.replace(/require\("(ajv\/dist\/runtime\/[^"]+)"\)\.default/g, (_, module) => require(module).default.toString())
if (source.includes('require(')) throw new Error('Unexpected generated runtime dependency')
mkdirSync(new URL('src/protocol/generated/', dir), { recursive: true })
writeFileSync(new URL('src/protocol/generated/validators.js', dir), '// @ts-nocheck\n// Generated from pinned schemas. Run scripts/compile-validators.mjs.\n' + source)
writeFileSync(new URL('src/protocol/generated/validators.d.ts', dir), 'type Validator = ((data: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null };\nexport const validateNode: Validator;\nexport const validateIntegrationSchema: Validator;\n')

