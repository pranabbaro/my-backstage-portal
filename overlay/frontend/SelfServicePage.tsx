
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

type ServiceType = 'vm' | 'storage' | 'app-service' | 'key-vault';
type TargetPlatform = 'azure' | 'aws' | 'gcp' | 'azure-local' | 'hyperv';
type NetworkType =
  | 'internal'
  | 'intranet'
  | 'dmz'
  | 'business-managed';

type Subscription = {
  subscriptionId: string;
  displayName: string;
};

type ResourceGroup = {
  id: string;
  name: string;
  location: string;
};

type VNet = {
  id: string;
  name: string;
  resourceGroup: string;
  addressPrefixes: string[];
};

type Subnet = {
  id: string;
  name: string;
  addressPrefixes: string[];
};

type Names = {
  resourceGroup: string;
  virtualMachine: string;
  networkInterface: string;
  storageAccount: string;
  appService: string;
  appServicePlan: string;
  keyVault: string;
};

type VmSize = {
  name: string;
  vcpus: number | null;
  memoryGB: number | null;
  premiumIO: boolean | null;
  hourlyPrice: number | null;
  monthlyPrice: number | null;
  currencyCode: string;
  priceSource: 'Azure Retail Prices' | 'Unavailable';
};

type PlatformConfig = {
  managedIdentity?: boolean;
  subscriptionRoutingConfigured?: boolean;
  allowedLocations?: string[];
  deploymentProvider?: 'direct-arm' | 'github';
};

const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #c8c8c8',
  background: '#fff',
};

const label: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: 6,
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
  gap: 18,
};

const infoBox: React.CSSProperties = {
  padding: 14,
  background: '#f6f8fa',
  border: '1px solid #d7d7d7',
};

const services: Array<{
  id: ServiceType;
  title: string;
  category: string;
  description: string;
}> = [
  {
    id: 'vm',
    title: 'Virtual Machine',
    category: 'Compute',
    description:
      'Deploy a Linux virtual machine with approved sizing, network placement and naming.',
  },
  {
    id: 'storage',
    title: 'Storage Account',
    category: 'Storage',
    description:
      'Deploy a secure StorageV2 account with approved redundancy and access settings.',
  },
  {
    id: 'app-service',
    title: 'App Service',
    category: 'Web',
    description:
      'Deploy a Linux App Service and App Service Plan with approved runtime and plan SKU.',
  },
  {
    id: 'key-vault',
    title: 'Key Vault',
    category: 'Security',
    description:
      'Deploy an Azure Key Vault using RBAC authorization, soft delete and approved security settings.',
  },
];

const APPROVED_VM_SIZE_NAMES = [
  'Standard_B2s',
  'Standard_D2s_v5',
  'Standard_D4s_v5',
];

function money(value: number | null) {
  if (value === null) return 'Unavailable';
  return `₹${value.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

export const SelfServicePage = () => {
  const fetchApi = useApi(fetchApiRef);

  const [platform, setPlatform] = useState<TargetPlatform>('azure');
  const [service, setService] = useState<ServiceType | null>(null);
  const [cfg, setCfg] = useState<PlatformConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] =
    useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    workload: 'backstage',
    environment: 'development',
    location: 'centralindia',
    instance: '01',
    networkType: 'internal' as NetworkType,
    subscriptionId: '',
    resourceGroupMode: 'new' as 'existing' | 'new',
    resourceGroup: '',

    vnetId: '',
    subnetResourceId: '',
    vmSize: 'Standard_B2s',
    adminUsername: 'azureadmin',
    sshPublicKey: '',

    redundancy: 'Standard_LRS',
    accessTier: 'Hot',
    storagePublicNetworkAccess: 'Enabled',

    planSku: 'B1',
    runtime: 'NODE|22-lts',
    appPublicNetworkAccess: 'Enabled',

    keyVaultSku: 'standard',
    keyVaultSoftDeleteRetention: '90',
    keyVaultPurgeProtection: 'Enabled',
    keyVaultNetworkMode: 'public',
    keyVaultTrustedServices: 'Enabled',
  });

  const [autoSub, setAutoSub] = useState<Subscription | null>(null);
  const [businessSubs, setBusinessSubs] = useState<Subscription[]>([]);
  const [rgs, setRgs] = useState<ResourceGroup[]>([]);
  const [vnets, setVnets] = useState<VNet[]>([]);
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [names, setNames] = useState<Names | null>(null);
  const [vmSizes, setVmSizes] = useState<VmSize[]>(
    APPROVED_VM_SIZE_NAMES.map(name => ({
      name,
      vcpus: null,
      memoryGB: null,
      premiumIO: null,
      hourlyPrice: null,
      monthlyPrice: null,
      currencyCode: 'INR',
      priceSource: 'Unavailable',
    })),
  );
  const [vmSizeMessage, setVmSizeMessage] = useState('');
  const [vmSizesLoading, setVmSizesLoading] = useState(false);
  const [error, setError] = useState('');

  const locations =
    cfg?.allowedLocations || ['centralindia', 'southindia', 'westindia'];

  useEffect(() => {
    fetchApi
      .fetch('/api/azure-self-service/config')
      .then(response => response.json())
      .then(body => setCfg(body as PlatformConfig))
      .catch(err => setError(String(err)));
  }, [fetchApi]);

  useEffect(() => {
    const query = new URLSearchParams({
      workload: form.workload,
      environment: form.environment,
      location: form.location,
      instance: form.instance,
    });

    fetchApi
      .fetch(`/api/azure-self-service/naming/preview?${query}`)
      .then(async response => {
        if (!response.ok) throw new Error('Naming preview failed');
        setNames((await response.json()) as Names);
      })
      .catch(() => setNames(null));
  }, [
    fetchApi,
    form.workload,
    form.environment,
    form.location,
    form.instance,
  ]);

  useEffect(() => {
    if (!cfg?.managedIdentity) return;

    setAutoSub(null);
    setBusinessSubs([]);
    setRgs([]);
    setVnets([]);
    setSubnets([]);
    setError('');

    setForm(current => ({
      ...current,
      subscriptionId: '',
      resourceGroup: '',
      vnetId: '',
      subnetResourceId: '',
    }));

    if (form.networkType === 'business-managed') {
      fetchApi
        .fetch('/api/azure-self-service/subscriptions/business-managed')
        .then(async response => {
          const body = await response.json();
          if (!response.ok) {
            throw new Error(
              body.error || 'Unable to load assigned subscriptions',
            );
          }
          setBusinessSubs(body.value || []);
        })
        .catch(err => setError(String(err)));

      return;
    }

    const query = new URLSearchParams({
      networkType: form.networkType,
      location: form.location,
    });

    fetchApi
      .fetch(`/api/azure-self-service/subscriptions/resolve?${query}`)
      .then(async response => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || 'Unable to resolve subscription');
        }
        setAutoSub(body.subscription);
        setForm(current => ({
          ...current,
          subscriptionId: body.subscription.subscriptionId,
        }));
      })
      .catch(err => setError(String(err)));
  }, [fetchApi, cfg?.managedIdentity, form.networkType, form.location]);

  const activeSubscription =
    form.networkType === 'business-managed'
      ? form.subscriptionId
      : autoSub?.subscriptionId || '';

  useEffect(() => {
    if (!activeSubscription) return;

    setRgs([]);
    setVnets([]);
    setSubnets([]);

    setForm(current => ({
      ...current,
      resourceGroup: '',
      vnetId: '',
      subnetResourceId: '',
    }));

    const query = new URLSearchParams({
      subscriptionId: activeSubscription,
      location: form.location,
    });

    fetchApi
      .fetch(`/api/azure-self-service/resource-groups/accessible?${query}`)
      .then(response => response.json())
      .then(body => setRgs(body.value || []))
      .catch(() => setRgs([]));

    const needsNetworkDiscovery =
      service === 'vm' ||
      (service === 'key-vault' &&
        form.keyVaultNetworkMode !== 'public');

    if (needsNetworkDiscovery) {
      fetchApi
        .fetch(`/api/azure-self-service/network/vnets?${query}`)
        .then(response => response.json())
        .then(body => setVnets(body.value || []))
        .catch(() => setVnets([]));
    }
  }, [
    fetchApi,
    activeSubscription,
    form.location,
    service,
    form.keyVaultNetworkMode,
  ]);

  useEffect(() => {
    const needsSubnet =
      service === 'vm' ||
      (service === 'key-vault' &&
        form.keyVaultNetworkMode !== 'public');

    if (!needsSubnet || !form.vnetId) {
      setSubnets([]);
      return;
    }

    setForm(current => ({
      ...current,
      subnetResourceId: '',
    }));

    fetchApi
      .fetch(
        `/api/azure-self-service/network/subnets?vnetId=${encodeURIComponent(
          form.vnetId,
        )}`,
      )
      .then(response => response.json())
      .then(body => setSubnets(body.value || []))
      .catch(() => setSubnets([]));
  }, [
    fetchApi,
    service,
    form.vnetId,
    form.keyVaultNetworkMode,
  ]);

  useEffect(() => {
    if (service !== 'vm' || !activeSubscription) {
      return;
    }

    setVmSizesLoading(true);
    setVmSizeMessage('Loading CPU, RAM and pricing details...');

    const query = new URLSearchParams({
      subscriptionId: activeSubscription,
      location: form.location,
    });

    fetchApi
      .fetch(`/api/azure-self-service/vm-sizes?${query}`)
      .then(async response => {
        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error || 'Unable to load VM size details',
          );
        }

        const details = (body.value || []) as VmSize[];

        if (details.length > 0) {
          setVmSizes(current =>
            current.map(item => {
              const match = details.find(
                detail => detail.name === item.name,
              );
              return match || item;
            }),
          );
        }

        setVmSizeMessage(
          body.pricingNote ||
            'Retail compute estimate only; additional Azure charges may apply.',
        );
      })
      .catch(() => {
        setVmSizeMessage(
          'CPU, RAM and pricing details are temporarily unavailable. VM size selection is still available.',
        );
      })
      .finally(() => setVmSizesLoading(false));
  }, [fetchApi, service, activeSubscription, form.location]);

  const selectedVmSize = vmSizes.find(size => size.name === form.vmSize);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(item =>
      `${item.title} ${item.category} ${item.description}`
        .toLowerCase()
        .includes(q),
    );
  }, [search]);

  const sharedReady = Boolean(
    activeSubscription &&
      names &&
      (form.resourceGroupMode === 'new' || form.resourceGroup),
  );

  const ready = Boolean(
    sharedReady &&
      (service === 'vm'
        ? form.subnetResourceId &&
          form.sshPublicKey.trim() &&
          selectedVmSize
        : service === 'storage'
          ? form.redundancy && form.accessTier
          : service === 'app-service'
            ? form.planSku && form.runtime
            : service === 'key-vault'
              ? form.keyVaultSku &&
                form.keyVaultSoftDeleteRetention &&
                form.keyVaultNetworkMode &&
                (form.keyVaultNetworkMode === 'public'
                  ? true
                  : Boolean(
                      form.vnetId &&
                        form.subnetResourceId,
                    ))
              : false),
  );

  const deploy = async () => {
    if (!service) return;

    setBusy(true);
    setStatus(null);

    try {
      let endpoint = '';
      let payload: Record<string, unknown> = {
        workload: form.workload,
        environment: form.environment,
        location: form.location,
        instance: form.instance,
        networkType: form.networkType,
        subscriptionId: activeSubscription,
        resourceGroupMode: form.resourceGroupMode,
        resourceGroup: form.resourceGroup,
      };

      if (service === 'vm') {
        endpoint = '/api/azure-self-service/deploy/vm';
        payload = {
          ...payload,
          subnetResourceId: form.subnetResourceId,
          vmSize: form.vmSize,
          adminUsername: form.adminUsername,
          sshPublicKey: form.sshPublicKey,
        };
      }

      if (service === 'storage') {
        endpoint = '/api/azure-self-service/deploy/storage';
        payload = {
          ...payload,
          redundancy: form.redundancy,
          accessTier: form.accessTier,
          publicNetworkAccess: form.storagePublicNetworkAccess,
        };
      }

      if (service === 'app-service') {
        endpoint = '/api/azure-self-service/deploy/app-service';
        payload = {
          ...payload,
          planSku: form.planSku,
          runtime: form.runtime,
          publicNetworkAccess: form.appPublicNetworkAccess,
        };
      }

      if (service === 'key-vault') {
        endpoint = '/api/azure-self-service/deploy/key-vault';
        payload = {
          ...payload,
          sku: form.keyVaultSku,
          softDeleteRetentionInDays: Number(
            form.keyVaultSoftDeleteRetention,
          ),
          purgeProtection:
            form.keyVaultPurgeProtection === 'Enabled',
          networkMode: form.keyVaultNetworkMode,
          trustedServicesBypass:
            form.keyVaultTrustedServices === 'Enabled',
          vnetId:
            form.keyVaultNetworkMode === 'public'
              ? undefined
              : form.vnetId,
          subnetResourceId:
            form.keyVaultNetworkMode === 'public'
              ? undefined
              : form.subnetResourceId,
        };
      }

      const response = await fetchApi.fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      setStatus(
        (await response.json()) as Record<string, unknown>,
      );
    } catch (err) {
      setStatus({ error: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const ServiceCard = ({
    item,
  }: {
    item: (typeof services)[number];
  }) => (
    <button
      type="button"
      onClick={() => {
        setService(item.id);
        setStatus(null);
        setError('');
      }}
      style={{
        textAlign: 'left',
        padding: 20,
        minHeight: 155,
        background: '#fff',
        border:
          service === item.id
            ? '2px solid #0078d4'
            : '1px solid #d7d7d7',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 19, fontWeight: 600 }}>{item.title}</div>
      <div style={{ marginTop: 5, fontSize: 13 }}>{item.category}</div>
      <div style={{ marginTop: 12, lineHeight: 1.45 }}>
        {item.description}
      </div>
    </button>
  );

  return (
    <Page themeId="tool">
      <Header
        title="Self-Service Market"
        subtitle="Approved Azure services and enterprise placement"
      />

      <Content>
        <InfoCard title="Platform readiness">
          {!cfg ? (
            <Progress />
          ) : (
            <div>
              Managed Identity:{' '}
              <b>{cfg.managedIdentity ? 'Ready' : 'Not configured'}</b>
              {' | '}
              Subscription routing:{' '}
              <b>
                {cfg.subscriptionRoutingConfigured
                  ? 'Ready'
                  : 'Not configured'}
              </b>
              {' | '}
              Deployment engine:{' '}
              <b>
                {cfg.deploymentProvider === 'github'
                  ? 'GitHub IaC'
                  : 'Direct ARM'}
              </b>
            </div>
          )}
        </InfoCard>

        <div style={{ marginTop: 28 }}>
          <h2 style={{ marginBottom: 8 }}>Target Platform</h2>
          <div style={grid}>
            {[
              ['azure', 'Microsoft Azure', 'Available'],
              ['aws', 'Amazon Web Services', 'Foundation ready'],
              ['gcp', 'Google Cloud', 'Foundation ready'],
              ['azure-local', 'Azure Local', 'Foundation ready'],
              ['hyperv', 'Hyper-V', 'Foundation ready'],
            ].map(([id, title, state]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPlatform(id as TargetPlatform);
                  setService(null);
                  setStatus(null);
                }}
                style={{
                  textAlign: 'left',
                  padding: 16,
                  background: '#fff',
                  border:
                    platform === id
                      ? '2px solid #0078d4'
                      : '1px solid #d7d7d7',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 17 }}>{title}</div>
                <div style={{ marginTop: 5, fontSize: 12 }}>{state}</div>
              </button>
            ))}
          </div>
        </div>

        {platform !== 'azure' && (
          <div style={{ ...infoBox, marginTop: 18 }}>
            The orchestration foundation for this platform is ready. Its approved
            service catalog and deployment adapter will be added without changing
            the common Self-Service contract.
          </div>
        )}

        {platform === 'azure' && (
          <>
        <div style={{ marginTop: 28 }}>
          <h1 style={{ marginBottom: 6 }}>Azure Marketplace</h1>
          <div>
            Choose an Azure service. Each service shows only the properties
            relevant to that resource.
          </div>
        </div>

        <input
          style={{ ...input, marginTop: 18, maxWidth: 720 }}
          placeholder="Search Azure services"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />

        <div
          style={{
            ...grid,
            marginTop: 20,
          }}
        >
          {filteredServices.map(item => (
            <ServiceCard key={item.id} item={item} />
          ))}
        </div>

        {!service && (
          <div style={{ ...infoBox, marginTop: 28 }}>
            Select a service above to open its deployment form.
          </div>
        )}

        {service && (
          <div
            style={{
              marginTop: 30,
              border: '1px solid #d7d7d7',
              padding: 24,
              background: '#fff',
            }}
          >
            <h2>
              {service === 'vm'
                ? 'Create Virtual Machine'
                : service === 'storage'
                  ? 'Create Storage Account'
                  : service === 'app-service'
                    ? 'Create App Service'
                    : 'Create Key Vault'}
            </h2>

            <h3>Placement</h3>
            <div style={grid}>
              <div>
                <label style={label}>Application / Workload</label>
                <input
                  style={input}
                  value={form.workload}
                  onChange={event =>
                    setForm({
                      ...form,
                      workload: event.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label style={label}>Environment</label>
                <select
                  style={input}
                  value={form.environment}
                  onChange={event =>
                    setForm({
                      ...form,
                      environment: event.target.value,
                    })
                  }
                >
                  <option value="development">Development</option>
                  <option value="test">Test</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div>
                <label style={label}>Region</label>
                <select
                  style={input}
                  value={form.location}
                  onChange={event =>
                    setForm({
                      ...form,
                      location: event.target.value,
                    })
                  }
                >
                  {locations.map(location => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={label}>Instance</label>
                <input
                  style={input}
                  value={form.instance}
                  onChange={event =>
                    setForm({
                      ...form,
                      instance: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <h3>Network Connection Type</h3>
            <select
              style={input}
              value={form.networkType}
              onChange={event =>
                setForm({
                  ...form,
                  networkType: event.target.value as NetworkType,
                })
              }
            >
              <option value="internal">Internal</option>
              <option value="intranet">Intranet</option>
              <option value="dmz">DMZ</option>
              <option value="business-managed">
                Business Managed
              </option>
            </select>

            <h3>Target Subscription</h3>
            {form.networkType === 'business-managed' ? (
              <select
                style={input}
                value={form.subscriptionId}
                onChange={event =>
                  setForm({
                    ...form,
                    subscriptionId: event.target.value,
                  })
                }
              >
                <option value="">Select an assigned subscription</option>
                {businessSubs.map(subscription => (
                  <option
                    key={subscription.subscriptionId}
                    value={subscription.subscriptionId}
                  >
                    {subscription.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <div style={infoBox}>
                <b>{autoSub?.displayName || 'Resolving...'}</b>
              </div>
            )}

            {error && (
              <div style={{ marginTop: 10 }}>
                {error}
              </div>
            )}

            <h3>Resource Group</h3>
            <label>
              <input
                type="radio"
                checked={form.resourceGroupMode === 'existing'}
                onChange={() =>
                  setForm({
                    ...form,
                    resourceGroupMode: 'existing',
                  })
                }
              />{' '}
              Use existing
            </label>{' '}
            <label>
              <input
                type="radio"
                checked={form.resourceGroupMode === 'new'}
                onChange={() =>
                  setForm({
                    ...form,
                    resourceGroupMode: 'new',
                    resourceGroup: '',
                  })
                }
              />{' '}
              Create new
            </label>

            {form.resourceGroupMode === 'existing' ? (
              <select
                style={{ ...input, marginTop: 10 }}
                value={form.resourceGroup}
                onChange={event =>
                  setForm({
                    ...form,
                    resourceGroup: event.target.value,
                  })
                }
              >
                <option value="">
                  {rgs.length === 0
                    ? 'No Resource Groups found'
                    : 'Select an existing Resource Group'}
                </option>
                {rgs.map(rg => (
                  <option key={rg.id} value={rg.name}>
                    {rg.name}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ ...infoBox, marginTop: 10 }}>
                <b>{names?.resourceGroup || 'Generating...'}</b>
              </div>
            )}

            {service === 'vm' && (
              <>
                <h3>Network</h3>
                <div style={grid}>
                  <div>
                    <label style={label}>Virtual Network</label>
                    <select
                      style={input}
                      value={form.vnetId}
                      onChange={event =>
                        setForm({
                          ...form,
                          vnetId: event.target.value,
                        })
                      }
                    >
                      <option value="">Select a VNet</option>
                      {vnets.map(vnet => (
                        <option key={vnet.id} value={vnet.id}>
                          {vnet.name} — {vnet.resourceGroup}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={label}>Subnet</label>
                    <select
                      style={input}
                      value={form.subnetResourceId}
                      disabled={!form.vnetId}
                      onChange={event =>
                        setForm({
                          ...form,
                          subnetResourceId: event.target.value,
                        })
                      }
                    >
                      <option value="">Select a subnet</option>
                      {subnets.map(subnet => (
                        <option key={subnet.id} value={subnet.id}>
                          {subnet.name}
                          {subnet.addressPrefixes.length
                            ? ` — ${subnet.addressPrefixes.join(', ')}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <h3>Generated Names</h3>
                <div style={infoBox}>
                  VM: <b>{names?.virtualMachine || 'Generating...'}</b>
                  <br />
                  NIC: <b>{names?.networkInterface || 'Generating...'}</b>
                </div>

                <h3>Compute</h3>
                <div style={grid}>
                  <div>
                    <label style={label}>VM Size</label>
                    <select
                      style={input}
                      value={form.vmSize}
                      onChange={event =>
                        setForm({
                          ...form,
                          vmSize: event.target.value,
                        })
                      }
                    >
                      {vmSizes.map(size => (
                        <option key={size.name} value={size.name}>
                          {size.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={label}>Administrator Username</label>
                    <input
                      style={input}
                      value={form.adminUsername}
                      onChange={event =>
                        setForm({
                          ...form,
                          adminUsername: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                {selectedVmSize && (
                  <div style={{ ...infoBox, marginTop: 16 }}>
                    <div style={grid}>
                      <div>
                        <strong>vCPU</strong>
                        <div>{selectedVmSize.vcpus ?? 'Unavailable'}</div>
                      </div>
                      <div>
                        <strong>RAM</strong>
                        <div>
                          {selectedVmSize.memoryGB === null
                            ? 'Unavailable'
                            : `${selectedVmSize.memoryGB} GB`}
                        </div>
                      </div>
                      <div>
                        <strong>Estimated hourly compute</strong>
                        <div>{money(selectedVmSize.hourlyPrice)}</div>
                      </div>
                      <div>
                        <strong>Estimated monthly compute</strong>
                        <div>{money(selectedVmSize.monthlyPrice)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12 }}>
                      {vmSizesLoading
                        ? 'Loading CPU, RAM and pricing details...'
                        : vmSizeMessage ||
                          'Retail compute estimate only; additional Azure charges may apply.'}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 18 }}>
                  <label style={label}>SSH Public Key</label>
                  <textarea
                    style={{ ...input, minHeight: 90 }}
                    value={form.sshPublicKey}
                    onChange={event =>
                      setForm({
                        ...form,
                        sshPublicKey: event.target.value,
                      })
                    }
                  />
                </div>
              </>
            )}

            {service === 'storage' && (
              <>
                <h3>Generated Name</h3>
                <div style={infoBox}>
                  Storage Account:{' '}
                  <b>{names?.storageAccount || 'Generating...'}</b>
                </div>

                <h3>Storage Configuration</h3>
                <div style={grid}>
                  <div>
                    <label style={label}>Redundancy</label>
                    <select
                      style={input}
                      value={form.redundancy}
                      onChange={event =>
                        setForm({
                          ...form,
                          redundancy: event.target.value,
                        })
                      }
                    >
                      <option value="Standard_LRS">
                        Standard LRS
                      </option>
                      <option value="Standard_ZRS">
                        Standard ZRS
                      </option>
                      <option value="Standard_GRS">
                        Standard GRS
                      </option>
                    </select>
                  </div>

                  <div>
                    <label style={label}>Access Tier</label>
                    <select
                      style={input}
                      value={form.accessTier}
                      onChange={event =>
                        setForm({
                          ...form,
                          accessTier: event.target.value,
                        })
                      }
                    >
                      <option value="Hot">Hot</option>
                      <option value="Cool">Cool</option>
                    </select>
                  </div>

                  <div>
                    <label style={label}>Public Network Access</label>
                    <select
                      style={input}
                      value={form.storagePublicNetworkAccess}
                      onChange={event =>
                        setForm({
                          ...form,
                          storagePublicNetworkAccess: event.target.value,
                        })
                      }
                    >
                      <option value="Enabled">Enabled</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </div>
                </div>

                <div style={{ ...infoBox, marginTop: 16 }}>
                  HTTPS only, TLS 1.2 minimum, and Blob public access disabled
                  are enforced automatically.
                </div>
              </>
            )}

            {service === 'app-service' && (
              <>
                <h3>Generated Names</h3>
                <div style={infoBox}>
                  App Service:{' '}
                  <b>{names?.appService || 'Generating...'}</b>
                  <br />
                  App Service Plan:{' '}
                  <b>{names?.appServicePlan || 'Generating...'}</b>
                </div>

                <h3>App Service Configuration</h3>
                <div style={grid}>
                  <div>
                    <label style={label}>App Service Plan SKU</label>
                    <select
                      style={input}
                      value={form.planSku}
                      onChange={event =>
                        setForm({
                          ...form,
                          planSku: event.target.value,
                        })
                      }
                    >
                      <option value="B1">B1</option>
                      <option value="P1v3">P1v3</option>
                    </select>
                  </div>

                  <div>
                    <label style={label}>Runtime</label>
                    <select
                      style={input}
                      value={form.runtime}
                      onChange={event =>
                        setForm({
                          ...form,
                          runtime: event.target.value,
                        })
                      }
                    >
                      <option value="NODE|20-lts">Node.js 20 LTS</option>
                      <option value="NODE|22-lts">Node.js 22 LTS</option>
                      <option value="PYTHON|3.12">Python 3.12</option>
                    </select>
                  </div>

                  <div>
                    <label style={label}>Public Network Access</label>
                    <select
                      style={input}
                      value={form.appPublicNetworkAccess}
                      onChange={event =>
                        setForm({
                          ...form,
                          appPublicNetworkAccess: event.target.value,
                        })
                      }
                    >
                      <option value="Enabled">Enabled</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </div>
                </div>

                <div style={{ ...infoBox, marginTop: 16 }}>
                  HTTPS only, TLS 1.2 minimum, FTPS disabled, and a
                  System-Assigned Managed Identity are enforced automatically.
                </div>
              </>
            )}

            {service === 'key-vault' && (
              <>
                <h3>Generated Name</h3>
                <div style={infoBox}>
                  Key Vault:{' '}
                  <b>{names?.keyVault || 'Generating...'}</b>
                </div>

                <h3>Key Vault Configuration</h3>
                <div style={grid}>
                  <div>
                    <label style={label}>SKU</label>
                    <select
                      style={input}
                      value={form.keyVaultSku}
                      onChange={event =>
                        setForm({
                          ...form,
                          keyVaultSku: event.target.value,
                        })
                      }
                    >
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>

                  <div>
                    <label style={label}>
                      Soft Delete Retention
                    </label>
                    <select
                      style={input}
                      value={form.keyVaultSoftDeleteRetention}
                      onChange={event =>
                        setForm({
                          ...form,
                          keyVaultSoftDeleteRetention:
                            event.target.value,
                        })
                      }
                    >
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                    </select>
                  </div>

                  <div>
                    <label style={label}>
                      Purge Protection
                    </label>
                    <select
                      style={input}
                      value={form.keyVaultPurgeProtection}
                      onChange={event =>
                        setForm({
                          ...form,
                          keyVaultPurgeProtection:
                            event.target.value,
                        })
                      }
                    >
                      <option value="Enabled">Enabled</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </div>

                  <div>
                    <label style={label}>Network Access</label>
                    <select
                      style={input}
                      value={form.keyVaultNetworkMode}
                      onChange={event =>
                        setForm({
                          ...form,
                          keyVaultNetworkMode:
                            event.target.value,
                          vnetId: '',
                          subnetResourceId: '',
                        })
                      }
                    >
                      <option value="public">
                        Public Access
                      </option>
                      <option value="service-endpoint">
                        Selected Networks / Service Endpoint
                      </option>
                      <option value="private-endpoint">
                        Private Endpoint
                      </option>
                    </select>
                  </div>

                  <div>
                    <label style={label}>
                      Trusted Microsoft Services
                    </label>
                    <select
                      style={input}
                      value={form.keyVaultTrustedServices}
                      onChange={event =>
                        setForm({
                          ...form,
                          keyVaultTrustedServices:
                            event.target.value,
                        })
                      }
                    >
                      <option value="Enabled">Enabled</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </div>
                </div>

                {form.keyVaultNetworkMode !== 'public' && (
                  <>
                    <h3>Networking</h3>
                    <div style={grid}>
                      <div>
                        <label style={label}>
                          Virtual Network
                        </label>
                        <select
                          style={input}
                          value={form.vnetId}
                          onChange={event =>
                            setForm({
                              ...form,
                              vnetId: event.target.value,
                              subnetResourceId: '',
                            })
                          }
                        >
                          <option value="">
                            Select a VNet
                          </option>
                          {vnets.map(vnet => (
                            <option
                              key={vnet.id}
                              value={vnet.id}
                            >
                              {vnet.name} — {vnet.resourceGroup}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={label}>Subnet</label>
                        <select
                          style={input}
                          value={form.subnetResourceId}
                          disabled={!form.vnetId}
                          onChange={event =>
                            setForm({
                              ...form,
                              subnetResourceId:
                                event.target.value,
                            })
                          }
                        >
                          <option value="">
                            Select a subnet
                          </option>
                          {subnets.map(subnet => (
                            <option
                              key={subnet.id}
                              value={subnet.id}
                            >
                              {subnet.name}
                              {subnet.addressPrefixes.length
                                ? ` — ${subnet.addressPrefixes.join(
                                    ', ',
                                  )}`
                                : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {form.keyVaultNetworkMode ===
                      'service-endpoint' && (
                      <div
                        style={{
                          ...infoBox,
                          marginTop: 16,
                        }}
                      >
                        The Microsoft.KeyVault service endpoint
                        will be enabled on the selected subnet and
                        the Key Vault firewall will allow that
                        subnet.
                      </div>
                    )}

                    {form.keyVaultNetworkMode ===
                      'private-endpoint' && (
                      <div
                        style={{
                          ...infoBox,
                          marginTop: 16,
                        }}
                      >
                        A Key Vault private endpoint and Private DNS
                        integration for
                        {' '}
                        <b>
                          privatelink.vaultcore.azure.net
                        </b>
                        {' '}
                        will be configured automatically.
                      </div>
                    )}
                  </>
                )}

                <div style={{ ...infoBox, marginTop: 16 }}>
                  Azure RBAC authorization and soft delete are enabled
                  automatically.
                </div>
              </>
            )}

            <button
              type="button"
              disabled={busy || !ready}
              onClick={deploy}
              style={{
                marginTop: 24,
                padding: '11px 22px',
                background: ready ? '#0078d4' : '#bcbcbc',
                color: '#fff',
                border: 0,
                fontWeight: 600,
              }}
            >
              {busy
                ? 'Deploying...'
                : service === 'vm'
                  ? 'Deploy Virtual Machine'
                  : service === 'storage'
                    ? 'Deploy Storage Account'
                    : service === 'app-service'
                      ? 'Deploy App Service'
                      : 'Deploy Key Vault'}
            </button>

            {busy && <Progress />}

            {status && (
              <pre
                style={{
                  marginTop: 18,
                  padding: 14,
                  background: '#f5f5f5',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {JSON.stringify(status, null, 2)}
              </pre>
            )}
          </div>
        )}
          </>
        )}
      </Content>
    </Page>
  );
};
