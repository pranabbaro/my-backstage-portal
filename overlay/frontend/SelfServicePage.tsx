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

  const [service, setService] = useState<ServiceType | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<unknown>(null);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [search, setSearch] = useState('');

  const [common, setCommon] = useState({
    resourceGroup: 'rg-selfservice-test',
    location: 'centralindia',
    name: '',
  });

  const [vm, setVm] = useState({
    vmSize: 'Standard_B2s',
    adminUsername: 'azureadmin',
    subnetResourceId: '',
    sshPublicKey: '',
  });

  const [storage, setStorage] = useState({
    sku: 'Standard_LRS',
  });

  const [appService, setAppService] = useState({
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
      .catch(error => {
        setConfig({ error: String(error) });
      });
  }, [fetchApi]);

  const locations = config?.allowedLocations || fallbackLocations;

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

  const platformReady = Boolean(
    config?.managedIdentity && config?.subscriptionConfigured,
  );

  const submit = async () => {
    if (!service) {
      return;
    }

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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();
      setStatus(result);
    } catch (error) {
      setStatus({
        error: String(error),
      });
    } finally {
      setBusy(false);
    }
  };

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
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600 }}>
            Marketplace
          </h1>
          <div style={{ marginTop: 8, fontSize: 15 }}>
            Select an approved Azure service and configure your deployment.
          </div>
        </div>

        <div style={{ maxWidth: 760, marginBottom: 24 }}>
          <input
            style={{
              ...inputStyle,
              height: 46,
              fontSize: 15,
            }}
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
              Managed Identity:{' '}
              <strong>
                {config.managedIdentity ? 'Ready' : 'Not configured'}
              </strong>
              {' | '}
              Azure Subscription:{' '}
              <strong>
                {config.subscriptionConfigured ? 'Ready' : 'Not configured'}
              </strong>
              {' | '}
              Allowed regions: <strong>{locations.join(', ')}</strong>
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
                setCommon(current => ({
                  ...current,
                  name: '',
                }));
              }}
              style={{
                textAlign: 'left',
                background: '#ffffff',
                border:
                  service === item.id
                    ? '2px solid #0078d4'
                    : '1px solid #d7d7d7',
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

              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {item.title}
              </div>

              <div style={{ marginTop: 5, fontSize: 13 }}>
                {item.category}
              </div>

              <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>
                {item.description}
              </div>
            </button>
          ))}
        </div>

        {selectedService && (
          <>
            <div style={{ height: 34 }} />

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #d7d7d7',
              }}
            >
              <div
                style={{
                  padding: '18px 22px',
                  borderBottom: '1px solid #d7d7d7',
                }}
              >
                <h2 style={{ margin: 0, fontSize: 22 }}>
                  Create {selectedService.title}
                </h2>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  Configure the approved deployment settings.
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  borderBottom: '1px solid #d7d7d7',
                }}
              >
                <div
                  style={{
                    padding: '14px 22px',
                    borderBottom: '3px solid #0078d4',
                    fontWeight: 600,
                  }}
                >
                  Basics
                </div>
                <div style={{ padding: '14px 22px' }}>Networking</div>
                <div style={{ padding: '14px 22px' }}>Management</div>
                <div style={{ padding: '14px 22px' }}>Tags</div>
                <div style={{ padding: '14px 22px' }}>Review + create</div>
              </div>

              <div style={{ padding: 24 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 20,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Resource group</label>
                    <input
                      style={inputStyle}
                      value={common.resourceGroup}
                      onChange={event =>
                        setCommon({
                          ...common,
                          resourceGroup: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Region</label>
                    <select
                      style={inputStyle}
                      value={common.location}
                      onChange={event =>
                        setCommon({
                          ...common,
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
                    <label style={labelStyle}>
                      {service === 'vm'
                        ? 'Virtual machine name'
                        : service === 'storage'
                          ? 'Storage account name'
                          : 'App Service name'}
                    </label>
                    <input
                      style={inputStyle}
                      value={common.name}
                      onChange={event =>
                        setCommon({
                          ...common,
                          name: event.target.value,
                        })
                      }
                    />
                  </div>

                  {service === 'vm' && (
                    <>
                      <div>
                        <label style={labelStyle}>VM size</label>
                        <select
                          style={inputStyle}
                          value={vm.vmSize}
                          onChange={event =>
                            setVm({
                              ...vm,
                              vmSize: event.target.value,
                            })
                          }
                        >
                          <option value="Standard_B2s">Standard_B2s</option>
                          <option value="Standard_D2s_v5">
                            Standard_D2s_v5
                          </option>
                          <option value="Standard_D4s_v5">
                            Standard_D4s_v5
                          </option>
                        </select>
                      </div>

                      <div>
                        <label style={labelStyle}>
                          Administrator username
                        </label>
                        <input
                          style={inputStyle}
                          value={vm.adminUsername}
                          onChange={event =>
                            setVm({
                              ...vm,
                              adminUsername: event.target.value,
                            })
                          }
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>
                          Existing subnet resource ID
                        </label>
                        <input
                          style={inputStyle}
                          value={vm.subnetResourceId}
                          onChange={event =>
                            setVm({
                              ...vm,
                              subnetResourceId: event.target.value,
                            })
                          }
                          placeholder="/subscriptions/.../virtualNetworks/.../subnets/..."
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>SSH public key</label>
                        <textarea
                          style={{
                            ...inputStyle,
                            minHeight: 90,
                          }}
                          value={vm.sshPublicKey}
                          onChange={event =>
                            setVm({
                              ...vm,
                              sshPublicKey: event.target.value,
                            })
                          }
                        />
                      </div>
                    </>
                  )}

                  {service === 'storage' && (
                    <div>
                      <label style={labelStyle}>Replication</label>
                      <select
                        style={inputStyle}
                        value={storage.sku}
                        onChange={event =>
                          setStorage({
                            ...storage,
                            sku: event.target.value,
                          })
                        }
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
                        <label style={labelStyle}>App Service plan</label>
                        <input
                          style={inputStyle}
                          value={appService.planName}
                          onChange={event =>
                            setAppService({
                              ...appService,
                              planName: event.target.value,
                            })
                          }
                          placeholder="Leave blank for <app-name>-plan"
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Pricing plan</label>
                        <select
                          style={inputStyle}
                          value={appService.sku}
                          onChange={event =>
                            setAppService({
                              ...appService,
                              sku: event.target.value,
                            })
                          }
                        >
                          <option value="B1">Basic B1</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 30,
                    borderTop: '1px solid #d7d7d7',
                    paddingTop: 20,
                  }}
                >
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !common.name ||
                      !common.resourceGroup ||
                      !platformReady
                    }
                    onClick={submit}
                    style={{
                      padding: '10px 22px',
                      border: 0,
                      background: platformReady ? '#0078d4' : '#bcbcbc',
                      color: '#ffffff',
                      fontWeight: 600,
                      cursor: platformReady ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {busy ? 'Deploying...' : `Deploy ${selectedService.title}`}
                  </button>
                </div>

                {busy && (
                  <div style={{ marginTop: 18 }}>
                    <Progress />
                  </div>
                )}

                {status && (
                  <div style={{ marginTop: 20 }}>
                    <h3>Deployment result</h3>
                    <pre
                      style={{
                        padding: 16,
                        background: '#f5f5f5',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {JSON.stringify(status, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Content>
    </Page>
  );
};
