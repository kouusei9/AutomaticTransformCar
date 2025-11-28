# Copilot Instructions: Vehicle Demo (Kyoto Future City Navigation)

## Project Overview
3D vehicle navigation demo showcasing Kyoto city with multi-modal transportation (road, highway, drone, airplane). Built with React, Three.js (via React Three Fiber), and WebSocket for real-time communication. Features two distinct demo modes:
- **CyberpunkCityDemo** (`src/pages/CyberpunkCityDemo.tsx`): 3D top-down city view with multiple AI vehicles following dynamic routes
- **CityRunDemo** (`src/pages/CityRunDemo.tsx`): First-person driving simulator with mode transformation animations

## Architecture & Core Concepts

### Dual-Mode Structure
Two independent pages with different visualization approaches:
1. **CyberpunkCityDemo**: Multi-vehicle 3D scene using React Three Fiber
   - Camera follows selected vehicle with `<OrbitControls>` integration
   - Real-time WebSocket communication for adding new routes
   - Billboard sprite-based vehicles with dynamic texture switching
   
2. **CityRunDemo**: Single-vehicle first-person experience using Canvas 2D
   - Mode transformation videos (car ↔ highway ↔ drone ↔ airplane)
   - HUD with route information and progress tracking
   - Time-scaled simulation (TIME_SCALE_FACTOR = 3)

### Route System & API-Based Navigation

#### Route Data Structure
Routes follow the **RouteResponse** API schema (`src/types/routeAPI.ts`):
```typescript
interface RouteResponse {
  id: string                    // Unique route identifier
  timestamp: number             // Creation timestamp
  nodes: RouteNode[]            // Ordered waypoints
  edges: RouteEdge[]            // Connections between nodes
}

interface RouteNode {
  id: string
  coordinates: { lat: number; lng: number }
  node_type: 'station' | 'airport' | 'point' | 'outside'
}

interface RouteEdge {
  seq: number                   // Sequence order
  from: string                  // Start node ID
  to: string                    // End node ID
  speed_limit: number           // km/h
  type: 'road' | 'highway' | 'drone' | 'sky'
  mode: 1 | 2 | 3 | 4          // Vehicle mode (金将/香車/桂馬/飛車)
  length: number                // Distance in meters
  cost: number                  // Time in milliseconds
}
```

#### Path Generation System
**Core Function**: `createRoutePathFromNodeIds()` in `src/utils/routePathGenerator.ts`

**Process**:
1. Takes ordered node IDs and edge data (including `cost` values)
2. Converts lat/lng coordinates to Three.js 3D positions
3. Generates `THREE.CurvePath` with altitude-specific segments
4. Stores `edgeType` and `cost` in each curve's `userData` for runtime access

**Altitude Management**:
```typescript
// Constants from src/utils/constants.ts
GROUND_Y = 0          // Road mode
HIGHWAY_ALTITUDE = 3  // Highway mode (curves to 9m)
DRONE_ALTITUDE = 10   // Drone mode (vertical transitions)
AIRPLANE_ALTITUDE = 20 // Airplane mode (smooth arcs)
```

**Critical Implementation Details**:
- **Drone**: Vertical ascent → horizontal flight → vertical descent (only at mode boundaries)
- **Highway**: Maintains 3m base altitude; curve geometry creates visual arc to 9m
- **Airplane**: `outside` type nodes trigger 20m altitude; return routes descend to 3m
- **Road**: Ground-level (0m) with direct line segments

### Vehicle Speed Control System

#### Time Scaling Architecture
**Location**: `src/hooks/useVehicleProgress.ts` (line 29)

```typescript
const TIME_RATIO = 10  // Real time → Demo time conversion
// 1 minute real = 6 seconds demo (60s / 10 = 6s)
```

#### Speed Calculation Formula
```typescript
// Per-segment speed based on edge cost
const realTimeSeconds = segmentCost / 1000  // cost is in milliseconds
const demoTimeSeconds = realTimeSeconds / TIME_RATIO
const segmentSpeed = 1 / demoTimeSeconds    // Progress per second (0-1 range)

// Applied in useFrame
progressRef.current += segmentSpeed * delta * directionRef.current
```

**Key Variables**:
- `segmentSpeed`: Path progress per second (0-1 normalized range)
- `delta`: Frame time (~0.016s @ 60fps)
- `directionRef`: 1 for forward, -1 for reverse (cycle mode)
- `cost`: Milliseconds from edge data (e.g., 120000ms = 2 minutes)

#### Adjusting Speed
**Option 1 - Global Speed** (affects all vehicles):
```typescript
// In src/hooks/useVehicleProgress.ts, line 29
const TIME_RATIO = 15  // Slower: 1 min real = 4 sec demo
const TIME_RATIO = 5   // Faster: 1 min real = 12 sec demo
```

**Option 2 - Mode-Specific Speed** (realistic differentiation):
```typescript
// Add to useVehicleProgress
const MODE_SPEED_MULTIPLIERS = {
  road: 1.0,
  highway: 1.8,
  drone: 1.3,
  airplane: 2.5
}
const modeMultiplier = MODE_SPEED_MULTIPLIERS[edgeType] || 1.0
progressRef.current += segmentSpeed * delta * directionRef.current * modeMultiplier
```

**Safety Guard** (prevents low FPS acceleration):
```typescript
const safeDelta = Math.min(delta, 0.1)  // Cap at 100ms/frame
```

### Vehicle Component Architecture

#### Hook-Based Composition
**File**: `src/components/website/Vehicle.tsx`

**Custom Hooks**:
1. **useVehicleProgress**: Path traversal, speed, direction, completion callbacks
2. **useVehicleAppearance**: Texture selection, scaling, camera-relative billboard rotation
3. **useOcclusionDetection**: Raycasting for X-ray vision when vehicle is behind objects

#### Texture System
**Assets**: 12 PNG sprites (4 modes × 3 views)
```
car_front.png      high_car_front.png    drone_front.png    airplane_front.png
car_back.png       high_car_back.png     drone_back.png     airplane_back.png
car_side.png       high_car_side.png     drone_side.png     airplane_side.png
```

**Selection Logic** (in `useVehicleAppearance`):
```typescript
// 1. Determine view angle from camera
const toCameraDir = camera.position - vehiclePosition
const dotForward = tangent.dot(toCameraDir)
const dotRight = rightAxis.dot(toCameraDir)

// 2. Select texture set by edge type
const textures = edgeType === 'drone' ? droneTextures : carTextures

// 3. Pick specific texture
if (abs(dotRight) > abs(dotForward)) {
  material.map = textures.side
} else {
  material.map = dotForward > 0 ? textures.front : textures.back
}
```

#### Billboard Behavior
**Constant**: `SIDE_VIEW_FIXED_MODE = false` (line 20 in Vehicle.tsx)
- `false`: Billboard always faces camera (default)
- `true`: Side view aligns perpendicular to path, follows terrain pitch

#### Particle Systems
- **WindParticles**: Visible during `road` mode (ground effect)
- **FlameParticles**: Visible during `drone` mode (propulsion effect)

### Coordinate System
**Converter**: `src/utils/coordinateConverter.ts`

**Kyoto Bounding Box**:
```typescript
// Geographic bounds
Latitude:  34.88°N to 35.13°N
Longitude: 135.67°E to 135.80°E

// Maps to Three.js coordinates
X: -100 to 100 (East-West)
Z: -100 to 100 (North-South)
Y: Altitude-based (0-20m)
```

**Usage**:
```typescript
import { latLngToPosition3D } from './utils/coordinateConverter'
const position = latLngToPosition3D({ lat: 35.0015, lng: 135.7583 })
// Returns THREE.Vector3(x, 0, z)
```

### WebSocket Communication System

#### Setup
**Server**: `websocket-server.js` (run with `npm run ws`)
**Port**: 8080
**Client Hook**: `src/hooks/useWebSocket.ts`

#### Message Flow
1. **CityRunDemo** sends route request:
```typescript
websocketService.send({
  type: 'NEW_ROUTE',
  start: 'A1',
  destination: 'D1',
  routeData: RouteResponse
})
```

2. **CyberpunkCityDemo** receives and adds vehicle:
```typescript
useWebSocket({
  onNewRoute: (start, destination, routeData) => {
    addVehicle(start, destination, routeData)
  }
})
```

#### Vehicle Management
**Hook**: `src/hooks/useVehicleRoutes.ts`

**State Tracking**:
- `vehicleRoutes`: Array of VehicleRoute objects
- `activeVehicles`: Set of route IDs currently visible
- `addedRouteIdsRef`: Prevents duplicate additions

**Key Methods**:
- `addVehicle()`: Creates VehicleRoute with random color, non-cycling mode
- `removeVehicle()`: Removes from activeVehicles Set (triggered by `onComplete`)
- `extractNodeIds()`: Converts route.nodes to string[] of IDs

### Camera Follow System

#### Hook: `useCameraFollow`
**File**: `src/hooks/useCameraFollow.ts`

**State**:
```typescript
followMode: boolean              // Tracking enabled
selectedVehicleId: string | null // Currently followed vehicle
vehiclePosition: Vector3         // Latest position
vehicleForward: Vector3          // Movement direction
```

**Integration with OrbitControls**:
```typescript
<OrbitControls
  enablePan={!followMode}
  enableZoom={!followMode}
  enableRotate={!followMode}
/>
```

**Camera Animation** (using GSAP):
```typescript
// In CameraFollower component
gsap.to(camera.position, {
  x: targetPosition.x,
  y: targetPosition.y + 30,  // Elevated view
  z: targetPosition.z + 40,  // Behind vehicle
  duration: 1.5
})
```

## Development Workflow

### Running the Project
```bash
npm install              # Install dependencies
npm run ws               # Start WebSocket server (terminal 1)
npm run dev              # Start Vite dev server (terminal 2)
```

**Ports**:
- Vite: `http://localhost:5173`
- WebSocket: `ws://localhost:8080`

**Node Environment**: Requires Node v20+ (tested with v20.19.0, npm 10.8.2)

### Project Structure Conventions

#### File Organization
```
src/
├── components/
│   ├── website/          # CyberpunkCityDemo 3D components (TypeScript)
│   │   ├── Vehicle.tsx   # Main vehicle billboard component
│   │   ├── CityGround.tsx
│   │   └── PathLine.tsx
│   └── cityrun/          # CityRunDemo 2D/Canvas components (TypeScript)
│       ├── FirstPersonView.tsx
│       └── HUDPanel.tsx
├── hooks/                # Custom React hooks (TypeScript)
│   ├── useVehicleProgress.ts   # Speed/movement logic
│   ├── useVehicleAppearance.ts # Texture/rendering
│   └── useWebSocket.ts
├── types/                # TypeScript type definitions
│   ├── routeAPI.ts       # API response schemas
│   └── vehicleTypes.ts   # Vehicle-specific types
├── utils/                # Pure utility functions (TypeScript)
│   ├── routePathGenerator.ts   # Path creation
│   └── coordinateConverter.ts  # Lat/lng → Three.js
└── config/               # Configuration data
    └── vehicleRoutes.ts  # Initial route definitions
```

#### Naming Conventions
- **Components**: PascalCase (e.g., `Vehicle.tsx`, `CityGround.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useVehicleProgress.ts`)
- **Utils**: camelCase (e.g., `routePathGenerator.ts`)
- **Types**: camelCase interfaces/types (e.g., `RouteResponse`, `VehicleMode`)
- **Assets**: snake_case (e.g., `car_front.png`, `kyoto_routes.json`)

### Adding New Routes

#### Method 1: Static Routes (Initial Display)
Edit `src/config/vehicleRoutes.ts`:
```typescript
export const INITIAL_VEHICLE_ROUTES: VehicleRoute[] = [
  {
    id: 'route-1',
    timestamp: Date.now(),
    nodes: [
      { id: 'A1', coordinates: { lat: 34.985849, lng: 135.758766 }, node_type: 'station' },
      { id: 'D1', coordinates: { lat: 34.985849, lng: 135.785000 }, node_type: 'point' }
    ],
    edges: [
      { seq: 1, from: 'A1', to: 'D1', speed_limit: 60, type: 'road', 
        mode: 1, length: 2000, cost: 120000 }
    ],
    name: 'Kyoto Station → Fushimi Inari',
    color: '#00ffff',
    isCycle: false
  }
]
```

#### Method 2: Dynamic Routes (WebSocket)
Send from CityRunDemo or external service:
```javascript
websocketService.send({
  type: 'NEW_ROUTE',
  start: 'Station A',
  destination: 'Temple B',
  routeData: {
    id: 'generated-route-123',
    timestamp: Date.now(),
    nodes: [...],
    edges: [...]
  }
})
```

#### Node Requirements
- Must exist in `public/website-assets/kyoto_routes.json` OR be provided in `routeData.nodes`
- Coordinates within Kyoto bounds (34.88-35.13°N, 135.67-135.80°E)
- Valid `node_type`: 'station' | 'airport' | 'point' | 'outside'

#### Edge Requirements
- `from`/`to` must match node IDs
- `cost` in milliseconds (affects vehicle speed)
- `type` determines altitude and vehicle appearance
- `seq` for proper ordering (must be sequential starting from 1)

### Debugging Tools

#### Console Logging
**Route Path Generation** (enabled in `useRoutePaths.ts`):
```
🛣️ 生成的路径 [车辆ID: route-1]:
  📐 曲线数量: 4
  📏 总长度: 85.32 units
  🔗 曲线段 1/4:
    📌 类型: road
    ⏱️ Cost: 120000ms (120.0s)
    📏 长度: 25.45 units
    📈 高度变化: 0.00m → 0.00m
```

**Speed Calculation** (commented in `useVehicleProgress.ts`, line 80):
```typescript
console.log(`当前曲线段 ${curveIndex}: 类型=${edgeType}, cost=${cost}ms, 速度=${speed.toFixed(4)}`)
```

#### Visual Debugging
**Path Visualization** (in `CityGround.tsx`):
```tsx
<PathLine 
  points={pathPoints} 
  color={edgeType === 'road' ? '#00ffff' : '#ffaa00'} 
/>
```

**Occlusion Detection** (set in `Vehicle.tsx`, line 22):
```typescript
const DEBUG_OCCLUSION = true  // Shows raycasting lines
```

**Performance Monitoring**:
```tsx
import { Stats } from '@react-three/drei'

<Canvas>
  <Stats />
  {/* ... other components */}
</Canvas>
```

### Common Development Patterns

#### Path-Following Component Template
```typescript
export function PathFollower({ path }: { path: THREE.CurvePath }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const progressRef = useRef(0)
  
  useFrame((state, delta) => {
    const t = progressRef.current
    const position = path.getPointAt(t)
    const tangent = path.getTangentAt(t).normalize()
    
    meshRef.current.position.copy(position)
    meshRef.current.lookAt(position.clone().add(tangent))
    
    progressRef.current = (t + 0.1 * delta) % 1.0
  })
  
  return <mesh ref={meshRef}>{/* geometry */}</mesh>
}
```

#### Custom Hook Pattern
```typescript
export function useCustomHook(params) {
  const stateRef = useRef(initialValue)
  
  const updateState = useCallback((newValue) => {
    stateRef.current = newValue
  }, [])
  
  return { stateRef, updateState }
}
```

#### Billboard Sprite Creation
```typescript
const geometry = useMemo(() => {
  const geo = new THREE.PlaneGeometry(1, 1)
  geo.translate(0, 0.5, 0)  // Pivot at bottom
  return geo
}, [])

const material = useMemo(() => {
  return new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide
  })
}, [texture])

// In useFrame
mesh.lookAt(camera.position)  // Billboard effect
```

## Integration Points

### Three.js with React Three Fiber
**Core Concepts**:
- `<Canvas>`: Renderer root, sets up WebGL context
- `useFrame(callback)`: Animation loop (60fps), receives `(state, delta)`
- `useLoader(Loader, path)`: Async asset loading (suspends)
- `useThree()`: Access to renderer, camera, scene, gl

**Performance Best Practices**:
```typescript
// ✅ Good: Memoized geometry
const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

// ❌ Bad: Recreated every render
const geometry = new THREE.BoxGeometry(1, 1, 1)

// ✅ Good: Single material, swap maps
material.map = newTexture
material.needsUpdate = true

// ❌ Bad: New material each frame
const material = new THREE.MeshStandardMaterial({ map: texture })
```

### Asset Loading
**Textures** (synchronous in component):
```typescript
import { useLoader } from '@react-three/fiber'
import { TextureLoader } from 'three'

const texture = useLoader(TextureLoader, '/path/to/texture.png')
```

**GLTF Models** (with Suspense):
```tsx
import { useGLTF } from '@react-three/drei'

function Model() {
  const { scene } = useGLTF('/model.glb')
  return <primitive object={scene.clone()} />
}

useGLTF.preload('/model.glb')  // Preload outside component

// Usage
<Suspense fallback={null}>
  <Model />
</Suspense>
```

### State Management Patterns

#### Local State (Refs)
```typescript
// For animation values that don't need re-renders
const progressRef = useRef(0)

useFrame(() => {
  progressRef.current += 0.01  // No re-render
})
```

#### Shared State (Props)
```typescript
// For parent-child communication
<Vehicle 
  onPositionUpdate={(pos, dir) => setCameraTarget({ pos, dir })} 
/>
```

#### Global State (Context)
```typescript
// For cross-component data (minimal usage in this project)
const SimulationContext = createContext<SimulationState>(null)
```

## TypeScript Configuration

### tsconfig.json Settings
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "moduleResolution": "bundler",
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Type Definitions
**Key Files**:
- `src/types/routeAPI.ts`: API request/response schemas
- `src/types/vehicle.ts`: VehicleRoute (extends RouteResponse)
- `src/types/vehicleTypes.ts`: EdgeType, PathSegmentInfo, CurveUserData

**Custom Type Patterns**:
```typescript
// Discriminated unions
type EdgeType = 'road' | 'highway' | 'drone' | 'airplane'

// Extended interfaces
interface VehicleRoute extends RouteResponse {
  name: string
  color: string
  isCycle: boolean
}

// Curve metadata
interface CurveUserData {
  edgeType: EdgeType
  cost: number
}
```

## Performance Considerations

### Rendering Optimizations
1. **Billboard Sprites** (6 vertices) vs 3D Models (1000+ vertices)
2. **Texture Reuse**: Single material, swap `map` property
3. **Geometry Caching**: `useMemo()` for all geometries/materials
4. **Particle Limits**: 50 particles per system max
5. **Raycasting**: Only when vehicles are on screen

### Memory Management
```typescript
// Clone GLB scenes to avoid shared state
const { scene } = useGLTF('/model.glb')
return <primitive object={scene.clone()} />

// Dispose geometries/materials on unmount
useEffect(() => {
  return () => {
    geometry.dispose()
    material.dispose()
  }
}, [])
```

### Frame Rate Targets
- **Target**: 60fps (16.67ms/frame)
- **Acceptable**: 30fps (33.33ms/frame)
- **Delta Capping**: Prevent physics explosions at low FPS

## Known Issues & Gotchas

1. **Cycle Mode Reversal**: `isCycle=true` makes vehicles ping-pong between start/end (direction × -1)
2. **Cost Requirement**: Missing `cost` in edges defaults to 80000ms (1.33 min)
3. **Drone Descent**: Only descends at route end or when next edge type ≠ 'drone'
4. **Airplane Altitude**: `outside` type nodes trigger 20m; regular nodes use 3m
5. **Z-Fighting**: Use `logarithmicDepthBuffer: true` in Canvas props
6. **Billboard Flipping**: Negative scale on X-axis for horizontal flip (line 256 in Vehicle.tsx)
7. **WebSocket Auto-Reconnect**: Service attempts reconnection but doesn't queue messages
8. **Path Point Deduplication**: EPSILON=1e-6 prevents duplicate consecutive points

## Future Enhancement Ideas

### Planned Features
- AI pathfinding (Dijkstra/A*) for arbitrary start/destination
- Vehicle physics (acceleration, banking on highway curves)
- Weather system (rain/fog affects visibility and speed)
- Multiplayer vehicle tracking
- Real-time traffic density visualization

### API Integration Points
- Route optimization service (replace `mockRouteAPI.ts`)
- Real-time traffic data
- Weather API for dynamic conditions
- User authentication for saved routes

### Performance Targets
- 30+ vehicles simultaneously (current: 3-5)
- VR support (90fps requirement)
- Mobile optimization (30fps acceptable)

---

**Project Status**: Active development
**Last Updated**: Based on codebase analysis November 2025
**Primary Contributors**: Team HAL Future City Project
