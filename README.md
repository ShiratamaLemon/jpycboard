# JPYC Distribution Dashboard

JPYC トークンの流通状況をリアルタイムで確認できるダッシュボードアプリケーションです。Ethereum、Polygon、Avalanche の3つのブロックチェーンネットワークにデプロイされたJPYCトークンの流通量、ホルダー情報、トランザクション数などを可視化します。

## 特徴

- 📊 **マルチチェーン対応**: Ethereum、Polygon、Avalanche の3チェーンに対応
- 💰 **流通量分析**: 総供給量とユーザー間流通量を自動計算
- 👥 **ホルダー追跡**: EOA（外部所有アカウント）のみを抽出し、最大保有者を運営ウォレットとして識別
- 📈 **可視化**: チャートで各チェーンの流通量比率を表示
- 🔄 **リアルタイム更新**: ボタン一つでデータを最新化
- 🏦 **DeFi統合分析**: 
  - Uniswap V2/V3、SushiSwap、QuickSwapなどのDEXプール自動検出
  - コントラクト種類の自動判定（DEX、レンディング、ブリッジ等）
  - コントラクトごとの保有量と保有比率を表示
- 💱 **リアルタイム監視（60秒ごと自動更新）**: 
  - **流通量**: 総供給量と運営保有量を自動更新し、流通量を再計算
  - **Chainlink USD/JPYオラクル統合**: EthereumメインネットからリアルタイムのJPY/USD為替レートを取得し、USD/JPYに変換して理論値として使用
  - 取得したFiatレートは全チェーン（Ethereum/Polygon/Avalanche）で共有
  - USDC/JPYCなどの主要DEXプールの実効価格を取得
  - 理論値との乖離（ペッグ偏差）を計算・表示
  - **円高/円安判定**: 
    - プール価格 < 理論値 → 円高（少ないJPYCでUSDC購入可能、有利）
    - プール価格 > 理論値 → 円安（多くのJPYCが必要、不利）
  - 流動性情報を表示
  - **自動ポーリング**: 流通量、DEX価格、オラクルレートは60秒ごとに自動更新（ホルダー情報は手動更新のみ）

## トークン情報

- **トークンアドレス**: `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29`
- **対応チェーン**: 
  - Ethereum Mainnet
  - Polygon (Matic)
  - Avalanche C-Chain

## セットアップ

### 必要要件

- Node.js 18.x 以上
- npm または yarn

### インストール手順

1. リポジトリをクローン:
```bash
git clone <repository-url>
cd jpyc-dashboard
```

2. 依存関係をインストール:
```bash
npm install
# または
yarn install
```

3. 環境変数を設定：

**重要**: Etherscan API V2キーが必要です（1つのキーで全チェーンに対応）

`.env.local` ファイルを作成：

```bash
# Etherscan API V2 Key（必須）
# 1つのキーでEthereum, Polygon, Avalanche など60+チェーンに対応
NEXT_PUBLIC_ETHERSCAN_API_KEY=your_etherscan_api_key

# RPC Endpoints（オプション、デフォルトで無料RPCを使用）
NEXT_PUBLIC_ETHEREUM_RPC=https://eth.llamarpc.com
NEXT_PUBLIC_POLYGON_RPC=https://polygon-rpc.com
NEXT_PUBLIC_AVALANCHE_RPC=https://1rpc.io/avax/c
```

**Etherscan API V2 キーの取得方法：**
1. https://etherscan.io/myapikey でアカウント作成
2. 新しいAPIキーを作成
3. このキー1つで全チェーンにアクセス可能（無料プラン: 5リクエスト/秒）

**注意**: 2025年8月15日以降、Etherscan API V1は廃止されました。V2キーを使用してください。

4. 開発サーバーを起動:
```bash
npm run dev
# または
yarn dev
```

5. ブラウザで `http://localhost:3000` を開く

## 本番環境ビルド

```bash
npm run build
npm start
# または
yarn build
yarn start
```

## アーキテクチャ

### 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **ブロックチェーン接続**: ethers.js v6
- **スタイリング**: Tailwind CSS
- **チャート**: Recharts

### データ取得ロジック（RPC + Chainlinkオラクル統合）

**🔗 完全RPC/オンチェーンベースに移行！**

Explorer APIの制限により、完全にRPCとChainlinkオラクルを使用した方式に変更しました：

1. **総供給量取得**: RPCから直接取得（高速）
2. **運営ウォレット残高取得**: 固定の運営ウォレットアドレス（`0x8549E82239a88f463ab6E55Ad1895b629a00Def3`）から残高を取得
3. **流通量計算**: ユーザー間流通量 = 総供給量 - 運営保有量
4. **コントラクト保有者検出**: 
   - Transferイベントをスキャン（過去7日〜3時間分、チェーンにより調整）
   - コントラクトアドレスを抽出（`getCode()`で判定）
   - 各コントラクトの残高を取得
   - トップ20を保有量順に表示
5. **コントラクト種別判定**:
   - Uniswap V2/V3 ABIをチェックしてDEXプールを識別
   - 既知のUniswap V4 PoolManagerも検出
6. **DEX価格取得**:
   - V2プール: `getReserves()`から直接計算
   - V3プール: `slot0()`の`sqrtPriceX96`から計算
7. **Chainlink USD/JPYオラクル統合**:
   - EthereumメインネットのChainlink JPY/USD Price Feed（`0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3`）からリアルタイムレートを取得
   - JPY/USD（1 JPY = X USD）形式から USD/JPY（1 USD = X JPY）に自動変換
   - このレートを理論値として使用し、DEXプールの実効価格と比較
   - ペッグ乖離を計算し、JPYCの強弱を判定
   - **全チェーンで共有**: Fiatレートなので、一度取得したレートを全チェーン（Ethereum/Polygon/Avalanche）で共有
8. **自動ポーリング（軽量更新）**:
   - **総供給量**と**運営保有量**を60秒ごとに取得し、**流通量**を再計算
   - **DEX価格**とChainlinkオラクルレートも同時に自動更新
   - 各チェーンあたりたった2回の追加RPC呼び出し（`totalSupply()`, `balanceOf()`）
   - 重い処理（ホルダー情報、コントラクト検出）は手動更新のみ
   - UIに次回更新までのカウントダウンを表示
   - 更新履歴（流通量・価格更新時刻、ホルダー情報更新時刻）を分けて表示

**メリット：**
- ✅ 完全分散化（外部APIに依存しない）
- ✅ 透明性が高い（すべてオンチェーンデータ）
- ✅ Chainlinkオラクルによる正確な為替レート
- ✅ 高速（初回: 数秒〜数十秒、自動更新: 数秒）
- ✅ **リアルタイムダッシュボード**: 流通量とDEX価格が60秒ごとに自動更新
- ✅ **軽量更新**: 各チェーンあたり2回のRPC呼び出しのみ（`totalSupply()`, `balanceOf()`）
- ⚠️ 注意: スキャン期間内にTransferイベントがないコントラクトは検出されない

### ファイル構成

```
jpyc-dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx          # メインダッシュボードページ
│   │   ├── layout.tsx        # レイアウトコンポーネント
│   │   └── globals.css       # グローバルスタイル
│   ├── lib/
│   │   ├── explorerApi.ts    # Explorer API + RPCハイブリッドロジック（新）
│   │   └── blockchain.ts     # オンチェーン直接アクセスロジック（旧・参考用）
│   └── types/
│       └── index.ts          # TypeScript型定義
├── public/                   # 静的ファイル
├── package.json              # 依存関係管理
├── tsconfig.json             # TypeScript設定
├── next.config.js            # Next.js設定
├── tailwind.config.js        # Tailwind CSS設定
├── README.md                 # プロジェクト説明（このファイル）
└── INFURA_SETUP.md           # Infuraセットアップガイド（参考用）
```

## トラブルシューティング

### 一部のチェーンしか表示されない場合

ダッシュボードで一部のチェーンのみが表示される場合、以下を確認してください：

1. **ブラウザの開発者コンソールを確認**
   - F12キーを押して開発者ツールを開く
   - コンソールタブでエラーメッセージを確認
   - `[チェーン名]` というプレフィックス付きのログで詳細を確認

2. **RPC接続の問題**
   - 現在のアプローチは完全にRPCベースです
   - 無料RPCは時々制限に達する可能性があります
   - **解決策**: 
     - Infura、Alchemy、QuickNodeなどの商用RPCプロバイダーに登録
     - カスタムRPC URLを `.env.local` に設定

3. **ネットワーク接続**
   - インターネット接続を確認
   - ファイアウォールやVPNがブロックチェーンRPC接続を妨げていないか確認

4. **チェーン検証**
   - エクスプローラーリンクをクリックして、実際にトークンがそのチェーンに存在するか確認
   - Ethereum: https://etherscan.io/token/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29
   - Polygon: https://polygonscan.com/token/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29
   - Avalanche: https://snowtrace.io/token/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29

### データ取得に時間がかかる場合

RPC/オンチェーンアプローチでは、通常**数秒〜数十秒**で完了します。

もし遅い場合：
- ネットワーク接続を確認
- ブラウザのコンソール（F12）でエラーを確認
- 商用RPCプロバイダー（Infura、Alchemy等）の使用を検討

### Polygonで「Too many requests」エラーが出る場合

Polygonの無料RPC（`polygon-rpc.com`）は特に厳しいレート制限があります。

**症状**:
```
"Too many requests, reason: call rate limit exhausted, retry in 10s"
```

**原因**:
- Polygonの公開RPCは他のチェーン（Ethereum/Avalanche）より遥かに制限が厳しい
- DEX価格取得時に複数のRPC呼び出しを行うため制限に達しやすい

**対策**（既に実装済み）:
- Polygonのみ2秒の遅延を設定（他のチェーンは0.5秒）
- 自動ポーリング時も同様の遅延を適用

**推奨解決策**:
1. **商用RPCプロバイダーを使用**（最も効果的）:
   - [Alchemy](https://www.alchemy.com/) - 無料プランで300M compute units/月
   - [Infura](https://www.infura.io/) - 無料プランで10万リクエスト/日
   - [QuickNode](https://www.quicknode.com/) - 無料トライアルあり
   
2. **.env.localでPolygonのRPCを変更**:
   ```bash
   NEXT_PUBLIC_POLYGON_RPC=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
   # または
   NEXT_PUBLIC_POLYGON_RPC=https://polygon-mainnet.infura.io/v3/YOUR_API_KEY
   ```

3. **遅延をさらに増やす**（`src/lib/explorerApi.ts`の`getPriceDelay`関数で調整可能）

## 制限事項と今後の改善点

### 現在の制限事項

1. **コントラクト検出の時間範囲**: 
   - Ethereum: 過去7日間のTransferイベントのみスキャン
   - Polygon: 過去3時間分のみ（高頻度トランザクションのため短縮）
   - Avalanche: 過去12時間分のみ
   - **影響**: スキャン期間内にTransferイベントがないコントラクトは検出されません
   - **解決策**: 重要なコントラクトは手動で `KNOWN_V4_POOLMANAGERS` リストに追加可能

2. **運営ウォレット固定**: 
   - 運営ウォレットアドレスは固定値（`0x8549E82239a88f463ab6E55Ad1895b629a00Def3`）
   - 運営が複数ウォレットを使用している場合、それらは検出されません

3. **RPC レート制限**:
   - 無料RPCは時々制限に達する可能性があります
   - **特にPolygonは厳しい**: `polygon-rpc.com`は他のチェーンより遥かに制限が厳しい
     - 対策: Polygonのみ2秒の遅延を設定（Ethereum/Avalancheは0.5秒）
   - 解決策: Infura、Alchemy、QuickNodeなどの商用RPCプロバイダーを推奨

4. **Chainlink JPY/USD オラクル**:
   - Ethereumメインネットから一度だけ取得（JPY/USD形式、USD/JPYに自動変換）
   - 取得したFiatレートを全チェーン（Ethereum/Polygon/Avalanche）で共有
   - オラクル取得失敗時はフォールバックとして固定レート（150 JPY/USD）を使用

5. **DEX価格計算の制限**:
   - V2/V3プールのみサポート（V4は部分的）
   - 複雑な流動性プール（Curve等）は未対応
   - 価格計算は単純なスポット価格（スリッページ未考慮）

### 改善案

- [x] ~~データキャッシング機能（定期的な自動更新）~~ → **実装済み（90秒ごとの自動ポーリング）**
- [ ] 時系列での流通量推移グラフ
- [ ] 特定ホルダーの追跡機能
- [ ] 多言語対応（英語など）
- [ ] 流通量の大幅な変動時の通知機能
- [ ] 履歴データ（過去のペッグ乖離推移）のチャート表示
- [ ] ポーリング間隔のカスタマイズ機能
- [ ] モバイルレスポンシブの最適化
- [ ] ダークモード対応

## ライセンス

MIT

## 開発者

このプロジェクトはJPYCトークンの流通状況を透明化するために開発されました。

