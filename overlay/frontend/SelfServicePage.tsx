import { useEffect, useMemo, useState } from 'react';
import {
  Content,
  Header,
  InfoCard,
  Page,
  Progress,
} from '@backstage/core-components';
import {
  fetchApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';

type ServiceType = 'vm' | 'storage' | 'app-service';

type PlatformConfig = {
  managedIdentity?: boolean;
  subscriptionConfigured?: boolean;
  subscriptionId?: string;
  allowedLocations?: string[];
  error?: string;
};

type VnetOption = {
  id: string;
  name: string;
  location: string;
  resourceGroup: string;
  addressPrefixes: string[];
};

type SubnetOption = {
  id: string;
  name: string;
  addressPrefixes: string[];
};

type NamingPreview = {
  workload: string;
  environment: string;
  environmentCode: string;
  location: string;
  regionCode: string;
  instance: string;
  resourceGroup: string;
  virtualMachine: string;
  networkInterface: string;
  storageAccount: string;
  appService: string;
  appServicePlan: string;
};

const fallbackLocations = ['centralindia', 'southindia', 'westindia'];

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '10px 12px',
  border: '1px solid #c8c8c8',
  borderRadius: 2,
  fontSize: 14,
  background: '#ffffff',
};

const labelStyle = {
  display: 'block',
  fontWeight: 600,
  marginBottom: 6,
  fontSize: 14,
};

const helperStyle = {
  marginTop: 5,
  fontSize: 12,
  color: '#555555',
};

const services: Array<{
  id: ServiceType;
  title: string;
  category: string;
  description: string;
  icon: string;
}> = [
  {
    id: 'vm',
    title: 'Virtual Machine',
    category: 'Compute',
    description:
      'Create a secure Azure Linux virtual machine using an approved enterprise configuration.',
    icon: 'VM',
  },
  {
    id: 'storage',
    title: 'Storage Account',
    category: 'Storage',
    description:
      'Create an Azure Storage Account with approved replication and security defaults.',
    icon: 'ST',
  },
  {
    id: 'app-service',
    title: 'App Service',
    category: 'Web',
    description:
      'Deploy an Azure Linux App Service on an approved managed application plan.',
    icon: 'AP',
  },
];

export const SelfServicePage = () => {
  const fetchApi = useApi(fetchApiRef);
  const [service, setService] = useState<ServiceType | null>('vm');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [search, setSearch] = useState('');

  const [vm, setVm] = useState({
    workload: 'backstage',
    environment: 'development',
    instance: '01',
    location: 'centralindia',
    vmSize: 'Standard_B2s',
    adminUsername: 'azureadmin',
    vnetId: '',
    subnetResourceId: '',
    sshPublicKey: '',
  });

  const [naming, setNaming] = useState<NamingPreview | null>(null);
  const [vnets, setVnets] = useState<VnetOption[]>([]);
  const [subnets, setSubnets] = useState<SubnetOption[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState('');

  const [storage, setStorage] = useState({
    resourceGroup: 'rg-selfservice-test',
    location: 'centralindia',
    name: '',
    sku: 'Standard_LRS',
  });

  const [appService, setAppService] = useState({
    resourceGroup: 'rg-selfservice-test',
    location: 'centralindia',
    name: '',
    planName: '',
    sku: 'B1',
  });

  useEffect(() => {
    fetchApi
      .fetch('/api/azure-self-service/config')
      .then(async response => {
        const body = (await response.json()) as PlatformConfig;
        setConfig(body);
      })
      .catch(error => setConfig({ error: String(error) }));
  }, [fetchApi]);

  const platformReady = Boolean(
    config?.managedIdentity && config?.subscriptionConfigured,
  );
  const locations = config?.allowedLocations || fallbackLocations;

  useEffect(() => {
    if (!platformReady) return;
    const query = new URLSearchParams({
      workload: vm.workload,
      environment: vm.environment,
      location: vm.location,
      instance: vm.instance,
    }).toString();

    fetchApi
      .fetch(`/api/azure-self-service/naming/preview?${query}`)
      .then(async response => {
        const body = (await response.json()) as NamingPreview | { error?: string };
        if (!response.ok) {
          throw new Error(
            'error' in body ? String(body.error) : 'Naming preview failed',
          );
        }
        setNaming(body as NamingPreview);
      })
      .catch(() => setNaming(null));
  }, [
    fetchApi,
    platformReady,
    vm.workload,
    vm.environment,
    vm.location,
    vm.instance,
  ]);

  useEffect(() => {
    if (!platformReady) return;

    setNetworkLoading(true);
    setNetworkError('');
    setVnets([]);
    setSubnets([]);
    setVm(current => ({
      ...current,
      vnetId: '',
      subnetResourceId: '',
    }));

    fetchApi
      .fetch(
        `/api/azure-self-service/network/vnets?location=${encodeURIComponent(
          vm.location,
        )}`,
      )
      .then(async response => {
        const body = (await response.json()) as {
          value?: VnetOption[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || 'Unable to load VNets');
        }
        setVnets(body.value || []);
      })
      .catch(error => setNetworkError(String(error)))
      .finally(() => setNetworkLoading(false));
  }, [fetchApi, platformReady, vm.location]);

  useEffect(() => {
    if (!vm.vnetId) {
      setSubnets([]);
      return;
    }

    setNetworkLoading(true);
    setNetworkError('');
    setSubnets([]);
    setVm(current => ({ ...current, subnetResourceId: '' }));

    fetchApi
      .fetch(
        `/api/azure-self-service/network/subnets?vnetId=${encodeURIComponent(
          vm.vnetId,
        )}`,
      )
      .then(async response => {
        const body = (await response.json()) as {
          value?: SubnetOption[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || 'Unable to load subnets');
        }
        setSubnets(body.value || []);
      })
      .catch(error => setNetworkError(String(error)))
      .finally(() => setNetworkLoading(false));
  }, [fetchApi, vm.vnetId]);

  const visibleServices = useMemo(
    () =>
      services.filter(item =>
        `${item.title} ${item.category} ${item.description}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [search],
  );

  const selectedService = services.find(item => item.id === service);

  const submit = async () => {
    if (!service) return;
    setBusy(true);
    setStatus(null);

    try {
      let payload: Record<string, string> = {};

      if (service === 'vm') {
        payload = {
          workload: vm.workload,
          environment: vm.environment,
          instance: vm.instance,
          location: vm.location,
          vmSize: vm.vmSize,
          adminUsername: vm.adminUsername,
          subnetResourceId: vm.subnetResourceId,
          sshPublicKey: vm.sshPublicKey,
        };
      } else if (service === 'storage') {
        payload = { ...storage };
      } else {
        payload = { ...appService };
      }

      const response = await fetchApi.fetch(
        `/api/azure-self-service/deploy/${service}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as Record<string, unknown>;
      setStatus(result);
    } catch (error) {
      setStatus({ error: String(error) });
    } finally {
      setBusy(false);
    }
  };

  const vmReady = Boolean(naming) && Boolean(vm.subnetResourceId) && Boolean(vm.sshPublicKey.trim());

  return (
    <Page themeId="tool">
      <Header
        title="Self-Service Market"
        subtitle="Discover and deploy approved cloud services"
      />
      <Content>
        <div style={{ fontSize: 13, marginBottom: 20 }}>
          Home &nbsp;&gt;&nbsp; Self Service &nbsp;&gt;&nbsp; Marketplace
        </div>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600 }}>Marketplace</h1>
          <div style={{ marginTop: 8, fontSize: 15 }}>
            Select an approved Azure service and configure your deployment.
          </div>
        </div>

        <div style={{ maxWidth: 760, marginBottom: 24 }}>
          <input
            style={{ ...inputStyle, height: 46, fontSize: 15 }}
            placeholder="Search Azure services"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>

        <InfoCard title="Platform readiness">
          {!config ? (
            <Progress />
          ) : config.error ? (
            <div>{config.error}</div>
          ) : (
            <div>
              Managed Identity: <strong>{config.managedIdentity ? 'Ready' : 'Not configured'}</strong>
              {' | '}Azure Subscription: <strong>{config.subscriptionConfigured ? 'Ready' : 'Not configured'}</strong>
              {' | '}Allowed regions: <strong>{locations.join(', ')}</strong>
            </div>
          )}
        </InfoCard>

        <div style={{ height: 28 }} />
        <h2 style={{ fontSize: 22, marginBottom: 16 }}>Azure services</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
            gap: 16,
          }}
        >
          {visibleServices.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setService(item.id);
                setStatus(null);
              }}
              style={{
                textAlign: 'left',
                background: '#ffffff',
                border: service === item.id ? '2px solid #0078d4' : '1px solid #d7d7d7',
                borderRadius: 2,
                padding: 20,
                cursor: 'pointer',
                minHeight: 170,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#0078d4',
                  color: '#ffffff',
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                {item.icon}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{item.title}</div>
              <div style={{ marginTop: 5, fontSize: 13 }}>{item.category}</div>
              <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>
                {item.description}
              </div>
            </button>
          ))}
        </div>

        {selectedService && (
          <>
            <div style={{ height: 34 }} />
            <div style={{ background: '#ffffff', border: '1px solid #d7d7d7' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #d7d7d7' }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>Create {selectedService.title}</h2>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  Configure approved deployment settings.
                </div>
              </div>

              {service === 'vm' && (
                <div style={{ padding: 24 }}>
                  <h3>Deployment intent</h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: 20,
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Application / Workload</label>
                      <input
                        style={inputStyle}
                        value={vm.workload}
                        onChange={event => setVm({ ...vm, workload: event.target.value })}
                      />
                      <div style={helperStyle}>Used by the naming engine.</div>
                    </div>

                    <div>
                      <label style={labelStyle}>Environment</label>
                      <select
                        style={inputStyle}
                        value={vm.environment}
                        onChange={event => setVm({ ...vm, environment: event.target.value })}
                      >
                        <option value="development">Development</option>
                        <option value="test">Test</option>
                        <option value="staging">Staging</option>
                        <option value="production">Production</option>
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Region</label>
                      <select
                        style={inputStyle}
                        value={vm.location}
                        onChange={event => setVm({ ...vm, location: event.target.value })}
                      >
                        {locations.map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Instance</label>
                      <input
                        style={inputStyle}
                        value={vm.instance}
                        onChange={event => setVm({ ...vm, instance: event.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ height: 28 }} />
                  <h3>Generated naming</h3>
                  <div
                    style={{
                      background: '#f6f8fa',
                      border: '1px solid #d7d7d7',
                      padding: 18,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 16,
                    }}
                  >
                    <div><strong>Resource Group</strong><div>{naming?.resourceGroup || 'Generating...'}</div></div>
                    <div><strong>VM Name</strong><div>{naming?.virtualMachine || 'Generating...'}</div></div>
                    <div><strong>NIC Name</strong><div>{naming?.networkInterface || 'Generating...'}</div></div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    {naming ? '✓ Naming compliant' : 'Waiting for valid naming inputs'}
                  </div>

                  <div style={{ height: 28 }} />
                  <h3>Networking</h3>
                  {networkLoading && <Progress />}
                  {networkError && <div style={{ marginBottom: 16 }}>{networkError}</div>}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: 20,
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Virtual Network</label>
                      <select
                        style={inputStyle}
                        value={vm.vnetId}
                        onChange={event => setVm({ ...vm, vnetId: event.target.value })}
                      >
                        <option value="">Select a VNet</option>
                        {vnets.map(vnet => (
                          <option key={vnet.id} value={vnet.id}>
                            {vnet.name} — {vnet.resourceGroup}
                            {vnet.addressPrefixes.length ? ` — ${vnet.addressPrefixes.join(', ')}` : ''}
                          </option>
                        ))}
                      </select>
                      <div style={helperStyle}>VNets are discovered from Azure in the selected region.</div>
                    </div>

                    <div>
                      <label style={labelStyle}>Subnet</label>
                      <select
                        style={inputStyle}
                        disabled={!vm.vnetId}
                        value={vm.subnetResourceId}
                        onChange={event => setVm({ ...vm, subnetResourceId: event.target.value })}
                      >
                        <option value="">Select a subnet</option>
                        {subnets.map(subnet => (
                          <option key={subnet.id} value={subnet.id}>
                            {subnet.name}
                            {subnet.addressPrefixes.length ? ` — ${subnet.addressPrefixes.join(', ')}` : ''}
                          </option>
                        ))}
                      </select>
                      <div style={helperStyle}>The subnet Resource ID is retained internally.</div>
                    </div>
                  </div>

                  <div style={{ height: 28 }} />
                  <h3>Compute</h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: 20,
                    }}
                  >
                    <div>
                      <label style={labelStyle}>VM Size</label>
                      <select
                        style={inputStyle}
                        value={vm.vmSize}
                        onChange={event => setVm({ ...vm, vmSize: event.target.value })}
                      >
                        <option value="Standard_B2s">Standard_B2s</option>
                        <option value="Standard_D2s_v5">Standard_D2s_v5</option>
                        <option value="Standard_D4s_v5">Standard_D4s_v5</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Administrator Username</label>
                      <input
                        style={inputStyle}
                        value={vm.adminUsername}
                        onChange={event => setVm({ ...vm, adminUsername: event.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <label style={labelStyle}>SSH Public Key</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 90 }}
                      value={vm.sshPublicKey}
                      onChange={event => setVm({ ...vm, sshPublicKey: event.target.value })}
                    />
                  </div>

                  <div style={{ marginTop: 30, borderTop: '1px solid #d7d7d7', paddingTop: 20 }}>
                    <button
                      type="button"
                      disabled={busy || !platformReady || !vmReady}
                      onClick={submit}
                      style={{
                        padding: '10px 22px',
                        border: 0,
                        background: platformReady && vmReady ? '#0078d4' : '#bcbcbc',
                        color: '#ffffff',
                        fontWeight: 600,
                        cursor: platformReady && vmReady ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {busy ? 'Deploying...' : 'Deploy Virtual Machine'}
                    </button>
                  </div>
                </div>
              )}

              {service === 'storage' && (
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                    <div>
                      <label style={labelStyle}>Resource Group</label>
                      <input style={inputStyle} value={storage.resourceGroup} onChange={event => setStorage({ ...storage, resourceGroup: event.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Region</label>
                      <select style={inputStyle} value={storage.location} onChange={event => setStorage({ ...storage, location: event.target.value })}>
                        {locations.map(location => <option key={location} value={location}>{location}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Storage Account Name</label>
                      <input style={inputStyle} value={storage.name} onChange={event => setStorage({ ...storage, name: event.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Replication</label>
                      <select style={inputStyle} value={storage.sku} onChange={event => setStorage({ ...storage, sku: event.target.value })}>
                        <option value="Standard_LRS">Standard LRS</option>
                        <option value="Standard_ZRS">Standard ZRS</option>
                        <option value="Standard_GRS">Standard GRS</option>
                      </select>
                    </div>
                  </div>
                  <button type="button" disabled={busy || !platformReady || !storage.name} onClick={submit} style={{ marginTop: 24, padding: '10px 22px' }}>
                    Deploy Storage Account
                  </button>
                </div>
              )}

              {service === 'app-service' && (
                <div style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                    <div>
                      <label style={labelStyle}>Resource Group</label>
                      <input style={inputStyle} value={appService.resourceGroup} onChange={event => setAppService({ ...appService, resourceGroup: event.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Region</label>
                      <select style={inputStyle} value={appService.location} onChange={event => setAppService({ ...appService, location: event.target.value })}>
                        {locations.map(location => <option key={location} value={location}>{location}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>App Service Name</label>
                      <input style={inputStyle} value={appService.name} onChange={event => setAppService({ ...appService, name: event.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>App Service Plan</label>
                      <input style={inputStyle} value={appService.planName} onChange={event => setAppService({ ...appService, planName: event.target.value })} />
                    </div>
                  </div>
                  <button type="button" disabled={busy || !platformReady || !appService.name} onClick={submit} style={{ marginTop: 24, padding: '10px 22px' }}>
                    Deploy App Service
                  </button>
                </div>
              )}

              {busy && <div style={{ padding: '0 24px 20px' }}><Progress /></div>}

              {status && (
                <div style={{ padding: '0 24px 24px' }}>
                  <h3>Deployment Result</h3>
                  <pre style={{ padding: 16, background: '#f5f5f5', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {JSON.stringify(status, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}
      </Content>
    </Page>
  );
};
