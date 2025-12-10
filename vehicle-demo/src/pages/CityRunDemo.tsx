import CityRunCore from './CityRunCore';
import './CityRunDemo.css';

/**
 * CityRunDemo 页面
 * 使用真实路线数据（不使用测试数据）
 */
export default function CityRunDemo() {
  return <CityRunCore useSimulationMode={false} />;
}
