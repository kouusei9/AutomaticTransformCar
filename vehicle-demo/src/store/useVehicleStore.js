import { create } from 'zustand';

const useVehicleStore = create((set, get) => ({
  // 车辆状态
  vehicle: {
    position: [0, 0.5, 0],
    rotation: 0,
    speed: 0,
    isMoving: false,
  },

  // 路径数据
  route: {
    start: null,
    destination: null,
    path: [],
    distance: 0,
    remainingDistance: 0,
    traveledDistance: 0,  // 已行驶距离
    eta: 0,
    currentIndex: 0,
  },

  // 环境状态
  weather: 'clear', // clear, rain, fog
  timeOfDay: 'night', // morning, day, evening, night

  // UI 状态
  ui: {
    showSequenceDiagram: false,
    currentStep: 0,
    isPlaying: false,
  },

  // 服务器状态（模拟时序图中的交互）
  serverStatus: {
    webServer: 'idle',
    aiServer: 'idle',
    website: 'idle',
  },

  // Actions
  setVehiclePosition: (position) =>
    set((state) => ({
      vehicle: { ...state.vehicle, position },
    })),

  setVehicleMoving: (isMoving) =>
    set((state) => ({
      vehicle: { ...state.vehicle, isMoving },
    })),

  setRoute: (route) =>
    set({ route }),

  setWeather: (weather) =>
    set({ weather }),

  setTimeOfDay: (timeOfDay) =>
    set({ timeOfDay }),

  requestRoute: async (start, destination) => {
    // 模拟时序图流程
    set({ serverStatus: { webServer: 'processing', aiServer: 'idle', website: 'idle' } });
    await new Promise(r => setTimeout(r, 500));

    set({ serverStatus: { webServer: 'waiting', aiServer: 'processing', website: 'idle' } });
    await new Promise(r => setTimeout(r, 1000));

    set({ serverStatus: { webServer: 'waiting', aiServer: 'processing', website: 'processing' } });
    await new Promise(r => setTimeout(r, 500));

    // 生成简单路径（直线）
    const path = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      path.push([
        start[0] + (destination[0] - start[0]) * t,
        0.5,
        start[2] + (destination[2] - start[2]) * t,
      ]);
    }

    const distance = Math.sqrt(
      Math.pow(destination[0] - start[0], 2) +
      Math.pow(destination[2] - start[2], 2)
    );

    set({
      route: {
        start,
        destination,
        path,
        distance: distance.toFixed(2),
        eta: (distance * 2).toFixed(0),
        totalDistance: distance.toFixed(2), // 总距离
        remainingDistance: distance, // 剩余距离（数值类型）
        traveledDistance: 0, // 已行驶距离
        currentIndex: 0, // 当前路径点索引
      },
      serverStatus: { webServer: 'completed', aiServer: 'completed', website: 'completed' },
    });

    // 重置状态
    setTimeout(() => {
      set({ serverStatus: { webServer: 'idle', aiServer: 'idle', website: 'idle' } });
    }, 2000);
  },

  // 更新车辆位置并计算剩余距离
  updateVehicleProgress: () => {
    const { vehicle, route } = get();
    if (!vehicle.isMoving || route.path.length === 0) return;

    const currentIndex = route.currentIndex || 0;
    if (currentIndex >= route.path.length - 1) {
      // 到达终点
      set({
        vehicle: { ...vehicle, isMoving: false },
        route: { ...route, remainingDistance: 0, traveledDistance: parseFloat(route.distance), currentIndex: route.path.length - 1 },
      });
      return;
    }

    // 计算剩余距离
    let remaining = 0;
    for (let i = currentIndex; i < route.path.length - 1; i++) {
      const p1 = route.path[i];
      const p2 = route.path[i + 1];
      remaining += Math.sqrt(
        Math.pow(p2[0] - p1[0], 2) +
        Math.pow(p2[2] - p1[2], 2)
      );
    }

    // 计算已行驶距离
    const traveled = parseFloat(route.distance) - remaining;

    // 更新剩余距离和ETA
    const newEta = Math.max(1, Math.floor(remaining * 2));

    set({
      route: {
        ...route,
        remainingDistance: remaining,
        traveledDistance: traveled,
        eta: newEta,
        currentIndex: currentIndex + 1,
      },
    });
  },

  toggleSequenceDiagram: () =>
    set((state) => ({
      ui: { ...state.ui, showSequenceDiagram: !state.ui.showSequenceDiagram },
    })),

  setCurrentStep: (step) =>
    set((state) => ({
      ui: { ...state.ui, currentStep: step },
    })),

  setIsPlaying: (isPlaying) =>
    set((state) => ({
      ui: { ...state.ui, isPlaying },
    })),

  // 更新路线进度（从 HUDControlPanel 调用）
  updateRouteProgress: (remainingDistance, traveledDistance) => set((state) => ({
    route: {
      ...state.route,
      remainingDistance: remainingDistance,
      traveledDistance: traveledDistance,
    },
  })),
}));

export default useVehicleStore;
