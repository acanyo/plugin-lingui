"""Composable interactions and consistent field presentation, with bounded local state."""

def register_interaction_components(node, components, ref, string, obj):
    short = {'type': 'string', 'maxLength': 160}
    identifier = {'type': 'string', 'pattern': '^[a-zA-Z][a-zA-Z0-9_-]{0,39}$'}
    boolean = {'type': 'boolean'}
    presentation = {
        'size': {'enum': ['small', 'medium', 'large']},
        'disabled': ref('dynamic'), 'readOnly': boolean,
        'status': {'enum': ['default', 'warning', 'error']}, 'hint': short,
    }
    field = {**presentation, 'label': ref('dynamic'), 'value': ref('binding'), 'placeholder': short, 'clearable': boolean}
    text_fields = ['TextField', 'LingUI.NumberInput', 'LingUI.SearchInput', 'LingUI.PasswordInput']
    for name in text_fields:
        components[name]['properties'].update({**presentation, 'placeholder': short, 'clearable': boolean,
            'prefixText': short, 'suffixText': short, 'showCount': boolean,
            'maxLength': {'type': 'integer', 'minimum': 1, 'maximum': 2000}})
    components['Button']['properties'].update({'size': presentation['size'], 'disabled': ref('dynamic'),
        'loading': ref('dynamic'), 'tone': {'enum': ['info', 'success', 'warning', 'danger']}})
    components['LingUI.IconButton']['properties'].update({'size': presentation['size'], 'loading': ref('dynamic'),
        'tone': {'enum': ['info', 'success', 'warning', 'danger']}})
    components['LingUI.Badge']['properties'].update({'size': presentation['size'], 'variant': {'enum': ['soft', 'outline', 'solid']}})
    for name in ['LingUI.Select', 'LingUI.Combobox', 'LingUI.MultiSelect']:
        components[name]['properties'].update(field)
        components[name]['properties']['options']['items']['properties'].update({
            'disabled': boolean, 'group': short, 'description': {'type': 'string', 'maxLength': 500}})
    components['LingUI.MultiSelect']['properties']['maxVisible'] = {'type': 'integer', 'minimum': 1, 'maximum': 6}
    components['LingUI.TagInput']['properties'].update(presentation)
    for name in ['DateTimeInput', 'LingUI.DateRange']:
        components[name]['properties'].update({**presentation, 'placeholder': short, 'clearable': boolean})
    menu_item = obj({'id': identifier, 'label': short, 'action': ref('action'), 'disabled': boolean,
        'group': short, 'tone': {'enum': ['default', 'danger']}}, ['id', 'label'])
    node('LingUI.Dropdown', {'label': ref('dynamic'), 'disabled': ref('dynamic'), 'size': presentation['size'],
        'menuItems': {'type': 'array', 'minItems': 1, 'maxItems': 20, 'items': menu_item}}, ['label', 'menuItems'])
    node('LingUI.Popconfirm', {'label': ref('dynamic'), 'text': ref('dynamic'), 'action': ref('action'),
        'disabled': ref('dynamic'), 'size': presentation['size'], 'confirmText': short, 'cancelText': short,
        'tone': {'enum': ['info', 'warning', 'danger']}}, ['label', 'text', 'action'])
    tree = {'type': 'array', 'minItems': 1, 'maxItems': 40, 'items': obj({
        'id': {'type': 'string', 'pattern': '^[a-zA-Z0-9_-]{1,80}$'},
        'label': short, 'parent': {'type': 'string', 'pattern': '^[a-zA-Z0-9_-]{1,80}$'}, 'disabled': boolean
    }, ['id', 'label'])}
    for name in ['LingUI.Cascader', 'LingUI.TreeSelect']:
        node(name, {**field, 'treeItems': tree}, ['label', 'value', 'treeItems'])
    node('LingUI.DynamicInput', {**presentation, 'label': ref('dynamic'), 'value': ref('binding'),
        'fields': {'type': 'array', 'minItems': 1, 'maxItems': 4, 'items': obj({
            'key': identifier, 'label': short, 'placeholder': short}, ['key', 'label'])},
        'minRows': {'type': 'integer', 'minimum': 0, 'maximum': 20},
        'maxRows': {'type': 'integer', 'minimum': 1, 'maximum': 20}, 'addText': short,
    }, ['label', 'value', 'fields'])
