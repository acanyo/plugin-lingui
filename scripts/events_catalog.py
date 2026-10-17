"""Portable events and declarative actions; executable callbacks remain in the host."""
FIELDS = ['CheckBox','TextField','Slider','ChoicePicker','DateTimeInput','LingUI.NumberInput',
 'LingUI.Switch','LingUI.Select','LingUI.SegmentedControl','LingUI.Rating','LingUI.SearchInput',
 'LingUI.ColorPicker','LingUI.MultiSelect','LingUI.TagInput','LingUI.RangeSlider','LingUI.DateRange',
 'LingUI.NumberStepper','LingUI.PasswordInput','LingUI.Combobox','LingUI.Transfer','LingUI.ToggleButton',
 'LingUI.TreeView','LingUI.Calendar','LingUI.CardChoice','LingUI.CheckboxGroup','LingUI.Cascader',
 'LingUI.TreeSelect','LingUI.DynamicInput']
EXTRAS = {
 'List':['select','retry'],
 'Button':['click'], 'LingUI.IconButton':['click'], 'LingUI.Link':['click'], 'LingUI.Breadcrumbs':['click'], 'LingUI.FileCard':['click'],
 'Tabs':['change'],'LingUI.Tabs':['change'],'LingUI.Steps':['change'],'LingUI.Pagination':['change'],
 'LingUI.Carousel':['change'],'LingUI.SplitPane':['change'],'LingUI.Collapse':['change'],
 'LingUI.Accordion':['change'],'LingUI.DiagramNode':['change'],
 'Modal':['open','close','cancel'],'LingUI.Drawer':['open','close','cancel'],'LingUI.Popover':['open','close'],
 'LingUI.Dropdown':['select','open','close'],'LingUI.Popconfirm':['open','close','confirm','cancel'],
 'LingUI.Alert':['close'],'LingUI.FormGroup':['submit','invalid'],
 'LingUI.TagInput':['add','remove'],'LingUI.DynamicInput':['add','remove','reorder'],
 'LingUI.Kanban':['change','move'],'LingUI.TreeView':['select'],'LingUI.Calendar':['select'],
 'Image':['load','error'],'Video':['load','error','play','pause','ended','timeUpdate'],
 'AudioPlayer':['load','error','play','pause','ended','timeUpdate'],
}

def register_events(components, defs, obj, ref):
 path = {'type':'string','pattern':'^/.+','maxLength':160}
 name = {'type':'string','pattern':'^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$'}
 json_value = {'type':['null','boolean','number','string','array','object']}
 timeout = {'type':'integer','minimum':100,'maximum':60000}
 result = {'resultPath':path}
 event_local = obj({'type':defs['localAction']['properties']['type'],'path':path,'value':json_value},['type'])
 action = {'oneOf':[
  obj({'type':{'const':'api'},'name':name,'args':json_value,'timeoutMs':timeout,**result},['type','name']),
  obj({'type':{'const':'local'},'actions':{'type':'array','items':event_local,'minItems':1,'maxItems':32}},['type','actions']),
  obj({'type':{'const':'request'},'url':{'type':'string','minLength':1,'maxLength':2048},
       'method':{'enum':['GET','POST','PUT','PATCH','DELETE']},'query':{'type':'object','maxProperties':40},
       'headers':{'type':'object','maxProperties':20},'body':json_value,'response':{'enum':['json','text']},
       'timeoutMs':timeout,**result},['type','url']),
  obj({'type':{'const':'callback'},'name':name,'args':json_value,'timeoutMs':timeout,**result},['type','name']),
  obj({'type':{'const':'delay'},'ms':{'type':'integer','minimum':0,'maximum':30000}},['type','ms']),
  obj({'type':{'const':'emit'},'name':name,'detail':json_value},['type','name']),
 ]}
 steps={'type':'array','items':ref('eventAction'),'maxItems':16}
 defs['eventAction']=action
 defs['eventBinding']=obj({'actions':{**steps,'minItems':1},'onSuccess':steps,'onError':steps,
   'loadingPath':path,'errorPath':path,'resultPath':path,'debounceMs':{'type':'integer','minimum':0,'maximum':5000},
   'concurrency':{'enum':['drop','latest']}},['actions'])
 capabilities={}
 for component,schema in components.items():
  events=list(EXTRAS.get(component,[]))
  if 'bindings' in schema['properties']: events += ['retry']
  if component in FIELDS: events += ['change','focus','blur']
  if component in ['CheckBox','Slider','ChoicePicker','TextField','LingUI.NumberInput','LingUI.SearchInput','LingUI.PasswordInput','LingUI.ColorPicker','LingUI.TagInput','LingUI.DynamicInput','LingUI.Combobox','DateTimeInput','LingUI.DateRange','LingUI.Rating','LingUI.RangeSlider','LingUI.CheckboxGroup','LingUI.CardChoice']:
   events += ['input','enter']
  if component in ['TextField','LingUI.SearchInput','LingUI.PasswordInput','LingUI.Select','LingUI.MultiSelect','LingUI.Combobox','LingUI.Cascader','LingUI.TreeSelect','LingUI.Rating','DateTimeInput','LingUI.DateRange']:
   events += ['clear']
  if component=='LingUI.SearchInput':events+=['search']
  if component in ['Button','LingUI.IconButton','LingUI.Link','LingUI.Dropdown','LingUI.Popconfirm']:events+=['focus','blur']
  # Work initialization is independent of native media load or DOM visibility.
  events=list(dict.fromkeys([*events, 'mount']))
  if events:
   schema['properties']['events']=obj({event:ref('eventBinding') for event in events},[])
   capabilities[component]=events
  if component in ['Button','LingUI.IconButton']:
   schema['properties']['buttonType']={'enum':['button','submit']}
  if component in ['TextField','LingUI.NumberInput','LingUI.PasswordInput','LingUI.SearchInput']:
   schema['properties']['required']={'type':'boolean'}
   schema['properties']['minLength']={'type':'integer','minimum':0,'maximum':2000}
 # A configured click hook can be used without also creating a dummy local action.
 for component in ['Button','LingUI.IconButton','LingUI.Popconfirm']:
  schema=components[component]
  if 'action' in schema['required']:schema['required'].remove('action')
 return capabilities
