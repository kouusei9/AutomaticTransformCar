/**
 * AI Route API 使用例
 * 
 * このファイルは API の使用方法を示すサンプルコードです。
 */

import { 
  getRoute, 
  getKyotoSampleRoute, 
  getLongDistanceRoute,
  generateRequestId 
} from '../api/mockRouteAPI';
import { 
  VEHICLE_MODES, 
  LOCATIONS,
  getModeById,
  calculateTotalDistance,
  calculateTotalTime,
  formatDistance,
  formatTime
} from '../types/routeAPI';

/**
 * 例1: 基本的なルート取得
 */
export async function example1_BasicRoute() {
  console.log('=== 例1: 基本的なルート取得 ===');
  
  // 京都駅(B) → 清水寺(C) のルートを取得
  const route = await getRoute('B', 'C');
  
  console.log(`ルートID: ${route.id}`);
  console.log(`タイムスタンプ: ${new Date(route.timestamp * 1000).toLocaleString('ja-JP')}`);
  console.log(`ノード数: ${route.nodes.length}`);
  console.log(`経路数: ${route.edges.length}`);
  console.log(`総距離: ${formatDistance(calculateTotalDistance(route.edges))}`);
  console.log(`予想時間: ${formatTime(calculateTotalTime(route.edges))}`);
  
  return route;
}

/**
 * 例2: ノード情報の詳細表示
 */
export async function example2_NodeDetails() {
  console.log('=== 例2: ノード情報の詳細表示 ===');
  
  const route = await getKyotoSampleRoute();
  
  route.nodes.forEach((node, index) => {
    console.log(`\nノード ${index + 1}:`);
    console.log(`  ID: ${node.id}`);
    console.log(`  座標: (${node.coordinates.lat.toFixed(4)}, ${node.coordinates.lng.toFixed(4)})`);
    console.log(`  タイプ: ${node.node_type}`);
  });
  
  return route;
}

/**
 * 例3: エッジ（経路）情報の詳細表示
 */
export async function example3_EdgeDetails() {
  console.log('=== 例3: エッジ（経路）情報の詳細表示 ===');
  
  const route = await getRoute('B', 'E'); // 京都駅 → 金閣寺
  
  route.edges.forEach((edge) => {
    const mode = getModeById(edge.mode);
    
    console.log(`\n経路 ${edge.seq}:`);
    console.log(`  ${edge.from} → ${edge.to}`);
    console.log(`  道路タイプ: ${edge.type}`);
    console.log(`  モード: ${mode?.name} (${mode?.piece})`);
    console.log(`  距離: ${formatDistance(edge.length)}`);
    console.log(`  制限速度: ${edge.speed_limit} km/h`);
    console.log(`  所要時間: ${Math.round(edge.cost / 1000 / 60)} 分`);
  });
  
  return route;
}

/**
 * 例4: 長距離ルート（東京 → 京都）
 */
export async function example4_LongDistanceRoute() {
  console.log('=== 例4: 長距離ルート（東京 → 京都） ===');
  
  const route = await getLongDistanceRoute();
  
  console.log(`出発地: 東京駅`);
  console.log(`目的地: 京都駅`);
  console.log(`総距離: ${formatDistance(calculateTotalDistance(route.edges))}`);
  console.log(`予想時間: ${formatTime(calculateTotalTime(route.edges))}`);
  
  // モード別の距離を集計
  const distanceByMode: Record<number, number> = {};
  route.edges.forEach(edge => {
    distanceByMode[edge.mode] = (distanceByMode[edge.mode] || 0) + edge.length;
  });
  
  console.log('\nモード別の距離:');
  Object.entries(distanceByMode).forEach(([modeId, distance]) => {
    const mode = getModeById(Number(modeId));
    console.log(`  ${mode?.name}: ${formatDistance(distance)}`);
  });
  
  return route;
}

/**
 * 例5: 全ロケーション一覧
 */
export function example5_ListLocations() {
  console.log('=== 例5: 全ロケーション一覧 ===');
  
  LOCATIONS.forEach(location => {
    console.log(`\n${location.id}: ${location.name}`);
    console.log(`  座標: (${location.coordinates.lat}, ${location.coordinates.lng})`);
  });
}

/**
 * 例6: 全モード一覧
 */
export function example6_ListModes() {
  console.log('=== 例6: 全モード一覧 ===');
  
  VEHICLE_MODES.forEach(mode => {
    console.log(`\n${mode.id}. ${mode.name}`);
    console.log(`   将棋駒: ${mode.piece}`);
    console.log(`   タイプ: ${mode.type}`);
    console.log(`   機能: ${mode.function}`);
  });
}

/**
 * 例7: カスタムリクエストID
 */
export async function example7_CustomRequestId() {
  console.log('=== 例7: カスタムリクエストID ===');
  
  const route = await getRoute('B', 'C');
  
  console.log(`生成されたリクエストID: ${route.id}`);
  console.log(`自動生成ID例: ${generateRequestId()}`);
  
  return route;
}

/**
 * 例8: ルートデータをJSON形式で出力
 */
export async function example8_ExportJSON() {
  console.log('=== 例8: ルートデータをJSON形式で出力 ===');
  
  const route = await getKyotoSampleRoute();
  const jsonStr = JSON.stringify(route, null, 2);
  
  console.log(jsonStr);
  
  return jsonStr;
}

/**
 * 全ての例を実行
 */
export async function runAllExamples() {
  try {
    await example1_BasicRoute();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example2_NodeDetails();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example3_EdgeDetails();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example4_LongDistanceRoute();
    console.log('\n' + '='.repeat(50) + '\n');
    
    example5_ListLocations();
    console.log('\n' + '='.repeat(50) + '\n');
    
    example6_ListModes();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example7_CustomRequestId();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await example8_ExportJSON();
    
    console.log('\n✅ 全ての例を実行完了！');
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// ブラウザのコンソールから実行できるようにグローバルに公開
if (typeof window !== 'undefined') {
  (window as any).routeAPIExamples = {
    example1_BasicRoute,
    example2_NodeDetails,
    example3_EdgeDetails,
    example4_LongDistanceRoute,
    example5_ListLocations,
    example6_ListModes,
    example7_CustomRequestId,
    example8_ExportJSON,
    runAllExamples
  };
  
  console.log('💡 ブラウザのコンソールで以下のコマンドを実行できます:');
  console.log('   window.routeAPIExamples.runAllExamples()');
  console.log('   window.routeAPIExamples.example1_BasicRoute()');
}
