/**
 * 车辆模式枚举
 * 使用将棋棋子命名
 */
export enum VehicleMode {
  NORMAL = 1,   // 金将 - 通常モード
  HIGHWAY = 2,  // 香車 - 高速モード
  DRONE = 3,    // 桂馬 - ドローンモード
  FLIGHT = 4    // 飛車 - 飛行モード
}

/**
 * 模式调色板
 */
export interface ModePalette {
  from: string;
  to: string;
  primary: string;
}

/**
 * 模式配置
 */
export interface ModeConfig {
  char: string;
  name: string;
  palette: ModePalette;
  speedMultiplier: number;
}

/**
 * 模式配置表
 */
export const MODE_CONFIG: Record<VehicleMode, ModeConfig> = {
  [VehicleMode.NORMAL]: {
    char: '金',
    name: '金将',
    palette: { from: '#F2D56A', to: '#FFF4CC', primary: '#F2D56A' },
    speedMultiplier: 1.0
  },
  [VehicleMode.HIGHWAY]: {
    char: '香',
    name: '香車',
    palette: { from: '#E8BAA0', to: '#F0F0F0', primary: '#E8BAA0' },
    speedMultiplier: 2.5
  },
  [VehicleMode.DRONE]: {
    char: '桂',
    name: '桂馬',
    palette: { from: '#C1CB93', to: '#E8BAA0', primary: '#C1CB93' },
    speedMultiplier: 2.0
  },
  [VehicleMode.FLIGHT]: {
    char: '飛',
    name: '飛車',
    palette: { from: '#ADC6D7', to: '#F2D56A', primary: '#ADC6D7' },
    speedMultiplier: 7.5
  }
};

/**
 * 模式颜色映射（用于地图等UI组件）
 */
export const MODE_COLORS: Record<VehicleMode, string> = {
  [VehicleMode.NORMAL]: '#06b6d4',
  [VehicleMode.HIGHWAY]: '#f59e0b',
  [VehicleMode.DRONE]: '#8b5cf6',
  [VehicleMode.FLIGHT]: '#ec4899'
};

/**
 * 获取模式颜色
 */
export function getModeColor(mode: VehicleMode): string {
  return MODE_COLORS[mode] ?? '#9ca3af';
}