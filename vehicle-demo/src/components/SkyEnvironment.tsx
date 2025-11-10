import React, { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * サイバーパンク空環境コンポーネント
 * 
 * 未来的な夜空を作成：
 * - 地平線（ダークパープル）から頂上（ブルー）へのグラデーションシェーダー
 * - アニメーション化されたグローリングと光線
 * - 太陽のないソフトな夜の雰囲気
 */

// ==================== 定数 ====================

// サイバーパンク空のカラースキーム
const HORIZON_COLOR = new THREE.Color(0x1a0033) // 地平線のダークパープル
const TOP_COLOR = new THREE.Color(0x000033) // 頂上のディープブルー
const GLOW_COLOR = new THREE.Color(0x4400ff) // リング用のパープルグロー
const BEAM_COLOR = new THREE.Color(0x0066ff) // 光線用のシアンブルー

// アニメーションパラメータ
const RING_SPEED = 0.3 // リングアニメーション速度
const BEAM_SPEED = 0.5 // 光線アニメーション速度
const GLOW_INTENSITY = 0.8 // グロー効果の強度
const RING_COUNT = 3 // グローリングの数
const BEAM_COUNT = 5 // 光線の数

// 空球体パラメータ
const SKY_RADIUS = 500 // 空球体の半径
const SKY_SEGMENTS = 32 // 滑らかさのための球体セグメント

// ==================== シェーダーコード ====================

/**
 * アニメーション効果付きグラデーション空シェーダーを作成
 */
const createSkyShader = () => {
  return {
    uniforms: {
      // アニメーション用の時間
      time: { value: 0 },
      // グラデーションカラー
      horizonColor: { value: HORIZON_COLOR },
      topColor: { value: TOP_COLOR },
      // グロー効果
      glowColor: { value: GLOW_COLOR },
      beamColor: { value: BEAM_COLOR },
      // アニメーションパラメータ
      ringSpeed: { value: RING_SPEED },
      beamSpeed: { value: BEAM_SPEED },
      glowIntensity: { value: GLOW_INTENSITY },
      ringCount: { value: RING_COUNT },
      beamCount: { value: BEAM_COUNT }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      
      void main() {
        // ワールド位置と法線をフラグメントシェーダーに渡す
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = normalize(normalMatrix * normal);
        
        // 標準頂点変換
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 horizonColor;
      uniform vec3 topColor;
      uniform vec3 glowColor;
      uniform vec3 beamColor;
      uniform float ringSpeed;
      uniform float beamSpeed;
      uniform float glowIntensity;
      uniform float ringCount;
      uniform float beamCount;
      
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      
      // 距離ベースのグラデーションを計算
      float getGradient(vec3 pos) {
        // Y位置を正規化して0-1範囲を取得（0 = 底部/地平線、1 = 頂上）
        float y = normalize(pos).y;
        // グラデーション遷移のためのスムーズステップ
        return smoothstep(-1.0, 1.0, y);
      }
      
      // アニメーション化されたグローリングを作成
      float getGlowRings(vec3 pos, float time) {
        float rings = 0.0;
        
        // XZ平面の中心からの距離を計算（水平距離）
        float dist = length(pos.xz);
        
        // 複数のアニメーション化されたリングを作成
        for (float i = 0.0; i < 3.0; i += 1.0) {
          // 時間とインデックスに基づくリング位置
          float ringPos = mod((time * ringSpeed + i * 0.5) * 100.0, 300.0);
          
          // リングからの距離を計算
          float ringDist = abs(dist - ringPos);
          
          // グローフォールオフ（リングは距離とともにフェードアウト）
          float glow = 1.0 / (1.0 + ringDist * 0.1);
          
          // パルス効果を追加
          float pulse = sin(time * 2.0 + i) * 0.3 + 0.7;
          
          rings += glow * pulse * glowIntensity;
        }
        
        return rings;
      }
      
      // 頂上からの光線を作成
      float getLightBeams(vec3 pos, float time) {
        float beams = 0.0;
        
        // Y軸周りの角度を計算
        float angle = atan(pos.x, pos.z);
        
        // 複数の光線を作成
        for (float i = 0.0; i < 5.0; i += 1.0) {
          // インデックスに基づく光線角度
          float beamAngle = (i / 5.0) * 3.14159 * 2.0;
          
          // アニメーション化された光線角度
          float animatedAngle = beamAngle + time * beamSpeed;
          
          // 角度差を計算
          float angleDiff = abs(angle - animatedAngle);
          // 円形距離のためのラップアラウンド
          angleDiff = min(angleDiff, 3.14159 * 2.0 - angleDiff);
          
          // 光線幅と強度
          float beamWidth = 0.3;
          float beamIntensity = 1.0 - smoothstep(0.0, beamWidth, angleDiff);
          
          // 高さベースの強度（地平線で強く）
          float heightFactor = 1.0 - smoothstep(-0.5, 0.5, pos.y);
          
          // 距離によるフェード
          float dist = length(pos.xz);
          float distFactor = 1.0 / (1.0 + dist * 0.01);
          
          beams += beamIntensity * heightFactor * distFactor * glowIntensity * 0.5;
        }
        
        return beams;
      }
      
      void main() {
        // 地平線から頂上へのベースグラデーションを計算
        float gradient = getGradient(vWorldPosition);
        vec3 skyColor = mix(horizonColor, topColor, gradient);
        
        // グローリングを追加
        float rings = getGlowRings(vWorldPosition, time);
        vec3 ringGlow = glowColor * rings;
        
        // 光線を追加
        float beams = getLightBeams(vWorldPosition, time);
        vec3 beamGlow = beamColor * beams;
        
        // すべての効果を組み合わせ
        vec3 finalColor = skyColor + ringGlow + beamGlow;
        
        // 位置に基づく微妙な大気グローを追加
        float atmosphericGlow = smoothstep(0.0, 0.3, gradient) * 0.1;
        finalColor += glowColor * atmosphericGlow;
        
        // 最終カラーを出力
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  }
}

// ==================== コンポーネント ====================

interface SkyEnvironmentProps {
  /** オプションのカスタム空半径 */
  radius?: number
  /** オプションの球体用カスタムセグメント */
  segments?: number
}

/**
 * SkyEnvironmentコンポーネント
 * 
 * サイバーパンクの夜空をレンダリング：
 * - ダークパープル（地平線）からディープブルー（頂上）へのグラデーション
 * - アニメーション化されたグローリング
 * - アニメーション化された光線
 * - ソフトな夜の雰囲気
 */
export const SkyEnvironment: React.FC<SkyEnvironmentProps> = ({
  radius = SKY_RADIUS,
  segments = SKY_SEGMENTS
}) => {
  // シェーダーマテリアルを作成
  const shaderMaterial = useMemo(() => {
    const shader = createSkyShader()
    return new THREE.ShaderMaterial(shader)
  }, [])

  // アニメーション用の時間uniformを更新
  useFrame((state) => {
    if (shaderMaterial.uniforms) {
      shaderMaterial.uniforms.time.value = state.clock.elapsedTime
    }
  })

  return (
    <mesh scale={[radius, radius, radius]}>
      {/* 空ドーム用の球体ジオメトリ */}
      <sphereGeometry args={[1, segments, segments]} />
      {/* グラデーションとアニメーション効果付きシェーダーマテリアル */}
      <primitive object={shaderMaterial} attach="material" side={THREE.BackSide} />
    </mesh>
  )
}

export default SkyEnvironment
