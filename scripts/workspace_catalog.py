"""Local navigation, workspace composition and analytical components."""


def register_workspace_components(node, ref, string, obj, children):
    identifier = {'type': 'string', 'pattern': '^[a-zA-Z0-9_-]{1,80}$'}
    short = {'type': 'string', 'minLength': 1, 'maxLength': 120}
    number = {'type': 'number', 'minimum': -1e12, 'maximum': 1e12}
    field = {'label': ref('dynamic'), 'value': ref('binding'), 'disabled': ref('dynamic')}
    options = {'type': 'array', 'minItems': 1, 'maxItems': 20, 'items': obj({'label': short, 'value': identifier, 'description': {'type': 'string', 'maxLength': 500}}, ['label', 'value'])}
    for name in ['LingUI.CardChoice', 'LingUI.CheckboxGroup']:
        node(name, {**field, 'description': ref('dynamic'), 'options': options}, ['label', 'value', 'options'])
    node('LingUI.TreeView', {**field, 'treeItems': {'type': 'array', 'minItems': 1, 'maxItems': 40, 'items': obj({'id': identifier, 'label': short, 'parent': identifier}, ['id', 'label'])}}, ['label', 'value', 'treeItems'])
    node('LingUI.Calendar', {**field, 'month': {'type': 'string', 'pattern': '^[0-9]{4}-(0[1-9]|1[0-2])$'}}, ['label', 'value', 'month'])
    node('LingUI.Drawer', {'label': ref('dynamic'), 'trigger': string, 'content': string, 'side': {'enum': ['left', 'right']}}, ['label', 'trigger', 'content'])
    node('LingUI.SplitPane', {'label': ref('dynamic'), 'children': {**children, 'minItems': 2, 'maxItems': 2}, 'value': ref('binding')}, ['label', 'children', 'value'])
    node('LingUI.ChatMessage', {'sender': short, 'text': ref('dynamic'), 'variant': {'enum': ['user', 'assistant', 'note']}, 'metadata': {'type': 'string', 'maxLength': 120}}, ['sender', 'text'])
    card = obj({'id': identifier, 'title': short, 'description': {'type': 'string', 'maxLength': 500}, 'tag': {'type': 'string', 'maxLength': 40}}, ['id', 'title'])
    board = obj({'id': identifier, 'title': short, 'cards': {'type': 'array', 'items': card, 'maxItems': 12}}, ['id', 'title', 'cards'])
    node('LingUI.Kanban', {**field, 'boards': {'type': 'array', 'minItems': 2, 'maxItems': 4, 'items': board}}, ['label', 'value', 'boards'])
    chart = {'label': string, 'description': string}
    node('LingUI.ScatterChart', {**chart, 'xLabel': short, 'yLabel': short, 'points': {'type': 'array', 'minItems': 1, 'maxItems': 24, 'items': obj({'label': short, 'x': number, 'y': number}, ['label', 'x', 'y'])}}, ['label', 'xLabel', 'yLabel', 'points'])
    node('LingUI.WaterfallChart', {**chart, 'unit': {'type': 'string', 'maxLength': 40}, 'data': {'type': 'array', 'minItems': 1, 'maxItems': 12, 'items': obj({'label': short, 'value': number}, ['label', 'value'])}}, ['label', 'data'])
