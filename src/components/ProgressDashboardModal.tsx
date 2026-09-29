import React, { useMemo } from 'react';
import {
  X,
  TrendingUp,
  Calendar,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { QuizAttempt, UserProgress } from '../types/histology';
import { useDialogFocus } from '../utils/dialogFocus';

interface ProgressDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetakeQuiz?: () => void;
}

export const ProgressDashboardModal: React.FC<ProgressDashboardModalProps> = ({
  isOpen,
  onClose,
}) => {
  // A11y: foco inicial no painel, Escape fecha e o foco volta ao botão de
  // origem (utils/dialogFocus substitui a cópia local do listener, que era a
  // única a registar-se com o modal fechado e a re-subscrever por render).
  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  // Read progress from localStorage
  const getProgress = (): UserProgress => {
    try {
      const raw = localStorage.getItem('histoscope_quiz_history');
      if (raw) {
        const history: QuizAttempt[] = JSON.parse(raw);
        if (Array.isArray(history) && history.length > 0) {
          const totalQuestionsAnswered = history.reduce((acc, h) => acc + h.totalQuestions, 0);
          const totalCorrectAnswers = history.reduce((acc, h) => acc + h.score, 0);
          const averagePercentage = Math.round(
            (totalCorrectAnswers / (totalQuestionsAnswered || 1)) * 100
          );

          return {
            totalQuizzesTaken: history.length,
            totalQuestionsAnswered,
            totalCorrectAnswers,
            averagePercentage,
            history: history.reverse(), // most recent first
          };
        }
      }
    } catch (e) {
      console.error('Erro ao ler histórico de avaliações:', e);
    }

    return {
      totalQuizzesTaken: 0,
      totalQuestionsAnswered: 0,
      totalCorrectAnswers: 0,
      averagePercentage: 0,
      history: [],
    };
  };

  const progress = useMemo(getProgress, []);

  const handleClearHistory = () => {
    if (window.confirm('Tem a certeza de que deseja reiniciar todo o histórico de avaliação?')) {
      localStorage.removeItem('histoscope_quiz_history');
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Painel de progresso do estudante"
        tabIndex={-1}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-200 outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Progresso & Histórico Académico
              </h2>
              <p className="text-xs text-slate-400">
                Acompanhamento contínuo da retenção diagnóstica e testes realizados
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Avaliações
              </span>
              <div className="text-2xl font-black text-white">
                {progress.totalQuizzesTaken}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Questões
              </span>
              <div className="text-2xl font-black text-indigo-400">
                {progress.totalQuestionsAnswered}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Acertos
              </span>
              <div className="text-2xl font-black text-emerald-400">
                {progress.totalCorrectAnswers}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">
                Média Global
              </span>
              <div className="text-2xl font-black text-amber-400">
                {progress.averagePercentage}%
              </div>
            </div>
          </div>

          {/* Historical Attempts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <h3 className="font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Histórico de Sessões de Treino</span>
              </h3>
              {progress.history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                >
                  Limpar Histórico
                </button>
              )}
            </div>

            {progress.history.length === 0 ? (
              <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-slate-800/80 text-slate-500 space-y-1">
                <BookOpen className="w-8 h-8 mx-auto opacity-40 mb-2" />
                <p>Ainda não realizou nenhum questionário.</p>
                <p className="text-[11px] text-slate-600">
                  Inicie um teste na lâmina ativa para começar a registar o seu desempenho!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {progress.history.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <h4 className="font-semibold text-slate-100 text-xs">
                        {attempt.tissueName}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {attempt.date}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-indigo-400">{attempt.difficulty}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white">
                        {attempt.score} / {attempt.totalQuestions}
                      </div>
                      <span
                        className={`text-[10px] font-semibold ${
                          attempt.percentage >= 80
                            ? 'text-emerald-400'
                            : attempt.percentage >= 60
                            ? 'text-indigo-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {attempt.percentage}% de precisão
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
