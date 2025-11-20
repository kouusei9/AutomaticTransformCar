# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

node インストール
Install node environment [node js](https://nodejs.org/ja)

node: v20.19.0
npm: 10.8.2
version

## 运行项目

### 1. 安装依赖
```bash
npm install
```

### 2. 启动 WebSocket 服务器（用于 CityRun ↔ CyberpunkCityDemo 通信）
在一个终端窗口运行：
```bash
npm run ws
```
服务器将在 `ws://localhost:8080` 启动

### 3. 启动开发服务器
在另一个终端窗口运行：
```bash
npm run dev
```

### 4. 测试 WebSocket 通信流程
1. 打开浏览器访问 `http://localhost:5173`
2. 在 CityRun 页面选择起始点和目的地
3. 点击 START 按钮
4. 切换到 CyberpunkCityDemo 页面，会看到新车辆自动添加到场景中

## WebSocket 功能说明

- **CityRunDemo**: 点击 START 时通过 WebSocket 发送路线数据
- **CyberpunkCityDemo**: 实时接收路线数据并自动添加新车辆
- **消息类型**: 
  - `NEW_ROUTE`: 新路线消息（包含起点、终点、完整路线数据）
  - `VEHICLE_STATUS`: 车辆状态消息（预留）

environment run
```
npm install
npm run dev
```