"""Additional local inputs, feedback, composition and analytical views."""


def register_advanced_components(node, ref, string, obj, children):
    boolean = {'type': 'boolean'}
    field = {'label': ref('dynamic'), 'value': ref('binding'), 'disabled': ref('dynamic')}
    options = {'type': 'array', 'minItems': 1, 'maxItems': 40, 'items': obj({
        'label': string, 'value': {'type': 'string', 'minLength': 1, 'maxLength': 160}
    }, ['label', 'value'])}
    node('LingUI.SearchInput', {**field, 'placeholder': string, 'maxLength': {'type': 'integer', 'minimum': 1, 'maximum': 500}}, ['label', 'value'])
    node('LingUI.ColorPicker', field, ['label', 'value'])
    node('LingUI.MultiSelect', {**field, 'options': options, 'placeholder': string, 'maxSelected': {'type': 'integer', 'minimum': 1, 'maximum': 40}}, ['label', 'value', 'options'])
    node('LingUI.TagInput', {**field, 'placeholder': string, 'maxTags': {'type': 'integer', 'minimum': 1, 'maximum': 20}}, ['label', 'value'])
    node('LingUI.Pagination', {**field, 'totalPages': {'type': 'integer', 'minimum': 1, 'maximum': 10000}}, ['label', 'value', 'totalPages'])
    tone = {'enum': ['info', 'success', 'warning', 'danger']}
    node('LingUI.Alert', {'title': ref('dynamic'), 'description': ref('dynamic'), 'tone': tone, 'value': ref('binding'), 'dismissible': boolean}, ['title', 'value'])
    node('LingUI.Status', {'text': ref('dynamic'), 'tone': tone}, ['text'])
    node('LingUI.Tooltip', {'label': ref('dynamic'), 'text': ref('dynamic')}, ['label', 'text'])
    node('LingUI.Accordion', {'label': string, 'value': ref('binding'), 'allowMultiple': boolean, 'sections': {'type': 'array', 'minItems': 1, 'maxItems': 12, 'items': obj({'title': string, 'child': string}, ['title', 'child'])}}, ['value', 'sections'])
    node('LingUI.LabeledDivider', {'text': ref('dynamic')}, ['text'])
    node('LingUI.Toolbar', {'label': string, 'children': children}, ['children'])
    node('LingUI.Gauge', {'label': string, 'description': string, 'value': ref('dynamic'), 'min': {'type': 'number', 'minimum': -1e12, 'maximum': 1e12}, 'max': {'type': 'number', 'minimum': -1e12, 'maximum': 1e12}, 'unit': {'type': 'string', 'maxLength': 40}}, ['label', 'value', 'min', 'max'])
    node('LingUI.RadarChart', {'label': string, 'description': string, 'max': {'type': 'number', 'exclusiveMinimum': 0, 'maximum': 1e12}, 'data': {'type': 'array', 'minItems': 3, 'maxItems': 8, 'items': obj({'label': string, 'value': {'type': 'number', 'minimum': 0, 'maximum': 1e12}}, ['label', 'value'])}}, ['label', 'max', 'data'])
    node('LingUI.Heatmap', {'label': string, 'description': string, 'unit': {'type': 'string', 'maxLength': 40}, 'columns': {'type': 'array', 'minItems': 1, 'maxItems': 14, 'items': string}, 'matrix': {'type': 'array', 'minItems': 1, 'maxItems': 12, 'items': obj({'label': string, 'cells': {'type': 'array', 'minItems': 1, 'maxItems': 14, 'items': {'type': 'number', 'minimum': 0, 'maximum': 1e12}}}, ['label', 'cells'])}}, ['label', 'columns', 'matrix'])
