"""Generate LingUI's strict OpenUI custom component configuration catalog. No remote schema resolution."""
import json
from pathlib import Path
ref = lambda name: {'$ref': '#/$defs/' + name}
string = {'type': 'string', 'maxLength': 16000}
number = {'type': 'number'}
boolean = {'type': 'boolean'}
binding = {'type': 'object', 'properties': {'path': {'type': 'string', 'pattern': '^/', 'maxLength': 160}}, 'required': ['path'], 'additionalProperties': False}
obj = lambda props, required: {'type': 'object', 'properties': props, 'required': required, 'additionalProperties': False}
expr = {'anyOf': [{'type': ['string','number','boolean','null']}, binding, obj({'op': {'enum': ['add','subtract','multiply','divide','mod','min','max','round','eq','neq','gt','gte','lt','lte','and','or','not','if','includes']}, 'args': {'type': 'array', 'items': ref('expression'), 'minItems': 1, 'maxItems': 8}}, ['op','args'])]}
function = obj({'call': {'const': 'lingui.evaluate'}, 'args': obj({'expression': ref('expression')}, ['expression']), 'returnType': {'enum': ['string','number','boolean']}}, ['call','args'])
dynamic = {'anyOf': [{'type':['string','number','boolean']},binding,function]}
action_item = obj({'type': {'enum': ['setState','toggleState','increment','decrement','selectOption','show','hide','nextStep','previousStep','reset']}, 'path': binding['properties']['path'], 'value': ref('expression')}, ['type'])
action = obj({'functionCall': obj({'call': {'const':'lingui.dispatch'}, 'args': obj({'actions': {'type':'array','items': ref('localAction'),'minItems':1,'maxItems':32}},['actions'])},['call','args'])},['functionCall'])
children = {'type':'array','items':{'type':'string','maxLength':80},'maxItems':256}
components = {}
def node(name, props={}, required=[]):
 components[name] = obj({'id': {'type':'string','pattern':'^[a-zA-Z0-9_-]{1,80}$'}, 'component': {'const':name}, **props}, ['id','component',*required])
for name in ['Column','Row']:
 node(name, {'children':children,'align':{'enum':['start','center','end','stretch']},'justify':{'enum':['start','center','end','spaceBetween']}},['children'])
node('Card', {'child':string,'variant':{'enum':['outlined','soft','plain']}},['child'])
node('Text', {'text':ref('dynamic'),'variant':{'enum':['h1','h2','h3','body','caption']}},['text'])
icons = {'enum':['warning','info','check','code','layers','book','sparkles','arrow','clock','help','cube','database','heap','list','cpu','chevronDown','arrowDown']}
node('Icon', {'name':icons},['name'])
node('Button', {'child':string,'variant':{'enum':['primary','secondary','text']},'action':ref('action')},['child','action'])
node('Divider')
node('CheckBox', {'label':ref('dynamic'),'value':ref('binding')},['label','value'])
node('TextField', {'label':ref('dynamic'),'value':ref('binding'),'variant':{'enum':['shortText','longText','number','obscured']}},['label','value'])
node('Slider', {'label':ref('dynamic'),'value':ref('binding'),'min':number,'max':number,'step':{'type':'number','exclusiveMinimum':0}},['label','value','min','max'])
node('ChoicePicker', {'label':ref('dynamic'),'value':ref('binding'),'variant':{'enum':['mutuallyExclusive','multipleSelection']},'options':{'type':'array','items':obj({'label':string,'value':string},['label','value']),'minItems':1,'maxItems':40}},['label','value','options'])
from basic_catalog import register_basic_components
register_basic_components(node, ref, string, boolean, children, obj)
from extended_catalog import register_extended_components
register_extended_components(node, ref, string, obj, icons)
from advanced_catalog import register_advanced_components
register_advanced_components(node, ref, string, obj, children)
from productivity_catalog import register_productivity_components
register_productivity_components(node, ref, string, obj, children)
from workspace_catalog import register_workspace_components
register_workspace_components(node, ref, string, obj, children)
from primitive_catalog import register_primitive_components
register_primitive_components(node, ref, string, children, icons)
node('LingUI.Callout', {'child':string,'tone':ref('dynamic')},['child'])
node('LingUI.Collapse', {'title':ref('dynamic'),'child':string,'expanded':ref('binding'),'multiple':ref('binding'),'exclusiveGroup':{'type':'string','maxLength':80}},['title','child','expanded'])
node('LingUI.Conditional', {'condition':ref('expression'),'child':string},['condition','child'])
node('LingUI.NumberInput', {'label':ref('dynamic'),'value':ref('binding'),'min':number,'max':number,'step':{'type':'number','exclusiveMinimum':0}},['label','value'])
node('LingUI.Progress', {'label':ref('dynamic'),'value':ref('dynamic'),'max':{'type':'number','exclusiveMinimum':0}},['label','value'])
node('LingUI.Tabs', {'value':ref('binding'),'tabs':{'type':'array','items':obj({'title':string,'child':string},['title','child']),'minItems':1,'maxItems':20}},['value','tabs'])
node('LingUI.Steps', {'value':ref('binding'),'children':children},['value','children'])
node('LingUI.Diagram', {'children':children,'orientation':{'enum':['horizontal','vertical']}},['children'])
node('LingUI.DiagramNode', {'title':ref('dynamic'),'description':ref('dynamic'),'children':children,'expanded':ref('binding'),'accent':boolean,'variant':{'enum':['tree','group','stage','item']},'name':icons,'tone':ref('dynamic')},['title'])
node('LingUI.Timeline', {'children':children},['children'])
node('LingUI.TimelineItem', {'title':ref('dynamic'),'description':ref('dynamic'),'child':string},['title'])
node('LingUI.Badge', {'text':ref('dynamic'),'tone':ref('dynamic')},['text'])
node('LingUI.Quote', {'text':ref('dynamic'),'label':ref('dynamic'),'description':ref('dynamic')},['text'])
node('LingUI.Metric', {'label':ref('dynamic'),'value':ref('dynamic'),'description':ref('dynamic')},['label','value'])
node('LingUI.Table', {'label':string,'columns':{'type':'array','items':string,'minItems':2,'maxItems':6},'rows':{'type':'array','minItems':1,'maxItems':30,'items':obj({'label':string,'cells':{'type':'array','items':string,'minItems':1,'maxItems':5}},['label','cells'])}},['label','columns','rows'])
node('LingUI.Section', {'label':ref('dynamic'),'title':ref('dynamic'),'description':ref('dynamic'),'children':children},['title','children'])
node('LingUI.Grid', {'children':children,'maxColumns':{'enum':[2,3,4]}},['children'])
node('LingUI.CodeBlock', {'label':string,'code':string,'language':{'enum':['text','java','javascript','typescript','json','python','bash','sql']}},['code'])
node('LingUI.KeyValue', {'label':string,'entries':{'type':'array','minItems':1,'maxItems':20,'items':obj({'label':string,'value':string},['label','value'])}},['entries'])
node('LingUI.BarChart', {'label':string,'description':string,'unit':{'type':'string','maxLength':40},'data':{'type':'array','minItems':1,'maxItems':12,'items':obj({'label':string,'value':{'type':'number','minimum':0,'maximum':1e12}},['label','value'])}},['label','data'])
from interaction_catalog import register_interaction_components
register_interaction_components(node, components, ref, string, obj)
catalog = {'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:lingui:openui:1','catalogId':'urn:lingui:openui:1','title':'LingUI OpenUI Catalog v1', 'components':components,'functions':{'lingui.dispatch':ref('action'),'lingui.evaluate':function},'$defs':{'theme':obj({},[]),'binding':binding,'expression':expr,'dynamic':dynamic,'localAction':action_item,'action':action,'anyComponent':{'type':'object','discriminator':{'propertyName':'component'},'oneOf':list(components.values())}}}
from data_bindings_catalog import register_data_bindings
binding_capabilities = register_data_bindings(components, catalog['$defs'], obj, ref)
Path('packages/renderer/schemas/binding-capabilities.json').write_text(json.dumps(binding_capabilities,ensure_ascii=False,indent=2)+'\n')
from integrations_catalog import register_integrations
register_integrations(catalog['$defs'], obj)
from events_catalog import register_events
event_capabilities = register_events(components, catalog['$defs'], obj, ref)
Path('packages/renderer/schemas/event-capabilities.json').write_text(json.dumps(event_capabilities,ensure_ascii=False,indent=2)+'\n')
from motion_catalog import register_motion
register_motion(components, catalog['$defs'], obj, ref)
Path('packages/renderer/schemas/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
