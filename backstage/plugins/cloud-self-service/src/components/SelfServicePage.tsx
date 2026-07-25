import React, { FormEvent, useState } from 'react';
import {
  Content,
  Header,
  HeaderLabel,
  InfoCard,
  Page,
  Progress,
} from '@backstage/core-components';

type ServiceType = 'vm' | 'storage' | 'appservice';

type ApiResult = {
  status: string;
  requestId: string;
  message: string;
  normalizedRequest?: Record<string, unknown>;
};

const cardGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #d0d7de',
  background: '#fff',
  borderRadius: 12,
  minHeight: 120,
  padding: 18,
  textAlign: 'left',
  cursor: 'pointer',
};

const formGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 16,
};

const field: React.CSSProperties = {
  display: 'grid',
  gap: 6,
};

const input: React.CSSProperties = {
  minHeight: 40,
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: '1px solid #b8c0cc',
  borderRadius: 6,
};

const button: React.CSSProperties = {
  marginTop: 18,
  padding: '10px 18px',
  borderRadius: 6,
  border: 0,
  cursor: 'pointer',
  fontWeight: 600,
};

async function submitRequest(
  service: ServiceType,
  body: Record<string, unknown>,
): Promise<ApiResult> {
  const response = await fetch(`/api/cloud-provisioning/${service}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = (await response.json()) as ApiResult & { error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? 'Request validation failed');
  }
  return result;
}

function GovernanceFields(props: {
  environment: string;
  setEnvironment: (value: string) => void;
  owner: string;
  setOwner: (value: string) => void;
  costCenter: string;
  setCostCenter: (value: string) => void;
}) {
  return (
    <>
      <label style={field}>
        <span>Environment</span>
        <select
          style={input}
          value={props.environment}
          onChange={e => props.setEnvironment(e.target.value)}
        >
          <option value="dev">Development</option>
          <option value="test">Test</option>
          <option value="uat">UAT</option>
          <option value="prod">Production</option>
        </select>
      </label>
      <label style={field}>
        <span>Owner</span>
        <input
          style={input}
          value={props.owner}
          onChange={e => props.setOwner(e.target.value)}
          placeholder="Platform Team"
          required
        />
      </label>
      <label style={field}>
        <span>Cost Center</span>
        <input
          style={input}
          value={props.costCenter}
          onChange={e => props.setCostCenter(e.target.value)}
          placeholder="CC1001"
          required
        />
      </label>
    </>
  );
}

function VmForm({ done }: { done: (result: ApiResult) => void }) {
  const [vmName, setVmName] = useState('');
  const [resourceGroup, setResourceGroup] = useState('');
  const [location, setLocation] = useState('centralindia');
  const [environment, setEnvironment] = useState('dev');
  const [osType, setOsType] = useState('Ubuntu');
  const [vmSize, setVmSize] = useState('Standard_D2s_v5');
  const [adminUsername, setAdminUsername] = useState('azureuser');
  const [owner, setOwner] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      done(
        await submitRequest('vm', {
          vmName,
          resourceGroup,
          location,
          environment,
          osType,
          vmSize,
          adminUsername,
          owner,
          costCenter,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={formGrid}>
        <label style={field}>
          <span>VM Name</span>
          <input
            style={input}
            value={vmName}
            onChange={e => setVmName(e.target.value)}
            placeholder="payroll-dev-01"
            required
          />
        </label>
        <label style={field}>
          <span>Resource Group</span>
          <input
            style={input}
            value={resourceGroup}
            onChange={e => setResourceGroup(e.target.value)}
            placeholder="rg-payroll-dev"
            required
          />
        </label>
        <label style={field}>
          <span>Azure Region</span>
          <select
            style={input}
            value={location}
            onChange={e => setLocation(e.target.value)}
          >
            <option value="centralindia">Central India</option>
            <option value="southindia">South India</option>
            <option value="westindia">West India</option>
            <option value="eastus">East US</option>
            <option value="westeurope">West Europe</option>
          </select>
        </label>
        <label style={field}>
          <span>Operating System</span>
          <select
            style={input}
            value={osType}
            onChange={e => setOsType(e.target.value)}
          >
            <option value="Ubuntu">Ubuntu</option>
            <option value="Windows">Windows Server</option>
          </select>
        </label>
        <label style={field}>
          <span>VM Size</span>
          <select
            style={input}
            value={vmSize}
            onChange={e => setVmSize(e.target.value)}
          >
            <option value="Standard_B2s">Standard_B2s</option>
            <option value="Standard_D2s_v5">Standard_D2s_v5</option>
            <option value="Standard_D4s_v5">Standard_D4s_v5</option>
            <option value="Standard_D8s_v5">Standard_D8s_v5</option>
          </select>
        </label>
        <label style={field}>
          <span>Admin Username</span>
          <input
            style={input}
            value={adminUsername}
            onChange={e => setAdminUsername(e.target.value)}
            required
          />
        </label>
        <GovernanceFields
          environment={environment}
          setEnvironment={setEnvironment}
          owner={owner}
          setOwner={setOwner}
          costCenter={costCenter}
          setCostCenter={setCostCenter}
        />
      </div>
      {error && <p style={{ color: '#b42318' }}>{error}</p>}
      {busy ? <Progress /> : <button style={button}>Validate VM Request</button>}
    </form>
  );
}

function StorageForm({ done }: { done: (result: ApiResult) => void }) {
  const [storageAccountName, setStorageAccountName] = useState('');
  const [resourceGroup, setResourceGroup] = useState('');
  const [location, setLocation] = useState('centralindia');
  const [environment, setEnvironment] = useState('dev');
  const [sku, setSku] = useState('Standard_LRS');
  const [publicNetworkAccess, setPublicNetworkAccess] = useState(false);
  const [owner, setOwner] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      done(
        await submitRequest('storage', {
          storageAccountName,
          resourceGroup,
          location,
          environment,
          sku,
          publicNetworkAccess,
          owner,
          costCenter,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={formGrid}>
        <label style={field}>
          <span>Storage Account Name</span>
          <input
            style={input}
            value={storageAccountName}
            onChange={e => setStorageAccountName(e.target.value)}
            placeholder="payrolldevstore01"
            required
          />
        </label>
        <label style={field}>
          <span>Resource Group</span>
          <input
            style={input}
            value={resourceGroup}
            onChange={e => setResourceGroup(e.target.value)}
            required
          />
        </label>
        <label style={field}>
          <span>Azure Region</span>
          <select
            style={input}
            value={location}
            onChange={e => setLocation(e.target.value)}
          >
            <option value="centralindia">Central India</option>
            <option value="southindia">South India</option>
            <option value="westindia">West India</option>
            <option value="eastus">East US</option>
            <option value="westeurope">West Europe</option>
          </select>
        </label>
        <label style={field}>
          <span>Redundancy</span>
          <select style={input} value={sku} onChange={e => setSku(e.target.value)}>
            <option value="Standard_LRS">Standard LRS</option>
            <option value="Standard_ZRS">Standard ZRS</option>
            <option value="Standard_GRS">Standard GRS</option>
          </select>
        </label>
        <label style={field}>
          <span>Public Network Access</span>
          <select
            style={input}
            value={publicNetworkAccess ? 'Enabled' : 'Disabled'}
            onChange={e => setPublicNetworkAccess(e.target.value === 'Enabled')}
          >
            <option value="Disabled">Disabled</option>
            <option value="Enabled">Enabled</option>
          </select>
        </label>
        <GovernanceFields
          environment={environment}
          setEnvironment={setEnvironment}
          owner={owner}
          setOwner={setOwner}
          costCenter={costCenter}
          setCostCenter={setCostCenter}
        />
      </div>
      {error && <p style={{ color: '#b42318' }}>{error}</p>}
      {busy ? (
        <Progress />
      ) : (
        <button style={button}>Validate Storage Request</button>
      )}
    </form>
  );
}

function AppServiceForm({ done }: { done: (result: ApiResult) => void }) {
  const [appName, setAppName] = useState('');
  const [resourceGroup, setResourceGroup] = useState('');
  const [location, setLocation] = useState('centralindia');
  const [environment, setEnvironment] = useState('dev');
  const [runtime, setRuntime] = useState('NODE|24-lts');
  const [sku, setSku] = useState('B1');
  const [owner, setOwner] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      done(
        await submitRequest('appservice', {
          appName,
          resourceGroup,
          location,
          environment,
          runtime,
          sku,
          owner,
          costCenter,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={formGrid}>
        <label style={field}>
          <span>App Service Name</span>
          <input
            style={input}
            value={appName}
            onChange={e => setAppName(e.target.value)}
            placeholder="payroll-web-dev"
            required
          />
        </label>
        <label style={field}>
          <span>Resource Group</span>
          <input
            style={input}
            value={resourceGroup}
            onChange={e => setResourceGroup(e.target.value)}
            required
          />
        </label>
        <label style={field}>
          <span>Azure Region</span>
          <select
            style={input}
            value={location}
            onChange={e => setLocation(e.target.value)}
          >
            <option value="centralindia">Central India</option>
            <option value="southindia">South India</option>
            <option value="westindia">West India</option>
            <option value="eastus">East US</option>
            <option value="westeurope">West Europe</option>
          </select>
        </label>
        <label style={field}>
          <span>Runtime</span>
          <select
            style={input}
            value={runtime}
            onChange={e => setRuntime(e.target.value)}
          >
            <option value="NODE|24-lts">Node.js 24</option>
            <option value="NODE|22-lts">Node.js 22</option>
            <option value="PYTHON|3.12">Python 3.12</option>
            <option value="DOTNETCORE|8.0">.NET 8</option>
          </select>
        </label>
        <label style={field}>
          <span>App Service Plan SKU</span>
          <select style={input} value={sku} onChange={e => setSku(e.target.value)}>
            <option value="B1">B1</option>
            <option value="B2">B2</option>
            <option value="S1">S1</option>
            <option value="P0v3">P0v3</option>
            <option value="P1v3">P1v3</option>
          </select>
        </label>
        <GovernanceFields
          environment={environment}
          setEnvironment={setEnvironment}
          owner={owner}
          setOwner={setOwner}
          costCenter={costCenter}
          setCostCenter={setCostCenter}
        />
      </div>
      {error && <p style={{ color: '#b42318' }}>{error}</p>}
      {busy ? (
        <Progress />
      ) : (
        <button style={button}>Validate App Service Request</button>
      )}
    </form>
  );
}

export function SelfServicePage() {
  const [service, setService] = useState<ServiceType>('vm');
  const [result, setResult] = useState<ApiResult>();

  const choose = (next: ServiceType) => {
    setService(next);
    setResult(undefined);
  };

  const title =
    service === 'vm'
      ? 'Deploy Azure Virtual Machine'
      : service === 'storage'
        ? 'Create Azure Storage Account'
        : 'Create Azure App Service';

  return (
    <Page themeId="tool">
      <Header title="Self-Service Cloud" subtitle="Governed Azure provisioning">
        <HeaderLabel label="Cloud" value="Azure" />
        <HeaderLabel label="Mode" value="Validation MVP" />
      </Header>
      <Content>
        <div style={cardGrid}>
          <button style={cardStyle} onClick={() => choose('vm')}>
            <strong>🖥️ Deploy Azure VM</strong>
            <p>Request Windows or Linux compute.</p>
          </button>
          <button style={cardStyle} onClick={() => choose('storage')}>
            <strong>💾 Create Storage Account</strong>
            <p>Request secure Azure Storage.</p>
          </button>
          <button style={cardStyle} onClick={() => choose('appservice')}>
            <strong>🌐 Create App Service</strong>
            <p>Request managed Azure web hosting.</p>
          </button>
        </div>

        <InfoCard title={title}>
          {service === 'vm' && <VmForm done={setResult} />}
          {service === 'storage' && <StorageForm done={setResult} />}
          {service === 'appservice' && <AppServiceForm done={setResult} />}
        </InfoCard>

        {result && (
          <div style={{ marginTop: 20 }}>
            <InfoCard title="Request validated">
              <p>
                <strong>{result.requestId}</strong>
              </p>
              <p>{result.message}</p>
              <p>
                V1 is validation-only. No Azure resource has been created.
              </p>
            </InfoCard>
          </div>
        )}
      </Content>
    </Page>
  );
}
