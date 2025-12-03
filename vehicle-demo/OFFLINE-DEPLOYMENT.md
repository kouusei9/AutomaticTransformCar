# 离线部署指南

## ✅ 已完成的离线化配置

### 1. 外部资源本地化
- ✅ **Draco 解码器** (GLB 模型压缩)
  - 位置: `public/draco/`
  - 文件: `draco_decoder.js`, `draco_decoder.wasm`, `draco_wasm_wrapper.js`
  - 配置: 所有 `useGLTF` 调用都指向 `/draco/`

- ✅ **字体文件**
  - 位置: `public/fonts/NotoSansJP-Regular.otf` (16MB，支持日文/中文)
  - 配置: 所有 `Text` 组件都使用 `font="/fonts/NotoSansJP-Regular.otf"`
  - 备注: Noto Sans CJK JP 包含完整的日文汉字、假名和中文字符集，无需从 CDN 加载字形数据

- ✅ **3D 模型**
  - 位置: `public/website-assets/*.glb`
  - 全部本地化

- ✅ **路线数据**
  - 位置: `public/website-assets/*.json`
  - 全部本地化

- ✅ **纹理图片**
  - 位置: `public/assets/` 和 `public/website-assets/`
  - 全部本地化

### 2. 依赖管理
- ✅ 移除未使用的 `mapbox-gl` 依赖
- ✅ 所有 npm 包都在 `node_modules/` 中

## 🚀 部署步骤

### 方案 1：使用 Vite Preview（推荐）

```bash
# 1. 构建项目
npm run build

# 2. 启动预览服务器（本地访问）
npm run preview

# 3. 启动预览服务器（局域网访问）
npx vite preview --host 0.0.0.0 --port 5173
```

### 方案 2：完全离线打包

需要打包的文件/文件夹：
```
dist/                      # 构建后的前端文件
websocket-server.js        # WebSocket 服务器
package.json               # 依赖配置
package-lock.json          # 锁定版本
node_modules/              # 已下载的依赖（或在目标机器重新安装）
```

在目标机器上：
```bash
# 如果带了 node_modules，直接运行
node websocket-server.js              # 终端 1: 启动 WebSocket
npx vite preview --port 5173          # 终端 2: 启动前端

# 如果没带 node_modules，先安装
npm install                           # 需要联网
node websocket-server.js
npx vite preview --port 5173
```

### 方案 3：使用静态文件服务器

```bash
# Python (如果系统有 Python)
cd dist
python3 -m http.server 5173

# Node.js (需要先在联网环境安装 http-server)
npm install -g http-server
http-server dist -p 5173
```

## 🌐 局域网访问配置

### 修改 WebSocket 连接地址（如需要）

文件: `src/services/websocketService.ts`

```typescript
// 当前配置（仅本地）
connect(url: string = 'ws://localhost:8080')

// 改为动态 IP（支持局域网）
connect(url: string = `ws://${window.location.hostname}:8080`)
```

### 启动服务器时绑定所有网络接口

```bash
# Vite 开发服务器
npm run dev  # 已配置 --host 0.0.0.0

# Vite 预览服务器
npx vite preview --host 0.0.0.0 --port 5173

# WebSocket 服务器（默认已绑定 0.0.0.0）
node websocket-server.js
```

### 获取本机 IP 地址

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

然后其他设备访问: `http://<你的IP>:5173`

## 📋 离线运行检查清单

### 构建前检查
- [ ] 已下载 Draco 解码器到 `public/draco/`
- [ ] 已下载字体文件到 `public/fonts/`
- [ ] 所有 GLB 模型在 `public/website-assets/`
- [ ] 所有 JSON 数据在 `public/website-assets/`
- [ ] `npm install` 已完成

### 构建后检查
- [ ] `dist/` 文件夹包含构建结果
- [ ] `dist/draco/` 包含 3 个解码器文件
- [ ] `dist/fonts/` 包含字体文件
- [ ] `dist/website-assets/` 包含所有资源
- [ ] 浏览器控制台无 "Failed to fetch" 错误

### 运行时检查
- [ ] WebSocket 服务器在 8080 端口运行
- [ ] 前端服务器在 5173 端口运行
- [ ] 浏览器可以访问 `http://localhost:5173`
- [ ] 3D 场景正常加载
- [ ] 车辆模型正常显示
- [ ] 文字标签正常显示
- [ ] 无网络请求错误

## 🔧 故障排查

### 问题 1: "Failed to fetch" 错误

**原因**: 仍有资源尝试从外部 CDN 加载

**解决**: 
1. 打开浏览器开发者工具 → Network 标签
2. 查看失败的请求 URL
3. 下载对应资源到 `public/` 目录
4. 修改代码指向本地路径
5. 重新构建 `npm run build`

### 问题 2: 模型不显示

**原因**: Draco 解码器路径不正确

**检查**:
- `public/draco/` 是否有 3 个文件
- 所有 `useGLTF` 是否传入第二个参数 `'/draco/'`
- 控制台是否有解码器加载错误

### 问题 3: 文字不显示

**原因**: 字体文件未加载或格式不支持

**检查**:
- `public/fonts/Arial.ttf` 是否存在
- 所有 `<Text>` 组件是否有 `font="/fonts/Arial.ttf"` 属性
- 字体格式必须是 TTF 或 OTF，不能是 WOFF/WOFF2
- 如需使用其他字体，从系统字体目录复制：
  ```bash
  # macOS
  cp /System/Library/Fonts/Supplemental/Arial.ttf public/fonts/
  # 或其他字体
  ls /System/Library/Fonts/
  ```

### 问题 4: WebSocket 连接失败

**原因**: WebSocket 服务器未启动或端口冲突

**解决**:
```bash
# 检查 8080 端口是否被占用
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows

# 更改 WebSocket 端口
# 修改 websocket-server.js 中的 PORT
# 修改 src/services/websocketService.ts 中的默认端口
```

## 📦 完整打包示例

```bash
# 1. 准备构建
npm install
npm run build

# 2. 创建部署包
mkdir vehicle-demo-offline
cp -r dist vehicle-demo-offline/
cp websocket-server.js vehicle-demo-offline/
cp package.json vehicle-demo-offline/
cp package-lock.json vehicle-demo-offline/

# 如果目标机器无 node_modules，可以打包（文件较大）
cp -r node_modules vehicle-demo-offline/

# 3. 压缩
tar -czf vehicle-demo-offline.tar.gz vehicle-demo-offline/

# 4. 传输到目标机器后
tar -xzf vehicle-demo-offline.tar.gz
cd vehicle-demo-offline

# 如果没有 node_modules
npm install

# 启动服务
node websocket-server.js &
npx vite preview --host 0.0.0.0 --port 5173
```

## 🎯 性能优化建议

### 减小打包体积
当前构建大小约 1.5MB，如需优化：

1. **代码分割**
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'react': ['react', 'react-dom'],
          'drei': ['@react-three/drei']
        }
      }
    }
  }
}
```

2. **压缩 GLB 模型**
- 使用 gltf-pipeline 压缩模型
- 启用 Draco 压缩

3. **图片优化**
- PNG → WebP 格式
- 减小纹理分辨率

## ✅ 验证清单

部署完成后，在浏览器中验证：

```
✓ 打开 http://localhost:5173 或 http://<IP>:5173
✓ 看到京都城市 3D 场景
✓ 看到建筑物模型
✓ 看到神社模型
✓ 看到摩天大楼
✓ 看到路线线条
✓ 看到位置标记和文字标签
✓ 车辆在路线上移动
✓ 控制台无红色错误
✓ Network 标签无失败请求（除了 WebSocket 初始连接可能失败，这是正常的）
```

---

**最后更新**: 2025-12-03
**测试环境**: macOS, Node v20.19.0, npm 10.8.2
