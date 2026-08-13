
import { JsonRecord } from './types';
const MANAGEMENT='https://management.azure.com';

async function token():Promise<string> {
  const endpoint=process.env.IDENTITY_ENDPOINT;
  const header=process.env.IDENTITY_HEADER;
  if (!endpoint || !header) throw new Error('Azure App Service Managed Identity is unavailable');
  const url=new URL(endpoint);
  url.searchParams.set('api-version','2019-08-01');
  url.searchParams.set('resource',`${MANAGEMENT}/`);
  const r=await fetch(url,{headers:{'X-IDENTITY-HEADER':header,Metadata:'true'}});
  const d=(await r.json()) as {access_token?:string;error?:string;error_description?:string};
  if (!r.ok || !d.access_token) throw new Error(`Managed Identity token failed: ${d.error_description||d.error||r.statusText}`);
  return d.access_token;
}

export async function arm(method:string,path:string,apiVersion:string,body?:JsonRecord) {
  const auth=await token();
  const url=`${MANAGEMENT}${path}${path.includes('?')?'&':'?'}api-version=${encodeURIComponent(apiVersion)}`;
  const r=await fetch(url,{
    method,
    headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined,
  });
  const text=await r.text();
  let data:any={};
  if (text) { try { data=JSON.parse(text); } catch { data={message:text}; } }
  if (!r.ok) throw new Error(`Azure ARM ${method} failed (${r.status}): ${JSON.stringify(data)}`);
  return {status:r.status,data,headers:r.headers};
}

export async function ensureResourceGroup(subscriptionId:string,resourceGroup:string,location:string) {
  return arm('PUT',`/subscriptions/${subscriptionId}/resourcegroups/${encodeURIComponent(resourceGroup)}`,'2022-09-01',{
    location,tags:{ManagedBy:'Backstage',Portal:'EnterpriseDeveloperPortal'},
  });
}
