// CarPath.jsx
import * as THREE from "three"
import { useEffect, forwardRef, useImperativeHandle, useRef } from "react"

export default forwardRef(function CarPath({ scene }, ref) {
  const pathRef = useRef(null)

  useImperativeHandle(ref, () => ({
    getPath: () => pathRef.current,
  }))

  useEffect(() => {
    if (!scene) return

    // ✅ 路线点（可以替换为任意地图路径点）
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(10, 0, -10),
      new THREE.Vector3(20, 0, 0),
      new THREE.Vector3(30, 0, 10),
      new THREE.Vector3(40, 0, 0),
    ]

    // ✅ 创建路径曲线
    const curve = new THREE.CatmullRomCurve3(points)
    pathRef.current = curve

    // ✅ 路线可视化
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(200))
    const material = new THREE.LineBasicMaterial({ color: 0x888888 })
    const line = new THREE.Line(geometry, material)
    scene.add(line)

    // ✅ 可选：添加地面
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide })
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.y = -0.01
    scene.add(plane)

    console.log("✅ 路线已创建")

    return () => {
      scene.remove(line)
      scene.remove(plane)
    }
  }, [scene])

  return null
})