import { useEffect, useRef } from 'react';

/**
 * Comportamento de diálogo modal (2026-09-29).
 *
 * Os modais já fechavam com Escape, mas o foco ficava no botão que os abriu:
 * com o teclado, o Tab seguinte percorria o conteúdo por trás do modal. Este
 * hook (substitui as cinco cópias do listener de Escape) foca o painel ao
 * abrir, fecha com Escape e devolve o foco ao elemento anterior ao fechar.
 *
 * Uso: `const dialogRef = useDialogFocus(isOpen, onClose)` e
 * `<div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>`.
 */
export function useDialogFocus(isOpen: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  return ref;
}
