
const ENV: Record<string,string> = {
  development:'dev', test:'tst', staging:'stg', production:'prd',
};
const REGION: Record<string,string> = {
  centralindia:'cin', southindia:'sin', westindia:'win',
};

export function names(workloadRaw:string, environmentRaw:string, locationRaw:string, instanceRaw:string) {
  const workload = workloadRaw.toLowerCase().trim()
    .replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,20);
  if (workload.length < 2) throw new Error('Workload must contain at least 2 letters/numbers');

  const environment = environmentRaw.toLowerCase();
  const location = locationRaw.toLowerCase();
  if (!ENV[environment]) throw new Error(`Unsupported environment '${environment}'`);
  if (!REGION[location]) throw new Error(`No naming code for '${location}'`);

  const digits = instanceRaw.replace(/\D/g,'') || '1';
  const instance = String(Number(digits)).padStart(2,'0');
  const suffix = `${workload}-${ENV[environment]}-${REGION[location]}-${instance}`;
  return {
    workload, environment, location, instance,
    resourceGroup:`rg-${workload}-${ENV[environment]}-${REGION[location]}`,
    virtualMachine:`vm-${suffix}`.slice(0,64),
    networkInterface:`nic-${suffix}`.slice(0,80),
  };
}
