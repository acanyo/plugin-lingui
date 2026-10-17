"""Collection bindings preserve the static property contracts and validate resolved data."""

def register_data_bindings(components, defs, obj, ref):
 path = {'type':'string','pattern':'^/','maxLength':160}
 mapping = {'type':'object','maxProperties':12,'additionalProperties':{'oneOf':[path,{'type':'array','items':path,'maxItems':12}]}}
 defs['collectionBinding'] = obj({'path':path,'map':mapping},['path'])
 list_item = obj({'id':{'oneOf':[{'type':'string','maxLength':120},{'type':'number'}]},'label':{'type':'string','maxLength':16000},'description':{'type':'string','maxLength':16000}},['label'])
 components['List']['properties']['items']={'type':'array','items':list_item,'maxItems':100}
 supported = {}
 for name, schema in components.items():
  keys=[key for key in ['rows','data','entries','matrix','points','items','options','members','treeItems'] if key in schema['properties']]
  if not keys: continue
  supported[name]=keys
  for key in keys:
   minimum=schema['properties'][key].get('minItems',0)
   schema['properties'][key]['minItems']=0
   if minimum > 1: schema['properties'][key]['not']={'minItems':1,'maxItems':minimum-1}
  schema['properties']['bindings']=obj({key:ref('collectionBinding') for key in keys},[])
  schema['properties']['dataState']=obj({'loading':ref('binding'),'error':ref('binding'),'emptyText':{'type':'string','maxLength':300}},[])
 return supported
