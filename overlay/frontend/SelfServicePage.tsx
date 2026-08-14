import { useEffect, useMemo, useState } from 'react';
import {
  Content,
  Header,
  InfoCard,
  Page,
  Progress,
} from '@backstage/core-components';
import { microsoftAuthApiRef } from '@backstage/core-plugin-api';
import {
  fetchApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';

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

function inr(value: number | null): string {
  if (value === null) return 'Price unavailable';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

export const SelfServicePage = () => {
  const fetchApi = useApi(fetchApiRef);
  const microsoftAuthApi = useApi(microsoftAuthApiRef);

  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] =
    useState<Record<string, unknown> | null>(null);

  const [businessSubscriptions, setBusinessSubscriptions] =
    useState<Subscription[]>([]);
  const [autoSubscription, setAutoSubscription] =
    useState<Subscription | null>(null);

  const [resourceGroups, setResourceGroups] =
    useState<ResourceGroup[]>([]);
  const [resourceGroupLoading, setResourceGroupLoading] =
    useState(false);
  const [resourceGroupMessage, setResourceGroupMessage] =
    useState('');
  const [vnets, setVnets] = useState<VNet[]>([]);
  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [generatedNames, setGeneratedNames] =
    useState<Names | null>(null);
  const [placementError, setPlacementError] = useState('');

  const [vmSizes, setVmSizes] = useState<VmSize[]>([]);
  const [vmSizesLoading, setVmSizesLoading] = useState(false);
  const [vmSizeMessage, setVmSizeMessage] = useState('');

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
  });

  useEffect(() => {
    fetchApi
      .fetch('/api/azure-self-service/config')
      .then(response => response.json())
      .then(body => setConfig(body as PlatformConfig))
      .catch(() => setConfig(null));
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
        if (!response.ok) throw new Error();
        setGeneratedNames((await response.json()) as Names);
      })
      .catch(() => setGeneratedNames(null));
  }, [
    fetchApi,
    form.workload,
    form.environment,
    form.location,
    form.instance,
  ]);

  // Existing V8 subscription routing is intentionally preserved.
  useEffect(() => {
    if (!config?.managedIdentity) return;

    setPlacementError('');
    setAutoSubscription(null);
    setBusinessSubscriptions([]);
    setResourceGroups([]);
    setVnets([]);
    setSubnets([]);
    setVmSizes([]);

    setForm(current => ({
      ...current,
      subscriptionId: '',
      resourceGroup: '',
      vnetId: '',
      subnetResourceId: '',
    }));

    if (form.networkType === 'business-managed') {
      fetchApi
        .fetch(
          '/api/azure-self-service/subscriptions/business-managed',
        )
        .then(async response => {
          const body = (await response.json()) as {
            value?: Subscription[];
            error?: string;
          };
          if (!response.ok) {
            throw new Error(
              body.error ||
                'Unable to load assigned subscriptions',
            );
          }
          setBusinessSubscriptions(body.value || []);
        })
        .catch(error => setPlacementError(String(error)));

      return;
    }

    const query = new URLSearchParams({
      networkType: form.networkType,
      location: form.location,
    });

    fetchApi
      .fetch(
        `/api/azure-self-service/subscriptions/resolve?${query}`,
      )
      .then(async response => {
        const body = (await response.json()) as {
          subscription?: Subscription;
          error?: string;
        };
        if (!response.ok || !body.subscription) {
          throw new Error(
            body.error || 'Unable to resolve subscription',
          );
        }
        setAutoSubscription(body.subscription);
        setForm(current => ({
          ...current,
          subscriptionId:
            body.subscription?.subscriptionId || '',
        }));
      })
      .catch(error => setPlacementError(String(error)));
  }, [
    fetchApi,
    config?.managedIdentity,
    form.networkType,
    form.location,
  ]);

  const activeSubscription =
    form.networkType === 'business-managed'
      ? form.subscriptionId
      : autoSubscription?.subscriptionId || '';

  // VNet discovery and VM-size details use the resolved subscription.
  useEffect(() => {
    if (!activeSubscription) return;

    setVnets([]);
    setSubnets([]);
    setVmSizes([]);
    setVmSizesLoading(true);
    setVmSizeMessage('');

    setForm(current => ({
      ...current,
      vnetId: '',
      subnetResourceId: '',
    }));

    const query = new URLSearchParams({
      subscriptionId: activeSubscription,
      location: form.location,
    });

    fetchApi
      .fetch(`/api/azure-self-service/network/vnets?${query}`)
      .then(response => response.json())
      .then(body => setVnets((body.value || []) as VNet[]))
      .catch(() => setVnets([]));

    fetchApi
      .fetch(`/api/azure-self-service/vm-sizes?${query}`)
      .then(async response => {
        const body = (await response.json()) as {
          value?: VmSize[];
          pricingNote?: string;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error || 'Unable to load VM sizes');
        }
        const sizes = body.value || [];
        setVmSizes(sizes);
        setVmSizeMessage(body.pricingNote || '');

        if (
          sizes.length > 0 &&
          !sizes.some(size => size.name === form.vmSize)
        ) {
          setForm(current => ({
            ...current,
            vmSize: sizes[0].name,
          }));
        }
      })
      .catch(error => {
        setVmSizes([]);
        setVmSizeMessage(String(error));
      })
      .finally(() => setVmSizesLoading(false));
  }, [fetchApi, activeSubscription, form.location]);

  // Existing RGs are loaded ONLY when Existing is selected.
  // The user token is used only for RG visibility; deployment continues
  // to use Managed Identity.
  useEffect(() => {
    if (
      form.resourceGroupMode !== 'existing' ||
      !activeSubscription
    ) {
      setResourceGroups([]);
      setResourceGroupMessage('');
        return;
    }

    let cancelled = false;

    const load = async () => {
      setResourceGroupLoading(true);
      setResourceGroups([]);
      setResourceGroupMessage('Checking your Resource Group access...');
      setForm(current => ({ ...current, resourceGroup: '' }));

      let token: string | undefined;
      try {
        token = await microsoftAuthApi.getAccessToken(
          'https://management.azure.com/user_impersonation',
        );
      } catch {
        // Microsoft delegated auth is optional. The backend will use the
        // explicit entitlement-map fallback, or return an empty list.
        token = undefined;
      }

      if (cancelled) return;
      const query = new URLSearchParams({
        subscriptionId: activeSubscription,
        location: form.location,
      });

      try {
        const response = await fetchApi.fetch(
          `/api/azure-self-service/resource-groups/accessible?${query}`,
          {
            headers: token
              ? { 'x-azure-user-token': token }
              : undefined,
          },
        );

        const body = (await response.json()) as {
          value?: ResourceGroup[];
          mode?: 'azure-rbac' | 'entitlement-map' | 'none';
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error || 'Unable to check RG access');
        }

        if (cancelled) return;

        const value = body.value || [];
        setResourceGroups(value);

        if (value.length === 0) {
          setResourceGroupMessage(
            'No accessible Resource Groups found for the signed-in user in this subscription and region.',
          );
        } else if (body.mode === 'azure-rbac') {
          setResourceGroupMessage(
            'Showing only Resource Groups accessible to your Azure user identity.',
          );
        } else if (body.mode === 'entitlement-map') {
          setResourceGroupMessage(
            'Showing only Resource Groups assigned to your Backstage user/group.',
          );
        } else {
          setResourceGroupMessage(
            'No Resource Groups are assigned to the signed-in user.',
          );
        }
      } catch (error) {
        if (!cancelled) {
          setResourceGroups([]);
          setResourceGroupMessage(String(error));
        }
      } finally {
        if (!cancelled) setResourceGroupLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    fetchApi,
    microsoftAuthApi,
    form.resourceGroupMode,
    activeSubscription,
    form.location,
  ]);

  useEffect(() => {
    if (!form.vnetId) {
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
      .then(body => setSubnets((body.value || []) as Subnet[]))
      .catch(() => setSubnets([]));
  }, [fetchApi, form.vnetId]);

  const selectedVmSize = useMemo(
    () => vmSizes.find(size => size.name === form.vmSize) || null,
    [vmSizes, form.vmSize],
  );

  const ready = Boolean(
    activeSubscription &&
      form.subnetResourceId &&
      form.sshPublicKey.trim() &&
      generatedNames &&
      selectedVmSize &&
      (form.resourceGroupMode === 'new' || form.resourceGroup),
  );

  const deploy = async () => {
    setBusy(true);
    setStatus(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (form.resourceGroupMode === 'existing') {
        try {
          const token = await microsoftAuthApi.getAccessToken(
            'https://management.azure.com/user_impersonation',
          );
          headers['x-azure-user-token'] = token;
        } catch {
          // No delegated token: backend revalidation falls back to explicit
          // Backstage user/group RG entitlements, or denies the selection.
        }
      }

      const response = await fetchApi.fetch(
        '/api/azure-self-service/deploy/vm',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...form,
            subscriptionId: activeSubscription,
          }),
        },
      );

      setStatus(
        (await response.json()) as Record<string, unknown>,
      );
    } catch (error) {
      setStatus({ error: String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page themeId="tool">
      <Header
        title="Self-Service Market"
        subtitle="Approved cloud placement and deployment"
      />

      <Content>
        <InfoCard title="Platform readiness">
          {!config ? (
            <Progress />
          ) : (
            <div>
              Managed Identity:{' '}
              <b>
                {config.managedIdentity ? 'Ready' : 'Not configured'}
              </b>
              {' | '}
              Subscription routing:{' '}
              <b>
                {config.subscriptionRoutingConfigured
                  ? 'Ready'
                  : 'Not configured'}
              </b>
            </div>
          )}
        </InfoCard>

        <div style={{ height: 20 }} />
        <h2>Create Virtual Machine</h2>

        <div style={grid}>
          <div>
            <label style={label}>Application / Workload</label>
            <input
              style={input}
              value={form.workload}
              onChange={event =>
                setForm({ ...form, workload: event.target.value })
              }
            />
          </div>

          <div>
            <label style={label}>Environment</label>
            <select
              style={input}
              value={form.environment}
              onChange={event =>
                setForm({ ...form, environment: event.target.value })
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
                setForm({ ...form, location: event.target.value })
              }
            >
              {(
                config?.allowedLocations || [
                  'centralindia',
                  'southindia',
                  'westindia',
                ]
              ).map(location => (
                <option key={location}>{location}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={label}>Instance</label>
            <input
              style={input}
              value={form.instance}
              onChange={event =>
                setForm({ ...form, instance: event.target.value })
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
          <option value="business-managed">Business Managed</option>
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
            {businessSubscriptions.map(subscription => (
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
            <b>
              {autoSubscription?.displayName ||
                'Resolving subscription...'}
            </b>
            <div>Automatically selected by placement policy.</div>
          </div>
        )}

        {placementError && (
          <div style={{ marginTop: 8 }}>{placementError}</div>
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
                resourceGroup: '',
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
          <>
            {resourceGroupLoading && <Progress />}
            <select
              style={{ ...input, marginTop: 10 }}
              value={form.resourceGroup}
              disabled={resourceGroupLoading || resourceGroups.length === 0}
              onChange={event =>
                setForm({
                  ...form,
                  resourceGroup: event.target.value,
                })
              }
            >
              <option value="">
                {resourceGroups.length === 0
                  ? 'No accessible Resource Groups'
                  : 'Select an existing Resource Group'}
              </option>
              {resourceGroups.map(resourceGroup => (
                <option
                  key={resourceGroup.id}
                  value={resourceGroup.name}
                >
                  {resourceGroup.name}
                </option>
              ))}
            </select>
            {resourceGroupMessage && (
              <div style={{ marginTop: 7, fontSize: 13 }}>
                {resourceGroupMessage}
              </div>
            )}
          </>
        ) : (
          <div style={{ ...infoBox, marginTop: 10 }}>
            <b>{generatedNames?.resourceGroup || 'Generating...'}</b>
            <div>
              No end-user RG access restriction. Managed Identity creates
              this Resource Group.
            </div>
          </div>
        )}

        <h3>Network</h3>
        <div style={grid}>
          <div>
            <label style={label}>Virtual Network</label>
            <select
              style={input}
              value={form.vnetId}
              onChange={event =>
                setForm({ ...form, vnetId: event.target.value })
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
          VM:{' '}
          <b>{generatedNames?.virtualMachine || 'Generating...'}</b>
          <br />
          NIC:{' '}
          <b>{generatedNames?.networkInterface || 'Generating...'}</b>
        </div>

        <h3>Compute</h3>
        <div style={grid}>
          <div>
            <label style={label}>VM Size</label>
            {vmSizesLoading ? (
              <Progress />
            ) : (
              <select
                style={input}
                value={form.vmSize}
                disabled={vmSizes.length === 0}
                onChange={event =>
                  setForm({ ...form, vmSize: event.target.value })
                }
              >
                {vmSizes.length === 0 ? (
                  <option value="">No approved VM sizes available</option>
                ) : (
                  vmSizes.map(size => (
                    <option key={size.name} value={size.name}>
                      {size.name} — {size.vcpus ?? '?'} vCPU —{' '}
                      {size.memoryGB ?? '?'} GB RAM
                      {size.hourlyPrice !== null
                        ? ` — ${inr(size.hourlyPrice)}/hr`
                        : ''}
                    </option>
                  ))
                )}
              </select>
            )}
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
                <div>{inr(selectedVmSize.hourlyPrice)}</div>
              </div>
              <div>
                <strong>Estimated monthly compute</strong>
                <div>{inr(selectedVmSize.monthlyPrice)}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12 }}>
              {vmSizeMessage ||
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
              setForm({ ...form, sshPublicKey: event.target.value })
            }
          />
        </div>

        <button
          type="button"
          disabled={busy || !ready}
          onClick={deploy}
          style={{ marginTop: 22, padding: '10px 22px' }}
        >
          {busy ? 'Deploying...' : 'Deploy Virtual Machine'}
        </button>

        {busy && <Progress />}

        {status && (
          <pre
            style={{
              marginTop: 18,
              padding: 14,
              background: '#f5f5f5',
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify(status, null, 2)}
          </pre>
        )}
      </Content>
    </Page>
  );
};
