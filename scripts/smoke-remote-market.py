import base64,json,time,hashlib,urllib.request,urllib.error
base='http://127.0.0.1:8090'
admin=('admin','admin')
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args): return None
opener=urllib.request.build_opener(NoRedirect)
def call(method,path,data=None,auth=admin):
 headers={'Accept':'application/json'}
 if auth:headers['Authorization']='Basic '+base64.b64encode((':'.join(auth)).encode()).decode()
 if data is not None:headers['Content-Type']='application/json'
 req=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
 try:
  with opener.open(req,timeout=30) as res:code=res.status;raw=res.read()
 except urllib.error.HTTPError as err:code=err.code;raw=err.read()
 try:body=json.loads(raw) if raw else None
 except ValueError:body=raw.decode()[:200]
 return code,body
def ok(method,path,data=None,auth=admin):
 code,body=call(method,path,data,auth)
 assert code in [200,201],(method,path,code,body)
 return body
resources=[];checks=[];prefix='qa-lingui-bridge-'+str(int(time.time()))
api='/apis/console.api.lingui.acanyo.com/v1alpha1'
def check(name,result):
 assert result,name
 checks.append(name)
try:
 for role,templates in [('view',['plugin-lingui-role-view']),('author',['plugin-lingui-role-market-submit'])]:
  name=prefix+'-'+role
  ok('POST','/api/v1alpha1/roles',{'apiVersion':'v1alpha1','kind':'Role','metadata':{'name':name,'annotations':{'rbac.authorization.halo.run/dependencies':json.dumps(templates)}},'rules':[]})
  resources.append('/api/v1alpha1/roles/'+name)
 for user,role in [('viewer','view'),('alice','author'),('bob','author')]:
  name=prefix+'-'+user
  ok('POST','/apis/api.console.halo.run/v1alpha1/users',{'name':name,'displayName':name,'email':name+'@example.invalid','password':'qa-local-strong-password','roles':[prefix+'-'+role]})
  resources.append('/api/v1alpha1/users/'+name)
 viewer=(prefix+'-viewer','qa-local-strong-password');alice=(prefix+'-alice','qa-local-strong-password');bob=(prefix+'-bob','qa-local-strong-password')
 for _ in range(20):
  code,_=call('GET',api+'/marketconnection',auth=alice)
  if code==200:break
  time.sleep(.25)
 check('View role can read real public market',call('GET',api+'/marketworks',auth=viewer)[0]==200)
 check('View role cannot read connection',call('GET',api+'/marketconnection',auth=viewer)[0]==403)
 check('View role cannot connect',call('PUT',api+'/marketconnection',{'token':'qa-invalid'},viewer)[0]==403)
 check('Anonymous cannot read personal connection',call('GET',api+'/marketconnection',auth=None)[0] in [401,403,302])
 secret='lingui-market-'+hashlib.sha256(alice[0].encode()).hexdigest()
 # Dummy credential used only to verify local user isolation. Never sent to the market.
 ok('POST','/api/v1alpha1/secrets',{'apiVersion':'v1alpha1','kind':'Secret','metadata':{'name':secret},'type':'Opaque','stringData':{'token':'qa-local-isolation-sentinel','username':'qa-market-author','displayName':'验收作者'}})
 resources.append('/api/v1alpha1/secrets/'+secret)
 a=ok('GET',api+'/marketconnection',auth=alice);b=ok('GET',api+'/marketconnection',auth=bob)
 check('Connection is scoped to local authenticated user',a['connected'] and not b['connected'])
 check('Status never returns stored credentials','qa-local-isolation-sentinel' not in json.dumps(a) and 'token' not in a)
 check('Authors cannot read raw Secret',call('GET','/api/v1alpha1/secrets/'+secret,auth=alice)[0]==403)
 check('Other user cannot read raw Secret',call('GET','/api/v1alpha1/secrets/'+secret,auth=bob)[0]==403)
 check('Unconnected author cannot submit',call('POST',api+'/marketsubmissions',{'packageJson':'{}'},bob)[0]==400)
 check('Page validation happens before outbound fetch',call('GET',api+'/marketworks?page=0',auth=viewer)[0]==400)
 check('Invalid identifier is refused',call('GET',api+'/marketworks/not-a-work',auth=viewer)[0]==400)
 check('Disconnect only affects calling user',call('DELETE',api+'/marketconnection',auth=bob)[0]==204 and ok('GET',api+'/marketconnection',auth=alice)['connected'])
 check('Author can delete own connection',call('DELETE',api+'/marketconnection',auth=alice)[0]==204 and not ok('GET',api+'/marketconnection',auth=alice)['connected'])
 print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False,indent=2))
finally:
 for path in reversed(resources):
  code,body=call('DELETE',path)
  if code not in [200,202,204,404]:print('Cleanup failed:',path,code)
