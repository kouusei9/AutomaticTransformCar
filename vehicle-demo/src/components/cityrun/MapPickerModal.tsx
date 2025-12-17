import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { RouteResponse } from '../../types/routeAPI';
import { generateRoute, getAvailableLocations, KyotoEdge, type KyotoNode } from '../../utils/kyotoRouteUtils';

interface MapPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedId: string, selectedName: string) => void;
    startLocationId: string;
    destinationId: string;
    selectionMode: 'start' | 'destination';
}

// 路线类型颜色映射
const EDGE_COLORS = {
    road: '#EBCF65',      // 金将
    highway: '#F24B90',   // 香車
    drone: '#13632cff',     // 桂馬
    airplane: '#98B5C2'   // 飛車
};

// 坐标转换：将经纬度转换为Canvas坐标
function latLngToCanvas(lat: number, lng: number, bounds: any, canvasWidth: number, canvasHeight: number) {
    const padding = 30; // 上下左右留出空间，避免标签被裁剪
    const availableWidth = canvasWidth - padding * 2;
    const availableHeight = canvasHeight - padding * 2;
    
    const x = padding + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * availableWidth;
    const y = canvasHeight - padding - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * availableHeight;
    return { x, y };
}

export default function MapPickerModal({ isOpen, onClose, onConfirm, startLocationId, destinationId, selectionMode }: MapPickerModalProps) {
    const [nodes, setNodes] = useState<KyotoNode[]>([]);
    const [edges, setEdges] = useState<KyotoEdge[]>([]);
    const [tempStartNode, setTempStartNode] = useState<string>(startLocationId);
    const [tempDestNode, setTempDestNode] = useState<string>(destinationId);
    const [highlightedRoute, setHighlightedRoute] = useState<RouteResponse | null>(null);
    
    // 内部状态：当前正在选择起点还是终点（独立于外部selectionMode）
    const [internalSelectionMode, setInternalSelectionMode] = useState<'start' | 'destination'>('start');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const mouseMoveRafRef = useRef<number>();

    // 缓存地图边界计算
    const bounds = useMemo(() => {
        if (nodes.length === 0) return null;
        const lats = nodes.map(n => n.coordinates.lat);
        const lngs = nodes.map(n => n.coordinates.lng);
        return {
            minLat: Math.min(...lats) - 0.01,
            maxLat: Math.max(...lats) + 0.01,
            minLng: Math.min(...lngs) - 0.01,
            maxLng: Math.max(...lngs) + 0.01
        };
    }, [nodes]);

    // 初始化临时选择节点和内部选择模式
    useEffect(() => {
        if (isOpen) {
            setTempStartNode(startLocationId);
            setTempDestNode(destinationId);
            
            // 根据外部selectionMode初始化内部状态
            if (selectionMode === 'start') {
                // 点击"着"：第一次选择出发地
                setInternalSelectionMode('start');
            } else {
                // 点击"発"：第一次选择目的地
                setInternalSelectionMode('destination');
            }
        }
    }, [isOpen, startLocationId, destinationId, selectionMode]);

    // 加载地图数据
    useEffect(() => {
        if (!isOpen) return;

        Promise.all([
            getAvailableLocations(),
            fetch('/website-assets/kyoto_routes.json').then(res => res.json())
        ]).then(([locationNodes, routeData]) => {
            setNodes(locationNodes);
            setEdges(routeData.edges || []);
        });
    }, [isOpen]);

    // 当地图打开且有起点和终点时，自动计算并显示路线
    useEffect(() => {
        if (!isOpen || !tempStartNode || !tempDestNode || tempStartNode === tempDestNode) return;

        const calculateInitialRoute = async () => {
            try {
                const route = await generateRoute(tempStartNode, tempDestNode);
                if (route) {
                    console.log('📍 初始路线显示:', route);
                    setHighlightedRoute(route);
                }
            } catch (error) {
                console.error('❌ 初始路线计算失败:', error);
            }
        };

        calculateInitialRoute();
    }, [isOpen, tempStartNode, tempDestNode]);

    // Canvas 尺寸监听
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!isOpen || !canvasRef.current) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setCanvasSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });

        observer.observe(canvasRef.current);
        return () => observer.disconnect();
    }, [isOpen]);

    // 绘制地图
    useEffect(() => {
        if (!isOpen || !canvasRef.current || !bounds) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 设置Canvas尺寸
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const canvasWidth = rect.width;
        const canvasHeight = rect.height;

        // 清空画布
        ctx.fillStyle = '#0A1929';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 绘制网格
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.1)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 10; i++) {
            const x = (canvasWidth / 10) * i;
            const y = (canvasHeight / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvasHeight);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvasWidth, y);
            ctx.stroke();
        }

        // 绘制所有边（路线）
        edges.forEach(edge => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return;

            const from = latLngToCanvas(fromNode.coordinates.lat, fromNode.coordinates.lng, bounds, canvasWidth, canvasHeight);
            const to = latLngToCanvas(toNode.coordinates.lat, toNode.coordinates.lng, bounds, canvasWidth, canvasHeight);

            ctx.strokeStyle = EDGE_COLORS[edge.type as keyof typeof EDGE_COLORS] || '#666666';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        });

        // 绘制高亮路线
        if (highlightedRoute) {
            ctx.globalAlpha = 1;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            for (let i = 0; i < highlightedRoute.nodes.length - 1; i++) {
                const fromNode = highlightedRoute.nodes[i];
                const toNode = highlightedRoute.nodes[i + 1];

                // 双向查找edge，因为路线可能以任意方向遍历边
                const edge = highlightedRoute.edges.find(e =>
                    (e.from === fromNode.id && e.to === toNode.id) ||
                    (e.from === toNode.id && e.to === fromNode.id)
                );

                const from = latLngToCanvas(fromNode.coordinates.lat, fromNode.coordinates.lng, bounds, canvasWidth, canvasHeight);
                const to = latLngToCanvas(toNode.coordinates.lat, toNode.coordinates.lng, bounds, canvasWidth, canvasHeight);

                // 根据edge类型设置颜色
                if (edge && edge.type) {
                    ctx.strokeStyle = EDGE_COLORS[edge.type as keyof typeof EDGE_COLORS] || '#FFFFFF';
                } else {
                    ctx.strokeStyle = '#FFFFFF';
                    console.warn('⚠️ 未找到边的类型:', fromNode.id, '→', toNode.id);
                }

                // 添加阴影效果使高亮更明显
                ctx.shadowColor = ctx.strokeStyle;
                ctx.shadowBlur = 8;

                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }

            // 重置阴影
            ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = 1;

        // 绘制节点（起点和终点使用SVG标记，其他节点用圆圈）
        nodes.forEach(node => {
            // 起点和终点跳过，使用SVG标记显示
            if (node.id === tempStartNode || node.id === tempDestNode) {
                return;
            }

            const pos = latLngToCanvas(node.coordinates.lat, node.coordinates.lng, bounds, canvasWidth, canvasHeight);

            // 节点圆圈
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);

            if (node.id === hoveredNode) {
                ctx.fillStyle = '#EBCF65'; // 金色 - hover
                ctx.shadowColor = '#EBCF65';
                ctx.shadowBlur = 10;
            } else {
                ctx.fillStyle = '#A1E3FF';
                ctx.shadowBlur = 0;
            }

            ctx.fill();
            ctx.shadowBlur = 0;

            // 节点标签（只显示hover的节点名称）
            // if (node.id === hoveredNode) {
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(node.name, pos.x, pos.y - 12);
            // }
        });

    }, [isOpen, bounds, nodes, edges, tempStartNode, tempDestNode, hoveredNode, highlightedRoute, canvasSize]);

    // 处理Canvas点击
    const handleCanvasClick = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !bounds) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 查找最近的节点
        let closestNode: KyotoNode | null = null;
        let minDistance = Infinity;

        nodes.forEach(node => {
            const pos = latLngToCanvas(node.coordinates.lat, node.coordinates.lng, bounds, rect.width, rect.height);
            const distance = Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));

            if (distance < 15 && distance < minDistance) {
                minDistance = distance;
                closestNode = node;
            }
        });

        if (!closestNode) {
            console.log('⚠️ 未找到节点，点击位置:', { x, y });
            return;
        }

        // 检查是否选择了相同的节点
        if (closestNode.id === tempStartNode && closestNode.id === tempDestNode) {
            console.log('⚠️ 出発地と目的地は同じにできません');
            return;
        }

        let newStartId = tempStartNode;
        let newDestId = tempDestNode;

        if (internalSelectionMode === 'start') {
            // 当前正在选择出发地
            console.log('✅ 选择出発地:', closestNode.name);
            newStartId = closestNode.id;
            setTempStartNode(closestNode.id);
            
            // 清除目的地和高亮路线
            newDestId = '';
            setTempDestNode('');
            setHighlightedRoute(null);
            
            // 切换到选择目的地模式
            setInternalSelectionMode('destination');
        } else {
            // 当前正在选择目的地
            console.log('✅ 选择目的地:', closestNode.name);
            newDestId = closestNode.id;
            setTempDestNode(closestNode.id);
            
            // 切换到选择出发地模式
            setInternalSelectionMode('start');
        }

        // 如果起点终点都存在且不同，计算路线
        if (newStartId && newDestId && newStartId !== newDestId) {
            console.log('📍 计算路线:', { start: newStartId, dest: newDestId });
            try {
                const route = await generateRoute(newStartId, newDestId);
                if (route) {
                    console.log('✅ 路线计算成功');
                    setHighlightedRoute(route);
                } else {
                    console.log('⚠️ 无法生成路线');
                    setHighlightedRoute(null);
                }
            } catch (error) {
                console.error('❌ 路线计算失败:', error);
                setHighlightedRoute(null);
            }
        } else {
            setHighlightedRoute(null);
        }
    }, [bounds, nodes, internalSelectionMode, tempStartNode, tempDestNode]);

    // 处理鼠标移动（显示hover效果）- 使用RAF节流
    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !bounds) return;

        // 先提取坐标值，避免事件对象在 RAF 回调时失效
        const clientX = e.clientX;
        const clientY = e.clientY;

        if (mouseMoveRafRef.current) {
            cancelAnimationFrame(mouseMoveRafRef.current);
        }

        mouseMoveRafRef.current = requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;

            let foundNodeId: string | null = null;
            for (const node of nodes) {
                const pos = latLngToCanvas(node.coordinates.lat, node.coordinates.lng, bounds, rect.width, rect.height);
                const distance = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);

                if (distance < 15) {
                    foundNodeId = node.id;
                    break; // 找到第一个就退出，比 forEach 更高效
                }
            }

            setHoveredNode(foundNodeId);
        });
    }, [bounds, nodes]);

    // 清理RAF
    useEffect(() => {
        return () => {
            if (mouseMoveRafRef.current) {
                cancelAnimationFrame(mouseMoveRafRef.current);
            }
        };
    }, []);

    const handleConfirm = useCallback(() => {
        if (tempDestNode && tempStartNode) {
            onConfirm(tempStartNode, tempDestNode);
            onClose();
        }

        // if (selectionMode === 'start') {
        //     const startNode = nodes.find(n => n.id === tempStartNode);
        //     if (startNode) {
        //         console.log('✅ 确认出发地:', startNode.name);
        //         onConfirm(tempStartNode, startNode.name);
        //         onClose();
        //     }
        // } else {
        //     const destNode = nodes.find(n => n.id === tempDestNode);
        //     if (destNode) {
        //         console.log('✅ 确认目的地:', destNode.name);
        //         onConfirm(tempDestNode, destNode.name);
        //         onClose();
        //     }
        // }
    }, [nodes, tempStartNode, tempDestNode, selectionMode, onConfirm, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="relative bg-gradient-to-br from-gray-900 to-black border-2 border-cyan-500/50 rounded-xl p-6 shadow-2xl pointer-events-auto"
                style={{ width: '90vw', height: '90vh', maxWidth: '1600px', maxHeight: '900px' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 标题 */}
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-cyan-400 mb-2">
                        経路を選択
                    </h3>
                    <div className="flex gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1" style={{ backgroundColor: EDGE_COLORS.road }}></div>
                            <span>金将(一般道路)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1" style={{ backgroundColor: EDGE_COLORS.highway }}></div>
                            <span>香車(高速道路)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1" style={{ backgroundColor: EDGE_COLORS.drone }}></div>
                            <span>桂馬(ドローン)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1" style={{ backgroundColor: EDGE_COLORS.airplane }}></div>
                            <span>飛車(航空路線)</span>
                        </div>
                    </div>
                </div>

                {/* 地图Canvas */}
                <div className="relative" style={{ height: 'calc(100% - 140px)' }}>
                    <canvas
                        ref={canvasRef}
                        className="w-full h-full border border-cyan-500/30 rounded cursor-pointer"
                        onClick={handleCanvasClick}
                        onMouseMove={handleCanvasMouseMove}
                    />
                    
                    {/* SVG标记层 - 起点和终点 */}
                    {bounds && canvasRef.current && (
                        <>
                            {/* 起点标记 */}
                            {tempStartNode && (() => {
                                const node = nodes.find(n => n.id === tempStartNode);
                                if (!node) return null;
                                const rect = canvasRef.current!.getBoundingClientRect();
                                const pos = latLngToCanvas(node.coordinates.lat, node.coordinates.lng, bounds, rect.width, rect.height);
                                return (
                                    <div
                                        className="absolute pointer-events-none"
                                        style={{
                                            left: `${pos.x}px`,
                                            top: `${pos.y}px`,
                                            transform: 'translate(-50%, -100%)',
                                            width: 'clamp(30px, 2vw, 60px)',
                                        }}
                                    >
                                        <svg
                                            viewBox="0 0 41 51"
                                            className="w-full h-auto drop-shadow-lg"
                                            preserveAspectRatio="xMidYMid meet"
                                        >
                                            <path
                                                d="M6.07446 10.5L0.574463 50L39.5745 50L34.0745 10.5L20.5745 0.5L6.07446 10.5Z"
                                                fill="#60A5FA"
                                                stroke="#1F2937"
                                                strokeWidth="1"
                                            />
                                            <text
                                                x="20.5"
                                                y="30"
                                                fontSize="20"
                                                fontWeight="bold"
                                                fill="#ffffffff"
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                            >
                                                発
                                            </text>
                                        </svg>
                                    </div>
                                );
                            })()}
                            
                            {/* 终点标记 */}
                            {tempDestNode && (() => {
                                const node = nodes.find(n => n.id === tempDestNode);
                                if (!node) return null;
                                const rect = canvasRef.current!.getBoundingClientRect();
                                const pos = latLngToCanvas(node.coordinates.lat, node.coordinates.lng, bounds, rect.width, rect.height);
                                return (
                                    <div
                                        className="absolute pointer-events-none"
                                        style={{
                                            left: `${pos.x}px`,
                                            top: `${pos.y}px`,
                                            transform: 'translate(-50%, -100%)',
                                            width: 'clamp(30px, 2vw, 60px)',
                                        }}
                                    >
                                        <svg
                                            viewBox="0 0 41 51"
                                            className="w-full h-auto drop-shadow-lg"
                                            preserveAspectRatio="xMidYMid meet"
                                            style={{ transform: 'rotate(180deg)' }}
                                        >
                                            <path
                                                d="M6.07446 10.5L0.574463 50L39.5745 50L34.0745 10.5L20.5745 0.5L6.07446 10.5Z"
                                                fill="#F24B90"
                                                stroke="#1F2937"
                                                strokeWidth="1"
                                            />
                                            <text
                                                x="20.5"
                                                y="30"
                                                fontSize="20"
                                                fontWeight="bold"
                                                fill="#ffffffff"
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                style={{ transform: 'rotate(180deg)', transformOrigin: '20.5px 30px' }}
                                            >
                                                着
                                            </text>
                                        </svg>
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm space-y-1">
                        {/* <div className="text-yellow-300 text-base font-bold mb-2">
                            {internalSelectionMode === 'start' ? '🚩 出発地を選択してください' : '🎯 目的地を選択してください'}
                        </div> */}
                        <div className="text-cyan-300">
                            🚩 出発: {nodes.find(n => n.id === tempStartNode)?.name || '未選択'}
                        </div>
                        <div className="text-pink-300">
                            🎯 目的: {nodes.find(n => n.id === tempDestNode)?.name || '未選択'}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-8 py-3 bg-red-900/80 hover:bg-red-800 text-white text-lg font-bold rounded-lg font-mono transition-colors border-2 border-red-500/50 shadow-lg"
                            style={{
                                backgroundColor: 'rgba(31, 41, 55, 0.9)',
                                textShadow: '0 0 8px rgba(6,182,212,0.8)',
                                boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                                WebkitTapHighlightColor: 'transparent',
                                fontSize: '18px',
                                borderRadius: '12px'
                            }}
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectionMode === 'start' ? !tempStartNode : !tempDestNode}
                            className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-lg font-bold rounded-lg font-mono transition-colors border-2 border-cyan-400/50 shadow-lg"
                            style={{
                                backgroundColor: 'rgba(31, 41, 55, 0.9)',
                                textShadow: '0 0 8px rgba(6,182,212,0.8)',
                                boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
                                WebkitTapHighlightColor: 'transparent',
                                fontSize: '18px',
                                borderRadius: '12px'
                            }}
                        >
                            確定
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
