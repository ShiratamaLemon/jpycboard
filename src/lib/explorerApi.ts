import { ethers } from 'ethers';
import { JPYC_ADDRESS, ChainConfig, TokenData, ContractType, DexPrice } from '@/types';

// 運営ウォレットアドレス（全チェーン共通）
const OPERATING_WALLET = '0x8549E82239a88f463ab6E55Ad1895b629a00Def3';

// ERC-20 ABI
const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// Uniswap V2 Pair ABI
const UNISWAP_V2_PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

// Uniswap V3 Pool ABI
const UNISWAP_V3_POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function liquidity() view returns (uint128)',
];

// Uniswap V4 PoolManager ABI（簡易版）
const UNISWAP_V4_POOLMANAGER_ABI = [
  'function protocolFeesAccrued(address token) view returns (uint256)',
];

// ゼロアドレス（mint時のfrom）
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// 既知のDEXプール（各チェーン）
const KNOWN_DEX_POOLS: { [chain: string]: { [address: string]: { protocol: string; type: 'V2' | 'V3'; pairToken: string } } } = {
  Ethereum: {
    // 実際のプールアドレスは後で追加可能
  },
  Polygon: {
    // QuickSwap等
  },
  Avalanche: {
    // Trader Joe等
  },
};

// 既知のUniswap V4 PoolManager
const KNOWN_V4_POOLMANAGERS: { [chain: string]: string[] } = {
  Ethereum: [],
  Polygon: ['0x67366782805870060151383F4BbFF9daB53e5cD6'],
  Avalanche: ['0x06380c0e0912312b5150364b9dc4542ba0dbbc85'],
};

// Chainlink JPY/USD Price Feed（Ethereum Mainnet）
// 注意: このフィードはJPY/USD（1 JPY = X USD）の形式
const CHAINLINK_JPYUSD_FEED = '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3';

const CHAINLINK_AGGREGATOR_ABI = [
  'function latestAnswer() view returns (int256)',
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
];

// USD/JPY為替レート（フォールバック用）
const USD_JPY_RATE_FALLBACK = 150; // 1 USD = 150 JPY

/**
 * Chainlink JPY/USDオラクルから為替レートを取得し、USD/JPYに変換
 * Ethereumメインネットから取得し、全チェーンで共有可能（Fiatレート）
 */
async function getUsdJpyRateFromOracle(): Promise<number | null> {
  try {
    // Ethereumメインネットのプロバイダーを作成
    const ethereumRpc = process.env.NEXT_PUBLIC_ETHEREUM_RPC || 'https://eth.llamarpc.com';
    const provider = new ethers.JsonRpcProvider(ethereumRpc, undefined, {
      staticNetwork: true,
    });
    
    const feed = new ethers.Contract(CHAINLINK_JPYUSD_FEED, CHAINLINK_AGGREGATOR_ABI, provider);
    
    const [answer, decimals] = await Promise.all([
      feed.latestAnswer(),
      feed.decimals(),
    ]);
    
    // JPY/USD（1 JPY = X USD）の値を取得
    const jpyUsdRate = Number(answer) / (10 ** Number(decimals));
    
    // USD/JPY（1 USD = X JPY）に変換
    const usdJpyRate = 1 / jpyUsdRate;
    
    console.log(`[Oracle] Chainlink JPY/USD: ${jpyUsdRate.toFixed(8)} → USD/JPY: ${usdJpyRate.toFixed(2)}`);
    
    return usdJpyRate;
  } catch (error) {
    console.warn(`[Oracle] Failed to fetch Chainlink JPY/USD, using fallback:`, error);
    return null;
  }
}

/**
 * 理論価格を計算（ペアトークンに応じて）
 */
function getTheoreticalPrice(pairToken: string, usdJpyRate: number): number {
  switch (pairToken.toUpperCase()) {
    case 'USDC':
    case 'USDT':
    case 'DAI':
      return usdJpyRate; // 1 USDC = X JPYC（オラクルレート）
    case 'WETH':
    case 'ETH':
      return usdJpyRate * 3000; // 仮定：1 ETH = $3000
    default:
      return usdJpyRate; // デフォルト
  }
}

/**
 * チェーンごとのブロック範囲制限
 */
function getMaxBlockRange(chainName: string): number {
  switch (chainName) {
    case 'Ethereum':
      return 1000;
    case 'Polygon':
      return 100;
    case 'Avalanche':
      return 5000;
    default:
      return 1000;
  }
}

/**
 * Transfer eventを複数チャンクで取得
 */
async function fetchTransferEventsInChunks(
  contract: ethers.Contract,
  chainName: string,
  fromBlock: number,
  toBlock: number
): Promise<ethers.Log[]> {
  const maxBlockRange = getMaxBlockRange(chainName);
  const allEvents: ethers.Log[] = [];
  
  const totalBlocks = toBlock - fromBlock + 1;
  const numChunks = Math.ceil(totalBlocks / maxBlockRange);
  
  console.log(`[${chainName}] Scanning ${totalBlocks} blocks in ${numChunks} chunks...`);

  for (let i = 0; i < numChunks; i++) {
    const chunkStart = fromBlock + i * maxBlockRange;
    const chunkEnd = Math.min(chunkStart + maxBlockRange - 1, toBlock);
    
    let retries = 3;
    while (retries > 0) {
      try {
        const filter = contract.filters.Transfer(null, null, null);
        const events = await contract.queryFilter(filter, chunkStart, chunkEnd);
        
        // 進捗をより詳細に表示
        if ((i + 1) % 10 === 0 || i + 1 === numChunks) {
          console.log(`[${chainName}] Progress: ${i + 1}/${numChunks} chunks (found ${allEvents.length} events so far)`);
        }
        
        allEvents.push(...events);
        break;
      } catch (error: any) {
        retries--;
        if (retries === 0) {
          console.warn(`[${chainName}] Chunk ${i + 1}/${numChunks} (blocks ${chunkStart}-${chunkEnd}) failed after 3 retries, skipping...`);
        } else {
          console.log(`[${chainName}] Chunk ${i + 1} failed, retrying... (${retries} retries left)`);
          // 指数バックオフ（より長い待機時間）
          await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
        }
      }
    }
  }

  return allEvents;
}

/**
 * コントラクトかどうか判定（タイムアウト＆リトライ付き）
 */
async function isContract(provider: ethers.JsonRpcProvider, address: string, chainName: string): Promise<boolean> {
  let retries = 2;
  
  while (retries >= 0) {
    try {
      const code = await Promise.race([
        provider.getCode(address),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000)) // 10秒に延長
      ]);
      
      return code !== '0x';
    } catch (error) {
      retries--;
      if (retries < 0) {
        // リトライ失敗時は警告を出さずにEOAと判定
        return false;
      }
      // リトライ前に待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return false;
}

/**
 * コントラクトの種類を判定
 */
async function detectContractType(
  provider: ethers.JsonRpcProvider,
  address: string,
  chainName: string
): Promise<{ type: ContractType; protocol?: string }> {
  try {
    // Uniswap V4 PoolManagerチェック（既知アドレス）
    const v4Managers = KNOWN_V4_POOLMANAGERS[chainName] || [];
    if (v4Managers.some(addr => addr.toLowerCase() === address.toLowerCase())) {
      console.log(`[${chainName}] Detected Uniswap V4 PoolManager: ${address}`);
      return { type: 'DEX_V4', protocol: 'Uniswap V4 PoolManager' };
    }
    
    // Uniswap V2スタイルのプールチェック
    try {
      const pairContract = new ethers.Contract(address, UNISWAP_V2_PAIR_ABI, provider);
      await pairContract.getReserves();
      
      // プロトコル名を推定
      let protocol = 'Unknown DEX';
      if (chainName === 'Ethereum') protocol = 'Uniswap V2 / SushiSwap';
      if (chainName === 'Polygon') protocol = 'QuickSwap / SushiSwap';
      if (chainName === 'Avalanche') protocol = 'Trader Joe / Pangolin';
      
      return { type: 'DEX_V2', protocol };
    } catch {}

    // Uniswap V3スタイルのプールチェック
    try {
      const poolContract = new ethers.Contract(address, UNISWAP_V3_POOL_ABI, provider);
      await poolContract.slot0();
      
      let protocol = 'Uniswap V3';
      if (chainName === 'Polygon') protocol = 'Uniswap V3';
      
      return { type: 'DEX_V3', protocol };
    } catch {}

    // その他の既知パターンをここに追加可能
    // (Aave、Compound等)

    return { type: 'UNKNOWN' };
  } catch (error) {
    return { type: 'UNKNOWN' };
  }
}

/**
 * Uniswap V2スタイルのプールから価格を取得
 */
async function getV2PoolPrice(
  provider: ethers.JsonRpcProvider,
  poolAddress: string,
  protocol: string,
  usdJpyRate: number
): Promise<DexPrice | null> {
  try {
    const pairContract = new ethers.Contract(poolAddress, UNISWAP_V2_PAIR_ABI, provider);
    const jpycContract = new ethers.Contract(JPYC_ADDRESS, ERC20_ABI, provider);
    
    const [reserves, token0Address, token1Address] = await Promise.all([
      pairContract.getReserves(),
      pairContract.token0(),
      pairContract.token1(),
    ]);
    
    // JPYCがtoken0かtoken1か判定
    const isToken0 = token0Address.toLowerCase() === JPYC_ADDRESS.toLowerCase();
    const pairTokenAddress = isToken0 ? token1Address : token0Address;
    
    // ペアトークンの情報取得
    const pairContract2 = new ethers.Contract(pairTokenAddress, ERC20_ABI, provider);
    const [pairSymbol, pairDecimalsRaw] = await Promise.all([
      pairContract2.symbol(),
      pairContract2.decimals(),
    ]);
    
    // Decimalsを明示的にNumberに変換
    const pairDecimals = Number(pairDecimalsRaw);
    
    // リザーブから価格計算
    const jpycReserve = isToken0 ? reserves[0] : reserves[1];
    const pairReserve = isToken0 ? reserves[1] : reserves[0];
    
    const jpycAmount = parseFloat(ethers.formatUnits(jpycReserve.toString(), 18));
    const pairAmount = parseFloat(ethers.formatUnits(pairReserve.toString(), pairDecimals));
    
    if (jpycAmount === 0) return null;
    
    // 1 JPYC = ? pairToken
    const priceInPairToken = pairAmount / jpycAmount;
    
    // 表示用：1 pairToken = ? JPYC
    const displayPrice = 1 / priceInPairToken;
    const displayFormat = `1 ${pairSymbol} = ${displayPrice.toFixed(2)} JPYC`;
    
    // 理論価格とペッグ乖離（オラクルレート使用）
    const theoreticalPrice = getTheoreticalPrice(pairSymbol, usdJpyRate);
    const pegDeviation = ((displayPrice - theoreticalPrice) / theoreticalPrice) * 100;
    
    // 内部計算用（レガシー）
    let jpycPriceUSD = priceInPairToken;
    if (pairSymbol === 'WETH' || pairSymbol === 'ETH') {
      jpycPriceUSD = priceInPairToken / 3000; // 1 ETH = $3000と仮定
    }
    
    console.log(`[V2] ${displayFormat}, deviation: ${pegDeviation.toFixed(2)}% from ${theoreticalPrice} (oracle: ${usdJpyRate.toFixed(2)})`);
    
    return {
      poolAddress,
      protocol,
      pairToken: pairSymbol,
      displayPrice,
      displayFormat,
      jpycPrice: jpycPriceUSD,
      pegDeviation,
      theoreticalPrice,
      liquidity: jpycAmount,
    };
  } catch (error) {
    console.warn(`Failed to get V2 pool price for ${poolAddress}:`, error);
    return null;
  }
}

/**
 * Uniswap V3スタイルのプールから価格を取得
 */
async function getV3PoolPrice(
  provider: ethers.JsonRpcProvider,
  poolAddress: string,
  protocol: string,
  usdJpyRate: number
): Promise<DexPrice | null> {
  try {
    console.log(`[V3-v2] Fetching price for pool ${poolAddress}...`);
    const poolContract = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, provider);
    
    console.log(`[V3-v2] Getting slot0, tokens, and liquidity...`);
    const [slot0, token0Address, token1Address, liquidity] = await Promise.all([
      poolContract.slot0(),
      poolContract.token0(),
      poolContract.token1(),
      poolContract.liquidity(),
    ]);
    
    console.log(`[V3-v2] token0=${token0Address}, token1=${token1Address}, liquidity=${liquidity}`);
    
    // JPYCがtoken0かtoken1か判定
    const isToken0 = token0Address.toLowerCase() === JPYC_ADDRESS.toLowerCase();
    const pairTokenAddress = isToken0 ? token1Address : token0Address;
    
    console.log(`[V3-v2] JPYC is token${isToken0 ? '0' : '1'}, pair token=${pairTokenAddress}`);
    
    // ペアトークンの情報取得
    const pairContract = new ethers.Contract(pairTokenAddress, ERC20_ABI, provider);
    
    console.log(`[V3-v2] Getting pair token info...`);
    const [pairSymbol, pairDecimalsRaw] = await Promise.all([
      pairContract.symbol(),
      pairContract.decimals(),
    ]);
    
    // Decimalsを明示的にNumberに変換
    const pairDecimals = Number(pairDecimalsRaw);
    console.log(`[V3-v2] ✓ Decimals converted to Number: ${pairDecimals}`);
    
    console.log(`[V3-v2] Pair: ${pairSymbol} (decimals=${pairDecimals})`);
    
    // sqrtPriceX96から価格を計算
    // Uniswap V3: price = (sqrtPriceX96 / 2^96)^2 * (10^token0Decimals / 10^token1Decimals)
    // これは token1/token0 の価格
    
    const sqrtPriceX96 = BigInt(slot0[0].toString());
    console.log(`[V3-v2] sqrtPriceX96=${sqrtPriceX96}`);
    
    // より正確な計算：decimal調整を先に行う
    // price = (sqrtPriceX96)^2 * 10^(token0Decimals - token1Decimals) / (2^96)^2
    
    const Q96 = 2n ** 96n;
    const token0Decimals = isToken0 ? 18 : pairDecimals;
    const token1Decimals = isToken0 ? pairDecimals : 18;
    
    console.log(`[V3-v2] token0Decimals=${token0Decimals}, token1Decimals=${token1Decimals}`);
    
    // token1 / token0 の価格を計算
    // まず sqrtPrice を実数に変換
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    const price = sqrtPrice ** 2;
    
    console.log(`[V3-v2] sqrtPrice=${sqrtPrice}, price (token1/token0 raw)=${price}`);
    
    // Decimal調整を適用
    const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
    const priceAdjusted = price * decimalAdjustment;
    
    console.log(`[V3-v2] Decimal adjustment: 10^${token0Decimals - token1Decimals} = ${decimalAdjustment}`);
    console.log(`[V3-v2] Price adjusted (token1/token0): ${priceAdjusted}`);
    
    // 1 JPYC = ? pairToken を計算
    let priceInPairToken: number;
    
    if (isToken0) {
      // JPYC is token0 → priceAdjusted = token1/token0 = pairToken/JPYC
      priceInPairToken = priceAdjusted;
    } else {
      // JPYC is token1 → priceAdjusted = token1/token0 = JPYC/pairToken
      // 逆数を取る
      priceInPairToken = 1 / priceAdjusted;
    }
    
    console.log(`[V3-v2] Price: 1 JPYC = ${priceInPairToken} ${pairSymbol}`);
    
    // 表示用：1 pairToken = ? JPYC
    const displayPrice = 1 / priceInPairToken;
    const displayFormat = `1 ${pairSymbol} = ${displayPrice.toFixed(2)} JPYC`;
    
    // 理論価格とペッグ乖離（オラクルレート使用）
    const theoreticalPrice = getTheoreticalPrice(pairSymbol, usdJpyRate);
    const pegDeviation = ((displayPrice - theoreticalPrice) / theoreticalPrice) * 100;
    
    // 内部計算用（レガシー）
    let jpycPriceUSD = priceInPairToken;
    if (pairSymbol === 'WETH' || pairSymbol === 'ETH') {
      jpycPriceUSD = priceInPairToken / 3000; // 1 ETH = $3000と仮定
    }
    
    // 流動性の概算（BigIntを明示的にStringに変換）
    const jpycLiquidity = parseFloat(ethers.formatUnits(liquidity.toString(), 18)) / 2;
    
    console.log(`[V3-v2] ✓ ${displayFormat}, deviation: ${pegDeviation.toFixed(2)}% from ${theoreticalPrice} (oracle: ${usdJpyRate.toFixed(2)}), liquidity: ${jpycLiquidity.toFixed(0)} JPYC`);
    
    return {
      poolAddress,
      protocol,
      pairToken: pairSymbol,
      displayPrice,
      displayFormat,
      jpycPrice: jpycPriceUSD,
      pegDeviation,
      theoreticalPrice,
      liquidity: jpycLiquidity,
    };
  } catch (error: any) {
    console.error(`[V3-v2] ❌ Failed to get V3 pool price for ${poolAddress}:`, error.message || error);
    if (error.stack) console.error(`[V3-v2] Stack:`, error.stack);
    return null;
  }
}

/**
 * チェーンごとのスキャンブロック数を取得
 */
function getScanBlocks(chainName: string): number {
  switch (chainName) {
    case 'Ethereum':
      return 50000; // 約7日分
    case 'Polygon':
      return 5000;  // 約3時間分（ブロック生成が速いため短縮）
    case 'Avalanche':
      return 50000; // 約12時間分
    default:
      return 50000;
  }
}

/**
 * コントラクト保有者を検出
 */
async function detectContractHolders(
  provider: ethers.JsonRpcProvider,
  contract: ethers.Contract,
  chainName: string,
  totalSupply: number,
  usdJpyRate: number
): Promise<any[]> {
  try {
    // チェーンごとに最適なブロック数をスキャン
    const currentBlock = await provider.getBlockNumber();
    const scanBlocks = getScanBlocks(chainName);
    const fromBlock = Math.max(0, currentBlock - scanBlocks);
    
    console.log(`[${chainName}] Scanning Transfer events from block ${fromBlock} to ${currentBlock}...`);
    
    // Transferイベント取得
    const events = await fetchTransferEventsInChunks(contract, chainName, fromBlock, currentBlock);
    
    if (events.length === 0) {
      console.log(`[${chainName}] No Transfer events found`);
      return [];
    }
    
    // 受信アドレス（to）を収集（送信側fromは除外）
    const recipientAddresses = new Set<string>();
    for (const event of events) {
      const parsedLog = contract.interface.parseLog({
        topics: [...event.topics],
        data: event.data,
      });
      
      if (parsedLog && parsedLog.name === 'Transfer') {
        // より明確に .to でアクセス（.args[1]と同じだが意図が明確）
        const fromAddress = parsedLog.args.from || parsedLog.args[0];
        const toAddress = parsedLog.args.to || parsedLog.args[1];
        
        // 受信側（to）のみを収集、送信側（from）は含めない
        if (toAddress && toAddress !== ZERO_ADDRESS && toAddress !== OPERATING_WALLET) {
          recipientAddresses.add(toAddress.toLowerCase());
        }
      }
    }
    
    // 既知のV4 PoolManagerを強制的に追加（スキャン範囲外でも検出）
    const v4Managers = KNOWN_V4_POOLMANAGERS[chainName] || [];
    v4Managers.forEach(addr => {
      recipientAddresses.add(addr.toLowerCase());
      console.log(`[${chainName}] ✓ Added known V4 PoolManager: ${addr}`);
    });
    
    console.log(`[${chainName}] Found ${recipientAddresses.size} unique recipient addresses (including ${v4Managers.length} known V4 managers)`);
    
    // コントラクトを特定（バッチ処理）
    const addresses = Array.from(recipientAddresses);
    const contractAddresses: string[] = [];
    
    // 並列でコントラクト判定（5件ずつバッチ処理でレート制限を回避）
    const batchSize = 5;
    console.log(`[${chainName}] Checking ${addresses.length} addresses (${batchSize} at a time)...`);
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(addr => isContract(provider, addr, chainName))
      );
      
      results.forEach((isContr, idx) => {
        if (isContr) {
          contractAddresses.push(batch[idx]);
        }
      });
      
      // レート制限対策の待機（500msに延長）
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 進捗表示
      if ((i + batchSize) % 20 === 0 || i + batchSize >= addresses.length) {
        console.log(`[${chainName}] Progress: ${Math.min(i + batchSize, addresses.length)}/${addresses.length} addresses checked`);
      }
    }
    
    console.log(`[${chainName}] Found ${contractAddresses.length} contract addresses`);
    
    if (contractAddresses.length === 0) {
      return [];
    }
    
    // コントラクトの残高を取得（バッチ処理）
    const contractHolders: any[] = [];
    console.log(`[${chainName}] Fetching balances for ${contractAddresses.length} contracts...`);
    
    for (let i = 0; i < contractAddresses.length; i += batchSize) {
      const batch = contractAddresses.slice(i, i + batchSize);
      const balances = await Promise.all(
        batch.map(async (addr) => {
          try {
            const balance = await contract.balanceOf(addr);
            return {
              address: addr,
              balance: parseFloat(ethers.formatUnits(balance, 18)),
            };
          } catch (error) {
            return { address: addr, balance: 0 };
          }
        })
      );
      
      contractHolders.push(...balances);
      
      // レート制限対策の待機（300msに延長）
      if (i + batchSize < contractAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // 残高降順でソート＆トップ20
    const sorted = contractHolders
      .filter(h => h.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 20);
    
    console.log(`[${chainName}] Detecting contract types for ${sorted.length} holders...`);
    
    // コントラクト種類を判定（バッチ処理）
    const typedHolders: any[] = [];
    for (let i = 0; i < sorted.length; i += 3) {
      const batch = sorted.slice(i, i + 3);
      const typedBatch = await Promise.all(
        batch.map(async (h) => {
          const typeInfo = await detectContractType(provider, h.address, chainName);
          return {
            address: h.address,
            balance: h.balance,
            percentage: (h.balance / totalSupply) * 100,
            type: typeInfo.type,
            protocol: typeInfo.protocol,
          };
        })
      );
      
      typedHolders.push(...typedBatch);
      
      // レート制限対策の待機
      if (i + 3 < sorted.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`[${chainName}] Found ${typedHolders.length} typed contract holders`);
    
    return typedHolders;
  } catch (error: any) {
    console.error(`[${chainName}] Error detecting contract holders:`, error);
    return [];
  }
}

/**
 * トークンデータを取得（シンプル方式）
 */
export async function fetchTokenDataSimple(chain: ChainConfig, usdJpyRate: number): Promise<TokenData> {
  console.log(`[${chain.name}] Starting simple data fetch with USD/JPY rate: ${usdJpyRate.toFixed(2)}...`);
  
  try {
    // プロバイダーとコントラクト接続
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl, undefined, {
      staticNetwork: true,
    });
    const contract = new ethers.Contract(JPYC_ADDRESS, ERC20_ABI, provider);

    // 1. Total Supply取得
    console.log(`[${chain.name}] Fetching total supply...`);
    const totalSupplyBN = await contract.totalSupply();
    const totalSupply = parseFloat(ethers.formatUnits(totalSupplyBN, 18));
    console.log(`[${chain.name}] Total supply: ${totalSupply.toFixed(2)} JPYC`);

    // 2. 運営ウォレット残高取得
    console.log(`[${chain.name}] Fetching operating wallet balance...`);
    const operatingBalanceBN = await contract.balanceOf(OPERATING_WALLET);
    const operatingBalance = parseFloat(ethers.formatUnits(operatingBalanceBN, 18));
    console.log(`[${chain.name}] Operating wallet balance: ${operatingBalance.toFixed(2)} JPYC`);

    // 3. 流通量 = Total Supply - 運営ウォレット残高
    const circulatingSupply = totalSupply - operatingBalance;
    console.log(`[${chain.name}] Circulating supply: ${circulatingSupply.toFixed(2)} JPYC`);

    // 4. コントラクト保有者を検出
    console.log(`[${chain.name}] Detecting contract holders...`);
    const contractHolders = await detectContractHolders(provider, contract, chain.name, totalSupply, usdJpyRate);

    // 5. DEX価格を取得（DEXプールが見つかった場合）
    console.log(`[${chain.name}] Fetching DEX prices...`);
    const dexPrices: DexPrice[] = [];
    
    const delayMs = getPriceDelay(chain.name);
    console.log(`[${chain.name}] Using ${delayMs}ms delay between DEX price fetches`);
    
    for (let i = 0; i < contractHolders.length; i++) {
      const holder = contractHolders[i];
      
      if (holder.type === 'DEX_V2') {
        const price = await getV2PoolPrice(provider, holder.address, holder.protocol || 'Unknown DEX', usdJpyRate);
        if (price) dexPrices.push(price);
      } else if (holder.type === 'DEX_V3') {
        const price = await getV3PoolPrice(provider, holder.address, holder.protocol || 'Unknown DEX', usdJpyRate);
        if (price) dexPrices.push(price);
      }
      
      // レート制限対策：各プール価格取得後に待機（チェーン別の遅延）
      if (i < contractHolders.length - 1 && (holder.type === 'DEX_V2' || holder.type === 'DEX_V3')) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.log(`[${chain.name}] Found ${dexPrices.length} DEX pools with prices`);

    // 結果を返す
    return {
      chain: chain.name,
      totalSupply,
      operatingBalance,
      circulatingSupply,
      holders: [],
      contractHolders,
      dexPrices,
    };
  } catch (error: any) {
    console.error(`[${chain.name}] Error in simple fetch:`, error);
    throw new Error(`Failed to fetch data for ${chain.name}: ${error.message}`);
  }
}

/**
 * チェーンごとのDEX価格取得遅延を取得（レート制限対策）
 */
function getPriceDelay(chainName: string): number {
  switch (chainName) {
    case 'Polygon':
      return 2000; // 2秒（Polygonは非常に厳しい制限）
    case 'Ethereum':
      return 500;  // 0.5秒
    case 'Avalanche':
      return 500;  // 0.5秒
    default:
      return 1000;
  }
}

/**
 * DEX価格のみを更新（軽量・高速）
 */
export async function fetchDexPricesOnly(
  chain: ChainConfig,
  contractHolders: any[],
  usdJpyRate: number
): Promise<DexPrice[]> {
  console.log(`[${chain.name}] Fetching DEX prices only (lightweight update)...`);
  
  try {
    const provider = new ethers.JsonRpcProvider(chain.rpcUrl, undefined, {
      staticNetwork: true,
    });
    
    const dexPrices: DexPrice[] = [];
    
    // DEXプールのみをフィルタリング
    const dexPools = contractHolders.filter(h => h.type === 'DEX_V2' || h.type === 'DEX_V3');
    
    const delayMs = getPriceDelay(chain.name);
    console.log(`[${chain.name}] Using ${delayMs}ms delay between DEX price fetches`);
    
    for (let i = 0; i < dexPools.length; i++) {
      const holder = dexPools[i];
      
      if (holder.type === 'DEX_V2') {
        const price = await getV2PoolPrice(provider, holder.address, holder.protocol || 'Unknown DEX', usdJpyRate);
        if (price) dexPrices.push(price);
      } else if (holder.type === 'DEX_V3') {
        const price = await getV3PoolPrice(provider, holder.address, holder.protocol || 'Unknown DEX', usdJpyRate);
        if (price) dexPrices.push(price);
      }
      
      // レート制限対策（チェーン別の遅延）
      if (i < dexPools.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.log(`[${chain.name}] Updated ${dexPrices.length} DEX prices`);
    return dexPrices;
  } catch (error: any) {
    console.error(`[${chain.name}] Error fetching DEX prices:`, error);
    return [];
  }
}

/**
 * 軽量データ（流通量・DEX価格）のみを更新（高速）
 */
export async function updateLightweightData(
  chainDataResults: ChainDataResult[]
): Promise<ChainDataResult[]> {
  console.log('[Lightweight Update] Fetching USD/JPY rate, supply data, and DEX prices...');
  
  // 1. Chainlink USD/JPYレートを取得
  const oracleRate = await getUsdJpyRateFromOracle();
  const usdJpyRate = oracleRate || USD_JPY_RATE_FALLBACK;
  console.log(`[Lightweight Update] Using USD/JPY rate: ${usdJpyRate.toFixed(2)} (${oracleRate ? 'from oracle' : 'fallback'})`);
  
  // 2. 各チェーンの流通量とDEX価格を並列更新
  const updatedResults = await Promise.all(
    chainDataResults.map(async (result) => {
      if (!result.success || !result.data) {
        return result; // エラーだったチェーンはスキップ
      }
      
      try {
        // チェーン設定を取得
        const chain = result.data.chain;
        const chainConfig = {
          name: chain,
          chainId: chain === 'Ethereum' ? 1 : chain === 'Polygon' ? 137 : 43114,
          rpcUrl: process.env[`NEXT_PUBLIC_${chain.toUpperCase()}_RPC`] || 
                  (chain === 'Ethereum' ? 'https://eth.llamarpc.com' :
                   chain === 'Polygon' ? 'https://polygon-rpc.com' :
                   'https://1rpc.io/avax/c'),
        };
        
        // プロバイダーとコントラクト接続
        const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl, undefined, {
          staticNetwork: true,
        });
        const contract = new ethers.Contract(JPYC_ADDRESS, ERC20_ABI, provider);
        
        // 総供給量と運営保有量を取得（並列実行）
        const [totalSupplyBN, operatingBalanceBN] = await Promise.all([
          contract.totalSupply(),
          contract.balanceOf(OPERATING_WALLET),
        ]);
        
        const totalSupply = parseFloat(ethers.formatUnits(totalSupplyBN, 18));
        const operatingBalance = parseFloat(ethers.formatUnits(operatingBalanceBN, 18));
        const circulatingSupply = totalSupply - operatingBalance;
        
        console.log(`[${chain}] Updated supply: total=${totalSupply.toFixed(0)}, operating=${operatingBalance.toFixed(0)}, circulating=${circulatingSupply.toFixed(0)}`);
        
        // DEX価格を更新
        const updatedDexPrices = await fetchDexPricesOnly(
          chainConfig as ChainConfig,
          result.data.contractHolders,
          usdJpyRate
        );
        
        return {
          ...result,
          data: {
            ...result.data,
            totalSupply,
            operatingBalance,
            circulatingSupply,
            dexPrices: updatedDexPrices,
          },
        };
      } catch (error: any) {
        console.error(`[Lightweight Update] Failed for ${result.chain}:`, error);
        return result; // エラー時は既存データを保持
      }
    })
  );
  
  console.log('[Lightweight Update] Completed');
  return updatedResults;
}

/**
 * @deprecated 後方互換性のため残す（updateLightweightDataを使用してください）
 */
export async function updateAllDexPrices(
  chainDataResults: ChainDataResult[]
): Promise<ChainDataResult[]> {
  return updateLightweightData(chainDataResults);
}

/**
 * 全チェーンのデータを並列取得
 */
export interface ChainDataResult {
  success: boolean;
  data?: TokenData;
  error?: string;
  chain: string;
}

export async function fetchAllChainDataSimple(chains: ChainConfig[]): Promise<ChainDataResult[]> {
  console.log('Starting parallel data fetch for all chains...');
  
  // 1. 最初にChainlink USD/JPYレートを取得（全チェーンで共有）
  console.log('[Global] Fetching USD/JPY rate from Chainlink oracle (Ethereum mainnet)...');
  const oracleRate = await getUsdJpyRateFromOracle();
  const usdJpyRate = oracleRate || USD_JPY_RATE_FALLBACK;
  console.log(`[Global] Using USD/JPY rate: ${usdJpyRate.toFixed(2)} (${oracleRate ? 'from oracle' : 'fallback'}) for all chains`);
  
  // 2. 各チェーンのデータを並列取得（同じUSD/JPYレートを使用）
  const results = await Promise.allSettled(
    chains.map(async (chain) => {
      try {
        const data = await fetchTokenDataSimple(chain, usdJpyRate);
        return { success: true, data, chain: chain.name };
      } catch (error: any) {
        console.error(`Failed to fetch data for ${chain.name}:`, error);
        return {
          success: false,
          error: error.message || 'Unknown error',
          chain: chain.name,
        };
      }
    })
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        error: result.reason?.message || 'Unknown error',
        chain: 'Unknown',
      };
    }
  });
}

/**
 * 数値フォーマット用ヘルパー関数（整数部分のみ、カンマ区切り）
 */
export function formatNumber(num: number): string {
  return Math.floor(num).toLocaleString('ja-JP');
}

/**
 * アドレス短縮用ヘルパー関数
 */
export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
