import React, { useEffect, useState } from 'react';
import { ReferenceTissueSlide, HistologyAnalysis, UiLocalAnalysis } from '../types/histology';
import { REFERENCE_SLIDES } from '../data/referenceSlides';
import { listAnalyses, deleteAnalysis, type StoredAnalysis } from '../utils/analysisHistory';
import { getThumbnails } from '../utils/thumbnailStore';
import { describeError, readApiError } from '../utils/apiError';
import { useDialogFocus } from '../utils/dialogFocus';
import {
  X,
  Search,
  Eye,
  Microscope,
  Camera,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Loader2,
  FolderOpen,
} from 'lucide-react';

/** Lâmina real da galeria (micrografia CC) — contrato de GET /api/gallery. */
export interface GalleryItem {
  key: string;
  title: string;
  tissue: string;
  description: string;
  author?: string;
  license?: string;
  source_url?: string;
  provenance: 'verified' | 'unverified' | 'ai-generated';
}

/** Análise mapeada devolvida por GET /api/gallery/:key/analysis. */
export type GalleryAnalysis = HistologyAnalysis & {
  mode?: string;
  localAnalysis?: UiLocalAnalysis | null;
};

interface ReferenceAtlasDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSlide: (slide: ReferenceTissueSlide) => void;
  onSelectGallerySlide: (item: GalleryItem, analysis: GalleryAnalysis) => void;
  activeSlideId: string;
  // B2: reabrir análises guardadas no histórico local.
  onSelectStoredAnalysis?: (entry: StoredAnalysis) => void;
}

export const ReferenceAtlasDrawer: React.FC<ReferenceAtlasDrawerProps> = ({
  isOpen,
  onClose,
  onSelectSlide,
  onSelectGallerySlide,
  activeSlideId,
  onSelectStoredAnalysis,
}) => {
  const [selectedFamily, setSelectedFamily] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Melhoria 2026-09-28: a galeria real (12 micrografias fotográficas) passou
  // a ser acessível pela UI — antes só os SVG sintéticos eram alcançáveis.
  const [tab, setTab] = useState<'atlas' | 'gallery' | 'mine'>('atlas');
  const [galleryItems, setGalleryItems] = useState<GalleryItem[] | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  // B2: histórico local de análises — recarrega quando o drawer abre.
  const [stored, setStored] = useState<StoredAnalysis[]>([]);
  // Miniaturas do histórico: vivem no IndexedDB (2026-09-29); entradas antigas
  // ainda podem trazer a data URL embutida no localStorage.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isOpen) return;
    const items = listAnalyses();
    setStored(items);
    void getThumbnails(items.filter((i) => !i.thumbnail).map((i) => i.id)).then(setThumbs);
  }, [isOpen]);

  // A11y: foco inicial no painel, Escape fecha e o foco volta ao botão de
  // origem (utils/dialogFocus).
  const dialogRef = useDialogFocus(isOpen, onClose);

  // Carrega a galeria quando o drawer abre (uma vez por abertura).
  useEffect(() => {
    if (!isOpen || galleryItems || galleryError) return;
    fetch('/api/gallery', { signal: AbortSignal.timeout(15_000) })
      .then(async (r) => {
        if (!r.ok) throw await readApiError(r, 'Falha ao carregar a galeria.');
        return r.json();
      })
      .then((d) => setGalleryItems(d.items ?? []))
      .catch((e) => setGalleryError(e?.name === 'TimeoutError' ? 'O pedido excedeu o tempo limite.' : e.message));
  }, [isOpen, galleryItems, galleryError]);

  const handleGallerySelect = async (item: GalleryItem) => {
    setLoadingKey(item.key);
    setGalleryError(null);
    try {
      const res = await fetch(`/api/gallery/${item.key}/analysis`, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw await readApiError(res, 'Falha ao analisar a lâmina.');
      const body = (await res.json()) as GalleryAnalysis;
      onSelectGallerySlide(item, body);
      onClose();
    } catch (e: any) {
      setGalleryError(describeError(e, 'Falha ao analisar a lâmina.'));
    } finally {
      setLoadingKey(null);
    }
  };

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

  const q = searchQuery.toLowerCase();
  const filteredGallery = (galleryItems ?? []).filter((item) =>
    !q || item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Atlas e galeria histológica"
        tabIndex={-1}
        className="relative w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-200 outline-none"
      >
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

        {/* Tabs: Atlas esquemático vs Galeria real */}
        <div className="px-4 pt-3 border-b border-slate-800 bg-slate-950/50 flex gap-1">
          <button
            onClick={() => setTab('atlas')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition-colors ${
              tab === 'atlas' ? 'bg-slate-900 text-indigo-300 border border-slate-800 border-b-transparent' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Atlas esquemático
          </button>
          <button
            onClick={() => setTab('gallery')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
              tab === 'gallery' ? 'bg-slate-900 text-indigo-300 border border-slate-800 border-b-transparent' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Galeria real (fotos)
          </button>
          {onSelectStoredAnalysis && (
            <button
              onClick={() => setTab('mine')}
              className={`px-3 py-2 text-xs font-semibold rounded-t-md transition-colors flex items-center gap-1.5 ${
                tab === 'mine' ? 'bg-slate-900 text-indigo-300 border border-slate-800 border-b-transparent' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              As minhas lâminas ({stored.length})
            </button>
          )}
        </div>

        {tab === 'mine' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {stored.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <FolderOpen className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs text-slate-400">
                  Ainda não há análises guardadas. Carrega uma lâmina em «Analisar Imagem» —
                  as análises ficam guardadas automaticamente neste separador.
                </p>
              </div>
            ) : (
              stored.map((entry) => {
                const thumb = entry.thumbnail ?? thumbs[entry.id];
                return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-700 transition-colors"
                >
                  {thumb ? (
                    <img src={thumb} alt={entry.title} className="w-16 h-16 object-cover rounded-lg border border-slate-800" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                      <Microscope className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">{entry.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {entry.tissue} · {entry.confidence}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(entry.date).toLocaleString('pt-PT')} · {entry.mode === 'gemini' ? 'Gemini' : 'Motor local'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onSelectStoredAnalysis?.(entry)}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => {
                        deleteAnalysis(entry.id);
                        setStored(listAnalyses());
                      }}
                      title="Apagar do histórico"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        )}
        {/* Filtros, pesquisa e grelha — só para o atlas/galeria. Sem isto, a
            aba «As minhas lâminas» mostrava a barra de pesquisa e o atlas
            esquemático completo por baixo do histórico (bug 2026-09-29). */}
        {tab !== 'mine' && (
          <>
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

          {/* Tissue Family Filter Tabs (só no atlas — a galeria pesquisa por texto) */}
          {tab === 'atlas' && (
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
          )}
        </div>

        {/* Slides Grid List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {tab === 'gallery' ? (
            galleryError ? (
              <div className="text-center py-12 text-red-400 text-xs">{galleryError}</div>
            ) : galleryItems === null ? (
              <div className="text-center py-12 text-slate-500 text-xs">A carregar galeria…</div>
            ) : filteredGallery.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">Nenhuma lâmina encontrada.</div>
            ) : (
              filteredGallery.map((item) => {
                const isActive = activeSlideId === `gallery_${item.key}`;
                return (
                  <div
                    key={item.key}
                    onClick={() => void handleGallerySelect(item)}
                    className={`group relative rounded-xl border p-3 transition-all cursor-pointer flex gap-3.5 items-center ${
                      isActive
                        ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Micrografia real */}
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-black shrink-0 border border-slate-800 relative shadow-inner">
                      <img
                        src={`/gallery-images/${item.key}.jpg`}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-medium mb-0.5">
                        <span className="text-indigo-400">H&E · fotografia real</span>
                        {item.provenance === 'verified' ? (
                          <a
                            href={item.source_url || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline decoration-dotted underline-offset-2"
                            title={item.author ? `© ${item.author} · ${item.license} — abrir ficha no Wikimedia Commons` : 'Abrir ficha no Wikimedia Commons'}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            {item.author ? `© ${item.author}` : 'origem verificada'}
                          </a>
                        ) : item.provenance === 'ai-generated' ? (
                          <span className="flex items-center gap-1 text-fuchsia-400" title="Imagem sintética gerada por IA para referência pedagógica — não é micrografia real; não usada no treino/validação do motor">
                            <Sparkles className="w-3 h-3" />
                            sintética — gerada por IA
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-400" title="Origem não confirmada no Wikimedia Commons">
                            <ShieldAlert className="w-3 h-3" />
                            proveniência por confirmar
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                        {item.title}
                      </h3>

                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                        <span>{item.tissue}</span>
                        {item.license && <span aria-hidden="true">·</span>}
                        {item.license && <span>{item.license}</span>}
                      </div>
                    </div>

                    <div className="shrink-0 pl-1">
                      {loadingKey === item.key ? (
                        <span className="p-2 rounded-lg flex items-center justify-center bg-slate-800 text-indigo-300">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </span>
                      ) : (
                        <span
                          className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : filteredSlides.length === 0 ? (
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
          </>
        )}
      </div>
    </div>
  );
};
