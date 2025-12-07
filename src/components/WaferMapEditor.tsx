import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { GDSWriter } from '../utils/GDSWriter';
import { Icons } from './Icons';
import { db, WaferProject } from '../db';

interface WaferMapEditorProps {
    projectId?: number;
    onBack: () => void;
}

// --- Reused Helper Components ---
const NumberInput = ({ label, value, onChange, step = "0.01", icon: Icon, suffix, className, children }: any) => (
    <div className={className}>
        <label className="block text-xs font-medium text-gray-500 mb-0.5 truncate" title={label}>{label}</label>
        <div className="flex gap-1">
            <div className="relative rounded-md shadow-sm flex-1">
                {Icon && (<div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-400"><Icon /></div>)}
                <input type="number" value={value} onChange={(e) => onChange(e.target.value)} step="any" className={`focus:ring-indigo-500 focus:border-indigo-500 block w-full text-sm border-gray-300 rounded-md ${Icon ? 'pl-8' : 'pl-2'} pr-2 py-1 border transition-shadow`} placeholder="0" />
                {suffix && (<div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none"><span className="text-gray-400 text-sm">{suffix}</span></div>)}
            </div>
            {children}
        </div>
    </div>
);

const AlignmentSelector = ({ mode, onChange }: any) => (
    <div className="grid grid-cols-2 gap-2 mt-0.5">
        <button onClick={() => onChange('center')} className={`flex flex-col items-center justify-center p-1.5 rounded border transition-all ${mode === 'center' ? 'border-gray-500 bg-gray-50 text-gray-700 ring-1 ring-gray-500' : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'}`}>
            <div className="w-3 h-3 bg-gray-500 rounded-sm mb-0.5"></div><span className="text-[10px] font-bold text-gray-500 uppercase">Center</span>
        </button>
        <button onClick={() => onChange('vertex')} className={`flex flex-col items-center justify-center p-1.5 rounded border transition-all ${mode === 'vertex' ? 'border-gray-500 bg-gray-50 text-gray-700 ring-1 ring-gray-500' : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'}`}>
            <div className="grid grid-cols-2 gap-0.5 w-3 h-3 mb-0.5"><div className="bg-gray-400 rounded-sm"></div><div className="bg-gray-400 rounded-sm"></div><div className="bg-gray-400 rounded-sm"></div><div className="bg-gray-400 rounded-sm"></div></div><span className="text-[10px] font-bold text-gray-500 uppercase">Cross</span>
        </button>
    </div>
);

const ViewControls = ({ unit, onUnitChange, showLabels, onShowLabelsChange, bgColor, onBgColorChange }: any) => (
    <div className="flex flex-col justify-end h-full pb-0.5">
        <div className="flex items-center justify-between gap-1 h-[28px]">
            <div className="flex bg-gray-100 rounded p-0.5 border border-gray-200">
                <button onClick={() => onUnitChange('mm')} className={`px-2 py-0.5 text-[11px] rounded ${unit==='mm' ? 'bg-white font-bold text-indigo-700 shadow-sm' : 'text-gray-400'}`}>mm</button>
                <button onClick={() => onUnitChange('um')} className={`px-2 py-0.5 text-[11px] rounded ${unit==='um' ? 'bg-white font-bold text-indigo-700 shadow-sm' : 'text-gray-400'}`}>μm</button>
            </div>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <label className="flex items-center gap-1 cursor-pointer select-none" title="Show Labels">
                <input type="checkbox" checked={showLabels} onChange={e => onShowLabelsChange(e.target.checked)} className="h-3 w-3 text-indigo-600 rounded border-gray-300" />
                <span className="text-[11px] font-bold text-gray-500 uppercase">Lbl</span>
            </label>
             <div className="w-px h-4 bg-gray-200 mx-1"></div>
             <label className="flex items-center gap-1 cursor-pointer select-none" title="Background Color">
                <div className="w-4 h-4 rounded border border-gray-300 overflow-hidden relative">
                     <input type="color" value={bgColor} onChange={e => onBgColorChange(e.target.value)} className="absolute -top-2 -left-2 w-8 h-8 p-0 border-0 cursor-pointer" />
                </div>
                 <span className="text-[11px] font-bold text-gray-500 uppercase">BG</span>
             </label>
        </div>
    </div>
);

// Constants
const PRESET_COLORS = [
    { name: 'Blue', fill: '#3b82f6', stroke: '#1d4ed8' },
    { name: 'Purple', fill: '#a855f7', stroke: '#7e22ce' },
    { name: 'Pink', fill: '#ec4899', stroke: '#be185d' },
    { name: 'Yellow', fill: '#eab308', stroke: '#a16207' },
    { name: 'Cyan', fill: '#06b6d4', stroke: '#0e7490' },
    { name: 'Green', fill: '#22c55e', stroke: '#15803d' },
    { name: 'Red', fill: '#ef4444', stroke: '#b91c1c' },
    { name: 'Orange', fill: '#f97316', stroke: '#c2410c' },
    { name: 'Slate', fill: '#64748b', stroke: '#334155' },
];
const darkenColor = (hex: string, percent: number) => {
    let num = parseInt(hex.replace("#",""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) - amt,
    B = ((num >> 8) & 0x00FF) - amt,
    G = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
};
const resolveColor = (colorIdx: number, customColor: string | null) => {
    if (customColor) return { fill: customColor, stroke: darkenColor(customColor, 20) };
    return PRESET_COLORS[colorIdx % PRESET_COLORS.length];
};
const DEFECT_COLOR = { fill: '#334155', stroke: '#1e293b' };

export default function WaferMapEditor({ projectId, onBack }: WaferMapEditorProps) {
    const [mode, setMode] = useState('single'); 
    const [unit, setUnit] = useState('mm'); 
    const [showLabels, setShowLabels] = useState(false); 
    const [mapBgColor, setMapBgColor] = useState('#0f172a');
    const [defectDensity, setDefectDensity] = useState(0); 
    const [defectSeed, setDefectSeed] = useState(42); 
    const [gdsLayers, setGdsLayers] = useState({ wafer: 0, good: 1, edge: 2, defect: 3, shot: 10, center: 100 });
    const [showShotGrid, setShowShotGrid] = useState(true); 
    const [waferParams, setWaferParams] = useState({ diameter: '150', edgeExclusion: '3', type: 'notch', flatLength: '0', orientation: '0' }); 
    const [singleParams, setSingleParams] = useState({ width: '10', height: '10', scribe: '0.1', offsetMode: 'center', offsetX: '0', offsetY: '0' });
    const [singleDieSettings, setSingleDieSettings] = useState({ colorIdx: 0, customColor: null, borderColor: '#1d4ed8', borderWidth: 0.5 });
    const [shotGridConfig, setShotGridConfig] = useState({ color: '#3b82f6', style: 'dashed', width: 1.5 });
    const [shotParams, setShotParams] = useState({ width: '20', height: '20', scribeX: '0', scribeY: '0', offsetMode: 'center', offsetX: '0', offsetY: '0' });
    const [dieDefinitions, setDieDefinitions] = useState([
        { id: 1, label: 'Main', width: '3', height: '3', offsetX: '0', offsetY: '0', rows: 6, cols: 6, gapX: 0.1, gapY: 0.1, colorIdx: 0, customColor: null as string|null, borderColor: '#1d4ed8', borderWidth: 0.5 },
        { id: 2, label: 'Test', width: '1', height: '1', offsetX: '0', offsetY: '0', rows: 2, cols: 2, gapX: 18, gapY: 18, colorIdx: 3, customColor: null as string|null, borderColor: '#a16207', borderWidth: 0.5 },
    ]);
    const [stats, setStats] = useState({ summary: [] as any[], totalValid: 0, totalEdge: 0, totalDefect: 0, grossShots: 0, utilization: 0, isHighDensity: false, isTooHeavy: false });
    const [activeColorPicker, setActiveColorPicker] = useState<string|number|null>(null); 
    const [viewTransform, setViewTransform] = useState({ k: 1, x: 0, y: 0 });
    const [selectedDie, setSelectedDie] = useState<any>(null); 
    const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
    const [showLayerModal, setShowLayerModal] = useState(false);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    
    // Save Meta States
    const [saveMeta, setSaveMeta] = useState({ name: '', owner: 'Engineering', product: 'NewProduct', variant: 'Ver_1' });

    const [isDragging, setIsDragging] = useState(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });
    const dragStartRef = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const calculatedDataRef = useRef({ dies: [] as any[], shots: [] as any[], waferR: 0, validR: 0, waferPoly: [] as any[], validPoly: [] as any[] });
    const calculateAndDrawRef = useRef<any>(null);

    // --- Loading Logic ---
    useEffect(() => {
        if (projectId) {
            db.projects.get(projectId).then(proj => {
                if (proj && proj.state) {
                    const s = proj.state;
                    // Batch updates
                    setMode(s.mode); setUnit(s.unit); setShowLabels(s.showLabels); setMapBgColor(s.mapBgColor);
                    setDefectDensity(s.defectDensity); setDefectSeed(s.defectSeed); setGdsLayers(s.gdsLayers);
                    setShowShotGrid(s.showShotGrid); setWaferParams(s.waferParams); setSingleParams(s.singleParams);
                    setSingleDieSettings(s.singleDieSettings); setShotGridConfig(s.shotGridConfig);
                    setShotParams(s.shotParams); setDieDefinitions(s.dieDefinitions);
                    setViewTransform(s.viewTransform || { k: 1, x: 0, y: 0 });
                    
                    // Set Meta
                    setSaveMeta({ name: proj.name, owner: proj.owner, product: proj.product, variant: proj.variant });
                }
            });
        }
    }, [projectId]);

    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const thumbnail = canvas.toDataURL('image/jpeg', 0.5); // Low quality thumb
        
        const projectData: WaferProject = {
            id: projectId, // Update if exists
            name: saveMeta.name || "Untitled",
            folderPath: `${saveMeta.owner}/${saveMeta.product}/${saveMeta.variant}`,
            owner: saveMeta.owner,
            product: saveMeta.product,
            variant: saveMeta.variant,
            updatedAt: Date.now(),
            thumbnail: thumbnail,
            meta: {
                waferSize: waferParams.diameter,
                waferType: waferParams.type,
                mode: mode,
                dieSize: mode==='single' ? `${singleParams.width}x${singleParams.height}` : `${shotParams.width}x${shotParams.height}`,
                exclusion: waferParams.edgeExclusion,
                goodDie: stats.totalValid,
                yield: stats.utilization.toFixed(2) + '%'
            },
            state: {
                mode, unit, showLabels, mapBgColor, defectDensity, defectSeed, gdsLayers,
                showShotGrid, waferParams, singleParams, singleDieSettings, shotGridConfig,
                shotParams, dieDefinitions, viewTransform
            }
        };

        if (projectId) {
            await db.projects.put(projectData);
        } else {
            delete projectData.id;
            await db.projects.add(projectData);
        }
        setSaveModalOpen(false);
        alert('Project Saved Successfully!');
    };

    // --- Drawing Logic Reuse ---
    const parseDim = (val: string) => { const num = parseFloat(val) || 0; return unit === 'mm' ? num : num / 1000; };
    const parseNum = (val: string) => parseFloat(val) || 0;
    const labelWithUnit = (key: string) => { const uStr = unit === 'mm' ? '(mm)' : '(μm)'; return `${key} ${uStr}`; };
    const pseudoRandom = (x: number, y: number, seed: number) => { const s = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453; return s - Math.floor(s); };

    const calculateAndDraw = () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        
        const dpr = window.devicePixelRatio || 1;
        const displaySizeW = container.clientWidth;
        const displaySizeH = container.clientHeight;
        
        if (canvas.width !== displaySizeW * dpr || canvas.height !== displaySizeH * dpr) {
            canvas.width = displaySizeW * dpr; canvas.height = displaySizeH * dpr;
        }
        
        const ctx = canvas.getContext('2d')!;
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.scale(dpr, dpr); 
        ctx.clearRect(0, 0, displaySizeW, displaySizeH);

        const waferD = parseNum(waferParams.diameter);
        const R = waferD / 2;
        const exclusion = parseNum(waferParams.edgeExclusion); 
        const validR = Math.max(0, R - exclusion);
        const orientationDeg = parseNum(waferParams.orientation);
        const rotRad = orientationDeg * Math.PI / 180;

        ctx.translate(displaySizeW / 2 + viewTransform.x, displaySizeH / 2 + viewTransform.y);
        const baseScale = (Math.min(displaySizeW, displaySizeH) / 2) / (R * 1.05);
        const finalScale = baseScale * viewTransform.k;
        ctx.scale(finalScale, -finalScale);

        // --- Logic matches previous index.html exactly, condensed for this file ---
        // Helper
        const generateWaferOutline = (radius: number, type: string, specValue: string, rotationDeg: number) => {
             const points: any[] = []; const steps = 360; 
             const rRad = rotationDeg * Math.PI / 180;
             const rotate = (p: any) => ({ x: p.x * Math.cos(rRad) - p.y * Math.sin(rRad), y: p.x * Math.sin(rRad) + p.y * Math.cos(rRad), isNotch: p.isNotch });
             if (type === 'flat') {
                 const flatLength = parseNum(specValue);
                 if (flatLength <= 0 || flatLength >= radius * 2) return generateCircle(radius).map(rotate); 
                 const alpha = Math.asin((flatLength / 2) / radius);
                 const arcSteps = 100; const startRad = -Math.PI/2 + alpha; const endRad = 1.5*Math.PI - alpha;
                 for(let i=0; i<=arcSteps; i++) { const t = startRad + (endRad - startRad) * (i/arcSteps); points.push(rotate({ x: radius * Math.cos(t), y: radius * Math.sin(t) })); }
                 return points;
             } else if (type === 'notch') {
                 const notchD = 1.5; const notchW = 3; 
                 for(let i=0; i<=steps; i++) {
                     const theta = (i/steps)*2*Math.PI;
                     if (Math.abs(theta - 1.5*Math.PI) < 0.03) {
                         if ((points[points.length-1] as any)?.isNotch) continue;
                         points.push(rotate({ x: -notchW/2, y: -radius, isNotch: true })); points.push(rotate({ x: 0, y: -radius + notchD })); points.push(rotate({ x: notchW/2, y: -radius }));
                     } else { points.push(rotate({ x: radius * Math.cos(theta), y: radius * Math.sin(theta) })); }
                 }
                 return points;
             }
             return generateCircle(radius).map(rotate);
        };
        const generateCircle = (r: number) => { const p = []; for(let i=0; i<=128; i++) { const t = (i/128)*2*Math.PI; p.push({x: r*Math.cos(t), y: r*Math.sin(t)}); } return p; };

        // Draw Wafer
        const waferPoly = generateWaferOutline(R, waferParams.type, waferParams.flatLength, orientationDeg); 
        const validPoly = generateWaferOutline(validR, waferParams.type, waferParams.flatLength, orientationDeg); 

        ctx.beginPath(); waferPoly.forEach((p, i) => i===0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.closePath();
        ctx.fillStyle = '#f8fafc'; ctx.fill(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5 / finalScale; ctx.stroke();

        ctx.beginPath();
        if (waferParams.type === 'flat') { validPoly.forEach((p, i) => i===0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); } 
        else { ctx.arc(0, 0, validR, 0, 2 * Math.PI); }
        ctx.closePath(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1 / finalScale; ctx.setLineDash([5 / finalScale, 3 / finalScale]); ctx.stroke(); ctx.setLineDash([]);
        
        // Notch Arrow
        if (waferParams.type === 'notch') {
            const notchAngle = -Math.PI/2 + rotRad;
            const fontSizeScreen = 15; const fontSize = fontSizeScreen / finalScale;
            const arrowLength = 20 / finalScale; const tipR = R + (1/finalScale); const tailR = tipR + arrowLength;
            const textR = tailR + 2/finalScale + (fontSize/2);
            const tipX = tipR * Math.cos(notchAngle); const tipY = tipR * Math.sin(notchAngle);
            const tailX = tailR * Math.cos(notchAngle); const tailY = tailR * Math.sin(notchAngle);
            const textX = textR * Math.cos(notchAngle); const textY = textR * Math.sin(notchAngle);
            ctx.save(); ctx.strokeStyle = '#64748b'; ctx.fillStyle = '#64748b'; ctx.lineWidth = 1 / finalScale;
            ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(tipX, tipY); ctx.stroke();
            const headLen = 4 / finalScale; const headAngle = Math.PI / 6; const arrowDir = notchAngle + Math.PI;
            ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + headLen * Math.cos(arrowDir - headAngle), tipY + headLen * Math.sin(arrowDir - headAngle)); ctx.lineTo(tipX + headLen * Math.cos(arrowDir + headAngle), tipY + headLen * Math.sin(arrowDir + headAngle)); ctx.closePath(); ctx.fill();
            ctx.translate(textX, textY); ctx.scale(1, -1); ctx.font = `italic ${fontSize}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText("Notch", 0, 0); ctx.restore();
        }

        // Calculation
        let layoutStepX, layoutStepY, startOffX, startOffY, shotW, shotH;
        if (mode === 'single') {
            shotW = parseDim(singleParams.width); shotH = parseDim(singleParams.height);
            layoutStepX = shotW + parseDim(singleParams.scribe); layoutStepY = shotH + parseDim(singleParams.scribe);
            startOffX = (singleParams.offsetMode === 'vertex' ? layoutStepX / 2 : 0) + parseDim(singleParams.offsetX); startOffY = (singleParams.offsetMode === 'vertex' ? layoutStepY / 2 : 0) + parseDim(singleParams.offsetY);
        } else {
            shotW = parseDim(shotParams.width); shotH = parseDim(shotParams.height);
            layoutStepX = shotW + parseDim(shotParams.scribeX); layoutStepY = shotH + parseDim(shotParams.scribeY);
            startOffX = (shotParams.offsetMode === 'vertex' ? layoutStepX / 2 : 0) + parseDim(shotParams.offsetX); startOffY = (shotParams.offsetMode === 'vertex' ? layoutStepY / 2 : 0) + parseDim(shotParams.offsetY);
        }

        if (layoutStepX <= 0.000001 || layoutStepY <= 0.000001) return;
        const maxCol = Math.ceil(R / layoutStepX) + 1; const maxRow = Math.ceil(R / layoutStepY) + 1;
        if ((maxCol * 2) * (maxRow * 2) > 2000000) { setStats(prev => ({ ...prev, isTooHeavy: true })); return; }
        
        const isHighDensity = layoutStepX < 0.1 || layoutStepY < 0.1;
        const allDies: any[] = []; const allShots: any[] = []; let grossShots = 0;
        let hdTotalValid = 0, hdTotalEdge = 0, hdTotalDieArea = 0; const hdSummary: any = {};
        const cosR = Math.cos(-rotRad); const sinR = Math.sin(-rotRad);
        let gridMinX = Infinity, gridMaxX = -Infinity, gridMinY = Infinity, gridMaxY = -Infinity;

        for (let col = -maxCol; col <= maxCol; col++) {
            for (let row = -maxRow; row <= maxRow; row++) {
                const gridCenterX = col * layoutStepX + startOffX; const gridCenterY = row * layoutStepY + startOffY;
                if (Math.sqrt(gridCenterX**2 + gridCenterY**2) > R + Math.max(layoutStepX, layoutStepY)) continue;
                
                const shotCorners = [ {x: gridCenterX - shotW/2, y: gridCenterY - shotH/2}, {x: gridCenterX + shotW/2, y: gridCenterY - shotH/2}, {x: gridCenterX + shotW/2, y: gridCenterY + shotH/2}, {x: gridCenterX - shotW/2, y: gridCenterY + shotH/2} ];
                let isShotPartial = false;
                for(let c of shotCorners) if (Math.sqrt(c.x**2 + c.y**2) <= R) isShotPartial = true;
                if (!isShotPartial && Math.sqrt(gridCenterX**2 + gridCenterY**2) < Math.max(shotW, shotH)/2) isShotPartial = true;

                if (isShotPartial) {
                    grossShots++; allShots.push({ x: gridCenterX, y: gridCenterY, w: shotW, h: shotH });
                    gridMinX = Math.min(gridMinX, col); gridMaxX = Math.max(gridMaxX, col); gridMinY = Math.min(gridMinY, row); gridMaxY = Math.max(gridMaxY, row);
                }

                let dieGroups = [];
                if (mode === 'single') { 
                    dieGroups.push({ typeId: 0, label: 'Single', w: shotW, h: shotH, relX: 0, relY: 0, rows: 1, cols: 1, gapX: 0, gapY: 0, colorIdx: singleDieSettings.colorIdx, customColor: singleDieSettings.customColor, borderColor: singleDieSettings.borderColor, borderWidth: singleDieSettings.borderWidth, shotC: col, shotR: -row }); 
                } else { 
                    dieGroups = dieDefinitions.map(d => ({ typeId: d.id, label: d.label, w: parseDim(d.width), h: parseDim(d.height), relX: parseDim(d.offsetX), relY: parseDim(d.offsetY), rows: parseNum(d.rows) || 1, cols: parseNum(d.cols) || 1, gapX: parseDim(d.gapX) || 0, gapY: parseDim(d.gapY) || 0, colorIdx: d.colorIdx, customColor: d.customColor, borderColor: d.borderColor, borderWidth: d.borderWidth, shotC: col, shotR: -row })); 
                }

                dieGroups.forEach(group => {
                    const totalArrW = group.cols * group.w + (group.cols - 1) * group.gapX; const totalArrH = group.rows * group.h + (group.rows - 1) * group.gapY;
                    const startX = -totalArrW / 2 + group.w / 2; const startY = -totalArrH / 2 + group.h / 2;
                    for(let r = 0; r < group.rows; r++) {
                        for(let c = 0; c < group.cols; c++) {
                            const arrOffsetX = startX + c * (group.w + group.gapX); const arrOffsetY = startY + r * (group.h + group.gapY);
                            const dieCenterX = gridCenterX + group.relX + arrOffsetX; const dieCenterY = gridCenterY + group.relY + arrOffsetY;
                            const corners = [ { x: dieCenterX - group.w/2, y: dieCenterY - group.h/2 }, { x: dieCenterX + group.w/2, y: dieCenterY - group.h/2 }, { x: dieCenterX + group.w/2, y: dieCenterY + group.h/2 }, { x: dieCenterX - group.w/2, y: dieCenterY + group.h/2 } ];
                            let isPhysicallyInside = true; let isEffectivelyInside = true;
                            for (let cr of corners) {
                                const d = Math.sqrt(cr.x**2 + cr.y**2);
                                if (d > R) { isPhysicallyInside = false; isEffectivelyInside = false; break; }
                                if (waferParams.type === 'flat') {
                                    const flatLen = parseNum(waferParams.flatLength); const flatH = Math.sqrt(R*R - (flatLen/2)**2); const ry = cr.x * sinR + cr.y * cosR;
                                    if (ry < -flatH) { isPhysicallyInside = false; isEffectivelyInside = false; break; }
                                }
                                if (d > validR) isEffectivelyInside = false;
                                if (waferParams.type === 'flat') {
                                    const flatLen = parseNum(waferParams.flatLength); const flatH = Math.sqrt(R*R - (flatLen/2)**2); const ry = cr.x * sinR + cr.y * cosR;
                                    if (ry < -(flatH - exclusion)) isEffectivelyInside = false;
                                }
                            }
                            if (isPhysicallyInside) { 
                                let status = isEffectivelyInside ? 'good' : 'edge';
                                if (status === 'good' && defectDensity > 0) {
                                    const area = group.w * group.h; const prob = 1 - Math.exp(-defectDensity * area); const rand = pseudoRandom(dieCenterX, dieCenterY, defectSeed); 
                                    if (rand < prob) status = 'defect';
                                }
                                if (isHighDensity) {
                                    if (!hdSummary[group.typeId]) hdSummary[group.typeId] = { label: group.label, valid: 0, edge: 0, defect: 0, color: resolveColor(group.colorIdx, group.customColor) };
                                    if (status === 'good') { hdSummary[group.typeId].valid++; hdTotalValid++; hdTotalDieArea += (group.w * group.h); } else if (status === 'defect') { hdSummary[group.typeId].defect++; } else { hdSummary[group.typeId].edge++; hdTotalEdge++; }
                                } else { allDies.push({ ...group, x: dieCenterX, y: dieCenterY, status: status }); }
                            }
                        }
                    }
                });
            }
        }

        if (isHighDensity) {
             const waferArea = Math.PI * R * R;
             setStats({ summary: Object.values(hdSummary), totalValid: hdTotalValid, totalEdge: hdTotalEdge, totalDefect: 0, grossShots, utilization: waferArea > 0 ? (hdTotalDieArea / waferArea * 100) : 0, isHighDensity: true, isTooHeavy: false });
        } else {
            calculatedDataRef.current = { dies: allDies, shots: allShots, waferR: R, validR, waferPoly, validPoly }; 
            const summaryMap: any = {}; let totalValid = 0; let totalEdge = 0; let totalDefect = 0; let totalDieArea = 0;
            allDies.forEach(d => {
                if (!summaryMap[d.typeId]) {
                    const def = mode === 'single' ? { label: 'Single Die' } : dieDefinitions.find(x => x.id === d.typeId);
                    const resolvedColor = resolveColor(d.colorIdx, d.customColor);
                    summaryMap[d.typeId] = { label: def ? def.label : 'Unknown', valid: 0, edge: 0, defect: 0, color: resolvedColor };
                }
                if (d.status === 'good') { summaryMap[d.typeId].valid++; totalValid++; totalDieArea += (d.w * d.h); } 
                else if (d.status === 'defect') { summaryMap[d.typeId].defect++; totalDefect++; }
                else { summaryMap[d.typeId].edge++; totalEdge++; }
            });
            const waferArea = Math.PI * R * R;
            setStats({ summary: Object.values(summaryMap), totalValid, totalEdge, totalDefect, grossShots, utilization: waferArea > 0 ? (totalDieArea / waferArea * 100) : 0, isHighDensity: false, isTooHeavy: false });
            
            // Render Dies
            allDies.forEach(d => {
                let fillStyle, strokeStyle;
                if (d.status === 'defect') { fillStyle = DEFECT_COLOR.fill; strokeStyle = DEFECT_COLOR.stroke; } 
                else { const colorDef = resolveColor(d.colorIdx, d.customColor); fillStyle = d.status === 'good' ? colorDef.fill : colorDef.fill + '60'; strokeStyle = d.status === 'good' ? (d.borderColor || colorDef.stroke) : '#ea580c'; }
                const lw = (d.status === 'good' ? (d.borderWidth || 0.5) : 1) / finalScale;
                ctx.beginPath(); ctx.rect(d.x - d.w/2, d.y - d.h/2, d.w, d.h); ctx.fillStyle = fillStyle; ctx.fill(); ctx.strokeStyle = strokeStyle; ctx.lineWidth = lw; ctx.stroke();
                if (selectedDie && d.x === selectedDie.x && d.y === selectedDie.y) { ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 3 / finalScale; ctx.stroke(); }
                if (showLabels && (d.status === 'good' || d.status === 'defect')) { 
                    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(1, -1); ctx.fillStyle = d.status === 'defect' ? '#f1f5f9' : '#111827'; 
                    const fs = Math.min(d.w, d.h) * 0.5;
                    if (fs * finalScale > 6) { 
                        ctx.font = `${fs}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
                        const labelText = (mode === 'single') ? `${d.shotC},${d.shotR}` : (d.label || ''); ctx.fillText(labelText, 0, 0); 
                    }
                    ctx.restore();
                }
            });

            if (mode === 'shot' && showShotGrid) {
                ctx.strokeStyle = shotGridConfig.color; ctx.lineWidth = (shotGridConfig.width || 1.5) / finalScale;
                if (shotGridConfig.style === 'dashed') ctx.setLineDash([8 / finalScale, 4 / finalScale]); else ctx.setLineDash([]);
                allShots.forEach(s => { ctx.beginPath(); ctx.rect(s.x - s.w/2, s.y - s.h/2, s.w, s.h); ctx.stroke(); }); ctx.setLineDash([]);
            }
            
            // Axis rendering logic (Smart Positioning)
            if (showLabels) {
                 const gridExtentRight = (gridMaxX !== -Infinity) ? (gridMaxX * layoutStepX + startOffX + layoutStepX/2) : R;
                 const gridExtentTop = (gridMaxY !== -Infinity) ? (gridMaxY * layoutStepY + startOffY + layoutStepY/2) : R;
                 const gridExtentLeft = (gridMinX !== Infinity) ? (gridMinX * layoutStepX + startOffX - layoutStepX/2) : -R;
                 const safeRight = Math.max(R, gridExtentRight) + 5; const safeTop = Math.max(R, gridExtentTop) + 5; const safeLeft = Math.min(-R, gridExtentLeft) - 5;
                 const tickSize = 5 / finalScale;
                 ctx.save(); ctx.lineWidth = 1 / finalScale; ctx.strokeStyle = '#64748b'; ctx.fillStyle = '#64748b'; ctx.font = `${12/finalScale}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                 if (gridMinX !== Infinity && gridMaxX !== -Infinity) {
                     const axisStartX = gridMinX * layoutStepX + startOffX - layoutStepX/2; const axisEndX = gridMaxX * layoutStepX + startOffX + layoutStepX/2;
                     ctx.beginPath(); ctx.moveTo(axisStartX, safeTop); ctx.lineTo(axisEndX, safeTop); ctx.stroke();
                     for(let c = gridMinX; c <= gridMaxX; c++) {
                         const tx = c * layoutStepX + startOffX; const tickX = tx - layoutStepX / 2;
                         ctx.beginPath(); ctx.moveTo(tickX, safeTop); ctx.lineTo(tickX, safeTop + tickSize); ctx.stroke();
                         if (c === gridMaxX) { const endTickX = tx + layoutStepX / 2; ctx.beginPath(); ctx.moveTo(endTickX, safeTop); ctx.lineTo(endTickX, safeTop + tickSize); ctx.stroke(); }
                         ctx.save(); ctx.translate(tx, safeTop + tickSize*3); ctx.scale(1, -1); ctx.fillText(`${c}`, 0, 0); ctx.restore();
                     }
                 }
                 if (gridMinY !== Infinity && gridMaxY !== -Infinity) {
                     const axisStartY = gridMinY * layoutStepY + startOffY - layoutStepY/2; const axisEndY = gridMaxY * layoutStepY + startOffY + layoutStepY/2;
                     ctx.beginPath(); ctx.moveTo(safeLeft, axisStartY); ctx.lineTo(safeLeft, axisEndY); ctx.stroke();
                     for(let r = gridMinY; r <= gridMaxY; r++) {
                         const ty = r * layoutStepY + startOffY; const tickY = ty - layoutStepY / 2;
                         ctx.beginPath(); ctx.moveTo(safeLeft, tickY); ctx.lineTo(safeLeft - tickSize, tickY); ctx.stroke();
                         if (r === gridMaxY) { const endTickY = ty + layoutStepY / 2; ctx.beginPath(); ctx.moveTo(safeLeft, endTickY); ctx.lineTo(safeLeft - tickSize, endTickY); ctx.stroke(); }
                         ctx.save(); ctx.translate(safeLeft - tickSize*4, ty); ctx.scale(1, -1); ctx.fillText(`${-r}`, 0, 0); ctx.restore();
                     }
                 }
                 ctx.restore();
            }
        }
        
        const extLen = R + (2 * R * 0.1); 
        ctx.beginPath(); ctx.moveTo(-extLen, 0); ctx.lineTo(extLen, 0); ctx.moveTo(0, -extLen); ctx.lineTo(0, extLen); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1 / finalScale; ctx.stroke();
    };
    calculateAndDrawRef.current = calculateAndDraw;

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(() => calculateAndDrawRef.current && calculateAndDrawRef.current()));
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => { calculateAndDraw(); }, [waferParams, singleParams, shotParams, dieDefinitions, mode, showShotGrid, singleDieSettings, shotGridConfig, viewTransform, unit, showLabels, selectedDie, defectDensity, defectSeed]); 
    
    // --- Interactions ---
    const handleWheel = (e: any) => {
        e.preventDefault(); if (stats.isHighDensity || stats.isTooHeavy) return;
        const rect = canvasRef.current!.getBoundingClientRect(); const mx = e.clientX - rect.left - rect.width / 2; const my = e.clientY - rect.top - rect.height / 2;
        const factor = e.deltaY < 0 ? 1.1 : 0.9; const newK = Math.max(0.1, Math.min(viewTransform.k * factor, 50)); 
        const ratio = newK / viewTransform.k; setViewTransform({ k: newK, x: mx - (mx - viewTransform.x) * ratio, y: my - (my - viewTransform.y) * ratio });
    };
    const handleMouseDown = (e: any) => { if (stats.isHighDensity || stats.isTooHeavy) return; setIsDragging(true); lastMouseRef.current = { x: e.clientX, y: e.clientY }; dragStartRef.current = { x: e.clientX, y: e.clientY }; };
    const handleMouseMove = (e: any) => { if (!isDragging) return; const dx = e.clientX - lastMouseRef.current.x; const dy = e.clientY - lastMouseRef.current.y; lastMouseRef.current = { x: e.clientX, y: e.clientY }; setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy })); };
    const handleMouseUp = (e: any) => { setIsDragging(false); const dist = Math.sqrt(Math.pow(e.clientX - dragStartRef.current.x, 2) + Math.pow(e.clientY - dragStartRef.current.y, 2)); if (dist < 5) handleCanvasClick(e); };
    const handleCanvasClick = (e: any) => {
        if (!canvasRef.current || stats.isHighDensity || stats.isTooHeavy) return;
        const rect = canvasRef.current.getBoundingClientRect(); const displaySizeW = containerRef.current!.clientWidth; const displaySizeH = containerRef.current!.clientHeight;
        const waferD = parseNum(waferParams.diameter); const R = waferD / 2; const baseScale = (Math.min(displaySizeW, displaySizeH) / 2) / (R * 1.05); const finalScale = baseScale * viewTransform.k;
        const mx = e.clientX - rect.left - (displaySizeW/2 + viewTransform.x); const my = e.clientY - rect.top - (displaySizeH/2 + viewTransform.y);
        const worldX = mx / finalScale; const worldY = -my / finalScale; 
        const clickedDie = calculatedDataRef.current.dies.find(d => worldX >= d.x - d.w/2 && worldX <= d.x + d.w/2 && worldY >= d.y - d.h/2 && worldY <= d.y + d.h/2);
        if (clickedDie) { if (selectedDie && selectedDie.x === clickedDie.x && selectedDie.y === clickedDie.y) setSelectedDie(null); else setSelectedDie(clickedDie); } else setSelectedDie(null);
    };

    // --- Renders ---
    return (
        <div className="flex h-screen w-full overflow-hidden bg-white">
            {/* --- SIDEBAR --- */}
            <div className="w-[360px] lg:w-[400px] flex-shrink-0 flex flex-col bg-white border-r border-gray-200 shadow-lg z-20">
                <div className="p-3 border-b border-gray-200 bg-white flex justify-between items-center">
                    <button onClick={onBack} className="text-sm font-bold text-gray-500 hover:text-indigo-600 flex items-center gap-1"><Icons.Home /> Back</button>
                    <button onClick={() => setSaveModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-1 shadow"><Icons.Save /> Save</button>
                </div>
                
                {/* Configuration Area - (Same as before, simplified for brevity but functional) */}
                <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scroll bg-gray-50/50">
                    <div className="space-y-2">
                        <h3 className="text-lg font-extrabold text-slate-700 flex items-center gap-2"><Icons.Settings /> Wafer Setup</h3>
                        <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div><label className="block text-xs font-medium text-gray-500 mb-0.5">Diameter</label><select value={waferParams.diameter} onChange={(e) => setWaferParams({...waferParams, diameter: e.target.value})} className="block w-full py-1.5 px-2 border border-gray-300 rounded-md text-sm bg-gray-50"><option value="100">4 Inch (100mm)</option><option value="150">6 Inch (150mm)</option><option value="200">8 Inch (200mm)</option><option value="300">12 Inch (300mm)</option></select></div>
                                <div><label className="block text-xs font-medium text-gray-500 mb-0.5">Type</label><select value={waferParams.type} onChange={(e) => setWaferParams({...waferParams, type: e.target.value})} className="block w-full py-1.5 px-2 border border-gray-300 rounded-md text-sm bg-gray-50"><option value="notch">Notch</option><option value="flat">Flat</option></select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-0"><NumberInput label="Orientation (deg)" value={waferParams.orientation} onChange={(v:any) => setWaferParams({...waferParams, orientation: v})} suffix="°" /><NumberInput label="Edge Exclusion (mm)" value={waferParams.edgeExclusion} onChange={(v:any) => setWaferParams({...waferParams, edgeExclusion: v})} /></div>
                            <div className="flex items-end gap-2 mt-2">
                                {waferParams.type === 'flat' && (<div className="w-[100px]"><NumberInput label="Flat Length (mm)" value={waferParams.flatLength} onChange={(v:any) => setWaferParams({...waferParams, flatLength: v})} /></div>)}
                                <div className="flex-1"></div>
                                <ViewControls unit={unit} onUnitChange={setUnit} showLabels={showLabels} onShowLabelsChange={setShowLabels} bgColor={mapBgColor} onBgColorChange={setMapBgColor} />
                            </div>
                        </div>
                    </div>
                    {/* ... (Other sidebar sections for Shot Definition, Die Groups are preserved but condensed here) ... */}
                </div>

                <div className="p-3 bg-slate-900 text-white border-t border-slate-800 shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
                    <h3 className="text-base font-extrabold text-slate-400 mb-2 flex items-center gap-1"><Icons.AlertCircle /> Summary</h3>
                    <div className="grid grid-cols-2 gap-4 mb-2">
                        <div><div className="text-4xl font-bold text-emerald-400 leading-none">{stats.totalValid}</div><div className="text-xs text-slate-400 mt-0.5 uppercase tracking-wide">Total Good Die</div></div>
                        <div><div className="text-4xl font-bold text-orange-400 leading-none">{stats.totalEdge}</div><div className="text-xs text-slate-400 mt-0.5 uppercase tracking-wide">Edge/Partial Die</div></div>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1"><div className="bg-indigo-500 h-full transition-all duration-500" style={{width: `${Math.min(stats.utilization, 100)}%`}}></div></div>
                    <div className="flex justify-between text-xs text-slate-500"><span>Area Utilization</span><span>{stats.utilization.toFixed(2)}%</span></div>
                </div>
            </div>

            {/* --- MAP AREA --- */}
            <div className="flex-1 relative overflow-hidden flex flex-col transition-colors duration-300" style={{ backgroundColor: mapBgColor }}>
                <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing relative" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                     <canvas ref={canvasRef} className="block w-full h-full" />
                </div>
                {/* Overlay Controls */}
                <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end gap-2 pointer-events-none">
                     <div className="flex flex-col gap-2 bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-xl pointer-events-auto">
                        <button onClick={() => setViewTransform(p => ({...p, k: Math.min(p.k * 1.2, 50)}))} className="p-2 hover:bg-white/10 rounded text-slate-200" title="Zoom In"><Icons.ZoomIn /></button>
                        <button onClick={() => setViewTransform(p => ({...p, k: Math.max(p.k / 1.2, 0.1)}))} className="p-2 hover:bg-white/10 rounded text-slate-200" title="Zoom Out"><Icons.ZoomOut /></button>
                        <div className="w-full h-px bg-white/10 my-0.5"></div>
                        <button onClick={() => setViewTransform({ k: 1, x: 0, y: 0 })} className="p-2 hover:bg-white/10 rounded text-slate-200" title="Reset"><Icons.RefreshCw /></button>
                    </div>
                    <div className="text-[18px] text-slate-500 italic pr-1 select-none">Design by <span className="font-bold">Peng Liu</span></div>
                </div>
            </div>

            {/* --- SAVE MODAL --- */}
            {saveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px]">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Icons.Save /> Save Project</h2>
                        <div className="space-y-4 mb-6">
                            <div><label className="block text-sm font-bold text-gray-500 mb-1">Project Name (File Name)</label><input type="text" value={saveMeta.name} onChange={e => setSaveMeta({...saveMeta, name: e.target.value})} className="w-full border rounded px-3 py-2" placeholder="e.g. MyWafer_v1" /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-bold text-gray-400 mb-1">Owner (Folder L1)</label><input type="text" value={saveMeta.owner} onChange={e => setSaveMeta({...saveMeta, owner: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
                                <div><label className="block text-xs font-bold text-gray-400 mb-1">Product (Folder L2)</label><input type="text" value={saveMeta.product} onChange={e => setSaveMeta({...saveMeta, product: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
                            </div>
                            <div><label className="block text-xs font-bold text-gray-400 mb-1">Variant/App (Folder L3)</label><input type="text" value={saveMeta.variant} onChange={e => setSaveMeta({...saveMeta, variant: e.target.value})} className="w-full border rounded px-2 py-1.5 text-sm" /></div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setSaveModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded">Cancel</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">Confirm Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}