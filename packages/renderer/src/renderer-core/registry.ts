import type { Component } from 'svelte'
import type { ComponentName, ComponentNode } from '../protocol/types'
import ButtonNode from './nodes/ButtonNode.svelte'
import FieldInputNode from './nodes/FieldInputNode.svelte'
import DropdownNode from './nodes/DropdownNode.svelte'
import PopconfirmNode from './nodes/PopconfirmNode.svelte'
import HierarchySelectNode from './nodes/HierarchySelectNode.svelte'
import DynamicInputNode from './nodes/DynamicInputNode.svelte'
import BaseNode from './nodes/BaseNode.svelte'
import ConditionalNode from './nodes/ConditionalNode.svelte'
import InteractiveNode from './nodes/InteractiveNode.svelte'
import DiagramNode from './nodes/DiagramNode.svelte'
import TimelineNode from './nodes/TimelineNode.svelte'
import ContentNode from './nodes/ContentNode.svelte'
import CompositionNode from './nodes/CompositionNode.svelte'
import CodeBlockNode from './nodes/CodeBlockNode.svelte'
import DataNode from './nodes/DataNode.svelte'
import MediaNode from './nodes/MediaNode.svelte'
import ListNode from './nodes/ListNode.svelte'
import TabsNode from './nodes/TabsNode.svelte'
import ModalNode from './nodes/ModalNode.svelte'
import DateRangeNode from './nodes/DateRangeNode.svelte'
import DateTimeNode from './nodes/DateTimeNode.svelte'
import FormNode from './nodes/FormNode.svelte'
import SelectNode from './nodes/SelectNode.svelte'
import PresentationNode from './nodes/PresentationNode.svelte'
import NavigationNode from './nodes/NavigationNode.svelte'
import ChartNode from './nodes/ChartNode.svelte'
import ColorPickerNode from './nodes/ColorPickerNode.svelte'
import TagInputNode from './nodes/TagInputNode.svelte'
import PaginationNode from './nodes/PaginationNode.svelte'
import FeedbackNode from './nodes/FeedbackNode.svelte'
import TooltipNode from './nodes/TooltipNode.svelte'
import AccordionNode from './nodes/AccordionNode.svelte'
import AnalyticsNode from './nodes/AnalyticsNode.svelte'
import RangeInputNode from './nodes/RangeInputNode.svelte'
import ToggleButtonNode from './nodes/ToggleButtonNode.svelte'
import SelectionNode from './nodes/SelectionNode.svelte'
import TransferNode from './nodes/TransferNode.svelte'
import CarouselNode from './nodes/CarouselNode.svelte'
import FramingNode from './nodes/FramingNode.svelte'
import ResourceNode from './nodes/ResourceNode.svelte'
import AvatarGroupNode from './nodes/AvatarGroupNode.svelte'
import ProgressRingNode from './nodes/ProgressRingNode.svelte'
import CompactChartNode from './nodes/CompactChartNode.svelte'
import TreeViewNode from './nodes/TreeViewNode.svelte'
import CalendarNode from './nodes/CalendarNode.svelte'
import ChoiceGroupNode from './nodes/ChoiceGroupNode.svelte'
import SplitPaneNode from './nodes/SplitPaneNode.svelte'
import ChatMessageNode from './nodes/ChatMessageNode.svelte'
import KanbanNode from './nodes/KanbanNode.svelte'
import WorkspaceChartNode from './nodes/WorkspaceChartNode.svelte'
import PrimitiveLayoutNode from './nodes/PrimitiveLayoutNode.svelte'
import PrimitiveTextNode from './nodes/PrimitiveTextNode.svelte'
import PopoverNode from './nodes/PopoverNode.svelte'
/** Trusted implementations are registered in code, never from imported JSON. */
export const componentRegistry: Readonly<
  Record<ComponentName, Component<{ node: ComponentNode }>>
> = Object.freeze({
  Column: BaseNode,
  Row: BaseNode,
  Card: BaseNode,
  Text: BaseNode,
  Icon: BaseNode,
  Button: ButtonNode,
  Divider: BaseNode,
  CheckBox: BaseNode,
  TextField: FieldInputNode,
  Slider: BaseNode,
  ChoicePicker: InteractiveNode,
  Image: MediaNode,
  Video: MediaNode,
  AudioPlayer: MediaNode,
  List: ListNode,
  Tabs: TabsNode,
  Modal: ModalNode,
  DateTimeInput: DateTimeNode,
  'LingUI.Callout': BaseNode,
  'LingUI.Conditional': ConditionalNode,
  'LingUI.NumberInput': FieldInputNode,
  'LingUI.Progress': BaseNode,
  'LingUI.Collapse': InteractiveNode,
  'LingUI.Tabs': TabsNode,
  'LingUI.Steps': InteractiveNode,
  'LingUI.Diagram': DiagramNode,
  'LingUI.DiagramNode': DiagramNode,
  'LingUI.Timeline': TimelineNode,
  'LingUI.TimelineItem': TimelineNode,
  'LingUI.Badge': ContentNode,
  'LingUI.Quote': ContentNode,
  'LingUI.Metric': ContentNode,
  'LingUI.Table': ContentNode,
  'LingUI.Section': CompositionNode,
  'LingUI.Grid': CompositionNode,
  'LingUI.CodeBlock': CodeBlockNode,
  'LingUI.KeyValue': DataNode,
  'LingUI.BarChart': DataNode,
  'LingUI.Switch': FormNode,
  'LingUI.Select': SelectNode,
  'LingUI.SegmentedControl': FormNode,
  'LingUI.Rating': FormNode,
  'LingUI.Avatar': PresentationNode,
  'LingUI.Link': NavigationNode,
  'LingUI.Breadcrumbs': NavigationNode,
  'LingUI.EmptyState': PresentationNode,
  'LingUI.Skeleton': PresentationNode,
  'LingUI.Spinner': PresentationNode,
  'LingUI.LineChart': ChartNode,
  'LingUI.DonutChart': ChartNode,
  'LingUI.SearchInput': FieldInputNode,
  'LingUI.ColorPicker': ColorPickerNode,
  'LingUI.MultiSelect': SelectionNode,
  'LingUI.TagInput': TagInputNode,
  'LingUI.Pagination': PaginationNode,
  'LingUI.Alert': FeedbackNode,
  'LingUI.Status': FeedbackNode,
  'LingUI.LabeledDivider': FeedbackNode,
  'LingUI.Tooltip': TooltipNode,
  'LingUI.Accordion': AccordionNode,
  'LingUI.Gauge': AnalyticsNode,
  'LingUI.RadarChart': AnalyticsNode,
  'LingUI.Heatmap': AnalyticsNode,
  'LingUI.Toolbar': CompositionNode,
  'LingUI.RangeSlider': RangeInputNode,
  'LingUI.DateRange': DateRangeNode,
  'LingUI.NumberStepper': RangeInputNode,
  'LingUI.PasswordInput': FieldInputNode,
  'LingUI.ToggleButton': ToggleButtonNode,
  'LingUI.Combobox': SelectionNode,
  'LingUI.Transfer': TransferNode,
  'LingUI.Carousel': CarouselNode,
  'LingUI.ScrollArea': FramingNode,
  'LingUI.AspectRatio': FramingNode,
  'LingUI.KeyboardShortcut': ResourceNode,
  'LingUI.FileCard': ResourceNode,
  'LingUI.AvatarGroup': AvatarGroupNode,
  'LingUI.ProgressRing': ProgressRingNode,
  'LingUI.Sparkline': CompactChartNode,
  'LingUI.FunnelChart': CompactChartNode,
  'LingUI.TreeView': TreeViewNode,
  'LingUI.Calendar': CalendarNode,
  'LingUI.CardChoice': ChoiceGroupNode,
  'LingUI.CheckboxGroup': ChoiceGroupNode,
  'LingUI.Drawer': ModalNode,
  'LingUI.SplitPane': SplitPaneNode,
  'LingUI.ChatMessage': ChatMessageNode,
  'LingUI.Kanban': KanbanNode,
  'LingUI.ScatterChart': WorkspaceChartNode,
  'LingUI.WaterfallChart': WorkspaceChartNode,
  'LingUI.Box': PrimitiveLayoutNode,
  'LingUI.Center': PrimitiveLayoutNode,
  'LingUI.Spacer': PrimitiveLayoutNode,
  'LingUI.Separator': PrimitiveLayoutNode,
  'LingUI.FormGroup': PrimitiveLayoutNode,
  'LingUI.ButtonGroup': PrimitiveLayoutNode,
  'LingUI.IconButton': ButtonNode,
  'LingUI.Popover': PopoverNode,
  'LingUI.InlineCode': PrimitiveTextNode,
  'LingUI.Highlight': PrimitiveTextNode,
  'LingUI.Dropdown': DropdownNode,
  'LingUI.Popconfirm': PopconfirmNode,
  'LingUI.Cascader': HierarchySelectNode,
  'LingUI.TreeSelect': HierarchySelectNode,
  'LingUI.DynamicInput': DynamicInputNode,
})
