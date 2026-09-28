import React, { useState, useEffect } from 'react';
import { UserAnnotation } from '../types/histology';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  Check,
  X,
  Layers,
  HelpCircle,
  FileCode,
  FileJson,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AnnotationSystemProps {
  slideId: string;
  slideTitle: string;
  slideTissue: string;
  imageSrc?: string;
  svgContent?: string;
  isDrawingMode: boolean;
  onToggleDrawingMode: (active: boolean) => void;
  annotations: UserAnnotation[];
  onAnnotationsChange: (annotations: UserAnnotation[]) => void;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
}

const PRESET_LABELS = [
  'Núcleo Celular',
  'Mitose / Divisão',
  'Célula Caliciforme',
  'Condrócito em Lacuna',
  'Enterócito / Bordo em Escova',
  'Fibra de Colagénio',
  'Queratina / Camada Córnea',
  'Vaso Capilar / Endotélio',
  'Atipia / Anomalia Celular',
  'Discos Intercalares',
  'Artefacto Técnico',
];

const PRESET_COLORS = [
  { label: 'Âmbar', hex: '#f59e0b', ring: 'ring-amber-500', border: 'border-amber-500', bg: 'bg-amber-500/20' },
  { label: 'Esmeralda', hex: '#10b981', ring: 'ring-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-500/20' },
  { label: 'Índigo', hex: '#6366f1', ring: 'ring-indigo-500', border: 'border-indigo-500', bg: 'bg-indigo-500/20' },
  { label: 'Rosa / Eosina', hex: '#ec4899', ring: 'ring-pink-500', border: 'border-pink-500', bg: 'bg-pink-500/20' },
  { label: 'Ciano', hex: '#06b6d4', ring: 'ring-cyan-500', border: 'border-cyan-500', bg: 'bg-cyan-500/20' },
  { label: 'Vermelho / Alerta', hex: '#ef4444', ring: 'ring-red-500', border: 'border-red-500', bg: 'bg-red-500/20' },
];

export const AnnotationSystem: React.FC<AnnotationSystemProps> = ({
  slideId,
  slideTitle,
  slideTissue,
  imageSrc,
  svgContent,
  isDrawingMode,
  onToggleDrawingMode,
  annotations,
  onAnnotationsChange,
  selectedAnnotationId,
  onSelectAnnotation,
}) => {
  const [editingAnnotation, setEditingAnnotation] = useState<UserAnnotation | null>(null);
  const [showAnnotationsList, setShowAnnotationsList] = useState<boolean>(true);
  const [filterCategory, setFilterCategory] = useState<string>('Todas');

  // Load saved annotations for this slide from localStorage on mount or slide change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`histoscope_annotations_${slideId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          onAnnotationsChange(parsed);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar anotações locais:', e);
    }
  }, [slideId]);

  // Save to localStorage when annotations change
  const saveAnnotations = (newList: UserAnnotation[]) => {
    onAnnotationsChange(newList);
    try {
      localStorage.setItem(`histoscope_annotations_${slideId}`, JSON.stringify(newList));
    } catch (e) {
      console.error('Erro ao guardar anotações:', e);
    }
  };

  const handleDeleteAnnotation = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = annotations.filter((a) => a.id !== id);
    saveAnnotations(updated);
    if (selectedAnnotationId === id) {
      onSelectAnnotation(null);
    }
  };

  const handleUpdateAnnotation = (updated: UserAnnotation) => {
    const list = annotations.map((a) => (a.id === updated.id ? updated : a));
    saveAnnotations(list);
    setEditingAnnotation(null);
  };

  // Export annotations as JSON training dataset
  const handleExportDataset = () => {
    const dataset = {
      format: 'HistoScope_AI_Annotation_Dataset_v1',
      exportedAt: new Date().toISOString(),
      slideMetadata: {
        slideId,
        slideTitle,
        tissue: slideTissue,
        hasImageBase64: !!imageSrc,
      },
      totalAnnotations: annotations.length,
      annotations: annotations.map((a) => ({
        id: a.id,
        label: a.label,
        category: a.category || 'Geral',
        notes: a.notes || '',
        bbox_normalized: {
          x_percent: a.x,
          y_percent: a.y,
          width_percent: a.width,
          height_percent: a.height,
        },
        timestamp: a.timestamp,
      })),
    };

    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dataset-anotacoes-${slideId}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import JSON annotations
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.annotations && Array.isArray(data.annotations)) {
          const formatted: UserAnnotation[] = data.annotations.map((item: any, i: number) => ({
            id: item.id || `imported_${Date.now()}_${i}`,
            label: item.label || 'Estrutura Anotada',
            category: item.category || 'Geral',
            notes: item.notes || '',
            color: '#f59e0b',
            x: item.bbox_normalized?.x_percent ?? item.x ?? 10,
            y: item.bbox_normalized?.y_percent ?? item.y ?? 10,
            width: item.bbox_normalized?.width_percent ?? item.width ?? 15,
            height: item.bbox_normalized?.height_percent ?? item.height ?? 15,
            timestamp: item.timestamp || new Date().toISOString(),
          }));
          saveAnnotations([...annotations, ...formatted]);
        }
      } catch (err) {
        alert('Ficheiro de anotações inválido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-200">
      {/* Header bar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Sistema de Anotações & Dataset
            </h3>
            <p className="text-[11px] text-slate-400">
              Delimite caixas sobre células e tecidos para retreinamento
            </p>
          </div>
        </div>

        {/* Toggle Drawing Mode Button */}
        <button
          onClick={() => onToggleDrawingMode(!isDrawingMode)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
            isDrawingMode
              ? 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-400/50'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isDrawingMode ? 'A Desenhar Caixa...' : 'Desenhar Caixa'}</span>
        </button>
      </div>

      {/* Dataset Actions: Export / Import / Count */}
      <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">
          {annotations.length} {annotations.length === 1 ? 'anotação registada' : 'anotações registadas'}
        </span>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-md cursor-pointer transition-colors text-[11px]">
            <Upload className="w-3 h-3" />
            <span>Importar</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
          </label>

          <button
            onClick={handleExportDataset}
            disabled={annotations.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 rounded-md transition-colors text-[11px] font-medium disabled:opacity-40"
          >
            <Download className="w-3 h-3" />
            <span>Exportar Dataset</span>
          </button>
        </div>
      </div>

      {/* Drawing mode instructional banner */}
      {isDrawingMode && (
        <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-800/50 text-amber-200 text-xs flex items-center justify-between animate-pulse">
          <span>
            Arraste o cursor sobre a lâmina no microscópio para criar a caixa delimitadora.
          </span>
          <button
            onClick={() => onToggleDrawingMode(false)}
            className="text-amber-400 hover:text-white font-bold ml-2 underline text-[11px]"
          >
            Concluir
          </button>
        </div>
      )}

      {/* Annotations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs">
        {annotations.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <Tag className="w-8 h-8 mx-auto opacity-40" />
            <p>Nenhuma anotação criada nesta lâmina ainda.</p>
            <p className="text-[11px] text-slate-600">
              Clique em "Desenhar Caixa" e selecione uma estrutura celular sobre o microscópio.
            </p>
          </div>
        ) : (
          annotations.map((ann, idx) => {
            const isSelected = selectedAnnotationId === ann.id;
            return (
              <div
                key={ann.id}
                onClick={() => onSelectAnnotation(ann.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 border-amber-500/80 ring-1 ring-amber-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: ann.color || '#f59e0b' }}
                    />
                    <h4 className="font-bold text-slate-100 text-xs">{ann.label}</h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAnnotation(ann);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {ann.category && (
                  <span className="text-[10px] text-indigo-400 font-mono mt-1 block">
                    {ann.category}
                  </span>
                )}

                {ann.notes && (
                  <p className="text-slate-300 mt-1.5 text-[11px] leading-relaxed bg-slate-900/80 p-2 rounded border border-slate-800/80">
                    {ann.notes}
                  </p>
                )}

                <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500 font-mono">
                  <span>
                    BBox: X={Math.round(ann.x)}% Y={Math.round(ann.y)}% (W={Math.round(ann.width)}% H={Math.round(ann.height)}%)
                  </span>
                  <span>{new Date(ann.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Annotation Modal */}
      {editingAnnotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">Editar Rótulo e Notas da Anotação</h3>
              <button
                onClick={() => setEditingAnnotation(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nome da Estrutura / Tecido:
                </label>
                <input
                  type="text"
                  value={editingAnnotation.label}
                  onChange={(e) =>
                    setEditingAnnotation({ ...editingAnnotation, label: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Suggestions */}
              <div>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">
                  Sugestões Rápidas:
                </span>
                <div className="flex flex-wrap gap-1">
                  {PRESET_LABELS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setEditingAnnotation({ ...editingAnnotation, label: preset })
                      }
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Notas & Descrição Histológica:
                </label>
                <textarea
                  rows={3}
                  value={editingAnnotation.notes || ''}
                  onChange={(e) =>
                    setEditingAnnotation({ ...editingAnnotation, notes: e.target.value })
                  }
                  placeholder="Ex: Cromatina densa, atipia nuclear discreta, relação núcleo-citoplasma aumentada..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Cor da Caixa Delimitadora:
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() =>
                        setEditingAnnotation({ ...editingAnnotation, color: c.hex })
                      }
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        editingAnnotation.color === c.hex
                          ? 'border-white scale-110 shadow-md'
                          : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingAnnotation(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateAnnotation(editingAnnotation)}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-sm"
              >
                Guardar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
