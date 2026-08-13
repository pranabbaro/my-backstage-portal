export interface VirtualNetworkOption {
  id: string;
  name: string;
  location: string;
  resourceGroup: string;
  addressPrefixes: string[];
}

export interface SubnetOption {
  id: string;
  name: string;
  addressPrefixes: string[];
}
