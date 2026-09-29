import { useEffect, useState } from 'react';
import {
  Microscope,
  Upload,
  SplitSquareVertical,
  Tag,
  Layers,
  Sparkles,
  Bot,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { REFERENCE_SLIDES } from './data/referenceSlides';
import {
  ReferenceTissueSlide,
  HistologyAnalysis,
  CellularConstituent,
  UserAnnotation,
  UiLocalAnalysis,
} from './types/histology';
import { MicroscopeViewer } from './components/MicroscopeViewer';
import { detectLang, setLang, t, type Lang } from './i18n';
import { AnalysisPanel } from './components/AnalysisPanel';
import { AnnotationSystem } from './components/AnnotationSystem';
import { SlideComparisonModal } from './components/SlideComparisonModal';
import { buildAnalysisReport, downloadReport, printReport } from './utils/report';
import { saveAnalysis, makeThumbnail, type StoredAnalysis } from './utils/analysisHistory';
import { putThumbnail, getThumbnails } from './utils/thumbnailStore';
import { loadAnnotations, saveAnnotations } from './utils/annotations';
import { AcademicQuizModal } from './components/AcademicQuizModal';
import { ReferenceAtlasDrawer } from './components/ReferenceAtlasDrawer';
import type { GalleryItem } from './components/ReferenceAtlasDrawer';
import { ImageUploaderModal } from './components/ImageUploaderModal';
import { HistologyTutorModal } from './components/HistologyTutorModal';
import { ProgressDashboardModal } from './components/ProgressDashboardModal';

export default function App() {
  // Current Active Slide State (Default: Skin thick reference)
  const defaultSlide = REFERENCE_SLIDES[0];

  const [activeSlideId, setActiveSlideId] = useState<string>(defaultSlide.id);
  const [slideTitle, setSlideTitle] = useState<string>(defaultSlide.title);
  const [slideStaining, setSlideStaining] = useState<string>(defaultSlide.staining);
  const [slideImageSrc, setSlideImageSrc] = useState<string | undefined>(undefined);
  const [slideSvgContent, setSlideSvgContent] = useState<string | undefined>(defaultSlide.thumbnailSvg);
  const [slideDescription, setSlideDescription] = useState<string>(defaultSlide.description);
  const [currentAnalysis, setCurrentAnalysis] = useState<HistologyAnalysis>(defaultSlide.analysis);
  // Análise local crua (motor CV) — é o que o endpoint de quiz offline precisa
  // (contrato 2026-09-28: antes o frontend nunca enviava analysis e o quiz
  // offline era inalcançável).
  const [currentLocalAnalysis, setCurrentLocalAnalysis] = useState<UiLocalAnalysis | null>(null);
  // Overlay da segmentação de núcleos (motor local) — mostra "o que o
  // computador viu" por cima da lâmina (melhoria 2026-09-28).
  const [overlaySrc, setOverlaySrc] = useState<string | undefined>(undefined);

  // Interaction State
  const [selectedConstituent, setSelectedConstituent] = useState<CellularConstituent | null>(null);
  const [userAnnotations, setUserAnnotations] = useState<UserAnnotation[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<'analysis' | 'annotations'>('analysis');

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isAtlasOpen, setIsAtlasOpen] = useState<boolean>(false);
  const [isQuizOpen, setIsQuizOpen] = useState<boolean>(false);
  const [isProgressOpen, setIsProgressOpen] = useState<boolean>(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState<boolean>(false);
  const [isTutorOpen, setIsTutorOpen] = useState<boolean>(false);
  // C4: i18n pt/en — idioma detetado/saved em localStorage.
  const [lang, setLangState] = useState<Lang>(() => detectLang());

  // As anotações pertencem à lâmina ativa e o App é o único dono do estado e da
  // persistência (utils/annotations) — antes o AnnotationSystem também gravava
  // na mesma chave, a partir do seu próprio snapshot.
  useEffect(() => {
    setUserAnnotations(loadAnnotations(activeSlideId));
  }, [activeSlideId]);

  // Switch to reference slide
  const handleSelectReferenceSlide = (slide: ReferenceTissueSlide) => {
    setActiveSlideId(slide.id);
    setSlideTitle(slide.title);
    setSlideStaining(slide.staining);
    setSlideImageSrc(undefined);
    setSlideSvgContent(slide.thumbnailSvg);
    setSlideDescription(slide.description);
    setCurrentAnalysis(slide.analysis);
    // Correcção 2026-09-28: as anotações pertencem à lâmina anterior —
    // sem limpar, caixas da lâmina A apareciam (e gravavam) na B.
    setCurrentLocalAnalysis(null);
    setOverlaySrc(undefined);
    setUserAnnotations([]);
    setSelectedConstituent(null);
    setSelectedAnnotationId(null);
    setIsDrawingMode(false);
  };

  // Melhoria 2026-09-28: lâminas reais da galeria (fotos CC) com análise
  // local mapeada pelo endpoint /api/gallery/:key/analysis.
  const handleSelectGallerySlide = (
    item: GalleryItem,
    mapped: HistologyAnalysis & { localAnalysis?: UiLocalAnalysis | null },
  ) => {
    setActiveSlideId(`gallery_${item.key}`);
    setSlideTitle(item.title);
    setSlideStaining('H&E');
    setSlideImageSrc(`/gallery-images/${item.key}.jpg`);
    setSlideSvgContent(undefined);
    setSlideDescription(item.description);
    setCurrentAnalysis(mapped);
    setCurrentLocalAnalysis(mapped.localAnalysis ?? null);
    const ov = mapped.localAnalysis?.overlay_jpg_b64;
    setOverlaySrc(ov ? `data:image/jpeg;base64,${ov}` : undefined);
    setUserAnnotations([]);
    setSelectedConstituent(null);
    setSelectedAnnotationId(null);
    setIsDrawingMode(false);
    setRightPanelMode('analysis');
  };

  // Receive newly uploaded & analyzed image from ImageUploaderModal
  const handleAnalysisComplete = (result: {
    imageBase64: string;
    analysis: HistologyAnalysis;
    title: string;
    staining: string;
    localAnalysis?: UiLocalAnalysis | null;
  }) => {
    const uploadId = `upload_${Date.now()}`;
    setActiveSlideId(uploadId);
    setSlideTitle(result.title);
    setSlideStaining(result.staining);
    setSlideImageSrc(result.imageBase64);
    setSlideSvgContent(undefined);
    setSlideDescription(result.analysis.tissueClassification.generalDescription);
    setCurrentAnalysis(result.analysis);
    setCurrentLocalAnalysis(result.localAnalysis ?? null);
    const ovRaw = result.localAnalysis?.overlay_jpg_b64;
    setOverlaySrc(ovRaw ? `data:image/jpeg;base64,${ovRaw}` : undefined);
    // Nova lâmina carregada: anotações da anterior não se aplicam.
    setUserAnnotations([]);
    setSelectedConstituent(null);
    setSelectedAnnotationId(null);
    setIsDrawingMode(false);
    setRightPanelMode('analysis');
    // B2: persiste a análise para sobreviver ao refresh.
    void makeThumbnail(result.imageBase64).then((thumb) => {
      const entry: StoredAnalysis = {
        id: uploadId,
        title: result.title,
        staining: result.staining,
        tissue: result.analysis.tissueClassification.primaryTissue,
        organ: result.analysis.tissueClassification.probableOrgan,
        confidence: result.analysis.tissueClassification.confidenceLevel,
        mode: (result.analysis as { mode?: string }).mode || 'local',
        date: new Date().toISOString(),
        analysis: result.analysis,
        localFeatures: result.localAnalysis?.features ?? null,
      };
      saveAnalysis(entry);
      // A miniatura vive no IndexedDB: no localStorage enchia a quota de 5 MB.
      if (thumb) void putThumbnail(uploadId, thumb);
    });
  };

  const handleAddAnnotation = (ann: UserAnnotation) => {
    // A gravação parte do estado anterior (update funcional), não do snapshot
    // deste render: era assim que a caixa anterior se perdia na chave.
    setUserAnnotations((prev) => {
      const next = [...prev, ann];
      saveAnnotations(activeSlideId, next);
      return next;
    });
  };

  const handleAnnotationsChange = (annotations: UserAnnotation[]) => {
    setUserAnnotations(annotations);
    saveAnnotations(activeSlideId, annotations);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-30 shrink-0">
        {/* App Title & Current Slide Summary */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Microscope className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                <span>{t(lang).appTitle}</span>
                <span className="text-[10px] font-mono uppercase bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-1.5 py-0.2 rounded font-normal">
                  {t(lang).appSubtitle}
                </span>
              </h1>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-800 text-xs text-slate-400">
            <span className="text-slate-200 font-medium truncate max-w-xs">{slideTitle}</span>
            <span aria-hidden="true">·</span>
            <span className="text-indigo-400 font-mono text-[11px]">{currentAnalysis.tissueClassification.tissueFamily}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400 text-[11px]">{currentAnalysis.tissueClassification.confidenceLevel}</span>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Upload Button */}
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t(lang).newImage}</span>
          </button>

          {/* Side-by-side Comparison Button */}
          <button
            onClick={() => setIsComparisonOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
            title={t(lang).compareTitle}
          >
            <SplitSquareVertical className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">{t(lang).compareSide}</span>
          </button>

          {/* Reference Atlas Library */}
          <button
            onClick={() => setIsAtlasOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
            title={t(lang).atlasTitle}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">{t(lang).atlas}</span>
          </button>

          {/* Academic Quiz Mode */}
          <button
            onClick={() => setIsQuizOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
            title={t(lang).quizTitle}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">{t(lang).quiz}</span>
          </button>

          {/* User Progress Dashboard */}
          <button
            onClick={() => setIsProgressOpen(true)}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            title={t(lang).progressTitle}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline">{t(lang).progress}</span>
          </button>

          {/* AI Histology Tutor Chat */}
          <button
            onClick={() => setIsTutorOpen(true)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-xs transition-colors border border-slate-700"
            title={t(lang).tutorTitle}
          >
            <Bot className="w-4 h-4" />
          </button>
          {/* C4: alternar idioma pt/en */}
          <button
            onClick={() => { const next = lang === 'pt' ? 'en' : 'pt'; setLang(next); setLangState(next); }}
            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-700"
            title="Switch language / Mudar idioma"
          >
            {lang === 'pt' ? 'EN' : 'PT'}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout (2-Column Desktop Grid) */}
      <main className="flex-1 flex flex-col md:flex-row p-3 gap-3 overflow-hidden">
        {/* Left Column: Interactive Microscope Viewport (60-65% width) */}
        <section className="flex-1 h-full min-h-[360px] flex flex-col min-w-0">
          <MicroscopeViewer
            imageSrc={slideImageSrc}
            svgContent={slideSvgContent}
            title={slideTitle}
            staining={slideStaining}
            overlaySrc={overlaySrc}
            nuclei={currentLocalAnalysis?.nuclei ?? undefined}
            magnification={currentAnalysis.tissueClassification.magnificationEstimate || '400x'}
            constituents={currentAnalysis.cellularConstituents}
            selectedConstituent={selectedConstituent}
            onSelectConstituent={(c) => {
              setSelectedConstituent(c);
              setRightPanelMode('analysis');
            }}
            userAnnotations={userAnnotations}
            onAddAnnotation={handleAddAnnotation}
            isDrawingMode={isDrawingMode}
            onToggleDrawingMode={(active) => {
              setIsDrawingMode(active);
              if (active) setRightPanelMode('annotations');
            }}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={(id) => {
              setSelectedAnnotationId(id);
              if (id) setRightPanelMode('annotations');
            }}
          />
        </section>

        {/* Right Column: Switchable Panel (Analysis Report vs User Annotations) (35-40% width) */}
        <aside className="w-full md:w-[440px] xl:w-[490px] h-full flex flex-col shrink-0">
          {/* Right Panel View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg mb-2 text-xs">
            <button
              onClick={() => setRightPanelMode('analysis')}
              className={`flex-1 py-1 px-3 rounded-md font-medium transition-colors text-center flex items-center justify-center gap-1.5 ${
                rightPanelMode === 'analysis'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Análise & Diagnóstico</span>
            </button>

            <button
              onClick={() => setRightPanelMode('annotations')}
              className={`flex-1 py-1 px-3 rounded-md font-medium transition-colors text-center flex items-center justify-center gap-1.5 ${
                rightPanelMode === 'annotations'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Minhas Anotações ({userAnnotations.length})</span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightPanelMode === 'analysis' ? (
              <AnalysisPanel
                analysis={currentAnalysis}
                selectedConstituent={selectedConstituent}
                onSelectConstituent={(c) => setSelectedConstituent(c)}
                onOpenQuiz={() => setIsQuizOpen(true)}
                onExportMarkdown={() => {
                  const md = buildAnalysisReport({
                    title: slideTitle,
                    staining: slideStaining,
                    analysis: currentAnalysis,
                    mode: (currentAnalysis as { mode?: string }).mode,
                    localFeatures: currentLocalAnalysis?.features ?? null,
                    annotations: userAnnotations,
                  });
                  downloadReport(md, `relatorio_${slideTitle.replace(/\s+/g, '_').toLowerCase()}.md`);
                }}
                onExportPrint={() => {
                  const md = buildAnalysisReport({
                    title: slideTitle,
                    staining: slideStaining,
                    analysis: currentAnalysis,
                    mode: (currentAnalysis as { mode?: string }).mode,
                    localFeatures: currentLocalAnalysis?.features ?? null,
                    annotations: userAnnotations,
                  });
                  printReport(md, slideTitle);
                }}
              />
            ) : (
              <AnnotationSystem
                slideId={activeSlideId}
                slideTitle={slideTitle}
                slideTissue={currentAnalysis.tissueClassification.primaryTissue}
                imageSrc={slideImageSrc}
                svgContent={slideSvgContent}
                isDrawingMode={isDrawingMode}
                onToggleDrawingMode={(active) => setIsDrawingMode(active)}
                annotations={userAnnotations}
                onAnnotationsChange={handleAnnotationsChange}
                selectedAnnotationId={selectedAnnotationId}
                onSelectAnnotation={(id) => setSelectedAnnotationId(id)}
              />
            )}
          </div>
        </aside>
      </main>

      {/* MODAL 1: Image Uploader & Live AI Analyzer */}
      <ImageUploaderModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onAnalysisComplete={handleAnalysisComplete}
      />

      {/* MODAL 2: Side-by-Side Slide Comparison */}
      <SlideComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        primarySlide={{
          id: activeSlideId,
          title: slideTitle,
          tissue: currentAnalysis.tissueClassification.primaryTissue,
          staining: slideStaining,
          imageSrc: slideImageSrc,
          svgContent: slideSvgContent,
          description: slideDescription,
        }}
        imageBase64={activeSlideId.startsWith('gallery_') ? undefined : slideImageSrc}
        galleryKey={activeSlideId.startsWith('gallery_') ? activeSlideId.slice('gallery_'.length) : undefined}
      />

      {/* MODAL 3: Reference Atlas Drawer */}
      <ReferenceAtlasDrawer
        isOpen={isAtlasOpen}
        onClose={() => setIsAtlasOpen(false)}
        onSelectSlide={handleSelectReferenceSlide}
        onSelectGallerySlide={handleSelectGallerySlide}
        activeSlideId={activeSlideId}
        onSelectStoredAnalysis={(entry) => {
          // B2: reabrir uma análise guardada — restaura título, imagem e análise
          // sem voltar a correr o motor.
          setActiveSlideId(entry.id);
          setSlideTitle(entry.title);
          setSlideStaining(entry.staining);
          setCurrentAnalysis(entry.analysis);
          setCurrentLocalAnalysis(entry.localFeatures ? { features: entry.localFeatures } : null);
          setSlideDescription(entry.analysis.tissueClassification.generalDescription);
          setSlideSvgContent(undefined);
          void getThumbnails([entry.id]).then((t) => {
            setSlideImageSrc(t[entry.id] ?? undefined);
          });
          setUserAnnotations([]);
          setSelectedConstituent(null);
          setSelectedAnnotationId(null);
          setIsDrawingMode(false);
          setRightPanelMode('analysis');
          setOverlaySrc(undefined);
          setIsAtlasOpen(false);
        }}
      />

      {/* MODAL 4: Academic Quiz & Evaluation Engine */}
      <AcademicQuizModal
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        questions={currentAnalysis.academicQuizQuestions}
        currentTissueName={currentAnalysis.tissueClassification.primaryTissue}
        imageBase64={slideImageSrc}
        localAnalysis={currentLocalAnalysis ?? undefined}
        onQuestionsUpdated={(newQuestions) => {
          setCurrentAnalysis((prev) => ({
            ...prev,
            academicQuizQuestions: newQuestions,
          }));
        }}
        onOpenProgressDashboard={() => {
          setIsQuizOpen(false);
          setIsProgressOpen(true);
        }}
      />

      {/* MODAL 5: Student Progress Dashboard */}
      <ProgressDashboardModal
        isOpen={isProgressOpen}
        onClose={() => setIsProgressOpen(false)}
      />

      {/* MODAL 6: AI Histology Tutor Chat */}
      <HistologyTutorModal
        isOpen={isTutorOpen}
        onClose={() => setIsTutorOpen(false)}
        tissueContext={`${slideTitle} - ${currentAnalysis.tissueClassification.primaryTissue} (${slideStaining})`}
        imageBase64={slideImageSrc}
        localFeatures={currentLocalAnalysis?.features ?? undefined}
      />
    </div>
  );
}
