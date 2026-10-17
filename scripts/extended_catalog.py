"""LingUI form, presentation, navigation and chart extensions."""


def register_extended_components(node, ref, string, obj, icons):
    boolean = {'type': 'boolean'}
    size = {'enum': ['small', 'medium', 'large']}
    options = {'type': 'array', 'minItems': 1, 'maxItems': 40, 'items': obj({
        'label': string, 'value': {'type': 'string', 'minLength': 1, 'maxLength': 160}
    }, ['label', 'value'])}
    field = {'label': ref('dynamic'), 'value': ref('binding'), 'disabled': ref('dynamic')}
    node('LingUI.Switch', {**field, 'description': ref('dynamic')}, ['label', 'value'])
    node('LingUI.Select', {**field, 'options': options, 'placeholder': string}, ['label', 'value', 'options'])
    node('LingUI.SegmentedControl', {**field, 'options': {**options, 'maxItems': 12}}, ['label', 'value', 'options'])
    node('LingUI.Rating', {**field, 'max': {'type': 'integer', 'minimum': 1, 'maximum': 10}, 'readOnly': boolean}, ['label', 'value'])
    node('LingUI.Avatar', {'label': ref('dynamic'), 'description': ref('dynamic'), 'url': ref('dynamic'), 'size': size}, ['label'])
    node('LingUI.Link', {'text': ref('dynamic'), 'url': ref('dynamic'), 'newWindow': boolean}, ['text', 'url'])
    node('LingUI.Breadcrumbs', {'label': string, 'items': {'type': 'array', 'minItems': 1, 'maxItems': 12, 'items': obj({'label': string, 'url': string}, ['label'])}}, ['items'])
    node('LingUI.EmptyState', {'title': ref('dynamic'), 'description': ref('dynamic'), 'name': icons, 'child': string}, ['title'])
    node('LingUI.Skeleton', {'label': string, 'lines': {'type': 'integer', 'minimum': 1, 'maximum': 8}, 'variant': {'enum': ['text', 'card', 'avatar']}}, [])
    node('LingUI.Spinner', {'label': ref('dynamic'), 'size': size}, ['label'])
    for name in ['LingUI.LineChart', 'LingUI.DonutChart']:
        data = {'type': 'array', 'minItems': 1, 'maxItems': 12, 'items': obj({
            'label': string, 'value': {'type': 'number', 'minimum': -1e12 if name == 'LingUI.LineChart' else 0, 'maximum': 1e12}
        }, ['label', 'value'])}
        node(name, {'label': string, 'description': string, 'unit': {'type': 'string', 'maxLength': 40}, 'data': data}, ['label', 'data'])
