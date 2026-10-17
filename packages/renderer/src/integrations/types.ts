import type { JsonValue } from '../protocol/types'
export interface CallbackDefinition {
  name: string
  label: string
  description?: string
  inputExample?: JsonValue
  responseExample?: JsonValue
}
export interface ApiDefinition extends CallbackDefinition {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
}
export interface IntegrationDefinitions {
  apis: ApiDefinition[]
  callbacks: CallbackDefinition[]
}
