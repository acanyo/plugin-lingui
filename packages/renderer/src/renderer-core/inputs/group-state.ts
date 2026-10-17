import { getContext, setContext } from 'svelte'

const groupState = Symbol('LingUI form group disabled state')

/** Native fieldsets disable inputs, but summary-based controls need the same state. */
export function useGroupDisabled(): () => boolean {
  return getContext<() => boolean>(groupState) ?? (() => false)
}

export function provideGroupDisabled(disabled: () => boolean) {
  const parent = useGroupDisabled()
  setContext(groupState, () => parent() || disabled())
}
