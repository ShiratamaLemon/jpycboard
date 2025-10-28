# JPYC Board - リアルタイム流通量ダッシュボード

JPYCトークンの流通状況をリアルタイムで監視できるダッシュボードです。Ethereum、Polygon、Avalanche の3つのブロックチェーンネットワーク上のJPYCトークンの流通量、保有者情報、DEX価格、ペッグ状況を可視化します。

🔗 **完全オンチェーン**: すべてのデータはブロックチェーンRPCとChainlinkオラクルから直接取得  
⚡ **リアルタイム**: 流通量とDEX価格が60秒ごとに自動更新  
📊 **DeFi統合**: Uniswap等のDEXプール自動検出とペッグ監視

## 主な機能

### 📊 マルチチェーン対応
- **Ethereum Mainnet**、**Polygon**、**Avalanche C-Chain** の3チェーンをサポート
- 各チェーンの流通量を並列取得・表示
- チェーン別の比率を円グラフで可視化

### 💰 流通量分析（60秒ごと自動更新）
- **総供給量**: 各チェーンのトークンコントラクトから直接取得
- **運営保有量**: 固定の運営ウォレット残高を取得
- **流通量**: 総供給量 - 運営保有量を自動計算
- **全チェーン合計**: 3チェーンの流通量を集計

### 🏦 DeFi統合分析
- **コントラクト保有者リスト**: JPYCを保有するコントラクト（DEXプール、レンディングプロトコル等）を自動検出
- **コントラクト種別判定**: Uniswap V2/V3、SushiSwap、QuickSwapなどを自動識別
- **保有量ランキング**: トップ20のコントラクト保有者を表示
- **アドレスリンク**: 各コントラクトのエクスプローラーへのリンク

### 💱 DEX価格・ペッグ監視（60秒ごと自動更新）
- **Chainlink USD/JPYオラクル**: Ethereumメインネットから為替レートを取得
  - JPY/USD形式からUSD/JPY形式に自動変換
  - 全チェーンで共有（Fiatレートのため）
- **DEX実効価格**: USDC/JPYCなどの主要DEXプールから価格を取得
  - 表示形式: 「1 USDC = X JPYC」（日本人に馴染み深い形式）
- **ペッグ乖離**: 理論値（Chainlinkレート）との差を計算
- **円高/円安判定**: 
  - プール価格 < 理論値 → 🟢 **円高（JPYC強い）** = 少ないJPYCでUSDC購入可能（有利）
  - プール価格 > 理論値 → 🔴 **円安（JPYC弱い）** = 多くのJPYCが必要（不利）
- **流動性情報**: 各プールのJPYC流動性を表示

### 🔄 自動更新
- **軽量データ（60秒ごと）**: 
  - 総供給量・運営保有量・流通量
  - DEX価格
  - Chainlink USD/JPYレート
  - 各チェーンあたり2回のRPC呼び出しのみ（超高速）
- **重いデータ（手動のみ）**: 
  - コントラクト保有者の検出（Transferイベントスキャン）
  - コントラクト種別判定
- **UI表示**: 次回更新までのカウントダウン、更新履歴

## トークン情報

- **トークンアドレス**: `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29`（全チェーン共通）
- **運営ウォレット**: `0x8549E82239a88f463ab6E55Ad1895b629a00Def3`（全チェーン共通）
- **対応チェーン**: 
  - [Ethereum Mainnet](https://etherscan.io/token/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29)
  - [Polygon (Matic)](https://polygonscan.com/token/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29)
  - [Avalanche C-Chain](https://snowtrace.io/token/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29)

## セットアップ

### 必要要件

- **Node.js** 18.x 以上
- **npm** または **yarn**

### インストール手順

1. **リポジトリをクローン**:
```bash
git clone https://github.com/ShiratamaLemon/jpycboard.git
cd jpycboard
```

または SSH を使用:
```bash
git clone git@github.com:ShiratamaLemon/jpycboard.git
cd jpycboard
```

2. **依存関係をインストール**:
```bash
npm install
```

3. **環境変数を設定（オプション）**:

`.env.local` ファイルを作成（カスタムRPCを使用する場合のみ）:

```bash
# RPC Endpoints（オプション - 指定しない場合は無料RPCを使用）
NEXT_PUBLIC_ETHEREUM_RPC=https://eth.llamarpc.com
NEXT_PUBLIC_POLYGON_RPC=https://polygon-rpc.com
NEXT_PUBLIC_AVALANCHE_RPC=https://api.avax.network/ext/bc/C/rpc
```

**推奨**: より高速で安定した接続のため、商用RPCプロバイダーの使用を推奨：
- [Infura](https://www.infura.io/) - 無料プランで10万リクエスト/日
- [Alchemy](https://www.alchemy.com/) - 無料プランで300M compute units/月
- [QuickNode](https://www.quicknode.com/) - 無料トライアルあり

**例**（Infuraを使用）:
```bash
NEXT_PUBLIC_ETHEREUM_RPC=https://mainnet.infura.io/v3/YOUR_API_KEY
NEXT_PUBLIC_POLYGON_RPC=https://polygon-mainnet.infura.io/v3/YOUR_API_KEY
NEXT_PUBLIC_AVALANCHE_RPC=https://avalanche-mainnet.infura.io/v3/YOUR_API_KEY
```

4. **開発サーバーを起動**:
```bash
npm run dev
```

5. **ブラウザで開く**: http://localhost:3000

### 本番環境ビルド

```bash
npm run build
npm start
```

## 技術スタック

- **フレームワーク**: [Next.js 14](https://nextjs.org/) (App Router)
- **言語**: [TypeScript](https://www.typescriptlang.org/)
- **ブロックチェーン接続**: [ethers.js v6](https://docs.ethers.org/v6/)
- **スタイリング**: [Tailwind CSS](https://tailwindcss.com/)
- **チャート**: [Recharts](https://recharts.org/)
- **オラクル**: [Chainlink Price Feeds](https://chain.link/)

## アーキテクチャ

### データ取得フロー

```
┌─────────────────────────────────────────────────────────────┐
│                     ユーザー操作                              │
├─────────────────────────────────────────────────────────────┤
│  初回ロード / 「全データ再取得」ボタン                          │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 重い処理（1〜2分）                                       │   │
│  │  - Transferイベントスキャン（数千〜数万ブロック）          │   │
│  │  - EOA/CA判定（数十〜数百アドレス）                       │   │
│  │  - コントラクト種別判定                                   │   │
│  │  - 総供給量・運営保有量取得                               │   │
│  │  - DEX価格取得                                          │   │
│  │  - Chainlink USD/JPYレート取得                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 60秒後... 自動ポーリング（数秒）                          │   │
│  │  ✅ Chainlink USD/JPYレート取得（1回のRPC）              │   │
│  │  ✅ 総供給量取得（各チェーン1回）                          │   │
│  │  ✅ 運営保有量取得（各チェーン1回）                        │   │
│  │  ✅ 流通量再計算（計算のみ）                              │   │
│  │  ✅ DEX価格取得（既知のプールのみ）                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                         ↓                                    │
│  60秒後... ← 繰り返し                                        │
└─────────────────────────────────────────────────────────────┘
```

### データ取得ロジック詳細

#### 1. 総供給量・運営保有量・流通量（60秒ごと自動更新）
```typescript
// 各チェーンで実行
const totalSupply = await contract.totalSupply();
const operatingBalance = await contract.balanceOf(OPERATING_WALLET);
const circulatingSupply = totalSupply - operatingBalance;
```
- **RPC呼び出し数**: 各チェーン2回のみ（超軽量）
- **処理時間**: 数秒

#### 2. コントラクト保有者検出（手動更新のみ）
```typescript
// Transferイベントをスキャン
const events = await contract.queryFilter('Transfer', fromBlock, toBlock);
// コントラクトアドレスを抽出
const isContract = (await provider.getCode(address)) !== '0x';
// 残高を取得
const balance = await contract.balanceOf(contractAddress);
```
- **スキャン期間**: 
  - Ethereum: 過去50,000ブロック（約7日間）
  - Polygon: 過去5,000ブロック（約3時間）
  - Avalanche: 過去30,000ブロック（約12時間）
- **処理時間**: 数十秒〜1分

#### 3. DEX価格取得（60秒ごと自動更新）

**Uniswap V2**:
```typescript
const { reserve0, reserve1 } = await poolContract.getReserves();
const price = reserve1 / reserve0; // JPYC per USDC
```

**Uniswap V3**:
```typescript
const { sqrtPriceX96 } = await poolContract.slot0();
const price = (sqrtPriceX96 / 2^96)^2 * (10^(decimals0 - decimals1));
```

#### 4. Chainlink USD/JPYオラクル（60秒ごと自動更新）
```typescript
// Ethereumメインネットから取得（1回のみ）
const jpyUsdRate = await oracleContract.latestAnswer();
const usdJpyRate = 1 / jpyUsdRate; // JPY/USD → USD/JPY変換
// 全チェーンで共有
```
- **オラクルアドレス**: `0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3`
- **フォールバック**: 取得失敗時は150 JPY/USDを使用

### ファイル構成

```
jpycboard/
├── src/
│   ├── app/
│   │   ├── page.tsx          # メインダッシュボードUI
│   │   ├── layout.tsx        # レイアウトコンポーネント
│   │   └── globals.css       # グローバルスタイル
│   ├── lib/
│   │   ├── explorerApi.ts    # RPC + Chainlinkロジック（メイン）
│   │   └── blockchain.ts     # 旧実装（参考用）
│   └── types/
│       └── index.ts          # TypeScript型定義
├── public/                   # 静的ファイル
├── package.json              # 依存関係管理
├── tsconfig.json             # TypeScript設定
├── next.config.js            # Next.js設定
├── tailwind.config.js        # Tailwind CSS設定
├── .gitignore                # Git除外設定
├── README.md                 # このファイル
└── INFURA_SETUP.md           # Infuraセットアップガイド（参考用）
```

## トラブルシューティング

### データ取得に失敗する場合

**症状**: 一部またはすべてのチェーンで「データ取得に失敗しました」と表示される

**確認手順**:
1. **ブラウザの開発者コンソールを確認**（F12キー）
   - `[チェーン名]` プレフィックス付きのエラーログを確認
   - RPC接続エラーの有無を確認

2. **インターネット接続を確認**
   - ブロックチェーンRPCへの接続が必要
   - ファイアウォールやVPNが妨げていないか確認

3. **RPCプロバイダーを変更**
   - 無料RPCは時々制限に達する可能性があります
   - `.env.local` でカスタムRPCを設定
   - 商用プロバイダー（Infura、Alchemy等）の使用を推奨

### Polygonで「Too many requests」エラーが出る場合

**症状**:
```
"Too many requests, reason: call rate limit exhausted, retry in 10s"
```

**原因**:
- Polygonの公開RPC（`polygon-rpc.com`）は特に厳しいレート制限があります
- DEX価格取得時に複数のRPC呼び出しを行うため制限に達しやすい

**既に実装済みの対策**:
- Polygonのみ2秒の遅延を設定（他のチェーンは0.5秒）
- 自動ポーリング時も同様の遅延を適用

**推奨解決策**:

1. **商用RPCプロバイダーを使用**（最も効果的）:
```bash
# .env.local
NEXT_PUBLIC_POLYGON_RPC=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
# または
NEXT_PUBLIC_POLYGON_RPC=https://polygon-mainnet.infura.io/v3/YOUR_API_KEY
```

2. **遅延をさらに増やす**:
   - `src/lib/explorerApi.ts` の `getPriceDelay` 関数を編集
   - Polygonの遅延を3秒や5秒に増やす

### データが古い場合

**コントラクト保有者リスト**は手動更新のみです。

**スキャン期間外のコントラクト**（最近Transferイベントがないもの）は検出されません：
- Ethereum: 過去7日間のみ
- Polygon: 過去3時間のみ
- Avalanche: 過去12時間のみ

**解決策**:
- 「全データ再取得」ボタンをクリックして最新データを取得
- 重要なコントラクトは `src/lib/explorerApi.ts` の `KNOWN_V4_POOLMANAGERS` に手動追加可能

### 起動が遅い場合

**初回起動時**:
- Next.jsのビルドとTypeScriptコンパイルが実行されます
- 通常30秒〜1分程度

**データ取得が遅い場合**:
- 初回の「全データ再取得」は1〜2分かかります（Transferイベントスキャン）
- 60秒ごとの自動更新は数秒で完了します（軽量処理のみ）

**改善方法**:
- 商用RPCプロバイダーを使用（Infura、Alchemy等）
- `src/lib/explorerApi.ts` の `scanBlocks` を減らす（スキャン期間短縮）

## 制限事項と改善案

### 現在の制限事項

1. **コントラクト検出の時間範囲制限**:
   - スキャン期間内にTransferイベントがないコントラクトは検出されません
   - 対策: 重要なコントラクトを手動リストに追加可能

2. **運営ウォレット固定**:
   - 運営ウォレットは1つのアドレスに固定（`0x8549E82239a88f463ab6E55Ad1895b629a00Def3`）
   - 複数の運営ウォレットが存在する場合は追加実装が必要

3. **RPC レート制限**:
   - 無料RPCは制限に達する可能性があります（特にPolygon）
   - 対策: 商用RPCプロバイダーの使用を推奨

4. **DEX価格計算の制限**:
   - Uniswap V2/V3のみサポート（V4は部分的）
   - 複雑な流動性プール（Curve、Balancer等）は未対応
   - 単純なスポット価格のみ（スリッページ未考慮）

5. **Chainlink オラクルの制限**:
   - JPY/USDレートはEthereumメインネットからのみ取得
   - オラクル取得失敗時は固定レート（150 JPY/USD）を使用
   - 全チェーンで同じレートを共有（Fiatレートのため問題なし）

### 今後の改善案

- [x] ~~データキャッシング機能（定期的な自動更新）~~ → **実装済み（60秒ごとの自動ポーリング）**
- [ ] 時系列での流通量推移グラフ
- [ ] ペッグ乖離の履歴チャート
- [ ] 特定ホルダーの追跡・通知機能
- [ ] 流通量の大幅変動時のアラート
- [ ] ポーリング間隔のカスタマイズ（30秒/60秒/120秒）
- [ ] 多言語対応（英語、中国語等）
- [ ] モバイルレスポンシブの最適化
- [ ] ダークモード対応
- [ ] より多くのDEX/DeFiプロトコル対応（Curve、Balancer等）

## パフォーマンス

### 軽量自動更新（60秒ごと）
- **RPC呼び出し数**: 
  - Chainlink オラクル: 1回
  - 各チェーンの総供給量: 3回
  - 各チェーンの運営保有量: 3回
  - DEX価格取得: プールごと数回
  - **合計**: 約10〜20回（並列実行）
- **処理時間**: 通常**2〜5秒**

### 重い処理（手動更新のみ）
- **RPC呼び出し数**: 
  - Transferイベントスキャン: チェーンごと数十〜数百回
  - コントラクト判定: アドレスごと1回
  - 残高取得: コントラクトごと1回
  - **合計**: 数百〜数千回
- **処理時間**: **30秒〜2分**

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 貢献

プルリクエストやIssueは歓迎します！

## 開発者

このプロジェクトはJPYCトークンの流通状況を透明化し、DeFiユーザーに有用な情報を提供するために開発されました。

## リンク

- **GitHub**: https://github.com/ShiratamaLemon/jpycboard
- **JPYC公式サイト**: https://jpyc.jp/
- **Chainlink Price Feeds**: https://data.chain.link/
- **ethers.js**: https://docs.ethers.org/
