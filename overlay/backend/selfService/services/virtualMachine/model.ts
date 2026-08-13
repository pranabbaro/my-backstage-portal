export interface VirtualMachineRequest {
  workload: string;
  environment: string;
  instance: string;
  resourceGroup: string;
  location: string;
  name: string;
  networkInterfaceName: string;
  vmSize: string;
  adminUsername: string;
  subnetResourceId: string;
  sshPublicKey: string;
}
