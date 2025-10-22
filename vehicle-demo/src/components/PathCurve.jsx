import * as THREE from "three"

export function createPath() {
  // 定义行驶路径点
  const points = [
    new THREE.Vector3(0, 0, 0),     // 起点
    new THREE.Vector3(50, 0, 0),    // A点（变形点1）
    new THREE.Vector3(100, 20, 50), // 飞行状态
    new THREE.Vector3(150, 0, 100), // B点（变形点2）
    new THREE.Vector3(200, 0, 150), // 终点
  ]
  return new THREE.CatmullRomCurve3(points)
}