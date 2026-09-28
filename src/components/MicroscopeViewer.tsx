import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  Eye,
  EyeOff,
  Sun,
  Layers,
  Grid,
  Tag,
  X,
} from 'lucide-react';
import { CellularConstituent, UserAnnotation } from '../types/histology';

interface MicroscopeViewerProps {
  imageSrc?: string;
  svgContent?: string;
  // Segmentação de núcleos do motor local (data URL) — melhoria 2026-09-28.
  overlaySrc?: string;
  title: string;
  staining: string;
  magnification?: string;
  constituents: CellularConstituent[];
  selectedConstituent: CellularConstituent | null;
  onSelectConstituent: (c: CellularConstituent) => void;
  // User Annotations Props
  userAnnotations?: UserAnnotation[];
  onAddAnnotation?: (ann: UserAnnotation) => void;
  isDrawingMode?: boolean;
  onToggleDrawingMode?: (active: boolean) => void;
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
}

export const MicroscopeViewer: React.FC<MicroscopeViewerProps> = ({
  imageSrc,
  svgContent,
  overlaySrc,
  title,
  staining,
  constituents,
  selectedConstituent,
  onSelectConstituent,
  userAnnotations = [],
  onAddAnnotation,
  isDrawingMode = false,
  onToggleDrawingMode,
  selectedAnnotationId,
  onSelectAnnotation,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true);
  const [showUserAnnotations, setShowUserAnnotations] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [objectiveLens, setObjectiveLens] = useState<string>('40x');
  const [showOverlay, setShowOverlay] = useState<boolean>(false);

  // Mostra a segmentação automaticamente quando chega um overlay novo.
  useEffect(() => {
    if (overlaySrc) setShowOverlay(true);
  }, [overlaySrc]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // New annotation labeling modal
  const [pendingBox, setPendingBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [newLabel, setNewLabel] = useState<string>('');
  const [newCategory] = useState<string>('Estrutura Celular');
  const [newNotes, setNewNotes] = useState<string>('');
  const [newColor] = useState<string>('#f59e0b');

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Reset view when slide changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [title]);

  // When a constituent is selected externally, smoothly pan to its pinpoint
  useEffect(() => {
    if (selectedConstituent?.pinpoint && containerRef.current) {
      const { x, y } = selectedConstituent.pinpoint;
      const targetX = -(x - 50) * 4 * zoom;
      const targetY = -(y - 50) * 3 * zoom;
      setPan({ x: targetX, y: targetY });
    }
  }, [selectedConstituent, zoom]);

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDrawingMode) {
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      setIsDrawing(true);
      setDrawStart({ x: Math.max(0, Math.min(100, xPercent)), y: Math.max(0, Math.min(100, yPercent)) });
      setCurrentBox({
        x: Math.max(0, Math.min(100, xPercent)),
        y: Math.max(0, Math.min(100, yPercent)),
        width: 0,
        height: 0,
      });
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDrawingMode && isDrawing && stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const currentY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      const x = Math.min(drawStart.x, currentX);
      const y = Math.min(drawStart.y, currentY);
      const width = Math.abs(currentX - drawStart.x);
      const height = Math.abs(currentY - drawStart.y);

      setCurrentBox({ x, y, width, height });
    } else if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (isDrawingMode && isDrawing && currentBox) {
      setIsDrawing(false);
      if (currentBox.width > 2 && currentBox.height > 2) {
        setPendingBox(currentBox);
        setNewLabel('');
        setNewNotes('');
      }
      setCurrentBox(null);
    } else {
      setIsDragging(false);
    }
  };

  const handleSavePendingAnnotation = () => {
    if (!pendingBox || !newLabel.trim() || !onAddAnnotation) return;

    const annotation: UserAnnotation = {
      id: `ann_${Date.now()}`,
      label: newLabel.trim(),
      category: newCategory,
      notes: newNotes.trim() || undefined,
      color: newColor,
      x: pendingBox.x,
      y: pendingBox.y,
      width: pendingBox.width,
      height: pendingBox.height,
      timestamp: new Date().toISOString(),
    };

    onAddAnnotation(annotation);
    setPendingBox(null);
    if (onToggleDrawingMode) {
      onToggleDrawingMode(false);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.min(Math.max(0.75, prev * zoomFactor), 6));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
  };

  const handleObjectiveChange = (lens: string, zoomVal: number) => {
    setObjectiveLens(lens);
    setZoom(zoomVal);
    setPan({ x: 0, y: 0 });
  };

  const scaleMicrons = Math.round(50 / zoom);

  return (
    <div className="relative flex flex-col h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl select-none">
      {/* Microscope Top HUD Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-100 truncate max-w-[240px] sm:max-w-md">{title}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 hidden sm:inline">{staining}</span>
        </div>

        {/* Objective Lens Turret Selector */}
        <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-500 px-1 font-mono uppercase">Objetiva:</span>
          {[
            { label: '4x', zoom: 0.85, name: 'Panorâmica' },
            { label: '10x', zoom: 1.25, name: 'Pequeno aumento' },
            { label: '40x', zoom: 2.2, name: 'Médio aumento' },
            { label: '100x', zoom: 3.8, name: 'Imersão' },
          ].map((obj) => (
            <button
              key={obj.label}
              onClick={() => handleObjectiveChange(obj.label, obj.zoom)}
              title={`${obj.name} (${obj.label})`}
              className={`px-2 py-0.5 text-xs font-mono font-medium rounded transition-colors ${
                objectiveLens === obj.label
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {obj.label}
            </button>
          ))}
        </div>

        {/* Segmentação (melhoria 2026-09-28) */}
        {overlaySrc && (
          <button
            onClick={() => setShowOverlay((v) => !v)}
            title="Mostrar/ocultar a segmentação de núcleos do motor local"
            className={`px-2 py-0.5 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
              showOverlay ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Segmentação
          </button>
        )}
      </div>

      {/* Main Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`relative flex-1 overflow-hidden ${
          isDrawingMode
            ? 'cursor-crosshair'
            : isDragging
            ? 'cursor-grabbing'
            : 'cursor-grab'
        } bg-neutral-950 flex items-center justify-center`}
        style={{
          filter: `brightness(${brightness}%) contrast(${contrast}%)`,
        }}
      >
        {/* Reticle / Micrometer Grid Overlay */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none z-10 opacity-30"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
        )}

        {/* Center Crosshair (Reticle) */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <div className="relative w-16 h-16 border border-emerald-400/40 rounded-full flex items-center justify-center">
              <div className="w-full h-[1px] bg-emerald-400/50 absolute" />
              <div className="h-full w-[1px] bg-emerald-400/50 absolute" />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
            </div>
          </div>
        )}

        {/* Slide Stage Container with Pan and Zoom */}
        <div
          ref={stageRef}
          className="relative transition-transform duration-75 ease-out select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            width: '800px',
            height: '600px',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          {/* Overlay da segmentação (melhoria 2026-09-28) */}
          {imageSrc && overlaySrc && showOverlay && (
            <img
              src={overlaySrc}
              alt="Segmentação de núcleos (motor local)"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded"
              style={{ opacity: 0.55, mixBlendMode: 'screen' }}
              draggable={false}
            />
          )}

{/* Visual Presentation: Either Uploaded Image or Procedural Histological SVG */}
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={title}
              className="w-full h-full object-contain pointer-events-none rounded shadow-2xl"
              draggable={false}
            />
          ) : svgContent ? (
            <div
              className="w-full h-full pointer-events-none rounded shadow-2xl overflow-hidden"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              Nenhuma imagem carregada
            </div>
          )}

          {/* AI Pre-annotated Spotters Overlay */}
          {showAnnotations &&
            constituents
              .filter((c) => c.pinpoint)
              .map((c, idx) => {
                const isSelected = selectedConstituent?.name === c.name;
                const p = c.pinpoint!;
                return (
                  <div
                    key={`${c.name}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectConstituent(c);
                    }}
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 pointer-events-auto"
                  >
                    <div
                      className={`relative flex items-center justify-center transition-transform ${
                        isSelected ? 'scale-125' : 'hover:scale-115'
                      }`}
                    >
                      <span
                        className={`absolute inline-flex h-7 w-7 rounded-full opacity-75 animate-ping ${
                          isSelected ? 'bg-amber-400' : 'bg-indigo-400'
                        }`}
                      />
                      <span
                        className={`relative inline-flex items-center justify-center h-6 w-6 rounded-full border-2 text-[10px] font-bold shadow-lg ${
                          isSelected
                            ? 'bg-amber-500 border-white text-black ring-4 ring-amber-400/40'
                            : 'bg-indigo-600/90 border-white text-white hover:bg-indigo-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </div>

                    <div
                      className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium shadow-xl pointer-events-none transition-opacity ${
                        isSelected
                          ? 'opacity-100 bg-amber-500 text-slate-950 font-semibold'
                          : 'opacity-0 group-hover:opacity-100 bg-slate-900/95 text-slate-100 border border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Crosshair className="w-3 h-3 text-current" />
                        <span>{p.label || c.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-300 opacity-90">{c.cellularCategory}</div>
                    </div>
                  </div>
                );
              })}

          {/* User Annotations Bounding Boxes Overlay */}
          {showUserAnnotations &&
            userAnnotations.map((ann) => {
              const isSelected = selectedAnnotationId === ann.id;
              const color = ann.color || '#f59e0b';
              return (
                <div
                  key={ann.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectAnnotation) onSelectAnnotation(ann.id);
                  }}
                  style={{
                    left: `${ann.x}%`,
                    top: `${ann.y}%`,
                    width: `${ann.width}%`,
                    height: `${ann.height}%`,
                    borderColor: color,
                    backgroundColor: `${color}18`,
                  }}
                  className={`absolute border-2 rounded-sm group cursor-pointer transition-all z-20 ${
                    isSelected
                      ? 'ring-2 ring-white shadow-xl'
                      : 'hover:border-opacity-100 border-opacity-75'
                  }`}
                >
                  {/* Label badge on top of box */}
                  <div
                    style={{ backgroundColor: color }}
                    className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-950 tracking-tight whitespace-nowrap flex items-center gap-1 shadow-md pointer-events-none"
                  >
                    <span>{ann.label}</span>
                  </div>

                  {/* Notes Tooltip on hover */}
                  {ann.notes && (
                    <div className="absolute top-full left-0 mt-1 max-w-xs px-2 py-1 bg-slate-950/95 border border-slate-800 rounded text-[10px] text-slate-200 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal z-30">
                      {ann.notes}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Live drawing preview box */}
          {isDrawing && currentBox && (
            <div
              style={{
                left: `${currentBox.x}%`,
                top: `${currentBox.y}%`,
                width: `${currentBox.width}%`,
                height: `${currentBox.height}%`,
              }}
              className="absolute border-2 border-dashed border-amber-400 bg-amber-400/20 z-30 pointer-events-none rounded-sm"
            >
              <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-amber-500 text-[10px] font-bold text-black">
                A definir caixa...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Labeling Dialog for newly drawn box */}
      {pendingBox && (
        <div className="absolute inset-0 z-40 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>Rotular Estrutura Delimitada</span>
              </h4>
              <button
                onClick={() => setPendingBox(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Nome da Estrutura / Tipo de Tecido:
              </label>
              <input
                type="text"
                placeholder="Ex: Condrócito, Queratina, Mitose, Núcleo..."
                value={newLabel}
                autoFocus
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePendingAnnotation()}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
              />
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1">
              {[
                'Núcleo',
                'Mitose',
                'Célula Caliciforme',
                'Colagénio',
                'Atipia',
                'Capilar',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setNewLabel(chip)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                >
                  {chip}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Notas & Descrição Histológica (Opcional):
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Cromatina densa, atipia, artefacto de técnica..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setPendingBox(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePendingAnnotation}
                disabled={!newLabel.trim()}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-sm disabled:opacity-40"
              >
                Guardar Anotação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Microscope Bottom Stage HUD & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-900/95 border-t border-slate-800 text-xs text-slate-300 z-20 backdrop-blur-md">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.25))}
            title="Reduzir ampliação"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs w-12 text-center text-slate-200">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(6, z + 0.25))}
            title="Aumentar ampliação"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            title="Centrar e restaurar vista"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-1"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* View toggles: Annotations, Grid, Light */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              showAnnotations
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {showAnnotations ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Marcadores IA ({constituents.filter((c) => c.pinpoint).length})</span>
          </button>

          <button
            onClick={() => setShowUserAnnotations(!showUserAnnotations)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              showUserAnnotations
                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Minhas Caixas ({userAnnotations.length})</span>
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
              showGrid
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="Grelha micrométrica e mira central"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Micrómetro</span>
          </button>

          {/* Diaphragm Light brightness */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <Sun className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="range"
              min="60"
              max="150"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-16 accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
              title={`Diafragma de campo: ${brightness}%`}
            />
          </div>
        </div>

        {/* Scientific Scale Bar */}
        <div className="flex items-center gap-2 pl-2">
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-mono text-slate-400 mb-0.5">~{scaleMicrons} µm</div>
            <div className="w-16 h-1 bg-slate-200 border-x border-slate-400 relative">
              <div className="absolute -left-0.5 -top-1 w-[1px] h-3 bg-slate-400" />
              <div className="absolute -right-0.5 -top-1 w-[1px] h-3 bg-slate-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
