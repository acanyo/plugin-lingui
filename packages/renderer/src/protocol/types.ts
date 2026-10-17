export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type State = { [key: string]: JsonValue }
export type Expression = JsonValue | { path: string } | { op: string; args: Expression[] }
export type Binding = { path: string }
export type Dynamic =
  | string
  | number
  | boolean
  | Binding
  | { call: 'lingui.evaluate'; args: { expression: Expression }; returnType?: string }
  | { call: string; args: Record<string, JsonValue>; returnType?: string }
export type ActionName =
  | 'setState'
  | 'toggleState'
  | 'increment'
  | 'decrement'
  | 'selectOption'
  | 'show'
  | 'hide'
  | 'nextStep'
  | 'previousStep'
  | 'reset'
export interface LocalAction {
  type: ActionName
  path?: string
  value?: Expression
}
export interface Action {
  functionCall: { call: 'lingui.dispatch'; args: { actions: LocalAction[] } }
}
export const componentNames = [
  'Column',
  'Row',
  'Card',
  'Text',
  'Icon',
  'Button',
  'Divider',
  'CheckBox',
  'TextField',
  'Slider',
  'ChoicePicker',
  'Image',
  'Video',
  'AudioPlayer',
  'List',
  'Tabs',
  'Modal',
  'DateTimeInput',
  'LingUI.Callout',
  'LingUI.Collapse',
  'LingUI.Conditional',
  'LingUI.NumberInput',
  'LingUI.Progress',
  'LingUI.Tabs',
  'LingUI.Steps',
  'LingUI.Diagram',
  'LingUI.DiagramNode',
  'LingUI.Timeline',
  'LingUI.TimelineItem',
  'LingUI.Badge',
  'LingUI.Quote',
  'LingUI.Metric',
  'LingUI.Table',
  'LingUI.Section',
  'LingUI.Grid',
  'LingUI.CodeBlock',
  'LingUI.KeyValue',
  'LingUI.BarChart',
  'LingUI.Switch',
  'LingUI.Select',
  'LingUI.SegmentedControl',
  'LingUI.Rating',
  'LingUI.Avatar',
  'LingUI.Link',
  'LingUI.Breadcrumbs',
  'LingUI.EmptyState',
  'LingUI.Skeleton',
  'LingUI.Spinner',
  'LingUI.LineChart',
  'LingUI.DonutChart',
  'LingUI.SearchInput',
  'LingUI.ColorPicker',
  'LingUI.MultiSelect',
  'LingUI.TagInput',
  'LingUI.Pagination',
  'LingUI.Alert',
  'LingUI.Status',
  'LingUI.Tooltip',
  'LingUI.Accordion',
  'LingUI.LabeledDivider',
  'LingUI.Toolbar',
  'LingUI.Gauge',
  'LingUI.RadarChart',
  'LingUI.Heatmap',
  'LingUI.RangeSlider',
  'LingUI.DateRange',
  'LingUI.NumberStepper',
  'LingUI.PasswordInput',
  'LingUI.Combobox',
  'LingUI.Transfer',
  'LingUI.ToggleButton',
  'LingUI.Carousel',
  'LingUI.ScrollArea',
  'LingUI.AspectRatio',
  'LingUI.KeyboardShortcut',
  'LingUI.FileCard',
  'LingUI.AvatarGroup',
  'LingUI.ProgressRing',
  'LingUI.Sparkline',
  'LingUI.FunnelChart',
  'LingUI.TreeView',
  'LingUI.Calendar',
  'LingUI.CardChoice',
  'LingUI.CheckboxGroup',
  'LingUI.Drawer',
  'LingUI.SplitPane',
  'LingUI.ChatMessage',
  'LingUI.Kanban',
  'LingUI.ScatterChart',
  'LingUI.WaterfallChart',
  'LingUI.Box',
  'LingUI.Center',
  'LingUI.Spacer',
  'LingUI.Separator',
  'LingUI.FormGroup',
  'LingUI.ButtonGroup',
  'LingUI.IconButton',
  'LingUI.Popover',
  'LingUI.InlineCode',
  'LingUI.Highlight',
  'LingUI.Dropdown',
  'LingUI.Popconfirm',
  'LingUI.Cascader',
  'LingUI.TreeSelect',
  'LingUI.DynamicInput',
] as const
export type ComponentName = (typeof componentNames)[number]
export interface ComponentNode {
  id: string
  component: ComponentName
  children?: string[]
  child?: string
  text?: Dynamic
  title?: Dynamic
  description?: Dynamic
  variant?: string
  align?: string
  justify?: string
  name?: string
  label?: Dynamic
  action?: Action
  buttonType?: 'button' | 'submit'
  required?: boolean
  minLength?: number
  bindings?: Partial<
    Record<
      | 'rows'
      | 'data'
      | 'entries'
      | 'matrix'
      | 'points'
      | 'items'
      | 'options'
      | 'members'
      | 'treeItems',
      import('../data-bindings/types').CollectionBinding
    >
  >
  dataState?: { loading?: Binding; error?: Binding; emptyText?: string }
  events?: Partial<
    Record<import('../events/types').ComponentEventName, import('../events/types').EventBinding>
  >
  value?: Dynamic
  min?: number | string
  max?: number | string
  step?: number
  options?: {
    label: string
    value: string
    description?: string
    disabled?: boolean
    group?: string
  }[]
  expanded?: Binding
  multiple?: Binding
  exclusiveGroup?: string
  condition?: Expression
  tone?: Dynamic
  tabs?: { title: Dynamic; child: string }[]
  orientation?: 'horizontal' | 'vertical'
  accent?: boolean
  columns?: string[]
  rows?: { label: string; cells: string[] }[]
  maxColumns?: 2 | 3 | 4
  code?: string
  language?: 'text' | 'java' | 'javascript' | 'typescript' | 'json' | 'python' | 'bash' | 'sql'
  entries?: { label: string; value: string }[]
  data?: { label: string; value: number }[]
  unit?: string
  url?: Dynamic
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scaleDown'
  direction?: 'horizontal' | 'vertical'
  trigger?: string
  content?: string
  enableDate?: boolean
  enableTime?: boolean
  disabled?: Dynamic
  readOnly?: boolean
  placeholder?: string
  size?: 'none' | 'small' | 'medium' | 'large'
  newWindow?: boolean
  items?: { id?: string | number; label: string; description?: string; url?: string }[]
  maxLength?: number
  maxSelected?: number
  maxTags?: number
  totalPages?: number
  dismissible?: boolean
  allowMultiple?: boolean
  sections?: { title: string; child: string }[]
  matrix?: { label: string; cells: number[] }[]
  sourceLabel?: string
  targetLabel?: string
  maxHeight?: 160 | 240 | 320 | 480
  ratio?: 'square' | 'landscape' | 'wide' | 'portrait'
  keys?: string[]
  metadata?: string
  members?: { label: string; url?: string }[]
  maxVisible?: number
  lines?: number
  weight?: number
  axis?: 'horizontal' | 'vertical'
  displayStyle?: 'checkbox' | 'chips'
  filterable?: boolean
  validationRegexp?: string
  treeItems?: { id: string; label: string; parent?: string; disabled?: boolean }[]
  month?: string
  side?: 'left' | 'right'
  sender?: string
  boards?: {
    id: string
    title: string
    cards: { id: string; title: string; description?: string; tag?: string }[]
  }[]
  points?: { label: string; x: number; y: number }[]
  padding?: 'none' | 'small' | 'medium' | 'large'
  gap?: 'none' | 'small' | 'medium' | 'large'
  maxWidth?: 320 | 480 | 640 | 960
  minHeight?: 0 | 120 | 240 | 360
  placement?: 'top' | 'bottom'
  xLabel?: string
  yLabel?: string
  loading?: Dynamic
  status?: 'default' | 'warning' | 'error'
  hint?: string
  clearable?: boolean
  prefixText?: string
  suffixText?: string
  showCount?: boolean
  confirmText?: string
  cancelText?: string
  addText?: string
  minRows?: number
  maxRows?: number
  fields?: { key: string; label: string; placeholder?: string }[]
  menuItems?: {
    id: string
    label: string
    action?: Action
    disabled?: boolean
    group?: string
    tone?: 'default' | 'danger'
  }[]
  // Optional presentation fields belong to LingUI.DiagramNode in our custom catalog.
}
export interface Parameter {
  key: string
  label: string
  path: string
  type: 'string' | 'number' | 'boolean'
  default: string | number | boolean
  min?: number
  max?: number
}
export interface LinguiDocument {
  integrations?: import('../integrations/types').IntegrationDefinitions
  schemaVersion: 'lingui.document/2'
  title: string
  source: string
  state: State
  parameters: Parameter[]
}
export interface Surface {
  id: string
  nodes: Record<string, ComponentNode>
  state: State
}
export interface ThemeTokens {
  schemaVersion: 'lingui.theme/1'
  id: string
  name: string
  mode: 'light' | 'dark' | 'auto'
  colors: {
    background: string
    surface: string
    text: string
    muted: string
    accent: string
    border: string
    success: string
    danger: string
    line: string
  }
  radius: number
  spacing: number
  iconSize: number
  lineWidth: number
  shadow: number
  font: 'system' | 'serif' | 'mono'
  customFont?: import('../fonts/types').FontFamilyDefinition
}
export interface ComponentInstance {
  schemaVersion: 'lingui.instance/1'
  templateId?: string
  templateVersion?: number
  document: LinguiDocument
  parameters: Record<string, string | number | boolean>
  theme: ThemeTokens
}
export const CATALOG_ID = 'urn:lingui:openui:1'
