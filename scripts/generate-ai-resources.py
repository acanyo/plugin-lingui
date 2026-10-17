"""Export labels and JVM validation envelopes from the pinned renderer contract."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src/main/resources/protocol'
labels = (ROOT / 'ui/src/component-studio/catalog-labels.ts').read_text()
sections = labels.split('export const nodeDescriptions:')[0], labels.split('export const nodeDescriptions:')[1]
def entries(section):
    return dict((a or b, text) for a, b, text in re.findall(r"^\s*(?:'([^']+)'|(\w+)):\s*'([^']*)',?", section, re.M))
names, descriptions = map(entries, sections)
catalog = json.loads((ROOT / 'packages/renderer/schemas/catalog.json').read_text())
assert set(names) == set(catalog['components'])
(OUT / 'component-summaries.json').write_text(json.dumps({name: {'label': names[name], 'description': descriptions[name]} for name in names}, ensure_ascii=False, indent=2) + '\n')

def obj(properties, required=None):
    return dict(type='object', properties=properties, required=list(properties) if required is None else required, additionalProperties=False)
def string(maximum, minimum=0):
    return dict(type='string', maxLength=maximum, minLength=minimum)
def number(low, high):
    return dict(type='number', minimum=low, maximum=high)
parameter = obj({'key': dict(type='string', pattern='^[a-zA-Z][a-zA-Z0-9_]{0,39}$'), 'label': string(120), 'path': dict(type='string', pattern='^/', maxLength=160), 'type': {'enum': ['string', 'number', 'boolean']}, 'default': {'type': ['string', 'number', 'boolean']}, 'min': {'type': 'number'}, 'max': {'type': 'number'}}, ['key', 'label', 'path', 'type', 'default'])
document = obj({'schemaVersion': {'const': 'lingui.document/2'}, 'title': string(120, 1), 'source': string(262144, 1), 'state': {'type': 'object'}, 'parameters': dict(type='array', items=parameter, maxItems=32)})
document['properties']['integrations'] = {'$ref': '#/$defs/integrations'}
theme = obj({'schemaVersion': {'const': 'lingui.theme/1'}, 'id': dict(type='string', pattern='^[a-zA-Z0-9_-]{1,80}$'), 'name': string(120, 1), 'mode': {'enum': ['light', 'dark', 'auto']}, 'colors': obj({key: dict(type='string', pattern='^#[0-9a-fA-F]{6}$') for key in ['background', 'surface', 'text', 'muted', 'accent', 'border', 'success', 'danger', 'line']}), 'radius': number(0, 32), 'spacing': number(4, 40), 'iconSize': number(12, 40), 'lineWidth': number(1, 4), 'shadow': number(0, 3), 'font': {'enum': ['system', 'serif', 'mono']}})
face = obj({'url': string(2048, 1), 'format': {'enum': ['woff2', 'woff']}, 'weight': dict(type='string', pattern=r'^[0-9]{1,4}(?:\s+[0-9]{1,4})?$'), 'style': {'enum': ['normal', 'italic']}, 'unicodeRange': string(2048, 1)}, ['url', 'format', 'weight', 'style'])
theme['properties']['customFont'] = obj({'id': dict(type='string', pattern='^[a-zA-Z0-9_-]{1,80}$'), 'name': string(120, 1), 'faces': dict(type='array', items=face, minItems=1, maxItems=512)})
(OUT / 'design-envelope.schema.json').write_text(json.dumps(obj({'document': document, 'theme': theme}, ['document']), ensure_ascii=False, indent=2) + '\n')
