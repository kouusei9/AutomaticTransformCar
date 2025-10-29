import React, { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import CarPath from "../components/CarPath"

export default function Home() {
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const rafRef = useRef(null)
  const carRef = useRef(null)
  const pathCompRef = useRef(null)

  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(0.02)
  const progressRef = useRef(0) // 0..1

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // scene & camera
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0f0f12)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000)
    camera.position.set(20, 20, 40)
    cameraRef.current = camera

    // lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7)
    hemi.position.set(0, 50, 0)
    scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 0.6)
    dir.position.set(10, 20, 10)
    scene.add(dir)

    // simple car placeholder
    const car = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1, 5),
      new THREE.MeshStandardMaterial({ color: 0xff5533 })
    )
    body.position.y = 0.7
    car.add(body)
    // four wheels (simple cylinders)
    const wheelGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.6, 16)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 })
    function addWheel(x, z) {
      const w = new THREE.Mesh(wheelGeom, wheelMat)
      w.rotation.z = Math.PI / 2
      w.position.set(x, 0.35, z)
      car.add(w)
    }
    addWheel(-1, -1.8)
    addWheel(1, -1.8)
    addWheel(-1, 1.8)
    addWheel(1, 1.8)
    scene.add(car)
    carRef.current = car

    // controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(20, 0, 0)
    controls.update()
    controlsRef.current = controls

    // resize handling
    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", onResize)

    // animation loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      // advance progress if playing and curve exists
      const curve = pathCompRef.current?.getPath?.()
      if (playing && curve) {
        progressRef.current += speed * 0.001 // scaled down for smoothness
        if (progressRef.current > 1) progressRef.current = 0
      }

      // update car along curve
      if (curve) {
        const t = progressRef.current
        const pos = curve.getPointAt(t)
        const tangent = curve.getTangentAt(t)
        if (pos && tangent) {
          car.position.copy(pos)
          // orient car to tangent direction (y-up)
          const axis = new THREE.Vector3(0, 1, 0)
          const up = new THREE.Vector3(0, 1, 0)
          const lookAtPos = pos.clone().add(tangent)
          car.lookAt(lookAtPos)
          // keep wheels rotation simple
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener("resize", onResize)
      controls.dispose()
      renderer.domElement && container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {/* CarPath を scene に渡し、経路を取得 */}
      <CarPath scene={sceneRef.current} ref={pathCompRef} />

      {/* シンプルなUI */}
      <div style={{ position: "absolute", left: 12, top: 12, background: "rgba(0,0,0,0.6)", padding: 12, borderRadius: 6, color: "#fff" }}>
        <button onClick={() => setPlaying(p => !p)} style={{ marginRight: 8 }}>
          {playing ? "停止" : "再生"}
        </button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          速度
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
          />
          {speed.toFixed(1)}
        </label>
      </div>
    </div>
  )
}