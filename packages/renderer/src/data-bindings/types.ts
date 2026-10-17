export interface CollectionBinding {
  path: string
  /** Map fields using JSON pointers relative to each source record. '/' means the record itself. */
  map?: Record<string, string | string[]>
}
