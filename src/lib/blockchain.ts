import { ethers } from 'ethers';
import { JPYC_ADDRESS, ChainConfig, TokenData } from '@/types';

// ERC-20 ABI（必要な関数のみ）
const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

/**
 * チェーンごとの最大ブロック範囲を取得
 */
function getMaxBlockRange(chainName: string): number {
  const limits: { [key: string]: number } = {
    'Ethereum': 1000,    // 安全のため1000ブロック
    'Polygon': 100,      // Polygonは100ブロックに制限（無料RPCの厳しい制限）
    'Avalanche': 5000,   // Avalancheは5000ブロックまで安全
  };
  return limits[chainName] || 1000;
}

/**
 * ブロック範囲を分割してTransferイベントを取得（リトライ機能付き）
 */
async function fetchTransferEventsInChunks(
  contract: ethers.Contract,
  fromBlock: number,
  toBlock: number,
  maxRange: number,
  chainName: string
): Promise<ethers.EventLog[]> {
  const allEvents: ethers.EventLog[] = [];
  const filter = contract.filters.Transfer();

  let currentFrom = fromBlock;
  let chunkCount = 0;

  while (currentFrom <= toBlock) {
    const currentTo = Math.min(currentFrom + maxRange - 1, toBlock);
    chunkCount++;
    
    console.log(`[${chainName}] Fetching chunk ${chunkCount}: blocks ${currentFrom} to ${currentTo}...`);
    
    // リトライロジック
    let retries = 3;
    let success = false;
    
    while (retries > 0 && !success) {
      try {
        const events = await contract.queryFilter(filter, currentFrom, currentTo);
        // EventLogのみをフィルタリング
        const eventLogs = events.filter((e): e is ethers.EventLog => e instanceof ethers.EventLog);
        allEvents.push(...eventLogs);
        console.log(`[${chainName}] Chunk ${chunkCount}: Found ${eventLogs.length} events`);
        success = true;
      } catch (error) {
        retries--;
        
        // エラーの詳細を出力
        if (error instanceof Error) {
          console.error(`[${chainName}] Failed to fetch chunk ${chunkCount} (${3 - retries}/3):`, error.message);
          // ethers.jsのエラーの場合、より詳細な情報を出力
          if ('code' in error) {
            console.error(`[${chainName}] Error code:`, (error as any).code);
          }
        } else {
          console.error(`[${chainName}] Failed to fetch chunk ${chunkCount} (${3 - retries}/3):`, error);
        }
        
        // リトライする場合は少し待機
        if (retries > 0) {
          const waitTime = (4 - retries) * 1000; // 1秒、2秒、3秒と増やす
          console.log(`[${chainName}] Retrying chunk ${chunkCount} in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.error(`[${chainName}] Giving up on chunk ${chunkCount} after 3 attempts`);
        }
      }
    }

    currentFrom = currentTo + 1;
    
    // レート制限を避けるため、少し待機
    if (currentFrom <= toBlock) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return allEvents;
}

/**
 * 指定されたチェーンのJPYCトークンデータを取得
 */
export async function fetchTokenData(chain: ChainConfig): Promise<TokenData> {
  try {
    console.log(`[${chain.name}] Starting data fetch...`);
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
    const contract = new ethers.Contract(JPYC_ADDRESS, ERC20_ABI, provider);

    // ネットワーク接続確認
    const network = await provider.getNetwork();
    console.log(`[${chain.name}] Connected to network:`, network.chainId.toString());

    // 総供給量を取得
    console.log(`[${chain.name}] Fetching total supply...`);
    const totalSupply = await contract.totalSupply();
    console.log(`[${chain.name}] Total supply:`, totalSupply.toString());

    // 現在のブロック番号を取得
    const currentBlock = await provider.getBlockNumber();
    console.log(`[${chain.name}] Current block:`, currentBlock);
    
    // チェーンごとの最大ブロック範囲を取得
    const maxBlockRange = getMaxBlockRange(chain.name);
    
    // Transferイベントを取得してホルダーアドレスを特定
    // チェーンごとに最適なブロック範囲を設定
    const totalBlocksToScan = chain.name === 'Polygon' ? 10000 : 50000; // Polygonは制限が厳しいため10000に
    const fromBlock = Math.max(0, currentBlock - totalBlocksToScan);
    console.log(`[${chain.name}] Querying Transfer events from block ${fromBlock} to ${currentBlock} (max ${maxBlockRange} blocks per chunk)...`);
    
    const events = await fetchTransferEventsInChunks(
      contract,
      fromBlock,
      currentBlock,
      maxBlockRange,
      chain.name
    );
    console.log(`[${chain.name}] Found ${events.length} Transfer events in total`);

    // ユニークなアドレスを収集
    const addressSet = new Set<string>();
    
    for (const event of events) {
      if (!event.args || event.args.length < 2) continue;
      
      const from = event.args[0] as string;
      const to = event.args[1] as string;

      if (from !== ethers.ZeroAddress) addressSet.add(from);
      if (to !== ethers.ZeroAddress) addressSet.add(to);
    }

    console.log(`[${chain.name}] Found ${addressSet.size} unique addresses`);

    // 各アドレスの残高を直接取得（並列処理）
    const holders = new Map<string, bigint>();
    const eoaHolders = new Map<string, bigint>();
    
    const addresses = Array.from(addressSet);
    const batchSize = 50; // 一度に処理するアドレス数
    
    console.log(`[${chain.name}] Fetching balances for ${addresses.length} addresses...`);
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, Math.min(i + batchSize, addresses.length));
      
      // バッチ内で並列処理
      const results = await Promise.allSettled(
        batch.map(async (address) => {
          try {
            const balance = await contract.balanceOf(address);
            
            if (balance > 0n) {
              // EOAかどうか確認
              const code = await provider.getCode(address);
              return {
                address,
                balance,
                isEOA: code === '0x',
              };
            }
            return null;
          } catch (err) {
            console.warn(`[${chain.name}] Failed to get balance for ${address}`);
            return null;
          }
        })
      );
      
      // 結果を処理
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const { address, balance, isEOA } = result.value;
          holders.set(address, balance);
          if (isEOA) {
            eoaHolders.set(address, balance);
          }
        }
      }
      
      console.log(`[${chain.name}] Processed ${Math.min(i + batchSize, addresses.length)}/${addresses.length} addresses...`);
      
      // レート制限対策
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[${chain.name}] Found ${eoaHolders.size} EOA holders with non-zero balance`);

    // 最大保有者を特定（運営ウォレット）
    let largestHolder = '';
    let largestHolderBalance = 0n;

    for (const [address, balance] of eoaHolders.entries()) {
      if (balance > largestHolderBalance) {
        largestHolderBalance = balance;
        largestHolder = address;
      }
    }

    console.log(`[${chain.name}] Largest holder: ${largestHolder} with balance: ${largestHolderBalance.toString()}`);

    // ユーザー間流通量 = 総供給量 - 運営保有量
    const userCirculation = totalSupply - largestHolderBalance;

    const result = {
      chain: chain.name,
      totalSupply,
      holders: eoaHolders,
      largestHolder,
      largestHolderBalance,
      userCirculation,
      holderCount: eoaHolders.size,
      transferCount: events.length,
    };

    console.log(`[${chain.name}] Data fetch completed successfully`);
    return result;
  } catch (error) {
    console.error(`[${chain.name}] Error fetching data:`, error);
    throw error;
  }
}

/**
 * チェーンデータ取得結果の型
 */
export interface ChainDataResult {
  success: boolean;
  data?: TokenData;
  error?: string;
  chainName: string;
}

/**
 * すべてのチェーンのデータを並列取得
 */
export async function fetchAllChainData(chains: ChainConfig[]): Promise<ChainDataResult[]> {
  const promises = chains.map(async (chain): Promise<ChainDataResult> => {
    try {
      console.log(`Fetching data for ${chain.name}...`);
      const data = await fetchTokenData(chain);
      console.log(`Successfully fetched data for ${chain.name}`);
      return {
        success: true,
        data,
        chainName: chain.name,
      };
    } catch (error) {
      console.error(`Failed to fetch data for ${chain.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        chainName: chain.name,
      };
    }
  });

  return await Promise.all(promises);
}

/**
 * 数値を人間が読みやすい形式にフォーマット
 */
export function formatNumber(value: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  // 小数点以下2桁まで表示
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').slice(0, 2);
  
  return `${integerPart.toLocaleString()}.${fractionalStr}`;
}

/**
 * アドレスを短縮表示
 */
export function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

