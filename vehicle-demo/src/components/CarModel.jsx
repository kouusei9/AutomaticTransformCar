import { useEffect, forwardRef, useImperativeHandle, useRef } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import gsap from "gsap"

export default forwardRef(function CarModel({ scene, camera, controls, pathRef }, ref) {
  const modelRootRef = useRef(null)
  const hasLoadedRef = useRef(false) // ✅ 防止重复加载
  const lightRef = useRef(null)
  const tRef = useRef(0) // 路线进度 [0~1]

  useImperativeHandle(ref, () => ({
    fly: () => modelRootRef.current && transformToFlyMode(modelRootRef.current),
    reset: () => modelRootRef.current && resetPosition(modelRootRef.current),
    startDrive: () => startDriving(),
  }))

  useEffect(() => {
    if (!scene || hasLoadedRef.current) return // 🚫 若已加载则直接跳过

    const loader = new GLTFLoader()
    loader.load(
      "/car.gltf",
      (gltf) => {
        const modelRoot = gltf.scene
        modelRootRef.current = modelRoot
        hasLoadedRef.current = true // ✅ 标记已加载

        // 清理旧模型（确保场景中只有一个）
        scene.children
          .filter(o => o.userData.isCar)
          .forEach(o => scene.remove(o))

        modelRoot.userData.isCar = true
        scene.add(modelRoot)
        console.log("✅ 模型已加载:", modelRoot)

        // 居中缩放
        // const bbox = new THREE.Box3().setFromObject(modelRoot)
        // const center = bbox.getCenter(new THREE.Vector3())
        // const size = bbox.getSize(new THREE.Vector3())
        // modelRoot.position.sub(center)
        // const maxDim = Math.max(size.x, size.y, size.z)
        // modelRoot.scale.setScalar(8 / maxDim)

        // 调整相机
        camera.position.set(0, 5, 20)
        controls.target.set(0, 0, 0)
        camera.lookAt(0, 0, 0)

        // 光源
        // const light = new THREE.PointLight(0xffffff, 5)
        // light.position.set(10, 10, 10)
        // lightRef.current = light
        // scene.add(light)

        console.log("🎨 模型显示已准备完成")
      },
      undefined,
      (err) => console.error("❌ GLTF 加载失败:", err)
    )

    // 清理
    return () => {
      if (modelRootRef.current) {
        console.log("🧹 移除模型")
        scene.remove(modelRootRef.current)
        modelRootRef.current = null
        hasLoadedRef.current = false
      }
      if (lightRef.current) {
        scene.remove(lightRef.current)
        lightRef.current = null
      }
    }
  }, [scene, camera, controls])

  // 🌀 飞行动画
  function transformToFlyMode(car) {
    gsap.to(car.scale, { x: 1.5, y: 0.2, z: 2, duration: 1 })
    gsap.to(car.rotation, { x: -Math.PI / 6, duration: 1 })
    gsap.to(car.position, { y: 20, duration: 2 })
  }

  // 🛬 回地动画
  function resetPosition(car) {
    gsap.to(car.scale, { x: 1, y: 1, z: 1, duration: 1 })
    gsap.to(car.rotation, { x: 0, duration: 1 })
    gsap.to(car.position, { y: 0, duration: 2 })
  }

  // 🚗 动画函数
  function startDriving() {
    const car = modelRootRef.current
    const curve = pathRef.current?.getPath?.()
    if (!car || !curve) return console.warn("路径未准备好")

    // 从起点开始
    gsap.to(tRef, {
      current: 1,
      duration: 10,
      ease: "none",
      onUpdate: () => {
        const pos = curve.getPointAt(tRef.current)
        const tangent = curve.getTangentAt(tRef.current)

        car.position.copy(pos)
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          tangent.normalize()
        )
        car.quaternion.slerp(quaternion, 0.1)

        // 相机跟随
        const camOffset = new THREE.Vector3(0, 5, 15)
        const camPos = pos.clone().add(camOffset.applyQuaternion(car.quaternion))
        camera.position.lerp(camPos, 0.1)
        camera.lookAt(car.position)
      },
    })
  }

  return null
})