import * as THREE from 'three'

/**
 * Vehicle Path Curves
 * 
 * Defines curved paths for vehicles to follow in the cyberpunk city.
 * Uses CatmullRomCurve3 for smooth, continuous paths.
 */

/**
 * Main vehicle path - a smooth curve around the city
 * Creates a loop that goes around the ground plane
 */
export const createVehiclePath = (): THREE.CatmullRomCurve3 => {
  // Define control points for a smooth city loop
  // The path creates a figure-8 pattern around the city
  const points = [
    new THREE.Vector3(-80, 2, -80),   // Start point
    new THREE.Vector3(-40, 3, -100),  // Curve point
    new THREE.Vector3(0, 2, -80),     // Center back
    new THREE.Vector3(40, 3, -100),   // Curve point
    new THREE.Vector3(80, 2, -80),    // Right side
    new THREE.Vector3(100, 3, -40),   // Curve point
    new THREE.Vector3(80, 2, 0),      // Front right
    new THREE.Vector3(100, 3, 40),   // Curve point
    new THREE.Vector3(80, 2, 80),    // Right back
    new THREE.Vector3(40, 3, 100),   // Curve point
    new THREE.Vector3(0, 2, 80),     // Center back
    new THREE.Vector3(-40, 3, 100),  // Curve point
    new THREE.Vector3(-80, 2, 80),   // Left back
    new THREE.Vector3(-100, 3, 40),  // Curve point
    new THREE.Vector3(-80, 2, 0),    // Front left
    new THREE.Vector3(-100, 3, -40), // Curve point
    new THREE.Vector3(-80, 2, -80), // Back to start (for loop)
  ]
  
  return new THREE.CatmullRomCurve3(points, true) // true = closed loop
}

/**
 * Alternative path - a tighter loop in the center
 */
export const createCenterPath = (): THREE.CatmullRomCurve3 => {
  const points = [
    new THREE.Vector3(-50, 2, 0),
    new THREE.Vector3(0, 3, -50),
    new THREE.Vector3(50, 2, 0),
    new THREE.Vector3(0, 3, 50),
    new THREE.Vector3(-50, 2, 0),
  ]
  
  return new THREE.CatmullRomCurve3(points, true)
}

/**
 * Get a random path from available paths
 */
export const getRandomPath = (): THREE.CatmullRomCurve3 => {
  const paths = [createVehiclePath(), createCenterPath()]
  return paths[Math.floor(Math.random() * paths.length)]
}
