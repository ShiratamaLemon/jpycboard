'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CHAINS, TokenData, JPYC_ADDRESS } from '@/types';
import { fetchAllChainDataLight, fetchAllChainDataSimple, updateLightweightData, formatNumber, shortenAddress, ChainDataResult } from '@/lib/explorerApi';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
const POLLING_INTERVAL = 180000; // 180秒（3分）

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainData, setChainData] = useState<TokenData[]>([]);
  const [failedChains, setFailedChains] = useState<ChainDataResult[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [lastFullUpdate, setLastFullUpdate] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [nextUpdateIn, setNextUpdateIn] = useState<number>(POLLING_INTERVAL / 1000);
  const [allResults, setAllResults] = useState<ChainDataResult[]>([]);
  
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 軽量データを取得（初回ロード用 - 高速）
  const loadLightData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🚀 Loading light data (fast initial load)...');
      const results = await fetchAllChainDataLight(CHAINS);
      
      // 成功したチェーンと失敗したチェーンを分離
      const successful = results.filter(r => r.success && r.data).map(r => r.data!);
      const failed = results.filter(r => !r.success);
      
      console.log('Successful chains (light):', successful.map(d => d.chain));
      console.log('Failed chains:', failed.map(f => f.chain));
      
      setChainData(successful);
      setFailedChains(failed);
      setAllResults(results);
      setLastUpdate(new Date());
      // lastFullUpdateは設定しない（まだフル取得していない）
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知のエラーが発生しました');
      console.error('Error loading light data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 全データを取得（重い処理 - コントラクト検出含む）
  const loadFullData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Loading full data (with contract scanning)...');
      const results = await fetchAllChainDataSimple(CHAINS);
      
      // 成功したチェーンと失敗したチェーンを分離
      const successful = results.filter(r => r.success && r.data).map(r => r.data!);
      const failed = results.filter(r => !r.success);
      
      console.log('Successful chains (full):', successful.map(d => d.chain));
      console.log('Failed chains:', failed.map(f => f.chain));
      
      setChainData(successful);
      setFailedChains(failed);
      setAllResults(results);
      setLastUpdate(new Date());
      setLastFullUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知のエラーが発生しました');
      console.error('Error loading full data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 軽量データ更新（流通量・DEX価格）
  const updatePrices = useCallback(async () => {
    if (allResults.length === 0 || isPolling) return;
    
    try {
      setIsPolling(true);
      console.log('🔄 Auto-updating supply data and DEX prices...');
      
      const updatedResults = await updateLightweightData(allResults);
      
      const successful = updatedResults.filter(r => r.success && r.data).map(r => r.data!);
      const failed = updatedResults.filter(r => !r.success);
      
      setChainData(successful);
      setFailedChains(failed);
      setAllResults(updatedResults);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error updating lightweight data:', err);
    } finally {
      setIsPolling(false);
    }
  }, [allResults, isPolling]);

  // 初回ロード（軽量版で高速表示）
  useEffect(() => {
    loadLightData();
  }, []);

  // 自動ポーリング
  useEffect(() => {
    if (allResults.length === 0) return;

    // カウントダウンタイマー
    setNextUpdateIn(POLLING_INTERVAL / 1000);
    countdownTimerRef.current = setInterval(() => {
      setNextUpdateIn(prev => {
        if (prev <= 1) return POLLING_INTERVAL / 1000;
        return prev - 1;
      });
    }, 1000);

    // ポーリングタイマー
    pollingTimerRef.current = setInterval(() => {
      updatePrices();
    }, POLLING_INTERVAL);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [allResults.length, updatePrices]);

  // 合計値を計算
  const totalCirculatingSupply = chainData.reduce((sum, chain) => sum + chain.circulatingSupply, 0);
  const totalSupply = chainData.reduce((sum, chain) => sum + chain.totalSupply, 0);
  const totalOperatingBalance = chainData.reduce((sum, chain) => sum + chain.operatingBalance, 0);

  // チャート用データ
  const pieData = chainData.map((chain) => ({
    name: chain.chain,
    value: chain.circulatingSupply,
  }));

  if (loading) {
    // 初回ロードかフルロードかを判定
    const isFullLoad = lastUpdate !== null; // 既にデータがある = フルロード中
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-700 mb-2">データを読み込んでいます...</p>
          <p className="text-sm text-gray-500 mt-2">RPCから直接データを取得しています</p>
          {isFullLoad ? (
            <p className="text-xs text-gray-400 mt-4">
              コントラクト保有者を検出中...
              <br />
              通常30秒〜2分程度で完了します。
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-4">
              基本情報を取得中...
              <br />
              通常数秒で完了します。
            </p>
          )}
          <div className="mt-6 bg-white rounded-lg p-4 shadow-lg">
            <p className="text-xs text-gray-600 text-left mb-2">
              💡 {isFullLoad ? 'コントラクトスキャン中...' : '高速ロード中...'}
            </p>
            <p className="text-xs text-gray-500 text-left">
              ブラウザのコンソール（F12）で詳細な進捗を確認できます
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={loadFullData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">JPYC 流通状況ダッシュボード</h1>
              <p className="text-gray-600">
                トークンアドレス: <span className="font-mono text-sm">{JPYC_ADDRESS}</span>
              </p>
            </div>
            
            {/* 更新ステータス */}
            <div className="text-right ml-4">
              {isPolling ? (
                <div className="flex items-center gap-2 text-sm text-indigo-600 mb-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></span>
                  データ更新中...
                </div>
              ) : (
                <div className="text-sm text-gray-600 mb-2">
                  🔄 次回自動更新: <span className="font-bold">{nextUpdateIn}秒後</span>
                </div>
              )}
              <button
                onClick={loadFullData}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition-colors text-sm whitespace-nowrap"
                title="コントラクト保有者を再スキャン（30秒〜2分）"
              >
                {lastFullUpdate ? '全データ再取得' : 'コントラクト情報取得'}
              </button>
            </div>
          </div>
          
          {/* 更新時刻情報 */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-6 text-sm">
            {lastUpdate && (
              <div className="text-gray-600">
                <span className="font-semibold">流通量・価格更新:</span>{' '}
                {lastUpdate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} JST
              </div>
            )}
            {lastFullUpdate && (
              <div className="text-gray-600">
                <span className="font-semibold">ホルダー情報更新:</span>{' '}
                {lastFullUpdate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} JST
              </div>
            )}
            <div className="text-xs text-gray-500 ml-auto">
              💡 流通量とDEX価格は180秒（3分）ごとに自動更新されます
            </div>
          </div>
        </div>

        {/* 全体統計 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="総供給量"
            value={formatNumber(totalSupply)}
            unit="JPYC"
            color="bg-blue-500"
          />
          <StatCard
            title="流通量"
            value={formatNumber(totalCirculatingSupply)}
            unit="JPYC"
            color="bg-green-500"
          />
          <StatCard
            title="運営保有量"
            value={formatNumber(totalOperatingBalance)}
            unit="JPYC"
            color="bg-purple-500"
          />
        </div>

        {/* DEX価格サマリー */}
        {chainData.some(c => c.dexPrices && c.dexPrices.length > 0) && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 mb-8 border border-blue-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 DEX価格・ペッグ状況</h2>
            <p className="text-sm text-gray-600 mb-4">
              理論値はChainlink JPY/USDを暫定使用中
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chainData.map(chain => (
                chain.dexPrices && chain.dexPrices.length > 0 && (
                  <div key={chain.chain} className="space-y-2">
                    <h3 className="font-semibold text-gray-700 text-sm">{chain.chain}</h3>
                    {chain.dexPrices.map(dex => {
                      // displayPrice > theoreticalPrice → 円安 → JPYC弱い
                      // displayPrice < theoreticalPrice → 円高 → JPYC強い
                      const isStrong = dex.pegDeviation < -1; // 理論値より低い = 円高 = JPYC強い
                      const isWeak = dex.pegDeviation > 1;    // 理論値より高い = 円安 = JPYC弱い
                      const isNeutral = Math.abs(dex.pegDeviation) <= 1;
                      
                      return (
                        <div key={dex.poolAddress} className={`rounded p-3 shadow-sm border-2 ${
                          isStrong ? 'bg-green-50 border-green-300' :
                          isWeak ? 'bg-red-50 border-red-300' :
                          'bg-white border-yellow-300'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-blue-600">{dex.protocol}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${
                                isNeutral ? 'bg-yellow-100 text-yellow-700' :
                                isStrong ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {dex.pegDeviation > 0 ? '+' : ''}{dex.pegDeviation.toFixed(2)}%
                              </span>
                              {isStrong && <span className="text-xs">💪</span>}
                              {isWeak && <span className="text-xs">📉</span>}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-800">
                              1 {dex.pairToken} = {dex.displayPrice.toFixed(2)} JPYC
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              理論値: {dex.theoreticalPrice.toFixed(2)} JPYC
                            </div>
                            {isStrong && (
                              <div className="text-xs text-green-700 font-semibold mt-2">
                                ✅ 円高 - 少ないJPYCでUSDC購入可能
                              </div>
                            )}
                            {isWeak && (
                              <div className="text-xs text-red-700 font-semibold mt-2">
                                ⚠️ 円安 - 多くのJPYCが必要
                              </div>
                            )}
                            {isNeutral && (
                              <div className="text-xs text-gray-600 mt-2">
                                ⚖️ ほぼペッグ維持
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* チャート */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">チェーン別流通量</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* エラー警告 */}
        {failedChains.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ 一部のチェーンでデータ取得に失敗しました</h3>
            <div className="space-y-2">
              {failedChains.map((failed) => (
                <div key={failed.chain} className="text-sm">
                  <span className="font-semibold text-yellow-700">{failed.chain}:</span>{' '}
                  <span className="text-yellow-600">{failed.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* データがない場合の警告 */}
        {chainData.length === 0 && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-red-800 mb-2">❌ データを取得できませんでした</h3>
            <p className="text-sm text-red-600">すべてのチェーンでエラーが発生しています。RPC接続を確認してください。</p>
          </div>
        )}

        {/* チェーン別詳細 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {chainData.map((chain, index) => (
            <ChainCard key={chain.chain} chain={chain} color={COLORS[index]} lastFullUpdate={lastFullUpdate} />
          ))}
        </div>
      </div>
    </div>
  );
}

// 統計カードコンポーネント
function StatCard({ title, value, unit, color }: { title: string; value: string; unit: string; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className={`${color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-gray-500 text-sm">{unit}</p>
    </div>
  );
}

// チェーンカードコンポーネント
function ChainCard({ chain, color, lastFullUpdate }: { chain: TokenData; color: string; lastFullUpdate: Date | null }) {
  const getExplorerUrl = (chainName: string) => {
    const baseUrls: { [key: string]: string } = {
      'Ethereum': 'https://etherscan.io',
      'Polygon': 'https://polygonscan.com',
      'Avalanche': 'https://snowtrace.io',
    };
    return baseUrls[chainName] || '';
  };

  const operatingWallet = '0x8549E82239a88f463ab6E55Ad1895b629a00Def3';
  const explorerUrl = getExplorerUrl(chain.chain);
  const tokenUrl = explorerUrl ? `${explorerUrl}/token/${JPYC_ADDRESS}` : '';
  const holderUrl = explorerUrl ? `${explorerUrl}/address/${operatingWallet}` : '';

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }}></div>
          <h2 className="text-2xl font-bold text-gray-800">{chain.chain}</h2>
        </div>
        {tokenUrl && (
          <a
            href={tokenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800 text-sm"
          >
            Explorer ↗
          </a>
        )}
      </div>
      
      <div className="space-y-3">
        <InfoRow label="総供給量" value={`${formatNumber(chain.totalSupply)} JPYC`} />
        <InfoRow label="流通量" value={`${formatNumber(chain.circulatingSupply)} JPYC`} />
        <InfoRow label="運営保有量" value={`${formatNumber(chain.operatingBalance)} JPYC`} />
        
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">運営ウォレット:</p>
          <a
            href={holderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-indigo-600 hover:text-indigo-800 break-all"
          >
            {operatingWallet}
          </a>
        </div>

        {/* コントラクト保有者リスト */}
        <div className="pt-3 border-t border-gray-200">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            💼 コントラクト保有者
          </p>
          {chain.contractHolders && chain.contractHolders.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {chain.contractHolders.map((holder, idx) => {
                const typeIcon = 
                  holder.type === 'DEX_V2' || holder.type === 'DEX_V3' || holder.type === 'DEX_V4' ? '🔄' :
                  holder.type === 'LENDING' ? '💰' :
                  holder.type === 'BRIDGE' ? '🌉' : '📦';
                
                return (
                  <div key={holder.address} className="bg-gray-50 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-gray-600">#{idx + 1}</span>
                        <span className="text-sm">{typeIcon}</span>
                        {holder.protocol && (
                          <span className="text-xs text-blue-600 font-medium">{holder.protocol}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-600">
                        {formatNumber(holder.balance)} JPYC ({holder.percentage.toFixed(2)}%)
                      </span>
                    </div>
                    <a
                      href={`${explorerUrl}/address/${holder.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-indigo-600 hover:text-indigo-800 break-all"
                    >
                      {holder.address}
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-gray-50 rounded p-3 border border-gray-300">
              <p className="text-xs text-gray-600 mb-2">
                コントラクト保有者情報がまだ取得されていません
              </p>
              <p className="text-xs text-gray-500">
                「{lastFullUpdate ? '全データ再取得' : 'コントラクト情報取得'}」ボタンをクリックしてスキャンを開始してください
              </p>
            </div>
          )}
        </div>

        {/* DEX価格情報 */}
        {chain.dexPrices && chain.dexPrices.length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              📊 DEX価格・ペッグ状況
            </p>
            <div className="space-y-2">
              {chain.dexPrices.map((dex, idx) => {
                // displayPrice > theoreticalPrice → 円安 → JPYC弱い
                // displayPrice < theoreticalPrice → 円高 → JPYC強い
                const isStrong = dex.pegDeviation < -1; // 理論値より低い = 円高 = JPYC強い
                const isWeak = dex.pegDeviation > 1;    // 理論値より高い = 円安 = JPYC弱い
                const isNeutral = Math.abs(dex.pegDeviation) <= 1;
                
                return (
                  <div key={dex.poolAddress} className={`rounded p-2 border ${
                    isStrong ? 'bg-green-50 border-green-300' :
                    isWeak ? 'bg-red-50 border-red-300' :
                    'bg-yellow-50 border-yellow-300'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-blue-700">{dex.protocol}</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          isNeutral ? 'bg-yellow-100 text-yellow-700' :
                          isStrong ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {dex.pegDeviation > 0 ? '+' : ''}{dex.pegDeviation.toFixed(2)}%
                        </span>
                        {isStrong && <span className="text-xs">💪</span>}
                        {isWeak && <span className="text-xs">📉</span>}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-800 mb-1">
                      1 {dex.pairToken} = {dex.displayPrice.toFixed(2)} JPYC
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>理論値: {dex.theoreticalPrice.toFixed(2)} JPYC</span>
                      {dex.liquidity > 0 && <span>TVL: {formatNumber(dex.liquidity)} JPYC</span>}
                    </div>
                    {isStrong && (
                      <div className="text-xs text-green-700 font-semibold">
                        ✅ 円高 - 少ないJPYCでUSDC購入可能
                      </div>
                    )}
                    {isWeak && (
                      <div className="text-xs text-red-700 font-semibold">
                        ⚠️ 円安 - 多くのJPYCが必要
                      </div>
                    )}
                    {isNeutral && (
                      <div className="text-xs text-gray-600">
                        ⚖️ ほぼペッグ維持
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 情報行コンポーネント
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 text-sm">{label}:</span>
      <span className="text-gray-800 font-semibold text-sm">{value}</span>
    </div>
  );
}

