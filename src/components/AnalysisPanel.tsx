import React, { useState } from 'react';
import {
  HistologyAnalysis,
  CellularConstituent,
} from '../types/histology';
import {
  CheckCircle2,
  HelpCircle,
  Crosshair,
  Sparkles,
  Info,
  ShieldAlert,
  Printer,
  FileText,
  ChevronRight,
} from 'lucide-react';

interface AnalysisPanelProps {
  analysis: HistologyAnalysis;
  selectedConstituent: CellularConstituent | null;
  onSelectConstituent: (c: CellularConstituent) => void;
  onOpenQuiz: () => void;
  // B3: exportar relatório (Markdown + PDF via diálogo de impressão).
  onExportMarkdown?: () => void;
  onExportPrint?: () => void;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysis,
  selectedConstituent,
  onSelectConstituent,
  onOpenQuiz,
  onExportMarkdown,
  onExportPrint,
}) => {
  const [activeTab, setActiveTab] = useState<'cells' | 'diagnosis' | 'staining' | 'overview'>('cells');

  const {
    tissueClassification,
    stainingAnalysis,
    cellularConstituents,
    diagnosticCriteria,
    academicQuizQuestions,
  } = analysis;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl text-slate-200">
      {/* Panel Header: Tissue Diagnosis Banner */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-b border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium mb-1">
              <span>{tissueClassification.tissueFamily}</span>
              <span aria-hidden="true">·</span>
              <span>{tissueClassification.probableOrgan}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-semibold">{tissueClassification.confidenceLevel}</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight leading-snug">
              {tissueClassification.primaryTissue}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onExportMarkdown && (
              <button
                onClick={onExportMarkdown}
                title="Exportar relatório (Markdown)"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <FileText className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onExportPrint || handlePrint}
              title="Exportar / Imprimir Relatório (PDF)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenQuiz}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Avaliação ({academicQuizQuestions.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-4 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('cells')}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors text-center ${
              activeTab === 'cells'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Constituintes ({cellularConstituents.length})
          </button>
          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors text-center ${
              activeTab === 'diagnosis'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Guia Diagnóstico
          </button>
          <button
            onClick={() => setActiveTab('staining')}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors text-center ${
              activeTab === 'staining'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Coloração
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-1.5 px-2 rounded-md font-medium transition-colors text-center ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Descrição
          </button>
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {/* TAB 1: Cellular Constituents List */}
        {activeTab === 'cells' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
              <span>Clique numa estrutura para centrar no microscópio:</span>
              <span className="text-[11px] text-indigo-400 font-mono">
                {cellularConstituents.filter((c) => c.pinpoint).length} marcadores
              </span>
            </div>

            {cellularConstituents.map((constituent, idx) => {
              const isSelected = selectedConstituent?.name === constituent.name;
              return (
                <div
                  key={`${constituent.name}-${idx}`}
                  onClick={() => onSelectConstituent(constituent)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border-amber-500/70 ring-1 ring-amber-500/30'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {constituent.pinpoint && (
                        <span className="w-5 h-5 rounded-full bg-indigo-900/80 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                      )}
                      <h4 className="font-semibold text-slate-100 leading-tight">
                        {constituent.name}
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {constituent.cellularCategory}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                    {constituent.morphologyDescription}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-slate-400 font-medium block">Características Nucleares:</span>
                      <span className="text-slate-300">{constituent.nuclearCharacteristics}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Afinidade de Coloração:</span>
                      <span className="text-indigo-300 font-medium">{constituent.stainingAffinity}</span>
                    </div>
                  </div>

                  {constituent.functionalSignificance && (
                    <div className="mt-2 text-[11px] text-slate-400 bg-slate-900/90 p-2 rounded border border-slate-800/60">
                      <span className="text-slate-300 font-medium">Função: </span>
                      {constituent.functionalSignificance}
                    </div>
                  )}

                  {constituent.pinpoint && (
                    <div className="mt-2 flex justify-end">
                      <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 font-medium group-hover:text-indigo-300">
                        <Crosshair className="w-3 h-3" />
                        Localizar na Lâmina
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: Diagnostic & Recognition Guide */}
        {activeTab === 'diagnosis' && (
          <div className="space-y-4">
            {/* Step-by-Step Recognition Rules */}
            <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Como Reconhecer com Alta Precisão
              </h3>
              <ul className="space-y-2 text-xs text-slate-300">
                {diagnosticCriteria.keyIdentificationRules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Differential Diagnosis Table */}
            <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Diagnóstico Diferencial ("Como Não Confundir")
              </h3>
              <div className="space-y-2.5">
                {diagnosticCriteria.differentialDiagnosis.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-md bg-slate-900/90 border border-slate-800/90 text-xs"
                  >
                    <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      <span>{item.confusedWith}</span>
                    </div>
                    <p className="text-slate-300 pl-4 text-[12px] leading-relaxed">
                      {item.howToDistinguish}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Artifacts and Student Pitfalls */}
            {diagnosticCriteria.artifactsAndCaveats?.length > 0 && (
              <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  Artefactos Técnicos e Armadilhas Frequentes
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {diagnosticCriteria.artifactsAndCaveats.map((caveat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">·</span>
                      <span className="leading-relaxed">{caveat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Staining Analysis */}
        {activeTab === 'staining' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Coloração Utilizada
                </span>
                <span className="text-xs font-mono text-indigo-400 font-semibold">
                  {stainingAnalysis.stainName}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {stainingAnalysis.chemicalRationale}
              </p>
            </div>

            {/* Basophilia vs Acidophilia Comparison */}
            <div className="grid grid-cols-1 gap-3">
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-900/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-3 h-3 rounded-full bg-purple-600 border border-purple-400" />
                  <h4 className="text-xs font-bold text-indigo-200">
                    Elementos Basofílicos (Afinidade por Hematoxilina / Azul-Roxo)
                  </h4>
                </div>
                <p className="text-xs text-indigo-100/90 leading-relaxed">
                  {stainingAnalysis.basophilicElements}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500 border border-rose-300" />
                  <h4 className="text-xs font-bold text-rose-200">
                    Elementos Acidofílicos / Eosinofílicos (Afinidade por Eosina / Rosa)
                  </h4>
                </div>
                <p className="text-xs text-rose-100/90 leading-relaxed">
                  {stainingAnalysis.acidophilicElements}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: General Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-400" />
                Descrição Panorâmica da Lâmina
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {tissueClassification.generalDescription}
              </p>
            </div>

            <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Classificação Tecidual:</span>
                <span className="text-slate-200 font-medium">{tissueClassification.primaryTissue}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Família Primária:</span>
                <span className="text-slate-200 font-medium">{tissueClassification.tissueFamily}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Órgão de Origem Provável:</span>
                <span className="text-slate-200 font-medium">{tissueClassification.probableOrgan}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Técnica Histológica:</span>
                <span className="text-slate-200 font-medium">{tissueClassification.stainType}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Grau de Confiança do Diagnóstico:</span>
                <span className="text-emerald-400 font-semibold">{tissueClassification.confidenceLevel}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Panel Footer: Quick Action to start Academic Quiz */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          Modo de Estudo & Avaliação Universitária
        </span>
        <button
          onClick={onOpenQuiz}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-md text-xs font-semibold transition-colors"
        >
          <span>Iniciar Teste Académico</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
