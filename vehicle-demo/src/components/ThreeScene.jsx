import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import CarPath from "./CarPath"
import CarModel from "./CarModel"

export default function ThreeScene() {
  const mountRef = useRef(null)
  const carRef = useRef(null)
  const pathRef = useRef(null)
  const [scene, setScene] = useState(null)
  const [camera, setCamera] = useState(null)
  const [controls, setControls] = useState(null)

  useEffect(() => {
    if (!mountRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111111)
    setScene(scene)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    // ✅ 辅助工具
    scene.add(new THREE.AxesHelper(10))
    scene.add(new THREE.GridHelper(20, 20))
    // 环境光（全局柔光）
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    // 方向光（模拟太阳）
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(30, 50, 10)
    scene.add(dirLight)

    // ✅ 地面
    // const planeGeometry = new THREE.PlaneGeometry(200, 200)
    // const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 })
    // const ground = new THREE.Mesh(planeGeometry, planeMaterial)
    // ground.rotation.x = -Math.PI / 2
    // ground.receiveShadow = true
    // scene.add(ground)

    const textureLoader = new THREE.TextureLoader()
    const groundTexture = textureLoader.load("/road_texture.jpg")
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping
    groundTexture.repeat.set(10, 10)

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        map: groundTexture,
        side: THREE.DoubleSide,
      })
    )
    plane.rotation.x = -Math.PI / 2
    scene.add(plane)

    // ✅ 天空背景色（更亮）
    scene.background = new THREE.Color(0x87ceeb) // 天空蓝

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    )
    camera.position.set(0, 5, 20)
    setCamera(camera)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.domElement.style.position = "absolute"
    renderer.domElement.style.inset = 0  // 占满父容器
    renderer.domElement.style.zIndex = 0 // 最底层
    renderer.domElement.style.pointerEvents = "auto" // 确保鼠标事件正常传递



    mountRef.current.innerHTML = ""
    mountRef.current.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    setControls(controls)

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      if (controls) controls.dispose()
      if (renderer) {
        renderer.dispose()
        if (mountRef.current?.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement)
        }
      }
    }
  }, [])

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {/* Three.js 渲染区域 */}

      <div
        ref={mountRef}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          zIndex: 0,
        }}
      />

      {/* 模型加载 */}
      {scene && camera && controls && (
        <>
          <CarPath ref={pathRef} scene={scene} />
          <CarModel ref={carRef} scene={scene} camera={camera} controls={controls} pathRef={pathRef} />
        </>

      )}

      {/* ✅ 按钮独立层 */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 10, // 比 canvas 高
          display: "flex",
          gap: "10px",
        }}
      >
        <button
          onClick={() => carRef.current?.startDrive()}
          style={{ ...btnStyle, background: "#4caf50" }}
        >
          🚗 沿路线行驶
        </button>

        <button onClick={() => carRef.current?.fly()} style={btnStyle}>
          🚗 变形为飞行模式
        </button>

        <button
          onClick={() => carRef.current?.reset()}
          style={{ ...btnStyle, background: "#ff6f61" }}
        >
          🛬 回到地面
        </button>
      </div>

      {/* ✅ 测试层 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          color: "white",
          zIndex: 999,
        }}
      >
        ✅ 按钮层测试
      </div>
    </div>
  )
}

// 按钮样式
const btnStyle = {
  padding: "10px 14px",
  border: "none",
  borderRadius: "8px",
  background: "#00bcd4",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  zIndex: 10,                   // 再加保险
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
}