import React, { useState } from 'react';
import { ReferenceTissueSlide, TissueFamily } from '../types/histology';
import { REFERENCE_SLIDES } from '../data/referenceSlides';
import {
  X,
  Search,
  Layers,
  ChevronRight,
  Sparkles,
  Eye,
  Microscope,
} from 'lucide-react';

interface ReferenceAtlasDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSlide: (slide: ReferenceTissueSlide) => void;
  activeSlideId: string;
}

export const ReferenceAtlasDrawer: React.FC<ReferenceAtlasDrawerProps> = ({
  isOpen,
  onClose,
  onSelectSlide,
  activeSlideId,
}) => {
  const [selectedFamily, setSelectedFamily] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const families = ['Todos', 'Epitelial', 'Conjuntivo', 'Muscular', 'Nervoso', 'Sangue e Linfóide'];

  const filteredSlides = REFERENCE_SLIDES.filter((slide) => {
    const matchesFamily =
      selectedFamily === 'Todos' || slide.tissueFamily.includes(selectedFamily);
    const matchesQuery =
      slide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      slide.organ.toLowerCase().includes(searchQuery.toLowerCase()) ||
      slide.analysis.tissueClassification.primaryTissue.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFamily && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold mb-1">
              <Microscope className="w-4 h-4" />
              <span>Coleção Histológica de Referência</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Atlas & Biblioteca de Tecidos
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Lâminas padrão para consulta imediata, estudo comparativo e autoavaliação
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-950/50">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar tecido, órgão ou coloração..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Tissue Family Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {families.map((fam) => (
              <button
                key={fam}
                onClick={() => setSelectedFamily(fam)}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  selectedFamily === fam
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {fam}
              </button>
            ))}
          </div>
        </div>

        {/* Slides Grid List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {filteredSlides.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Nenhuma lâmina encontrada para os filtros selecionados.
            </div>
          ) : (
            filteredSlides.map((slide) => {
              const isActive = activeSlideId === slide.id;
              return (
                <div
                  key={slide.id}
                  onClick={() => {
                    onSelectSlide(slide);
                    onClose();
                  }}
                  className={`group relative rounded-xl border p-3 transition-all cursor-pointer flex gap-3.5 items-center ${
                    isActive
                      ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  {/* Slide Microscopic Thumbnail */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-black shrink-0 border border-slate-800 relative shadow-inner">
                    <div
                      className="w-full h-full pointer-events-none scale-100"
                      dangerouslySetInnerHTML={{ __html: slide.thumbnailSvg }}
                    />
                    <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-black/80 px-1 rounded text-slate-300">
                      {slide.magnification}
                    </span>
                  </div>

                  {/* Slide Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-indigo-400 font-medium mb-0.5">
                      <span>{slide.tissueFamily}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-400 truncate">{slide.organ}</span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                      {slide.title}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {slide.description}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                      <span>{slide.staining}</span>
                      <span aria-hidden="true">·</span>
                      <span>{slide.analysis.cellularConstituents.length} estruturas</span>
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="shrink-0 pl-1">
                    <span
                      className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
