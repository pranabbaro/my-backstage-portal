export interface VirtualMachineRequest {
  resourceGroup: string;
  location: string;
  name: string;
  vmSize: string;
  adminUsername: string;
  subnetResourceId: string;
  sshPublicKey: string;
}
