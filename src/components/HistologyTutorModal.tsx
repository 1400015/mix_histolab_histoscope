import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  Trash2,
  Copy,
  Check,
  Lightbulb,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';

interface HistologyTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tissueContext: string;
  imageBase64?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const HistologyTutorModal: React.FC<HistologyTutorModalProps> = ({
  isOpen,
  onClose,
  tissueContext,
  imageBase64,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      content: `Olá! Sou o seu Assistente Especialista de Histologia HistoScope AI.\n\nO corte atualmente em análise é: **${tissueContext}**.\n\nPode colocar questões sobre diagnóstico diferencial, morfologia nuclear, ultraestrutura, colorações histológicas ou implicações patológicas!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [modelChoice, setModelChoice] = useState<'gemini-3.8-flash' | 'gemini-3.1-flash-lite'>('gemini-3.8-flash');
  const [rolePersona, setRolePersona] = useState<'pathologist' | 'academic_tutor' | 'lab_histotechnologist'>('pathologist');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, text: m.content })),
          tissueContext,
          imageBase64: imageBase64 || undefined,
          modelChoice,
          rolePersona,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao comunicar com o modelo Gemini.');
      }

      const data = await response.json();
      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Sem resposta disponível.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro ao processar a resposta. Por favor, tente novamente.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'init_reset',
        role: 'assistant',
        content: `Histórico reiniciado. Como posso auxiliá-lo na análise de **${tissueContext}**?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const quickPrompts = [
    'Quais os 3 critérios determinantes para este diagnóstico diferencial?',
    'Como explicar a afinidade basofílica ou eosinofílica observada?',
    'Que alterações patológicas seriam esperadas neste tecido numa biópsia?',
    'Como distinguir esta estrutura de potenciais artefactos técnicos?',
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
                <span>Especialista Gemini Histologia</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                  Multi-Turn
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate max-w-xs">
                {tissueContext}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              title="Limpar histórico da conversa"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Persona & Model Configuration Strip */}
        <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Papel:</span>
            <select
              value={rolePersona}
              onChange={(e: any) => setRolePersona(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-slate-300 text-[11px] focus:outline-none"
            >
              <option value="pathologist">Médico Patologista</option>
              <option value="academic_tutor">Professor Universitário</option>
              <option value="lab_histotechnologist">Especialista Histoquímica</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">Modelo:</span>
            <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px] font-mono">
              <button
                onClick={() => setModelChoice('gemini-3.8-flash')}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  modelChoice === 'gemini-3.8-flash'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Flash 3.8
              </button>
              <button
                onClick={() => setModelChoice('gemini-3.1-flash-lite')}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  modelChoice === 'gemini-3.1-flash-lite'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lite (Rápido)
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Conversation Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-600/40 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] p-3.5 rounded-xl leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 text-[10px] text-slate-400 border-t border-white/10 opacity-70">
                  <span>{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity flex items-center gap-1"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400 w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>O especialista Gemini está a analisar e formular a resposta...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt suggestions */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/50 space-y-1">
          <div className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
            <Lightbulb className="w-3 h-3 text-amber-400" />
            <span>Perguntas Sugeridas para esta Lâmina:</span>
          </div>
          <div className="flex flex-col gap-1">
            {quickPrompts.slice(0, 3).map((q, i) => (
              <button
                key={i}
                onClick={() => setInput(q)}
                className="text-[11px] text-left text-indigo-300 hover:text-indigo-200 hover:bg-slate-800/60 px-2 py-1 rounded transition-colors truncate"
              >
                · {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-900 flex items-center gap-2">
          <input
            type="text"
            placeholder="Pergunte sobre critérios, núcleos, colorações ou patologia..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
