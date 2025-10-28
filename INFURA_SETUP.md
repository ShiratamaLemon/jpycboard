# Infura セットアップガイド

無料のパブリックRPCは制限が厳しく、特にPolygonでデータ取得に失敗することがあります。
より安定した動作のため、**Infura（無料プランあり）**の使用を強く推奨します。

## 🚀 Infuraのセットアップ手順（5分で完了）

### 1. アカウント作成

1. https://infura.io/ にアクセス
2. 右上の「Sign Up」をクリック
3. メールアドレスとパスワードを入力して登録
4. メール確認を完了

### 2. プロジェクト作成

1. ダッシュボードにログイン
2. 「Create New API Key」をクリック
3. プロジェクト名を入力（例: "JPYC Dashboard"）
4. Network: **Web3 API (Formerly Ethereum)** を選択
5. 「Create」をクリック

### 3. APIキーを取得

作成したプロジェクトをクリックすると、以下の情報が表示されます：

- **API Key**: `YOUR_API_KEY_HERE`（32文字の英数字）
- **Endpoints**:
  - Ethereum Mainnet: `https://mainnet.infura.io/v3/YOUR_API_KEY`
  - Polygon Mainnet: `https://polygon-mainnet.infura.io/v3/YOUR_API_KEY`
  - Avalanche C-Chain: `https://avalanche-mainnet.infura.io/v3/YOUR_API_KEY`

### 4. プロジェクトに設定

プロジェクトルートに `.env.local` ファイルを作成：

```bash
NEXT_PUBLIC_ETHEREUM_RPC=https://mainnet.infura.io/v3/YOUR_API_KEY
NEXT_PUBLIC_POLYGON_RPC=https://polygon-mainnet.infura.io/v3/YOUR_API_KEY
NEXT_PUBLIC_AVALANCHE_RPC=https://avalanche-mainnet.infura.io/v3/YOUR_API_KEY
```

**重要**: `YOUR_API_KEY` を実際のAPIキーに置き換えてください！

### 5. 開発サーバーを再起動

```bash
# 開発サーバーを停止（Ctrl+C）してから再起動
npm run dev
```

## 📊 Infura無料プランの制限

- **リクエスト数**: 100,000リクエスト/日
- **ブロック範囲**: eth_getLogs で 10,000ブロックまで対応（十分な範囲）
- **レート制限**: 10リクエスト/秒

このダッシュボードでは、通常1回のデータ取得で100〜200リクエスト程度なので、無料プランで十分です。

## 🎯 その他の推奨プロバイダー

### Alchemy（無料プランあり）

1. https://www.alchemy.com/ でアカウント作成
2. アプリを作成してAPIキーを取得
3. エンドポイント例:
   ```
   https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
   https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
   ```

### QuickNode（無料トライアルあり）

1. https://www.quicknode.com/ でアカウント作成
2. エンドポイントを作成
3. HTTPプロバイダーURLをコピーして使用

## 🔍 トラブルシューティング

### APIキーが正しく設定されているか確認

ブラウザのコンソール（F12）で以下を確認：

```
[Ethereum] Connected to network: 1  ← 成功
[Polygon] Connected to network: 137  ← 成功
```

### エラーが出る場合

- `.env.local` ファイルがプロジェクトルートにあることを確認
- ファイル名が正確に `.env.local` であることを確認（先頭のドットを忘れずに）
- APIキーにスペースや改行が含まれていないことを確認
- 開発サーバーを再起動

## 💡 なぜInfuraが必要なのか？

無料のパブリックRPCは多くの人が共有して使用するため：

- レート制限が非常に厳しい（特にPolygon: 10ブロック範囲まで）
- 接続が不安定
- リクエストが拒否されることがある

Infuraなどの専用RPCを使用すると：

- ✅ より広いブロック範囲でデータ取得可能
- ✅ 安定した接続
- ✅ より高速なレスポンス
- ✅ 無料プランでも十分な制限

