import type { Library } from '@openuidev/svelte-lang'
import { defineLibrary } from './definitions'
import Component from './Component.svelte'
export const openuiLibrary = defineLibrary(Component) as unknown as Library
