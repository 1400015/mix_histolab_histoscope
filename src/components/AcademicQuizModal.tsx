import React, { useState, useEffect } from 'react';
import { AcademicQuizQuestion, QuizAttempt } from '../types/histology';
import { recordSRSAnswer, prioritizeQuestions, questionKey } from '../utils/spacedRepetition';
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Loader2,
  HelpCircle,
  Lightbulb,
  TrendingUp,
  Edit3,
} from 'lucide-react';

interface AcademicQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: AcademicQuizQuestion[];
  currentTissueName: string;
  imageBase64?: string;
  // Análise local crua (motor CV) — obriga o quiz offline a funcionar
  // (correcção 2026-09-28: o endpoint exigia analysis que nunca era enviado).
  localAnalysis?: Record<string, unknown> | null;
  onQuestionsUpdated?: (newQuestions: AcademicQuizQuestion[]) => void;
  onOpenProgressDashboard?: () => void;
}

export const AcademicQuizModal: React.FC<AcademicQuizModalProps> = ({
  isOpen,
  onClose,
  questions: initialQuestions,
  currentTissueName,
  imageBase64,
  localAnalysis,
  onQuestionsUpdated,
  onOpenProgressDashboard,
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

  const [questions, setQuestions] = useState<AcademicQuizQuestion[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [fillBlankInput, setFillBlankInput] = useState<string>('');
  // B6: perguntas dissertativas — resposta do aluno e autoavaliação.
  const [openInput, setOpenInput] = useState<string>('');
  const [openSelfGrade, setOpenSelfGrade] = useState<boolean | null>(null);
  const [showModelAnswer, setShowModelAnswer] = useState<boolean>(false);
  const [showOptionsHint, setShowOptionsHint] = useState<boolean>(false);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<{ questionIndex: number; selected?: number; userInput?: string; isCorrect: boolean }[]>([]);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // AI Quiz Generation States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Intermédio');
  const [selectedQuestionType, setSelectedQuestionType] = useState<string>('all');
  const [generationError, setGenerationError] = useState<string | null>(null);

  const resetQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setFillBlankInput('');
    setShowOptionsHint(false);
    setIsAnswered(false);
    setScore(0);
    setUserAnswers([]);
    setIsFinished(false);
  };

  React.useEffect(() => {
    // B4: repetição espaçada — perguntas falhadas/vencidas primeiro.
    setQuestions(prioritizeQuestions(initialQuestions));
    resetQuiz();
  }, [initialQuestions]);

  if (!isOpen) return null;

  const currentQ = questions[currentIndex];
  const isFillBlank = currentQ?.questionType === 'fill_blank';

  // Normalize text removing accents and extra spaces for fair comparison
  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);

    const isCorrect = index === currentQ.correctOptionIndex;
    if (isCorrect) {
      setScore((s) => s + 1);
    }

    setUserAnswers((prev) => [
      ...prev,
      { questionIndex: currentIndex, selected: index, isCorrect },
    ]);
    // B4: repetição espaçada — a pergunta falhada volta nas sessões seguintes.
    try { recordSRSAnswer(questionKey(currentQ), isCorrect); } catch { /* noop */ }
  };

  const handleCheckFillBlank = () => {
    if (isAnswered || !fillBlankInput.trim()) return;
    setIsAnswered(true);

    const userNorm = normalizeText(fillBlankInput);
    const correctTarget = currentQ.options[currentQ.correctOptionIndex];
    const acceptable = [
      correctTarget,
      ...(currentQ.acceptableAnswers || []),
    ];

    const isCorrect = acceptable.some((ans) => {
      const norm = normalizeText(ans);
      return norm === userNorm || norm.includes(userNorm) || userNorm.includes(norm);
    });

    if (isCorrect) {
      setScore((s) => s + 1);
    }

    setUserAnswers((prev) => [
      ...prev,
      { questionIndex: currentIndex, userInput: fillBlankInput.trim(), isCorrect },
    ]);
    // B4: repetição espaçada.
    try { recordSRSAnswer(questionKey(currentQ), isCorrect); } catch { /* noop */ }
  };

  // B6: o aluno lê a resposta modelo e autoavalia-se — a nota entra no
  // histórico tal como as outras perguntas.
  const handleOpenSelfGrade = (correct: boolean) => {
    if (isAnswered) return;
    setOpenSelfGrade(correct);
    setIsAnswered(true);
    if (correct) setScore((s) => s + 1);
    setUserAnswers((prev) => [
      ...prev,
      { questionIndex: currentIndex, userInput: openInput.trim(), isCorrect: correct },
    ]);
    // B4: repetição espaçada.
    try { recordSRSAnswer(questionKey(currentQ), correct); } catch { /* noop */ }
  };
  const handleRevealModelAnswer = () => {
    if (isAnswered) return;
    setShowModelAnswer(true);
  };
  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setFillBlankInput('');
      setOpenInput('');
      setOpenSelfGrade(null);
      setShowModelAnswer(false);
      setShowOptionsHint(false);
      setIsAnswered(false);
    } else {
      // Save attempt to localStorage
      saveQuizAttempt();
      setIsFinished(true);
    }
  };

  const saveQuizAttempt = () => {
    try {
      const attempt: QuizAttempt = {
        id: `attempt_${Date.now()}`,
        date: new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        tissueName: currentTissueName,
        totalQuestions: questions.length,
        score,
        percentage: Math.round((score / questions.length) * 100),
        difficulty: selectedDifficulty,
      };

      const existingRaw = localStorage.getItem('histoscope_quiz_history');
      const existing: QuizAttempt[] = existingRaw ? JSON.parse(existingRaw) : [];
      existing.push(attempt);
      localStorage.setItem('histoscope_quiz_history', JSON.stringify(existing));
    } catch (e) {
      console.error('Erro ao guardar progresso:', e);
    }
  };

  const generateNewQuestions = async () => {
    try {
      setIsGenerating(true);
      setGenerationError(null);

      const response = await fetch('/api/generate-quiz', {
        signal: AbortSignal.timeout(60_000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tissueName: currentTissueName,
          difficulty: selectedDifficulty,
          count: 5,
          questionTypes: selectedQuestionType,
          imageBase64: imageBase64 || undefined,
          // Quiz offline: sem analysis o endpoint devolve 400 (correcção 2026-09-28)
          analysis: localAnalysis || undefined,
        }),
      });

      if (!response.ok) {
        // Melhoria 2026-09-28: mostrar a razão específica do servidor (ex.:
        // 422 análise indeterminada) em vez de uma mensagem genérica.
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.error || 'Não foi possível gerar novas perguntas com a IA.');
      }

      const data = await response.json();
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        if (onQuestionsUpdated) {
          onQuestionsUpdated(data.questions);
        }
        resetQuiz();
      } else {
        throw new Error('A resposta da IA não continha perguntas válidas.');
      }
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || 'Erro ao conectar à API da IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const calculateGrade = () => {
    const percentage = Math.round((score / questions.length) * 100);
    if (percentage >= 90) return { title: 'Excelente / Distinção', color: 'text-emerald-400', desc: 'Domínio exímio da morfologia e critérios histológicos!' };
    if (percentage >= 70) return { title: 'Muito Bom', color: 'text-indigo-400', desc: 'Sólida compreensão diagnóstica e histoquímica.' };
    if (percentage >= 50) return { title: 'Suficiente', color: 'text-amber-400', desc: 'Compreensão básica, recomenda-se rever os critérios diferenciais.' };
    return { title: 'Necessita Revisão', color: 'text-rose-400', desc: 'Consulte o guia de reconhecimento da lâmina e tente novamente.' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Avaliação Académica & Treino Histológico
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-sm">
                Foco: {currentTissueName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenProgressDashboard && (
              <button
                onClick={onOpenProgressDashboard}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                title="Ver Histórico de Desempenho"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Meu Progresso</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Difficulty & AI Generation Settings */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-6 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Nível:</span>
              {(['Iniciação', 'Intermédio', 'Avançado'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    selectedDifficulty === diff
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedQuestionType}
                onChange={(e) => setSelectedQuestionType(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs focus:outline-none"
              >
                <option value="all">Mista (Escolha + Lacunas)</option>
                <option value="multiple_choice">Apenas Escolha Múltipla</option>
                <option value="fill_blank">Apenas Preenchimento de Lacunas</option>
              </select>

              <button
                onClick={generateNewQuestions}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>A Gerar...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Gerar com IA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {generationError && (
            <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300">
              {generationError}
            </div>
          )}

          {/* Test Finished Summary Screen */}
          {isFinished ? (
            <div className="text-center py-6 space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-indigo-950/60 border-2 border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-xl">
                <Award className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Resultado da Avaliação
                </span>
                <div className="text-4xl font-extrabold text-white mt-1">
                  {score} <span className="text-xl text-slate-500 font-normal">/ {questions.length}</span>
                </div>
                <div className={`text-lg font-bold mt-2 ${calculateGrade().color}`}>
                  {calculateGrade().title}
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  {calculateGrade().desc}
                </p>
                <div className="text-xs text-emerald-400 font-medium mt-1">
                  ✓ Sessão guardada automaticamente no seu histórico de progresso!
                </div>
              </div>

              {/* Breakdown of questions */}
              <div className="text-left bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Revisão das Questões
                </h4>
                {questions.map((q, idx) => {
                  const ua = userAnswers.find((a) => a.questionIndex === idx);
                  const isCorrect = ua?.isCorrect;
                  const correctText = q.options[q.correctOptionIndex];
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-start gap-2.5"
                    >
                      {isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-slate-200">{q.question}</div>
                        <div className="text-slate-400 mt-1">
                          Resposta correta:{' '}
                          <span className="text-emerald-400 font-semibold">
                            {correctText}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={resetQuiz}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Repetir Este Teste</span>
                </button>
                <button
                  onClick={generateNewQuestions}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gerar Próximo Desafio</span>
                </button>
              </div>
            </div>
          ) : currentQ ? (
            /* Active Question Screen */
            <div className="space-y-5">
              {/* Progress and metadata */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">
                    Pergunta {currentIndex + 1} de {questions.length}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-300 border border-indigo-800/40 rounded">
                    {currentQ.category}
                  </span>
                  {isFillBlank && (
                    <span className="px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-800/40 rounded flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      Preenchimento de Lacuna
                    </span>
                  )}
                </div>
                <span className="text-emerald-400 font-medium">Pontuação: {score}</span>
              </div>

              {/* Question Text */}
              <h3 className="text-base font-semibold text-slate-100 leading-relaxed">
                {currentQ.question}
              </h3>

              {/* B6 — MODE 0: Pergunta dissertativa com autoavaliação */}
              {currentQ.questionType === 'open' ? (
                <div className="space-y-3">
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                    <label className="block text-xs font-medium text-slate-300">
                      Escreve a tua resposta dissertativa (não é corrigida automaticamente):
                    </label>
                    <textarea
                      rows={4}
                      disabled={isAnswered}
                      placeholder="Escreve a tua resposta aqui..."
                      value={openInput}
                      onChange={(e) => setOpenInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    {!isAnswered ? (
                      <button
                        onClick={handleRevealModelAnswer}
                        disabled={!openInput.trim() && !showModelAnswer}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-colors disabled:opacity-40"
                      >
                        {showModelAnswer ? 'Compara com a resposta modelo abaixo' : 'Ver resposta modelo e autoavaliar'}
                      </button>
                    ) : showModelAnswer ? (
                      <div className="space-y-2">
                        <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-lg text-xs text-slate-200 space-y-1">
                          <span className="text-indigo-300 font-semibold">Resposta modelo:</span>
                          <p className="leading-relaxed">{currentQ.modelAnswer}</p>
                        </div>
                        <p className="text-[11px] text-slate-400">A tua resposta autoavaliada como:</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenSelfGrade(true)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                              openSelfGrade === true
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-emerald-950/40 hover:border-emerald-600'
                            }`}
                          >
                            ✓ Acertei
                          </button>
                          <button
                            onClick={() => handleOpenSelfGrade(false)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                              openSelfGrade === false
                                ? 'bg-rose-600 border-rose-500 text-white'
                                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-rose-950/40 hover:border-rose-600'
                            }`}
                          >
                            ✗ Errei
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {isAnswered && (
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300">
                      <span className="text-indigo-300 font-semibold">Explicação: </span>
                      {currentQ.explanation}
                    </div>
                  )}
                </div>
              ) : isFillBlank ? (
                <div className="space-y-3">
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                    <label className="block text-xs font-medium text-slate-300">
                      Escreva o termo histológico correto que preenche a lacuna:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        disabled={isAnswered}
                        placeholder="Escreva a resposta aqui..."
                        value={fillBlankInput}
                        onChange={(e) => setFillBlankInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCheckFillBlank()}
                        className={`flex-1 bg-slate-900 border rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none ${
                          isAnswered
                            ? userAnswers[userAnswers.length - 1]?.isCorrect
                              ? 'border-emerald-500 bg-emerald-950/30 text-emerald-200'
                              : 'border-rose-500 bg-rose-950/30 text-rose-200'
                            : 'border-slate-700 focus:ring-1 focus:ring-indigo-500'
                        }`}
                      />
                      {!isAnswered && (
                        <button
                          onClick={handleCheckFillBlank}
                          disabled={!fillBlankInput.trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-colors disabled:opacity-40"
                        >
                          Verificar
                        </button>
                      )}
                    </div>

                    {!isAnswered && !showOptionsHint && (
                      <button
                        type="button"
                        onClick={() => setShowOptionsHint(true)}
                        className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        Precisa de uma pista? Ver opções de apoio
                      </button>
                    )}

                    {/* Hint Options */}
                    {showOptionsHint && !isAnswered && (
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <span className="text-[11px] text-slate-400 font-medium">
                          Escolha entre as opções possíveis:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {currentQ.options.map((opt, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setFillBlankInput(opt)}
                              className="p-2 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded text-xs transition-colors"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* MODE 2: Multiple Choice Options */
                <div className="space-y-2.5">
                  {currentQ.options.map((option, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isSelected = selectedOption === optIdx;
                    const isCorrect = optIdx === currentQ.correctOptionIndex;

                    let optClass = 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700 text-slate-200';

                    if (isAnswered) {
                      if (isCorrect) {
                        optClass = 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-500/30';
                      } else if (isSelected) {
                        optClass = 'bg-rose-950/40 border-rose-500/60 text-rose-200 ring-1 ring-rose-500/30';
                      } else {
                        optClass = 'opacity-50 border-slate-800 text-slate-400';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        disabled={isAnswered}
                        onClick={() => handleSelectOption(optIdx)}
                        className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all flex items-start gap-3 ${optClass}`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border ${
                            isAnswered && isCorrect
                              ? 'bg-emerald-600 text-white border-emerald-400'
                              : isAnswered && isSelected
                              ? 'bg-rose-600 text-white border-rose-400'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="flex-1 pt-0.5 leading-relaxed">{option}</span>
                        {isAnswered && isCorrect && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        {isAnswered && isSelected && !isCorrect && (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Rationale / Explanation Box when answered */}
              {isAnswered && (
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs animate-in fade-in duration-150 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                      <Lightbulb className="w-4 h-4" />
                      <span>Justificação Histológica & Fundamentação</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Resposta Correta: <strong className="text-emerald-400">{currentQ.options[currentQ.correctOptionIndex]}</strong>
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {currentQ.explanation}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">
              Nenhuma pergunta disponível.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isFinished && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
            <button
              onClick={resetQuiz}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Reiniciar Questionário
            </button>

            {isAnswered ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <span>{currentIndex + 1 < questions.length ? 'Próxima Questão' : 'Ver Resultados'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="text-xs text-slate-500">
                {isFillBlank ? 'Escreva e verifique a sua resposta' : 'Selecione uma opção para verificar a resposta'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
