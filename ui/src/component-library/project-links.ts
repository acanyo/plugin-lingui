/** Open the saved project without navigating away from an unsaved article. */
export function projectEditorUrl(id?: string): string {
  return id ? `/console/lingui?${new URLSearchParams({ project: id })}` : '/console/lingui'
}
