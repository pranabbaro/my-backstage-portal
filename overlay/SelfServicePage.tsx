import React, { useEffect, useState } from 'react';
import { Content, Header, InfoCard, Page, Progress } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@material-ui/core';

type ServiceType = 'vm' | 'storage' | 'app-service';

const defaultLocations = ['centralindia', 'southindia', 'westindia'];

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

  return (
    <Page themeId="tool">
      <Header
        title="Azure Self-Service Cloud"
        subtitle="Deploy approved Azure services from the Enterprise Developer Portal"
      />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <InfoCard title="Platform Status">
              {!config ? (
                <Progress />
              ) : (
                <Typography>
                  Managed Identity: <b>{config.managedIdentity ? 'Ready' : 'Not configured'}</b>
                  {'  |  '}
                  Azure Subscription:{' '}
                  <b>{config.subscriptionConfigured ? 'Ready' : 'Not configured'}</b>
                  {'  |  '}
                  Allowed regions:{' '}
                  <b>{(config.allowedLocations || defaultLocations).join(', ')}</b>
                </Typography>
              )}
            </InfoCard>
          </Grid>

          <Grid item xs={12}>
            <InfoCard title="Choose Azure Service">
              <Tabs
                value={service}
                onChange={(_event, value) => {
                  setService(value);
                  setStatus(null);
                  setCommon(current => ({ ...current, name: '' }));
                }}
                indicatorColor="primary"
                textColor="primary"
              >
                <Tab value="vm" label="Virtual Machine" />
                <Tab value="storage" label="Storage Account" />
                <Tab value="app-service" label="App Service" />
              </Tabs>
            </InfoCard>
          </Grid>

          <Grid item xs={12}>
            <InfoCard title={`Request ${title}`}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Resource Group"
                    value={common.resourceGroup}
                    onChange={e => setCommon({ ...common, resourceGroup: e.target.value })}
                    helperText="Created automatically if it does not exist"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    fullWidth
                    label="Azure Region"
                    value={common.location}
                    onChange={e => setCommon({ ...common, location: e.target.value })}
                  >
                    {(config?.allowedLocations || defaultLocations).map((item: string) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label={
                      service === 'storage'
                        ? 'Storage Account Name'
                        : service === 'vm'
                          ? 'VM Name'
                          : 'App Service Name'
                    }
                    value={common.name}
                    onChange={e => setCommon({ ...common, name: e.target.value })}
                  />
                </Grid>

                {service === 'vm' && (
                  <>
                    <Grid item xs={12} md={4}>
                      <TextField
                        select
                        fullWidth
                        label="VM Size"
                        value={vm.vmSize}
                        onChange={e => setVm({ ...vm, vmSize: e.target.value })}
                      >
                        <MenuItem value="Standard_B2s">Standard_B2s</MenuItem>
                        <MenuItem value="Standard_D2s_v5">Standard_D2s_v5</MenuItem>
                        <MenuItem value="Standard_D4s_v5">Standard_D4s_v5</MenuItem>
                      </TextField>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Admin Username"
                        value={vm.adminUsername}
                        onChange={e => setVm({ ...vm, adminUsername: e.target.value })}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Existing Subnet Resource ID"
                        value={vm.subnetResourceId}
                        onChange={e => setVm({ ...vm, subnetResourceId: e.target.value })}
                        helperText="/subscriptions/.../virtualNetworks/.../subnets/..."
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="SSH Public Key"
                        value={vm.sshPublicKey}
                        onChange={e => setVm({ ...vm, sshPublicKey: e.target.value })}
                      />
                    </Grid>
                  </>
                )}

                {service === 'storage' && (
                  <Grid item xs={12} md={4}>
                    <TextField
                      select
                      fullWidth
                      label="Replication"
                      value={storage.sku}
                      onChange={e => setStorage({ ...storage, sku: e.target.value })}
                    >
                      <MenuItem value="Standard_LRS">Standard LRS</MenuItem>
                      <MenuItem value="Standard_ZRS">Standard ZRS</MenuItem>
                      <MenuItem value="Standard_GRS">Standard GRS</MenuItem>
                    </TextField>
                  </Grid>
                )}

                {service === 'app-service' && (
                  <>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="App Service Plan Name"
                        value={appService.planName}
                        onChange={e =>
                          setAppService({ ...appService, planName: e.target.value })
                        }
                        helperText="Leave blank to use <app-name>-plan"
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <TextField
                        select
                        fullWidth
                        label="Plan SKU"
                        value={appService.sku}
                        onChange={e =>
                          setAppService({ ...appService, sku: e.target.value })
                        }
                      >
                        <MenuItem value="B1">Basic B1</MenuItem>
                      </TextField>
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={
                        busy ||
                        !common.name ||
                        !common.resourceGroup ||
                        !config?.managedIdentity ||
                        !config?.subscriptionConfigured
                      }
                      onClick={submit}
                    >
                      {busy ? 'Deploying...' : `Deploy ${title}`}
                    </Button>
                  </Box>
                </Grid>

                {busy && (
                  <Grid item xs={12}>
                    <Progress />
                  </Grid>
                )}

                {status && (
                  <Grid item xs={12}>
                    <Box mt={2}>
                      <Typography variant="h6">
                        {status.error ? 'Deployment Error' : 'Request Result'}
                      </Typography>
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
                    </Box>
                  </Grid>
                )}
              </Grid>
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
