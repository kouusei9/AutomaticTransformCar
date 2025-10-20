import { useEffect, useRef } from "react"
import gsap from "gsap"

export default function CarPath() {
  const carRef = useRef(null)

  useEffect(() => {
    gsap.to(carRef.current, {
      x: 400,
      duration: 5,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut"
    })
  }, [])

  return (
    <div className="w-full h-64 bg-gray-900 flex items-center justify-start">
      <div
        ref={carRef}
        className="w-10 h-10 bg-blue-400 rounded-full shadow-lg"
      />
    </div>
  )
}