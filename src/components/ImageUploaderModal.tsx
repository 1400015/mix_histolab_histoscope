import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  X,
  FileQuestion,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { HistologyAnalysis } from '../types/histology';

interface ImageUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalysisComplete: (result: {
    imageBase64: string;
    analysis: HistologyAnalysis;
    title: string;
    staining: string;
  }) => void;
}

export const ImageUploaderModal: React.FC<ImageUploaderModalProps> = ({
  isOpen,
  onClose,
  onAnalysisComplete,
}) => {
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [tissueHint, setTissueHint] = useState<string>('');
  const [stainHint, setStainHint] = useState<string>('Hematoxilina e Eosina (H&E)');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor submeta um ficheiro de imagem válido (JPEG, PNG, WebP).');
      return;
    }

    setErrorMessage(null);
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Clipboard paste support
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  };

  const handleAnalyze = async () => {
    if (!imagePreview) return;

    try {
      setIsAnalyzing(true);
      setErrorMessage(null);
      setAnalysisStage('A segmentar arquitetura celular e coloração...');

      const timer1 = setTimeout(() => {
        setAnalysisStage('A identificar constituintes celulares e núcleos...');
      }, 1500);

      const timer2 = setTimeout(() => {
        setAnalysisStage('A gerar critérios de reconhecimento de alta precisão e teste académico...');
      }, 3500);

      const response = await fetch('/api/analyze-histology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imagePreview,
          mimeType: imageFile?.type || 'image/jpeg',
          tissueHint: tissueHint.trim() || undefined,
          stainHint: stainHint.trim() || undefined,
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || errData.error || 'Erro na análise com a IA.');
      }

      const result: HistologyAnalysis = await response.json();

      onAnalysisComplete({
        imageBase64: imagePreview,
        analysis: result,
        title: result.tissueClassification.primaryTissue || 'Lâmina Analisada por IA',
        staining: result.tissueClassification.stainType || stainHint,
      });

      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Falha ao processar a imagem com a IA.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage('');
    }
  };

  return (
    <div
      onPaste={handlePaste}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Submeter Imagem para Análise em Tempo Real
              </h2>
              <p className="text-xs text-slate-400">
                Microscopia ótica, biópsia ou citologia (suporta colar com Ctrl+V)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Drag & Drop Area */}
          {!imagePreview ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-indigo-500 bg-indigo-950/30'
                  : 'border-slate-700/80 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-950/90'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 mb-3">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200 mb-1">
                Arraste a lâmina histológica ou clique para escolher
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-2">
                Suporta PNG, JPEG, TIFF, WebP. Ou copie a imagem e cole diretamente aqui com <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-300 font-mono">Ctrl+V</kbd>.
              </p>
            </div>
          ) : (
            /* Image Preview */
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video max-h-56 flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Pré-visualização da lâmina"
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700 backdrop-blur-sm transition-colors text-xs flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Alterar Imagem</span>
              </button>
            </div>
          )}

          {/* Optional Clinical & Staining Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Coloração da Lâmina:
              </label>
              <select
                value={stainHint}
                onChange={(e) => setStainHint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Hematoxilina e Eosina (H&E)">Hematoxilina e Eosina (H&E)</option>
                <option value="Tricrómio de Masson">Tricrómio de Masson (Colagénio azul/verde)</option>
                <option value="Ácido Periódico de Schiff (PAS)">Ácido Periódico de Schiff (PAS - Mucinas/Glicogénio)</option>
                <option value="Giemsa / Wright">Giemsa / Wright (Esfregaço hematológico)</option>
                <option value="Impregnação por Prata">Impregnação por Prata (Fibras reticulares / Nervos)</option>
                <option value="Outra / Desconhecida">Outra / Deixar a IA identificar</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Suspeita de Tecido ou Órgão (Opcional):
              </label>
              <input
                type="text"
                placeholder="Ex: Fígado, Rim, Músculo, Pele..."
                value={tissueHint}
                onChange={(e) => setTissueHint(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-medium mb-1">
              Foco ou Dúvida Diagnóstica Específica (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ex: Identificar se há atipia celular ou diferenciar de cartilagem elástica"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isAnalyzing && (
            <div className="p-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Análise de Inteligência Artificial em Curso...</span>
              </div>
              <p className="text-xs text-slate-300 font-mono animate-pulse">
                {analysisStage}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleAnalyze}
            disabled={!imagePreview || isAnalyzing}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>A Analisar...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Analisar com IA em Tempo Real</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
