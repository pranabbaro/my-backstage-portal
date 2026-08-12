import React, { useEffect, useState } from 'react';
import {Content,Header,InfoCard,Page,Progress,} from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/frontend-plugin-api';

type ServiceType = 'vm' | 'storage' | 'app-service';

const fallbackLocations = ['centralindia', 'southindia', 'westindia'];

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #c9c9c9',
  borderRadius: 4,
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: 6,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 18,
};

export const SelfServicePage = () => {
  const fetchApi = useApi(fetchApiRef);
  const [service, setService] = useState<ServiceType>('vm');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);

  const [common, setCommon] = useState({
    resourceGroup: 'rg-selfservice-dev',
    location: 'centralindia',
    name: '',
  });

  const [vm, setVm] = useState({
    vmSize: 'Standard_B2s',
    adminUsername: 'azureadmin',
    subnetResourceId: '',
    sshPublicKey: '',
  });

  const [storage, setStorage] = useState({ sku: 'Standard_LRS' });
  const [appService, setAppService] = useState({ planName: '', sku: 'B1' });

  useEffect(() => {
    fetchApi
      .fetch('/api/azure-self-service/config')
      .then(async response => setConfig(await response.json()))
      .catch(error => setConfig({ error: String(error) }));
  }, [fetchApi]);

  const submit = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const payload =
        service === 'vm'
          ? { ...common, ...vm }
          : service === 'storage'
            ? { ...common, ...storage }
            : { ...common, ...appService };

      const response = await fetchApi.fetch(
        `/api/azure-self-service/deploy/${service}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      setStatus(await response.json());
    } catch (error) {
      setStatus({ error: String(error) });
    } finally {
      setBusy(false);
    }
  };

  const title =
    service === 'vm'
      ? 'Azure Virtual Machine'
      : service === 'storage'
        ? 'Azure Storage Account'
        : 'Azure App Service';

  const locations = config?.allowedLocations || fallbackLocations;
  const ready = Boolean(config?.managedIdentity && config?.subscriptionConfigured);

  return (
    <Page themeId="tool">
      <Header
        title="Self-Service Marketplace"
        subtitle="Deploy approved Azure services from the Enterprise Developer Portal"
      />
      <Content>
        <InfoCard title="Platform Status">
          {!config ? (
            <Progress />
          ) : (
            <div>
              Managed Identity: <strong>{config.managedIdentity ? 'Ready' : 'Not configured'}</strong>
              {' | '}
              Azure Subscription: <strong>{config.subscriptionConfigured ? 'Ready' : 'Not configured'}</strong>
              {' | '}
              Allowed regions: <strong>{locations.join(', ')}</strong>
            </div>
          )}
        </InfoCard>

        <div style={{ height: 18 }} />

        <InfoCard title="Choose Azure Service">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              ['vm', 'Virtual Machine'],
              ['storage', 'Storage Account'],
              ['app-service', 'App Service'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setService(value as ServiceType);
                  setStatus(null);
                  setCommon(current => ({ ...current, name: '' }));
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: 4,
                  border: '1px solid #888',
                  cursor: 'pointer',
                  fontWeight: service === value ? 700 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </InfoCard>

        <div style={{ height: 18 }} />

        <InfoCard title={`Request ${title}`}>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Resource Group</label>
              <input
                style={fieldStyle}
                value={common.resourceGroup}
                onChange={e => setCommon({ ...common, resourceGroup: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>Azure Region</label>
              <select
                style={fieldStyle}
                value={common.location}
                onChange={e => setCommon({ ...common, location: e.target.value })}
              >
                {locations.map((location: string) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                {service === 'storage'
                  ? 'Storage Account Name'
                  : service === 'vm'
                    ? 'VM Name'
                    : 'App Service Name'}
              </label>
              <input
                style={fieldStyle}
                value={common.name}
                onChange={e => setCommon({ ...common, name: e.target.value })}
              />
            </div>

            {service === 'vm' && (
              <>
                <div>
                  <label style={labelStyle}>VM Size</label>
                  <select
                    style={fieldStyle}
                    value={vm.vmSize}
                    onChange={e => setVm({ ...vm, vmSize: e.target.value })}
                  >
                    <option value="Standard_B2s">Standard_B2s</option>
                    <option value="Standard_D2s_v5">Standard_D2s_v5</option>
                    <option value="Standard_D4s_v5">Standard_D4s_v5</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Admin Username</label>
                  <input
                    style={fieldStyle}
                    value={vm.adminUsername}
                    onChange={e => setVm({ ...vm, adminUsername: e.target.value })}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Existing Subnet Resource ID</label>
                  <input
                    style={fieldStyle}
                    value={vm.subnetResourceId}
                    onChange={e => setVm({ ...vm, subnetResourceId: e.target.value })}
                    placeholder="/subscriptions/.../virtualNetworks/.../subnets/..."
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>SSH Public Key</label>
                  <textarea
                    style={{ ...fieldStyle, minHeight: 85 }}
                    value={vm.sshPublicKey}
                    onChange={e => setVm({ ...vm, sshPublicKey: e.target.value })}
                  />
                </div>
              </>
            )}

            {service === 'storage' && (
              <div>
                <label style={labelStyle}>Replication</label>
                <select
                  style={fieldStyle}
                  value={storage.sku}
                  onChange={e => setStorage({ ...storage, sku: e.target.value })}
                >
                  <option value="Standard_LRS">Standard LRS</option>
                  <option value="Standard_ZRS">Standard ZRS</option>
                  <option value="Standard_GRS">Standard GRS</option>
                </select>
              </div>
            )}

            {service === 'app-service' && (
              <>
                <div>
                  <label style={labelStyle}>App Service Plan Name</label>
                  <input
                    style={fieldStyle}
                    value={appService.planName}
                    onChange={e =>
                      setAppService({ ...appService, planName: e.target.value })
                    }
                    placeholder="Leave blank for <app-name>-plan"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Plan SKU</label>
                  <select
                    style={fieldStyle}
                    value={appService.sku}
                    onChange={e =>
                      setAppService({ ...appService, sku: e.target.value })
                    }
                  >
                    <option value="B1">Basic B1</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: 22 }}>
            <button
              type="button"
              disabled={busy || !common.name || !common.resourceGroup || !ready}
              onClick={submit}
              style={{
                padding: '11px 18px',
                border: 0,
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {busy ? 'Deploying...' : `Deploy ${title}`}
            </button>
          </div>

          {busy && (
            <div style={{ marginTop: 16 }}>
              <Progress />
            </div>
          )}

          {status && (
            <div style={{ marginTop: 20 }}>
              <h3>{status.error ? 'Deployment Error' : 'Request Result'}</h3>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  padding: 16,
                  background: '#f5f5f5',
                }}
              >
                {JSON.stringify(status, null, 2)}
              </pre>
            </div>
          )}
        </InfoCard>
      </Content>
    </Page>
  );
};
