"""Composable layout, text and action primitives for the LingUI catalog."""


def register_primitive_components(node, ref, string, children, icons):
    scale = {'enum': ['none', 'small', 'medium', 'large']}
    direction = {'enum': ['horizontal', 'vertical']}
    node('LingUI.Box', {
        'children': children, 'variant': {'enum': ['plain', 'outlined', 'soft']},
        'padding': scale, 'gap': scale, 'direction': direction,
        'align': {'enum': ['start', 'center', 'end', 'stretch']},
        'justify': {'enum': ['start', 'center', 'end', 'spaceBetween']},
    }, ['children'])
    node('LingUI.Center', {
        'child': string, 'maxWidth': {'enum': [320, 480, 640, 960]},
        'minHeight': {'enum': [0, 120, 240, 360]},
    }, ['child'])
    node('LingUI.Spacer', {'size': scale, 'direction': direction})
    node('LingUI.Separator', {'orientation': direction})
    node('LingUI.FormGroup', {
        'label': ref('dynamic'), 'description': ref('dynamic'),
        'child': string, 'disabled': ref('dynamic'),
    }, ['label', 'child'])
    node('LingUI.ButtonGroup', {
        'label': ref('dynamic'), 'children': children, 'direction': direction,
        'gap': scale,
    }, ['label', 'children'])
    node('LingUI.IconButton', {
        'label': ref('dynamic'), 'name': icons, 'action': ref('action'),
        'variant': {'enum': ['primary', 'secondary', 'text']},
        'disabled': ref('dynamic'),
    }, ['label', 'name', 'action'])
    node('LingUI.Popover', {
        'label': ref('dynamic'), 'trigger': string, 'content': string,
        'placement': {'enum': ['top', 'bottom']},
    }, ['label', 'trigger', 'content'])
    node('LingUI.InlineCode', {'text': ref('dynamic')}, ['text'])
    node('LingUI.Highlight', {
        'text': ref('dynamic'), 'tone': {'enum': ['accent', 'success', 'warning', 'danger']},
    }, ['text'])
