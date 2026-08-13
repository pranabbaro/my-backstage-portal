
import { useEffect, useState } from 'react';
import { Content, Header, InfoCard, Page, Progress } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/frontend-plugin-api';

type NetworkType='internal'|'intranet'|'dmz'|'business-managed';
type Subscription={subscriptionId:string;displayName:string};
type RG={id:string;name:string;location:string};
type VNet={id:string;name:string;resourceGroup:string;addressPrefixes:string[]};
type Subnet={id:string;name:string;addressPrefixes:string[]};
type Names={resourceGroup:string;virtualMachine:string;networkInterface:string};

const input:React.CSSProperties={width:'100%',boxSizing:'border-box',padding:'10px 12px',border:'1px solid #c8c8c8',background:'#fff'};
const label:React.CSSProperties={display:'block',fontWeight:600,marginBottom:6};
const grid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:18};

export const SelfServicePage=()=>{
  const fetchApi=useApi(fetchApiRef);
  const [cfg,setCfg]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState<Record<string,unknown>|null>(null);
  const [subs,setSubs]=useState<Subscription[]>([]);
  const [autoSub,setAutoSub]=useState<Subscription|null>(null);
  const [rgs,setRgs]=useState<RG[]>([]);
  const [vnets,setVnets]=useState<VNet[]>([]);
  const [subnets,setSubnets]=useState<Subnet[]>([]);
  const [names,setNames]=useState<Names|null>(null);
  const [error,setError]=useState('');

  const [f,setF]=useState({
    workload:'backstage',environment:'development',location:'centralindia',instance:'01',
    networkType:'internal' as NetworkType,subscriptionId:'',
    resourceGroupMode:'new' as 'existing'|'new',resourceGroup:'',
    vnetId:'',subnetResourceId:'',vmSize:'Standard_B2s',
    adminUsername:'azureadmin',sshPublicKey:'',
  });

  useEffect(()=>{fetchApi.fetch('/api/azure-self-service/config').then(r=>r.json()).then(setCfg)},[fetchApi]);

  useEffect(()=>{
    const q=new URLSearchParams({workload:f.workload,environment:f.environment,location:f.location,instance:f.instance});
    fetchApi.fetch(`/api/azure-self-service/naming/preview?${q}`).then(async r=>{
      if(!r.ok) throw new Error();
      setNames(await r.json());
    }).catch(()=>setNames(null));
  },[fetchApi,f.workload,f.environment,f.location,f.instance]);

  useEffect(()=>{
    if(!cfg?.managedIdentity) return;
    setError(''); setAutoSub(null); setSubs([]);
    setF(x=>({...x,subscriptionId:'',resourceGroup:'',vnetId:'',subnetResourceId:''}));
    if(f.networkType==='business-managed'){
      fetchApi.fetch('/api/azure-self-service/subscriptions/business-managed').then(async r=>{
        const b=await r.json(); if(!r.ok) throw new Error(b.error||'Unable to load assigned subscriptions');
        setSubs(b.value||[]);
      }).catch(e=>setError(String(e)));
    } else {
      const q=new URLSearchParams({networkType:f.networkType,location:f.location});
      fetchApi.fetch(`/api/azure-self-service/subscriptions/resolve?${q}`).then(async r=>{
        const b=await r.json(); if(!r.ok) throw new Error(b.error||'Unable to resolve subscription');
        setAutoSub(b.subscription);
        setF(x=>({...x,subscriptionId:b.subscription.subscriptionId}));
      }).catch(e=>setError(String(e)));
    }
  },[fetchApi,cfg?.managedIdentity,f.networkType,f.location]);

  const activeSub=f.networkType==='business-managed'?f.subscriptionId:autoSub?.subscriptionId||'';

  useEffect(()=>{
    if(!activeSub) return;
    setRgs([]); setVnets([]); setSubnets([]);
    setF(x=>({...x,resourceGroup:'',vnetId:'',subnetResourceId:''}));
    const rq=new URLSearchParams({subscriptionId:activeSub,location:f.location});
    fetchApi.fetch(`/api/azure-self-service/resource-groups?${rq}`).then(r=>r.json()).then(b=>setRgs(b.value||[]));
    fetchApi.fetch(`/api/azure-self-service/network/vnets?${rq}`).then(r=>r.json()).then(b=>setVnets(b.value||[]));
  },[fetchApi,activeSub,f.location]);

  useEffect(()=>{
    if(!f.vnetId){setSubnets([]);return;}
    setF(x=>({...x,subnetResourceId:''}));
    fetchApi.fetch(`/api/azure-self-service/network/subnets?vnetId=${encodeURIComponent(f.vnetId)}`)
      .then(r=>r.json()).then(b=>setSubnets(b.value||[]));
  },[fetchApi,f.vnetId]);

  const ready=Boolean(activeSub&&f.subnetResourceId&&f.sshPublicKey.trim()&&names&&(f.resourceGroupMode==='new'||f.resourceGroup));

  const deploy=async()=>{
    setBusy(true);setStatus(null);
    try{
      const r=await fetchApi.fetch('/api/azure-self-service/deploy/vm',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...f,subscriptionId:activeSub}),
      });
      setStatus(await r.json());
    }catch(e){setStatus({error:String(e)});}
    finally{setBusy(false);}
  };

  return <Page themeId="tool">
    <Header title="Self-Service Market" subtitle="Approved cloud placement and deployment"/>
    <Content>
      <InfoCard title="Platform readiness">
        {!cfg?<Progress/>:<div>
          Managed Identity: <b>{cfg.managedIdentity?'Ready':'Not configured'}</b>
          {' | '}Subscription routing: <b>{cfg.subscriptionRoutingConfigured?'Ready':'Not configured'}</b>
        </div>}
      </InfoCard>

      <div style={{height:20}}/>
      <h2>Create Virtual Machine</h2>

      <div style={grid}>
        <div><label style={label}>Application / Workload</label><input style={input} value={f.workload} onChange={e=>setF({...f,workload:e.target.value})}/></div>
        <div><label style={label}>Environment</label><select style={input} value={f.environment} onChange={e=>setF({...f,environment:e.target.value})}>
          <option value="development">Development</option><option value="test">Test</option><option value="staging">Staging</option><option value="production">Production</option>
        </select></div>
        <div><label style={label}>Region</label><select style={input} value={f.location} onChange={e=>setF({...f,location:e.target.value})}>
          {(cfg?.allowedLocations||['centralindia','southindia','westindia']).map((x:string)=><option key={x}>{x}</option>)}
        </select></div>
        <div><label style={label}>Instance</label><input style={input} value={f.instance} onChange={e=>setF({...f,instance:e.target.value})}/></div>
      </div>

      <h3>Network Connection Type</h3>
      <select style={input} value={f.networkType} onChange={e=>setF({...f,networkType:e.target.value as NetworkType})}>
        <option value="internal">Internal</option><option value="intranet">Intranet</option><option value="dmz">DMZ</option><option value="business-managed">Business Managed</option>
      </select>

      <h3>Target Subscription</h3>
      {f.networkType==='business-managed'
        ? <select style={input} value={f.subscriptionId} onChange={e=>setF({...f,subscriptionId:e.target.value})}>
            <option value="">Select an assigned subscription</option>
            {subs.map(s=><option key={s.subscriptionId} value={s.subscriptionId}>{s.displayName}</option>)}
          </select>
        : <div style={{padding:12,background:'#f6f8fa'}}><b>{autoSub?.displayName||'Resolving...'}</b><div>Automatically selected by placement policy.</div></div>}
      {error&&<div style={{marginTop:8}}>{error}</div>}

      <h3>Resource Group</h3>
      <label><input type="radio" checked={f.resourceGroupMode==='existing'} onChange={()=>setF({...f,resourceGroupMode:'existing'})}/> Use existing</label>{' '}
      <label><input type="radio" checked={f.resourceGroupMode==='new'} onChange={()=>setF({...f,resourceGroupMode:'new',resourceGroup:''})}/> Create new</label>
      {f.resourceGroupMode==='existing'
        ? <select style={{...input,marginTop:10}} value={f.resourceGroup} onChange={e=>setF({...f,resourceGroup:e.target.value})}>
            <option value="">Select an existing Resource Group</option>{rgs.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
        : <div style={{padding:12,background:'#f6f8fa',marginTop:10}}><b>{names?.resourceGroup||'Generating...'}</b></div>}

      <h3>Network</h3>
      <div style={grid}>
        <div><label style={label}>Virtual Network</label><select style={input} value={f.vnetId} onChange={e=>setF({...f,vnetId:e.target.value})}>
          <option value="">Select a VNet</option>{vnets.map(v=><option key={v.id} value={v.id}>{v.name} — {v.resourceGroup}</option>)}
        </select></div>
        <div><label style={label}>Subnet</label><select style={input} value={f.subnetResourceId} disabled={!f.vnetId} onChange={e=>setF({...f,subnetResourceId:e.target.value})}>
          <option value="">Select a subnet</option>{subnets.map(s=><option key={s.id} value={s.id}>{s.name}{s.addressPrefixes.length?` — ${s.addressPrefixes.join(', ')}`:''}</option>)}
        </select></div>
      </div>

      <h3>Generated Names</h3>
      <div style={{padding:12,background:'#f6f8fa'}}>
        VM: <b>{names?.virtualMachine||'Generating...'}</b><br/>NIC: <b>{names?.networkInterface||'Generating...'}</b>
      </div>

      <h3>Compute</h3>
      <div style={grid}>
        <div><label style={label}>VM Size</label><select style={input} value={f.vmSize} onChange={e=>setF({...f,vmSize:e.target.value})}>
          <option>Standard_B2s</option><option>Standard_D2s_v5</option><option>Standard_D4s_v5</option>
        </select></div>
        <div><label style={label}>Administrator Username</label><input style={input} value={f.adminUsername} onChange={e=>setF({...f,adminUsername:e.target.value})}/></div>
      </div>

      <div style={{marginTop:18}}><label style={label}>SSH Public Key</label><textarea style={{...input,minHeight:90}} value={f.sshPublicKey} onChange={e=>setF({...f,sshPublicKey:e.target.value})}/></div>

      <button type="button" disabled={busy||!ready} onClick={deploy} style={{marginTop:22,padding:'10px 22px'}}>
        {busy?'Deploying...':'Deploy Virtual Machine'}
      </button>
      {busy&&<Progress/>}
      {status&&<pre style={{marginTop:18,padding:14,background:'#f5f5f5',whiteSpace:'pre-wrap'}}>{JSON.stringify(status,null,2)}</pre>}
    </Content>
  </Page>;
};
