import CityRunCore from './CityRunCore';
import './CityRunDemo.css';

/**
 * CityRunSimulation 页面
 * 使用测试数据进行模拟
 * 不显示"走行シミュレーション"按钮
 */
export default function CityRunSimulation() {
  return <CityRunCore useSimulationMode={true} />;
}
