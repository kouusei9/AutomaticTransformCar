# Copilot Instructions: Vehicle Demo (Kyoto Future City Navigation)

## Project Overview
3D vehicle navigation demo showcasing Kyoto city with multi-modal transportation (road, highway, drone, airplane). Built with React, Three.js (via React Three Fiber), and Zustand. Features two distinct modes: **CyberpunkCityDemo** (3D top-down navigation) and **MobileDemo** (first-person driving simulator).

## Architecture & Core Concepts

### Dual-Mode Structure
The app (`src/App.jsx`) switches between two completely independent pages:
- **CyberpunkCityDemo** (`src/pages/CyberpunkCityDemo.tsx`): 3D city view with multiple AI vehicles following predefined routes
- **MobileDemo** (`src/pages/MobileDemo.jsx`): First-person driving view with HUD and canvas-based scene rendering

### Route System & Graph-Based Navigation
Routes are defined in `public/website-assets/kyoto_routes.json` as a **graph structure**:
- **Nodes**: Geographic locations with `{id, name, coordinates: {lat, lng}, type?}`
- **Edges**: Connections with `{from, to, distance_km, type}` where `type` is `road|highway|drone|airplane`

**Critical**: Vehicle paths are generated using `createRoutePathFromNodeIds()` in `src/utils/routePathGenerator.ts`, which:
1. Takes a sequence of node IDs (e.g., `['D1', 'H1', 'OUT_H1']`)
2. Automatically handles altitude transitions for different edge types (ground→0m, highway→3m, drone→10m, airplane→20m)
3. Creates `THREE.CurvePath` with smooth bezier curves for highways/airplanes and vertical transitions for drones
4. Stores `edgeType` in each curve segment's `userData` for vehicle mode switching

### Vehicle Transformation System
Vehicles in `src/components/website/Vehicle.tsx` dynamically switch modes based on the current path segment's `edgeType`:
- **Road** (0m): Uses `car_front/back/side.png`, ground movement with wind particles
- **Highway** (3m): Uses `high_car_front/back/side.png`, 2x speed, curved paths (3m→9m→3m arc)
- **Drone** (10m): Uses `drone_front/back/side.png`, vertical transitions, flame particles during flight
- **Airplane** (20m): Uses `airplane_front/back/side.png`, smooth cubic bezier curves for takeoff/landing

**Key Pattern**: Vehicles are billboard sprites that dynamically select textures based on camera angle (`dotForward` vs `dotRight`). Side view mode can be fixed (perpendicular to path) or follow (always face camera) via `SIDE_VIEW_FIXED_MODE` constant.

### Coordinate System
All geographic data is converted via `src/utils/coordinateConverter.ts`:
- **Input**: Lat/Lng coordinates (Kyoto area: 34.88-35.13°N, 135.67-135.80°E)
- **Output**: Three.js coordinates (-100 to 100 on X/Z axes, centered at origin)
- **Altitudes**: Defined in `src/utils/constants.ts` (GROUND_Y=0, HIGHWAY_ALTITUDE=3, DRONE_ALTITUDE=10, AIRPLANE_ALTITUDE=20)

### State Management (Zustand)
`src/store/useVehicleStore.js` manages global state:
- **vehicle**: position, rotation, speed, movement state
- **route**: start/destination, path points, distance, ETA
- **ui**: sequence diagram visibility, playback state
- **Actions**: `requestRoute()` simulates API calls with server status updates; `updateVehicleProgress()` tracks position along path

## Development Workflow

### Running the Project
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
```

**Node Environment**: Requires Node v20+ (confirmed working with v20.19.0, npm 10.8.2)

### File Organization Conventions
- **TypeScript**: Use for new 3D components in `src/components/website/` (prefer `.tsx`)
- **JSX**: Used for canvas-based mobile components in `src/components/mobile/`
- **Naming**: 
  - 3D scene components: PascalCase (e.g., `CityGround.tsx`, `Vehicle.tsx`)
  - Utilities: camelCase (e.g., `routePathGenerator.ts`, `coordinateConverter.ts`)
  - Data files: snake_case in `public/website-assets/` (e.g., `kyoto_routes.json`, `car_front.png`)

### Adding New Vehicles/Routes
1. Update `VEHICLE_ROUTES` array in `CyberpunkCityDemo.tsx` with `{id, name, nodeIds, color, speed, isCycle}`
2. Ensure node IDs exist in `kyoto_routes.json` and edges connect them
3. Add vehicle index to `activeVehicles` state (e.g., `new Set([0, 1, 2, 3])`)
4. Path generation is automatic via `createRoutePathFromNodeIds()`

### Camera Control Patterns
- **OrbitControls**: Disabled when `followMode=true` (vehicle tracking)
- **Camera Following**: Uses `gsap` for smooth transitions, lerps position/target in `useFrame()`
- **Click to Track**: Vehicles pass `onClick` callbacks to toggle follow mode (see `handleVehicleClick` in `CyberpunkCityDemo.tsx`)

## Key Integration Points

### Three.js with React Three Fiber
- Use `<Canvas>` from `@react-three/fiber` as root
- `useFrame()` for animation loops (runs every frame)
- `useGLTF()` and `useTexture()` from `@react-three/drei` for asset loading
- Always wrap GLB models in `<Suspense>` and call `useGLTF.preload()` outside component

### Asset Management
- **3D Models**: `.glb` files in `public/website-assets/` (e.g., `futuristic_city.glb`, `shrine.glb`)
- **Textures**: PNG sprites for vehicles (front/back/side views for each mode)
- **Map Data**: JSON files for routes (`kyoto_routes.json`), buildings (`kyoto_city.json`), shrines (`kyoto_shrine.json`)
- **Base Map**: `routes_map.png` rendered on ground plane via `GroundPlane` component

### Performance Optimizations
- Use `useMemo()` for geometry/material creation
- Clone GLB scenes instead of reusing: `scene.clone()` in `useMemo()`
- Limit particle systems (50 wind particles, 50 flame particles per vehicle)
- Billboard sprites reduce poly count vs 3D models
- Texture reuse: Single material with dynamic `map` swapping

## Common Patterns

### Creating Path-Following Components
```typescript
useFrame(() => {
  const t = progressRef.current
  const position = path.getPointAt(t)
  const tangent = path.getTangentAt(t).normalize()
  meshRef.current.position.copy(position)
  progressRef.current = (t + speed * delta) % 1
})
```

### Altitude-Based Mode Switching
```typescript
const edgeType = getCurrentEdgeType(path, progressRef.current)
const targetAltitude = edgeType === 'drone' ? DRONE_ALTITUDE : GROUND_Y
// Add vertical transition segments before horizontal movement
```

### Billboard Texturing with Camera Awareness
```typescript
const toCameraDir = new THREE.Vector3().subVectors(camera.position, position).normalize()
const dotForward = tangent.dot(toCameraDir)
const selectedTexture = dotForward > 0 ? frontTexture : backTexture
material.map = selectedTexture
```

## Project-Specific Gotchas

1. **Path Closure**: Route generation uses `isCycle` to determine if vehicles reverse at end (cycle) or stop (one-way)
2. **Altitude Transitions**: Drones require explicit vertical segments via `addVerticalTransition()` with `VERTICAL_DISTANCE_MULTIPLIER`
3. **Highway Curves**: Use `QuadraticBezierCurve3` with midpoint at 9m to create arc effect (3m→9m→3m)
4. **Outside Nodes**: Nodes with `type: 'outside'` represent map boundaries (e.g., airports) for airplane routes
5. **Billboard Pivot**: Geometry is translated `(0, 0.5, 0)` so origin is at bottom-center for proper ground placement
6. **Canvas Refs**: Mobile components use `useRef` for animation state (e.g., `roadOffsetRef.current`) to avoid re-render loops

## TypeScript Configuration
- **Target**: ES2020 with bundler resolution
- **JSX**: react-jsx (automatic runtime)
- **Strict Mode**: Enabled with noUnusedLocals/Parameters
- **Note**: `.jsx` files don't get type checking; prefer `.tsx` for new components

## Testing & Debugging
- No automated tests currently (manual QA only)
- Use React DevTools for Zustand state inspection
- Three.js Inspector: Add `<Stats />` from `@react-three/drei` for FPS monitoring
- Path visualization: `<PathLine>` components in `CityGround.tsx` show route graph (colored by type)

---

**Questions to Clarify**: 
- Should new routes use real Kyoto geographic data or fictional coordinates?
- Are there plans to add AI pathfinding between arbitrary nodes (Dijkstra/A*)?
- Should vehicle physics (acceleration, banking on curves) be implemented?
