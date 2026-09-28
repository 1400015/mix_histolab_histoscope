import React, { useState, useEffect } from 'react';
import {
  X,
  SplitSquareVertical,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { ComparisonResult } from '../types/histology';
import { REFERENCE_SLIDES } from '../data/referenceSlides';

interface SlideComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  primarySlide: {
    id: string;
    title: string;
    tissue: string;
    staining: string;
    imageSrc?: string;
    svgContent?: string;
    description?: string;
  };
}

export const SlideComparisonModal: React.FC<SlideComparisonModalProps> = ({
  isOpen,
  onClose,
  primarySlide,
}) => {
  // A11y: fechar com Escape (melhoria 2026-09-28).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const [selectedRefId, setSelectedRefId] = useState<string>(
    REFERENCE_SLIDES[0].id === primarySlide.id && REFERENCE_SLIDES.length > 1
      ? REFERENCE_SLIDES[1].id
      : REFERENCE_SLIDES[0].id
  );

  const [zoomLeft, setZoomLeft] = useState<number>(1);
  const [zoomRight, setZoomRight] = useState<number>(1);
  const [syncZoom, setSyncZoom] = useState<boolean>(true);

  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'analysis'>('visual');

  const referenceSlide =
    REFERENCE_SLIDES.find((s) => s.id === selectedRefId) || REFERENCE_SLIDES[0];

  useEffect(() => {
    // Automatically trigger comparison or reset when reference changes
    setComparisonResult(null);
    setComparisonError(null);
  }, [selectedRefId, primarySlide.title]);

  if (!isOpen) return null;

  const handleZoomChange = (delta: number) => {
    if (syncZoom) {
      setZoomLeft((z) => Math.min(Math.max(0.6, z + delta), 4));
      setZoomRight((z) => Math.min(Math.max(0.6, z + delta), 4));
    } else {
      setZoomLeft((z) => Math.min(Math.max(0.6, z + delta), 4));
    }
  };

  const handleRunAIComparison = async () => {
    try {
      setIsComparing(true);
      setComparisonError(null);

      const response = await fetch('/api/compare-slides', {
          signal: AbortSignal.timeout(90_000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primarySlide: {
            title: primarySlide.title,
            primaryTissue: primarySlide.tissue,
            description: primarySlide.description,
            imageBase64: primarySlide.imageSrc || undefined,
          },
          referenceSlide: {
            title: referenceSlide.title,
            tissueFamily: referenceSlide.tissueFamily,
            primaryTissue: referenceSlide.analysis.tissueClassification.primaryTissue,
            staining: referenceSlide.staining,
            description: referenceSlide.description,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao processar a comparação com a IA.');
      }

      const data: ComparisonResult = await response.json();
      setComparisonResult(data);
      setActiveTab('analysis');
    } catch (err: any) {
      console.error(err);
      setComparisonError(err.message || 'Erro ao comunicar com o modelo de IA.');
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl h-[94vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        {/* Comparison Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <SplitSquareVertical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight flex items-center gap-2">
                Comparação Histológica Lado a Lado
              </h2>
              <p className="text-xs text-slate-400">
                Amostra em Estudo vs Lâmina de Referência (Deteção de Padrões e Diagnóstico Diferencial)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('visual')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'visual'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Microscópio Duplo
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'analysis'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Análise Comparativa IA</span>
                {comparisonResult && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reference Selector Bar */}
        <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Lâmina de Referência para Contrastar:</span>
            <select
              value={selectedRefId}
              onChange={(e) => setSelectedRefId(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              {REFERENCE_SLIDES.map((slide) => (
                <option key={slide.id} value={slide.id}>
                  {slide.title} ({slide.staining})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncZoom}
                onChange={(e) => setSyncZoom(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span>Sincronizar Ampliação</span>
            </label>

            <button
              onClick={handleRunAIComparison}
              disabled={isComparing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isComparing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>A Analisar Semelhanças & Diferenças...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Gerar Comparação Detalhada (IA)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'visual' ? (
            /* Side-by-Side Dual Viewport */
            <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-black">
              {/* LEFT VIEWPORT: Primary Sample Slide */}
              <div className="relative flex flex-col h-full bg-slate-950 overflow-hidden">
                <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="font-semibold text-white truncate max-w-xs">{primarySlide.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                      Amostra em Estudo
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{primarySlide.staining}</span>
                </div>

                <div className="flex-1 relative flex items-center justify-center overflow-hidden p-4">
                  <div
                    style={{ transform: `scale(${zoomLeft})`, transition: 'transform 0.1s ease-out' }}
                    className="w-full h-full max-w-[700px] max-h-[500px] flex items-center justify-center rounded-lg overflow-hidden shadow-2xl border border-slate-800"
                  >
                    {primarySlide.imageSrc ? (
                      <img
                        src={primarySlide.imageSrc}
                        alt={primarySlide.title}
                        className="w-full h-full object-contain"
                      />
                    ) : primarySlide.svgContent ? (
                      <div
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{ __html: primarySlide.svgContent }}
                      />
                    ) : (
                      <div className="text-slate-500 text-xs">Sem visualização disponível</div>
                    )}
                  </div>
                </div>

                {/* Left Zoom HUD */}
                <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Zoom: {Math.round(zoomLeft * 100)}%</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleZoomChange(-0.25)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleZoomChange(0.25)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomLeft(1)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT VIEWPORT: Reference Library Slide */}
              <div className="relative flex flex-col h-full bg-slate-950 overflow-hidden">
                <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 z-10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-white truncate max-w-xs">{referenceSlide.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                      Padrão de Referência
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{referenceSlide.staining}</span>
                </div>

                <div className="flex-1 relative flex items-center justify-center overflow-hidden p-4">
                  <div
                    style={{ transform: `scale(${zoomRight})`, transition: 'transform 0.1s ease-out' }}
                    className="w-full h-full max-w-[700px] max-h-[500px] flex items-center justify-center rounded-lg overflow-hidden shadow-2xl border border-slate-800"
                  >
                    <div
                      className="w-full h-full"
                      dangerouslySetInnerHTML={{ __html: referenceSlide.thumbnailSvg }}
                    />
                  </div>
                </div>

                {/* Right Zoom HUD */}
                <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Zoom: {Math.round(zoomRight * 100)}%</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (syncZoom) handleZoomChange(-0.25);
                        else setZoomRight((z) => Math.max(0.6, z - 0.25));
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (syncZoom) handleZoomChange(0.25);
                        else setZoomRight((z) => Math.min(4, z + 0.25));
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-300"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomRight(1)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Comprehensive AI Comparison Report Tab */
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900">
              {comparisonError && (
                <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{comparisonError}</span>
                </div>
              )}

              {comparisonResult ? (
                <div className="space-y-6 max-w-5xl mx-auto">
                  {/* Summary Box */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-wider text-[11px]">
                      <Info className="w-4 h-4" />
                      <span>Resumo da Comparação Morfológica</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed text-sm">
                      {comparisonResult.comparisonSummary}
                    </p>
                  </div>

                  {/* Similarities & Differences Two-Column Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Similarities */}
                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Semelhanças Visuais & Estruturais ({comparisonResult.similarities.length})</span>
                      </div>
                      <ul className="space-y-2 text-xs text-emerald-100/90">
                        {comparisonResult.similarities.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Potential Anomalies / Structural Deviations */}
                    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-3">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Padrões de Variação ou Anomalias ({comparisonResult.potentialAnomaliesOrVariations.length})</span>
                      </div>
                      <ul className="space-y-2 text-xs text-amber-100/90">
                        {comparisonResult.potentialAnomaliesOrVariations.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-amber-400 font-bold">!</span>
                            <span className="leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Differential Feature Comparison Table */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-indigo-400" />
                      <span>Matriz de Critérios Diagnósticos Diferenciais</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 font-medium">
                            <th className="py-2 pr-3">Critério Morfológico</th>
                            <th className="py-2 pr-3 text-indigo-300">Amostra em Estudo</th>
                            <th className="py-2 pr-3 text-emerald-300">Lâmina de Referência ({referenceSlide.title})</th>
                            <th className="py-2 text-slate-300">Significado Diagnóstico</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {comparisonResult.differences.map((diff, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-2.5 pr-3 font-semibold text-slate-200 align-top">
                                {diff.feature}
                              </td>
                              <td className="py-2.5 pr-3 text-slate-300 align-top leading-relaxed">
                                {diff.primarySampleObservation}
                              </td>
                              <td className="py-2.5 pr-3 text-slate-300 align-top leading-relaxed">
                                {diff.referenceObservation}
                              </td>
                              <td className="py-2.5 text-indigo-300 align-top leading-relaxed font-medium">
                                {diff.diagnosticSignificance}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Diagnostic Conclusion */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 to-purple-950/40 border border-indigo-800/40 text-xs space-y-1.5">
                    <div className="text-indigo-300 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Conclusão Diagnóstica Integrada</span>
                    </div>
                    <p className="text-slate-100 text-sm leading-relaxed font-medium">
                      {comparisonResult.diagnosticConclusion}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Análise comparativa ainda não executada para este par de lâminas
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Clique no botão abaixo para que o modelo de inteligência artificial identifique semelhanças, diferenças morfológicas e padrões diagnósticos.
                  </p>
                  <button
                    onClick={handleRunAIComparison}
                    disabled={isComparing}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    Iniciar Comparação com IA
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
