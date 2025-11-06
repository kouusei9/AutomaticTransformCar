import React, { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Cyberpunk Sky Environment Component
 * 
 * Creates a futuristic night sky with:
 * - Gradient shader from horizon (dark purple) to top (blue)
 * - Animated glow rings and light beams
 * - Soft night atmosphere without sun
 */

// ==================== Constants ====================

// Color scheme for cyberpunk sky
const HORIZON_COLOR = new THREE.Color(0x1a0033) // Dark purple at horizon
const TOP_COLOR = new THREE.Color(0x000033) // Deep blue at top
const GLOW_COLOR = new THREE.Color(0x4400ff) // Purple glow for rings
const BEAM_COLOR = new THREE.Color(0x0066ff) // Cyan-blue for light beams

// Animation parameters
const RING_SPEED = 0.3 // Speed of ring animation
const BEAM_SPEED = 0.5 // Speed of beam animation
const GLOW_INTENSITY = 0.8 // Intensity of glow effects
const RING_COUNT = 3 // Number of glow rings
const BEAM_COUNT = 5 // Number of light beams

// Sky sphere parameters
const SKY_RADIUS = 500 // Radius of sky sphere
const SKY_SEGMENTS = 32 // Sphere segments for smoothness

// ==================== Shader Code ====================

/**
 * Creates the gradient sky shader with animated effects
 */
const createSkyShader = () => {
  return {
    uniforms: {
      // Time for animation
      time: { value: 0 },
      // Gradient colors
      horizonColor: { value: HORIZON_COLOR },
      topColor: { value: TOP_COLOR },
      // Glow effects
      glowColor: { value: GLOW_COLOR },
      beamColor: { value: BEAM_COLOR },
      // Animation parameters
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
        // Pass world position and normal to fragment shader
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = normalize(normalMatrix * normal);
        
        // Standard vertex transformation
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
      
      // Calculate distance-based gradient
      float getGradient(vec3 pos) {
        // Normalize Y position to get 0-1 range (0 = bottom/horizon, 1 = top)
        float y = normalize(pos).y;
        // Smooth step for gradient transition
        return smoothstep(-1.0, 1.0, y);
      }
      
      // Create animated glow rings
      float getGlowRings(vec3 pos, float time) {
        float rings = 0.0;
        
        // Calculate distance from center in XZ plane (horizontal distance)
        float dist = length(pos.xz);
        
        // Create multiple animated rings
        for (float i = 0.0; i < 3.0; i += 1.0) {
          // Ring position based on time and index
          float ringPos = mod((time * ringSpeed + i * 0.5) * 100.0, 300.0);
          
          // Calculate distance from ring
          float ringDist = abs(dist - ringPos);
          
          // Glow falloff (rings fade out with distance)
          float glow = 1.0 / (1.0 + ringDist * 0.1);
          
          // Add pulsing effect
          float pulse = sin(time * 2.0 + i) * 0.3 + 0.7;
          
          rings += glow * pulse * glowIntensity;
        }
        
        return rings;
      }
      
      // Create light beams from top
      float getLightBeams(vec3 pos, float time) {
        float beams = 0.0;
        
        // Calculate angle around Y axis
        float angle = atan(pos.x, pos.z);
        
        // Create multiple beams
        for (float i = 0.0; i < 5.0; i += 1.0) {
          // Beam angle based on index
          float beamAngle = (i / 5.0) * 3.14159 * 2.0;
          
          // Animated beam angle
          float animatedAngle = beamAngle + time * beamSpeed;
          
          // Calculate angle difference
          float angleDiff = abs(angle - animatedAngle);
          // Wrap around for circular distance
          angleDiff = min(angleDiff, 3.14159 * 2.0 - angleDiff);
          
          // Beam width and intensity
          float beamWidth = 0.3;
          float beamIntensity = 1.0 - smoothstep(0.0, beamWidth, angleDiff);
          
          // Height-based intensity (stronger at horizon)
          float heightFactor = 1.0 - smoothstep(-0.5, 0.5, pos.y);
          
          // Fade with distance
          float dist = length(pos.xz);
          float distFactor = 1.0 / (1.0 + dist * 0.01);
          
          beams += beamIntensity * heightFactor * distFactor * glowIntensity * 0.5;
        }
        
        return beams;
      }
      
      void main() {
        // Calculate base gradient from horizon to top
        float gradient = getGradient(vWorldPosition);
        vec3 skyColor = mix(horizonColor, topColor, gradient);
        
        // Add glow rings
        float rings = getGlowRings(vWorldPosition, time);
        vec3 ringGlow = glowColor * rings;
        
        // Add light beams
        float beams = getLightBeams(vWorldPosition, time);
        vec3 beamGlow = beamColor * beams;
        
        // Combine all effects
        vec3 finalColor = skyColor + ringGlow + beamGlow;
        
        // Add subtle atmospheric glow based on position
        float atmosphericGlow = smoothstep(0.0, 0.3, gradient) * 0.1;
        finalColor += glowColor * atmosphericGlow;
        
        // Output final color
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  }
}

// ==================== Component ====================

interface SkyEnvironmentProps {
  /** Optional custom sky radius */
  radius?: number
  /** Optional custom segments for sphere */
  segments?: number
}

/**
 * SkyEnvironment Component
 * 
 * Renders a cyberpunk night sky with:
 * - Gradient from dark purple (horizon) to deep blue (top)
 * - Animated glow rings
 * - Animated light beams
 * - Soft night atmosphere
 */
export const SkyEnvironment: React.FC<SkyEnvironmentProps> = ({
  radius = SKY_RADIUS,
  segments = SKY_SEGMENTS
}) => {
  // Create shader material
  const shaderMaterial = useMemo(() => {
    const shader = createSkyShader()
    return new THREE.ShaderMaterial(shader)
  }, [])

  // Update time uniform for animation
  useFrame((state) => {
    if (shaderMaterial.uniforms) {
      shaderMaterial.uniforms.time.value = state.clock.elapsedTime
    }
  })

  return (
    <mesh scale={[radius, radius, radius]}>
      {/* Sphere geometry for sky dome */}
      <sphereGeometry args={[1, segments, segments]} />
      {/* Shader material with gradient and animated effects */}
      <primitive object={shaderMaterial} attach="material" side={THREE.BackSide} />
    </mesh>
  )
}

export default SkyEnvironment
