# JPYC Board - リアルタイム流通量ダッシュボード

JPYCトークンの流通状況をリアルタイムで監視できるダッシュボードです。  
Ethereum、Polygon、Avalanche の3つのブロックチェーンネットワーク上のJPYCトークンの流通量、保有者情報、DEX価格、ペッグ状況を可視化します。

🔗 **完全オンチェーン**: すべてのデータはブロックチェーンRPCとChainlinkオラクルから直接取得  
⚡ **リアルタイム**: 流通量とDEX価格が180秒（3分）ごとに自動更新  
📊 **DeFi統合**: Uniswap V4・Kyberswap等のDEXプール自動検出とペッグ監視

---

## 主な機能

### 📊 マルチチェーン対応
- **Ethereum Mainnet**、**Polygon**、**Avalanche C-Chain** の3チェーンに対応
- 各チェーンの流通量を並列取得・表示
- チェーン別の比率を円グラフで可視化

### 💰 流通量分析（180秒ごと自動更新）
- **総供給量**: 各チェーンのトークンコントラクトから直接取得
- **運営保有量**: 運営ウォレット残高をリアルタイムで取得
- **流通量**: 総供給量 - 運営保有量を自動計算
- **全チェーン合計**: 3チェーンの流通量を集計して表示

### 🏦 DeFi統合分析（手動更新）
- **コントラクト保有者リスト**: JPYCを保有するDEXプール、レンディングプロトコル等を自動検出
- **コントラクト種別判定**: Uniswap V2/V3/V4、Kyberswapなどを自動識別
- **保有量ランキング**: トップ保有コントラクトを表示
- **エクスプローラーリンク**: 各コントラクトの詳細情報へ直接アクセス

### 💱 DEX価格・ペッグ監視（180秒ごと自動更新）
- **Chainlink USD/JPYオラクル**: Ethereumから為替レートを取得（全チェーン共有）
- **DEX実効価格**: USDC/JPYC、USDT0/JPYC等の主要プールから価格を取得
  - 表示形式: 「1 USDC = X JPYC」（日本人に馴染み深い形式）
- **ペッグ乖離**: 理論値（Chainlinkレート）との差を自動計算
- **円高/円安判定**: 
  - 🟢 **円高（JPYC強い）** = 少ないJPYCでUSDC購入可能
  - 🔴 **円安（JPYC弱い）** = 多くのJPYCが必要
- **TVL（流動性）**: 各プールのTotal Value Lockedを表示

### 🔄 自動更新
- **軽量データ（180秒ごと）**: 総供給量・運営保有量・流通量・DEX価格・オラクルレート
- **重いデータ（手動のみ）**: コントラクト保有者の検出・種別判定

---

## 対応DEX

| チェーン | DEX | ペア |
|---------|-----|------|
| Ethereum | Uniswap V4 | USDC/JPYC |
| Polygon | Uniswap V4 | USDC/JPYC |
| Polygon | Kyberswap | USDT0/JPYC |
| Avalanche | Uniswap V4 | USDC/JPYC |

---

## トークン情報

- **トークンアドレス**: `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29`（全チェーン共通）
- **運営ウォレット**: `0x8549E82239a88f463ab6E55Ad1895b629a00Def3`（全チェーン共通）
- **対応チェーン**: 
  - [Ethereum Mainnet](https://etherscan.io/token/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29)
  - [Polygon (Matic)](https://polygonscan.com/token/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29)
  - [Avalanche C-Chain](https://snowtrace.io/token/0xe7c3d8c9a439fede00d2600032d5db0be71c3c29)

---

## 技術スタック

- **フレームワーク**: Next.js 14 (React, TypeScript)
- **ブロックチェーン**: ethers.js v6
- **オラクル**: Chainlink Price Feeds
- **スタイリング**: Tailwind CSS
- **チャート**: Recharts

---

## データソース

すべてのデータはブロックチェーンから直接取得しています：

1. **流通量データ**: 各チェーンのJPYCトークンコントラクト
2. **DEX価格**: Uniswap V4、Kyberswapのオンチェーンプール
3. **為替レート**: Chainlink JPY/USDオラクル（Ethereum）
4. **コントラクト検出**: Transferイベントログのスキャン

---

## ライセンス

MIT License

---

## 開発者情報

このプロジェクトはJPYCトークンの流通状況を透明化し、DeFiユーザーに有用な情報を提供するために開発されました。

- **GitHub**: https://github.com/ShiratamaLemon/jpycboard
- **JPYC公式サイト**: https://jpyc.jp/
