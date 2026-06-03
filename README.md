# Soccer AI Formation - iOS App

サッカーの試合フォーメーション画像をアップロードして、AI が勝敗予測を行うネイティブ iOS アプリです。

## 機能

- **フォーメーション画像アップロード**: ホーム/アウェイチームのフォーメーション画像をカメラまたはギャラリーから選択
- **AI 解析**: Gemini API を使用してフォーメーション・選手名を自動抽出
- **情報確認・編集**: ユーザーが手入力でチーム情報を確認・修正
- **試合予想**: AI が勝敗確率（勝ち/引き分け/負け）と予想スコア、戦術分析を生成
- **広告統合**: 決定後と結果表示の間にインタースティシャル広告を表示

## 技術スタック

- **フレームワーク**: Expo + React Native
- **言語**: TypeScript
- **API**: Google Gemini 2.0 Flash
- **画像処理**: expo-image-picker, expo-camera, expo-file-system

## セットアップ

### 必要な環境

- Node.js 18+
- npm または yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator または Expo Go アプリ

### インストール

1. プロジェクトディレクトリに移動
```bash
cd soccer-ai-formation
```

2. 依存パッケージをインストール
```bash
npm install
```

3. Gemini API キーを設定
```bash
# .env ファイルを編集
EXPO_PUBLIC_GEMINI_API_KEY=your_actual_gemini_api_key
```

### 開発サーバーの起動

```bash
npm start
```

#### iOS Simulator で実行
```bash
npm run ios
```

#### Expo Go で実行
- Expo Go アプリをインストール（iOS App Store）
- ターミナルに表示される QR コードをスキャン

## 使い方

1. **ホーム画面**: ホーム/アウェイチームのフォーメーション画像をアップロード
2. **確認画面**: チーム名、フォーメーション、選手名を確認・修正
3. **決定**: 「決定」ボタンをタップ
4. **広告表示**: インタースティシャル広告が表示（3秒間）
5. **結果表示**: 試合展望、勝敗予測（確率とスコア）、戦術分析を表示

## ファイル構造

```
soccer-ai-formation/
├── App.tsx                          # メインアプリケーション
├── app.json                         # Expo 設定
├── package.json                     # 依存パッケージ
├── .env                            # 環境変数（Gemini API キー）
├── .env.example                    # 環境変数テンプレート
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx          # ホーム画面（画像アップロード）
│   │   ├── ConfirmationScreen.tsx  # 確認画面（情報編集）
│   │   └── PredictionScreen.tsx    # 結果画面（試合予想表示）
│   ├── services/
│   │   └── geminiService.ts        # Gemini API 統合
│   ├── components/
│   │   └── AdPlaceholder.tsx       # 広告プレースホルダー
│   ├── utils/
│   │   └── imagePicker.ts          # 画像ピッカー・カメラ機能
│   └── types/
│       └── index.ts                # TypeScript 型定義
└── assets/                         # アプリアイコン・スプラッシュ画像
```

## Gemini API キーの取得

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. Generative AI API を有効化
4. API キーを生成
5. `.env` ファイルに設定

## AdMob 統合

AdMob 広告は `react-native-google-mobile-ads` で実装されています。

GitHub Actions / EAS Build では、次の Secrets を設定してください:

1. `ADMOB_PUBLISHER_ID`: `pub-5840457424714744`
2. `ADMOB_INTERSTITIAL_ID`: `ca-app-pub-5840457424714744/2994711458`
3. `ADMOB_BANNER_ID`: バナー広告を使う場合の広告ユニット ID

iOS の AdMob App ID は `app.json` の `react-native-google-mobile-ads` 設定に入れます。
本番広告を有効にする場合は、Google 公式テスト App ID を AdMob 管理画面の `ca-app-pub-...~...` 形式の iOS App ID に置き換えてください。

## デザイン

- **基調色**: SAMURAI BLUE (#003F8F)
- **レイアウト**: モバイルファースト（iOS 最適化）
- **フォント**: システムデフォルト

## トラブルシューティング

### 画像ピッカーが動作しない
- iOS シミュレータでは実際のカメラが使用できません
- 実機で テストするか、ギャラリーから画像を選択してください

### Gemini API エラー
- API キーが正しく設定されているか確認
- API キーの使用制限を確認
- ネットワーク接続を確認

### 画像解析に時間がかかる
- Gemini API の応答時間は 10-30 秒の場合があります
- ネットワーク接続を確認

## ライセンス

MIT

## サポート

問題が発生した場合は、GitHub Issues で報告してください。
