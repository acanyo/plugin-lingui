"""Range inputs, content browsing and compact data components."""


def register_productivity_components(node, ref, string, obj, children):
    field = {'label': ref('dynamic'), 'value': ref('binding'), 'disabled': ref('dynamic')}
    number = {'type': 'number', 'minimum': -1e12, 'maximum': 1e12}
    bounds = {'min': number, 'max': number, 'step': {'type': 'number', 'exclusiveMinimum': 0, 'maximum': 1e12}}
    options = {'type': 'array', 'minItems': 1, 'maxItems': 40, 'items': obj({'label': string, 'value': {'type': 'string', 'minLength': 1, 'maxLength': 160}}, ['label', 'value'])}
    node('LingUI.RangeSlider', {**field, **bounds, 'unit': {'type': 'string', 'maxLength': 40}}, ['label', 'value', 'min', 'max'])
    node('LingUI.DateRange', {**field, 'min': string, 'max': string}, ['label', 'value'])
    node('LingUI.NumberStepper', {**field, **bounds, 'unit': {'type': 'string', 'maxLength': 40}}, ['label', 'value', 'min', 'max'])
    node('LingUI.PasswordInput', {**field, 'placeholder': string, 'maxLength': {'type': 'integer', 'minimum': 1, 'maximum': 500}}, ['label', 'value'])
    node('LingUI.Combobox', {**field, 'options': options, 'placeholder': string}, ['label', 'value', 'options'])
    node('LingUI.Transfer', {**field, 'options': options, 'sourceLabel': string, 'targetLabel': string}, ['label', 'value', 'options'])
    node('LingUI.ToggleButton', {**field, 'description': ref('dynamic')}, ['label', 'value'])
    node('LingUI.Carousel', {'label': string, 'children': {**children, 'minItems': 1, 'maxItems': 12}, 'value': ref('binding')}, ['label', 'children', 'value'])
    node('LingUI.ScrollArea', {'label': string, 'child': string, 'maxHeight': {'enum': [160, 240, 320, 480]}}, ['label', 'child'])
    node('LingUI.AspectRatio', {'child': string, 'ratio': {'enum': ['square', 'landscape', 'wide', 'portrait']}}, ['child'])
    node('LingUI.KeyboardShortcut', {'label': ref('dynamic'), 'keys': {'type': 'array', 'minItems': 1, 'maxItems': 6, 'items': {'type': 'string', 'minLength': 1, 'maxLength': 24}}}, ['label', 'keys'])
    node('LingUI.FileCard', {'label': ref('dynamic'), 'description': ref('dynamic'), 'url': ref('dynamic'), 'metadata': string, 'newWindow': {'type': 'boolean'}}, ['label', 'url'])
    node('LingUI.AvatarGroup', {'label': string, 'members': {'type': 'array', 'minItems': 1, 'maxItems': 20, 'items': obj({'label': {'type': 'string', 'minLength': 1, 'maxLength': 120}, 'url': string}, ['label'])}, 'maxVisible': {'type': 'integer', 'minimum': 1, 'maximum': 8}}, ['label', 'members'])
    node('LingUI.ProgressRing', {'label': ref('dynamic'), 'description': ref('dynamic'), 'value': ref('dynamic'), 'max': {'type': 'number', 'exclusiveMinimum': 0, 'maximum': 1e12}}, ['label', 'value', 'max'])
    for name in ['LingUI.Sparkline', 'LingUI.FunnelChart']:
        node(name, {'label': string, 'description': string, 'unit': {'type': 'string', 'maxLength': 40}, 'data': {'type': 'array', 'minItems': 1 if name == 'LingUI.Sparkline' else 2, 'maxItems': 12, 'items': obj({'label': string, 'value': {'type': 'number', 'minimum': -1e12 if name == 'LingUI.Sparkline' else 0, 'maximum': 1e12}}, ['label', 'value'])}}, ['label', 'data'])
