# CityRunDemo - Three.js 车辆前进动画场景

## 概述
基于 React + Three.js (React Three Fiber) 的3D车辆驾驶模拟场景，支持第一人称和第三人称视角切换。

## 文件结构

### 核心组件 (src/components/cityrun/)
1. **ThreeScene.tsx** - 主场景容器
   - 使用 React Three Fiber 的 Canvas 组件
   - 配置相机、光照、雾效
   - 赛博朋克主题配色（蓝色霓虹光效）

2. **RoadSystem.tsx** - 道路系统
   - 加载 road01.png 纹理实现无限滚动道路
   - 蓝色霓虹边缘线（左右两侧）
   - 点光源营造霓虹光效
   - 当 `isMoving=true` 时，纹理偏移模拟前进

3. **SideScenery.tsx** - 路边建筑
   - 使用 view_side1.png 作为建筑纹理
   - 左右对称两侧，带透视旋转
   - 纹理垂直滚动模拟前进
   - 轻微晃动效果增加真实感

4. **FirstPersonView.tsx** - 第一人称视角
   - 固定车内仪表盘 (car03.png) 在相机前方
   - 仪表盘底部霓虹光效
   - 视角位于车内

5. **ThirdPersonView.tsx** - 第三人称视角
   - 车辆精灵 (car_back.png) 位于场景中心
   - 相机位于车后方 (0, 2.5, 6)
   - 车辆轻微上下左右晃动
   - 车底霓虹环光效
   - 周围多个点光源营造立体感

6. **HUDPanel.tsx** - 控制面板 UI
   - START/STOP 按钮控制车辆移动
   - 视角切换按钮（第一/第三人称）
   - 实时显示速度和当前视角
   - 赛博朋克风格 UI 设计

### 主页面 (src/pages/)
7. **CityRunDemo.tsx** - 主页面
   - 管理 `isMoving` 和 `isFirstPerson` 状态
   - 集成所有子组件
   - 黑色背景 + 页面标题

### 路由集成 (src/App.jsx)
- 添加 "シティランデモ" 按钮
- 通过 `currentPage='cityrun'` 切换到 CityRunDemo 页面

## 技术实现

### React Three Fiber 使用模式
```tsx
// 1. Canvas 容器包裹所有3D内容
<Canvas camera={{...}} gl={{...}}>
  <color attach="background" args={[...]} />
  <fog attach="fog" args={[...]} />
  <ambientLight ... />
  {children}
</Canvas>

// 2. useLoader 加载纹理
const texture = useLoader(THREE.TextureLoader, '/assets/texture.png');

// 3. useFrame 动画循环
useFrame((state, delta) => {
  // 每帧执行的逻辑
  texture.offset.y += delta * speed;
});

// 4. 声明式网格/几何体
<mesh position={[0, 0, 0]}>
  <planeGeometry args={[width, height]} />
  <meshBasicMaterial map={texture} />
</mesh>
```

### 关键功能

#### 无限滚动道路
- 纹理 `wrapS/wrapT = RepeatWrapping`
- 纹理 `repeat.set(2, 20)` 重复平铺
- 动画循环中更新 `offset.y` 实现滚动

#### 视角切换
- **第一人称**: 仪表盘固定在相机前方，相机不移动
- **第三人称**: 相机位于车后，车辆居中，车辆有晃动动画

#### 霓虹光效
- 主色调: `0x00d4ff` (青色霓虹)
- 辅助色: `0xff00ff` (紫色霓虹)
- 使用 `pointLight` 和 `directionalLight` 组合
- 材质发光使用 `MeshBasicMaterial` 的 `color` 属性

## 资源依赖

### 图片资源 (public/assets/)
- `road01.png` - 道路纹理
- `view_side1.png` - 路边建筑纹理
- `car03.png` - 车内仪表盘
- `car_back.png` - 车辆背面

### NPM 包
- `three` - Three.js 核心库
- `@react-three/fiber` - React Three.js 渲染器
- `@react-three/drei` - Three.js 辅助工具库（如果需要更多功能）

## 使用方法

### 启动项目
```bash
npm run dev
```

### 访问页面
1. 打开浏览器访问 http://localhost:5173
2. 点击顶部导航栏 "シティランデモ" 按钮
3. 点击 START 开始动画
4. 点击视角切换按钮切换第一/第三人称
5. 点击 STOP 暂停动画

## 扩展建议

### 性能优化
- 使用 `useMemo` 缓存几何体和材质
- 限制粒子系统数量
- 使用 LOD (Level of Detail) 系统

### 功能增强
- 添加速度控制滑块
- 添加车辆转向动画
- 添加更多路边建筑变体
- 添加天气效果（雨、雾等）
- 添加音效（引擎声、环境音）

### 交互性
- 键盘控制（WASD/方向键）
- 鼠标拖拽调整相机
- VR 支持

## 注意事项

1. **纹理路径**: 所有纹理路径必须是 `/assets/xxx.png`（相对于 public 目录）
2. **组件导入**: 使用 `.tsx` 扩展名显式导入以避免模块解析错误
3. **性能**: 大型纹理会影响性能，建议压缩图片
4. **浏览器兼容**: 需要支持 WebGL 的现代浏览器

## 参考资源
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber
- Three.js: https://threejs.org/docs/
- React Three Drei: https://github.com/pmndrs/drei
