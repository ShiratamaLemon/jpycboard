export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}

export type ContractType = 'DEX_V2' | 'DEX_V3' | 'DEX_V4' | 'LENDING' | 'BRIDGE' | 'UNKNOWN';

export interface ContractHolder {
  address: string;
  balance: number;
  percentage: number;
  type: ContractType;
  protocol?: string; // 'Uniswap', 'Aave', etc.
}

export interface DexPrice {
  poolAddress: string;
  protocol: string; // 'Uniswap V2', 'Uniswap V3', etc.
  pairToken: string; // 'USDC', 'USDT', 'ETH'
  
  // 表示用（日本人向け）
  displayPrice: number; // 1 USDC = X JPYC
  displayFormat: string; // "1 USDC = 151.52 JPYC"
  
  // 内部計算・レガシー
  jpycPrice: number; // 1 JPYC = X USD
  pegDeviation: number; // 理論値からの乖離率 (%)
  theoreticalPrice: number; // 理論値（1 USDC = 150 JPYC等）
  liquidity: number; // in JPYC
}

export interface TokenData {
  chain: string;
  totalSupply: number;
  operatingBalance: number;
  circulatingSupply: number;
  holders: any[];
  contractHolders: ContractHolder[];
  dexPrices: DexPrice[];
}

export interface DashboardData {
  chains: TokenData[];
  totalCirculation: bigint;
  totalHolders: number;
  totalTransfers: number;
  timestamp: number;
}

export const JPYC_ADDRESS = '0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29';

export const CHAINS: ChainConfig[] = [
  {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC || 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
  },
  {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
  },
  {
    name: 'Avalanche',
    chainId: 43114,
    rpcUrl: process.env.NEXT_PUBLIC_AVALANCHE_RPC || 'https://avalanche.llamarpc.com',
    explorerUrl: 'https://snowtrace.io',
  },
];

