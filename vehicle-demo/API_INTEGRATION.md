# AI Route API 統合ガイド

## 📋 概要

このプロジェクトは **API説明書 v1.0** に基づいた車両ルート計算 API を実装しています。
HUD パネルで出発地と目的地を選択すると、自動的に最適なルートを計算し、詳細情報を表示します。

---

## 🏗️ アーキテクチャ

```
src/
├── types/
│   └── routeAPI.ts           # API型定義・定数・ヘルパー関数
├── api/
│   └── mockRouteAPI.ts       # モックAPI実装（伪数据生成器）
├── examples/
│   └── routeAPIExamples.ts   # 使用例とテストコード
└── components/
    └── cityrun/
        └── HUDPanel.tsx      # UI統合（ドロップダウン選択）
```

---

## 📝 API 仕様

### エンドポイント

```
POST /api/ai_route
```

### リクエスト形式

```json
{
  "id": "20251114-1",
  "start_id": "B",
  "end_id": "C"
}
```

### レスポンス形式

```json
{
  "id": "20251114-1",
  "timestamp": 1731571200,
  "nodes": [
    {
      "id": "node_001",
      "coordinates": { "lat": 35.0015, "lng": 135.7583 },
      "node_type": "station"
    }
  ],
  "edges": [
    {
      "seq": 1,
      "from": "node_001",
      "to": "node_002",
      "speed_limit": 40,
      "type": "road",
      "mode": 1,
      "length": 2500,
      "cost": 225000
    }
  ]
}
```

---

## 🚗 車両モード定義

| ID | 将棋駒 | モード名 | タイプ | 機能 |
|----|-------|---------|--------|------|
| 1 | 金将 | 通常運転モード | NORMAL | 前進 |
| 2 | 香車 | 高速モード | HIGHWAY | 直線移動・速度優先 |
| 3 | 桂馬 | ドローンモード | DRONE | 短距離飛行・段差や障害物越え |
| 4 | 飛車 | 長距離飛行モード | LONG_FLIGHT | 都市間移動 |
| 5 | 歩兵 | 追従モード | FOLLOW | 他車を自動追尾 |
| 6 | 王将 | 駐車モード | PARK | 駐車 |

---

## 📍 登録済みロケーション

| ID | 名称 | 座標 |
|----|------|------|
| A | 東京駅 | (35.6812, 139.7671) |
| B | 京都駅 | (35.0015, 135.7583) |
| C | 清水寺 | (34.9948, 135.7850) |
| D | 伏見稲荷大社 | (34.9671, 135.7726) |
| E | 金閣寺 | (35.0394, 135.7292) |

---

## 💻 使用方法

### 1. 基本的なルート取得

```typescript
import { getRoute } from '../api/mockRouteAPI';

// 京都駅 → 清水寺
const route = await getRoute('B', 'C');

console.log(`距離: ${route.edges.reduce((sum, e) => sum + e.length, 0)}m`);
console.log(`経路数: ${route.edges.length}`);
```

### 2. ヘルパー関数の使用

```typescript
import { 
  calculateTotalDistance, 
  calculateTotalTime,
  formatDistance,
  formatTime 
} from '../types/routeAPI';

const route = await getRoute('B', 'C');

const distance = calculateTotalDistance(route.edges);  // メートル
const time = calculateTotalTime(route.edges);          // 分

console.log(formatDistance(distance));  // "2.5km"
console.log(formatTime(time));          // "5分"
```

### 3. モード情報の取得

```typescript
import { getModeById } from '../types/routeAPI';

const edge = route.edges[0];
const mode = getModeById(edge.mode);

console.log(`${mode.name} (${mode.piece})`);  // "通常運転モード (金将)"
console.log(mode.function);                   // "前進"
```

### 4. HUD パネルでの統合

HUD パネルは自動的に以下を実行します：

1. **停止中**: 
   - 出発地・目的地をドロップダウンで選択
   - 選択時に自動的にルートを計算
   - 距離・予想時間・経路数をプレビュー表示

2. **走行中**:
   - リアルタイムで現在のモード（将棋駒）を表示
   - 総距離と予想時間を表示
   - 進行状況をプログレスバーで表示

---

## 🧪 テスト・デバッグ

### ブラウザコンソールでテスト

開発サーバーを起動後、ブラウザのコンソールで以下を実行：

```javascript
// 全ての例を実行
window.routeAPIExamples.runAllExamples()

// 個別の例を実行
window.routeAPIExamples.example1_BasicRoute()
window.routeAPIExamples.example4_LongDistanceRoute()
```

### サンプルルート取得

```typescript
import { getKyotoSampleRoute, getLongDistanceRoute } from '../api/mockRouteAPI';

// 京都エリア内（京都駅 → 清水寺）
const kyotoRoute = await getKyotoSampleRoute();

// 長距離（東京駅 → 京都駅）
const longRoute = await getLongDistanceRoute();
```

---

## 📊 データフロー

```
ユーザー操作 (HUDPanel)
    ↓
出発地・目的地選択
    ↓
getRoute(startId, endId) 呼び出し
    ↓
モックAPI: ルート生成
    - ノード生成（座標補間）
    - エッジ生成（距離・モード決定）
    - ハバサイン公式で実距離計算
    ↓
RouteResponse 返却
    ↓
HUDPanel で表示
    - 距離: formatDistance()
    - 時間: formatTime()
    - モード: getModeById()
```

---

## 🔧 カスタマイズ

### 新しいロケーションを追加

`src/types/routeAPI.ts` の `LOCATIONS` 配列に追加：

```typescript
export const LOCATIONS: Location[] = [
  // 既存のロケーション...
  {
    id: 'F',
    name: '銀閣寺',
    coordinates: { lat: 35.0269, lng: 135.7983 }
  }
];
```

### モードの挙動をカスタマイズ

`src/api/mockRouteAPI.ts` の以下の関数を編集：

- `determineModeByRoadType()`: 道路タイプ別のモード決定ロジック
- `getSpeedLimit()`: モード別の速度設定
- `calculateCost()`: 移動時間の計算式

---

## 📈 API レスポンス例

### 京都駅 → 清水寺（短距離）

```json
{
  "id": "20251114-123",
  "timestamp": 1731571200,
  "nodes": [
    {
      "id": "node_001",
      "coordinates": { "lat": 35.0015, "lng": 135.7583 },
      "node_type": "station"
    },
    {
      "id": "node_002",
      "coordinates": { "lat": 34.9948, "lng": 135.7850 },
      "node_type": "station"
    }
  ],
  "edges": [
    {
      "seq": 1,
      "from": "node_001",
      "to": "node_002",
      "speed_limit": 40,
      "type": "road",
      "mode": 1,
      "length": 2450,
      "cost": 220500
    }
  ]
}
```

**計算結果:**
- 距離: 2.5 km
- 時間: 4 分
- モード: 通常運転モード (金将)

### 東京駅 → 京都駅（長距離）

```json
{
  "id": "20251114-456",
  "timestamp": 1731571200,
  "nodes": [
    { "id": "node_001", "coordinates": {...}, "node_type": "station" },
    { "id": "node_002", "coordinates": {...}, "node_type": "intersection" },
    { "id": "node_003", "coordinates": {...}, "node_type": "airport" },
    { "id": "node_004", "coordinates": {...}, "node_type": "intersection" },
    { "id": "node_005", "coordinates": {...}, "node_type": "station" }
  ],
  "edges": [
    {
      "seq": 1,
      "from": "node_001",
      "to": "node_002",
      "speed_limit": 100,
      "type": "highway",
      "mode": 2,
      "length": 120000,
      "cost": 4320000
    },
    {
      "seq": 2,
      "from": "node_002",
      "to": "node_003",
      "speed_limit": 300,
      "type": "sky",
      "mode": 4,
      "length": 240000,
      "cost": 2880000
    }
    // ...
  ]
}
```

**計算結果:**
- 距離: 480 km
- 時間: 2 時間 48 分
- モード: 高速モード (香車) → 長距離飛行モード (飛車) → 通常運転モード (金将)

---

## 🎯 HUD パネル機能一覧

### 停止時

✅ 出発地選択（ドロップダウン）  
✅ 目的地選択（ドロップダウン）  
✅ ルート自動計算（500ms遅延でAPI模擬）  
✅ プレビュー情報表示:
  - 距離
  - 予想時間
  - 経路セグメント数

### 走行中

✅ 出発地・目的地表示  
✅ 総距離表示  
✅ 予想時間表示  
✅ 現在のモード表示（将棋駒）  
✅ 進行状況プログレスバー

---

## 🐛 トラブルシューティング

### ルートが取得できない

```typescript
// コンソールでエラーを確認
const route = await getRoute('B', 'C');
console.log('ルートデータ:', route);
```

### 距離・時間の計算がおかしい

```typescript
// ヘルパー関数のテスト
import { calculateTotalDistance, calculateTotalTime } from '../types/routeAPI';

const route = await getRoute('B', 'C');
console.log('距離(m):', calculateTotalDistance(route.edges));
console.log('時間(分):', calculateTotalTime(route.edges));
```

### モード情報が表示されない

```typescript
// モードIDの確認
import { getModeById, VEHICLE_MODES } from '../types/routeAPI';

console.log('全モード:', VEHICLE_MODES);
console.log('モード1:', getModeById(1));
```

---

## 📚 参考資料

- **API仕様書**: `docs/API_DESIGN.md`
- **型定義**: `src/types/routeAPI.ts`
- **モック実装**: `src/api/mockRouteAPI.ts`
- **使用例**: `src/examples/routeAPIExamples.ts`
- **UI統合**: `src/components/cityrun/HUDPanel.tsx`

---

## ✨ 今後の拡張

- [ ] 実際のAPIエンドポイントへの接続
- [ ] ルート最適化アルゴリズム（ダイクストラ法）
- [ ] リアルタイム交通情報の統合
- [ ] 複数経由地のサポート
- [ ] 3Dマップへのルート描画
- [ ] 音声案内機能

---

**作成日**: 2025-11-14  
**バージョン**: 1.0  
**プロジェクト**: AutomaticTransformCar - CityRun Demo
