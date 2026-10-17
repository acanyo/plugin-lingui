"""Named API and callback metadata. Credentials and executable functions are host-owned."""
def register_integrations(defs, obj):
 name={'type':'string','pattern':'^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$'}
 text=lambda limit: {'type':'string','maxLength':limit}
 value={'type':['null','boolean','number','string','array','object']}
 common={'name':name,'label':text(120),'description':text(500),'inputExample':value,'responseExample':value}
 api=obj({**common,'url':{'type':'string','minLength':1,'maxLength':2048},'method':{'enum':['GET','POST','PUT','PATCH','DELETE']}},['name','label','url','method'])
 callback=obj(common,['name','label'])
 defs['integrations']=obj({'apis':{'type':'array','items':api,'maxItems':32},'callbacks':{'type':'array','items':callback,'maxItems':32}},['apis','callbacks'])
