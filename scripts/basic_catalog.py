"""Basic Catalog component kinds implemented by LingUI's offline catalog."""


def register_basic_components(node, ref, string, boolean, children, obj):
    node('Image', {'url': ref('dynamic'), 'description': ref('dynamic'),
                  'fit': {'enum': ['contain', 'cover', 'fill', 'none', 'scaleDown']},
                  'variant': {'enum': ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header']}}, ['url'])
    node('Video', {'url': ref('dynamic'), 'description': ref('dynamic')}, ['url'])
    node('AudioPlayer', {'url': ref('dynamic'), 'description': ref('dynamic')}, ['url'])
    node('List', {'children': children, 'direction': {'enum': ['vertical', 'horizontal']},
                 'align': {'enum': ['start', 'center', 'end', 'stretch']}}, ['children'])
    node('Tabs', {'value': ref('binding'), 'tabs': {'type': 'array', 'minItems': 1, 'maxItems': 20,
                 'items': obj({'title': ref('dynamic'), 'child': string}, ['title', 'child'])}}, ['tabs'])
    node('Modal', {'trigger': string, 'content': string, 'label': ref('dynamic')}, ['trigger', 'content'])
    node('DateTimeInput', {'label': ref('dynamic'), 'value': ref('binding'),
                         'enableDate': boolean, 'enableTime': boolean, 'min': string, 'max': string}, ['value'])
