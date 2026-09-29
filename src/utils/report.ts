import type { HistologyAnalysis } from '../types/histology';
import type { UserAnnotation } from '../types/histology';

/** B3: serializa uma análise (opcionalmente com anotações e métricas locais)
 * para Markdown — o "deliverable" natural do estudante. Função pura, testável. */
export function buildAnalysisReport(input: {
  title: string;
  staining: string;
  analysis: HistologyAnalysis;
  mode?: string;
  magnification?: string;
  localFeatures?: Record<string, number> | null;
  annotations?: UserAnnotation[];
  date?: Date;
}): string {
  const {
    title,
    staining,
    analysis,
    mode,
    magnification,
    localFeatures,
    annotations,
    date = new Date(),
  } = input;
  const tc = analysis.tissueClassification;
  const lines: string[] = [];
  lines.push(`# Relatório Histológico — ${title}`);
  lines.push('');
  lines.push(
    `**Data:** ${date.toLocaleString('pt-PT')} | **Coloração:** ${staining}${
      magnification ? ` | **Ampliação:** ${magnification}` : ''
    }${mode ? ` | **Modo:** ${mode === 'gemini' ? 'Gemini (IA)' : 'Motor local (offline)'}` : ''}`,
  );
  lines.push('');
  lines.push('## Classificação Tecidular');
  lines.push('');
  lines.push(`- **Tecido primário:** ${tc.primaryTissue}`);
  lines.push(`- **Família:** ${tc.tissueFamily}`);
  lines.push(`- **Órgão provável:** ${tc.probableOrgan}`);
  lines.push(`- **Confiança:** ${tc.confidenceLevel}`);
  lines.push(`- **Coloração identificada:** ${tc.stainType}`);
  lines.push('');
  lines.push('### Descrição Geral');
  lines.push('');
  lines.push(tc.generalDescription);
  lines.push('');
  lines.push('## Análise da Coloração');
  lines.push('');
  const st = analysis.stainingAnalysis;
  lines.push(`- **Corante:** ${st.stainName}`);
  lines.push(`- **Elementos basófilos:** ${st.basophilicElements}`);
  lines.push(`- **Elementos acidófilos:** ${st.acidophilicElements}`);
  lines.push(`- **Racional químico:** ${st.chemicalRationale}`);
  lines.push('');
  if (analysis.cellularConstituents.length) {
    lines.push('## Constituintes Celulares Identificados');
    lines.push('');
    for (const c of analysis.cellularConstituents) {
      lines.push(`### ${c.name} — *${c.cellularCategory}*`);
      lines.push('');
      lines.push(c.morphologyDescription);
      lines.push('');
    }
  }
  lines.push('## Critérios de Identificação');
  lines.push('');
  for (const r of analysis.diagnosticCriteria.keyIdentificationRules) {
    lines.push(`- ${r}`);
  }
  lines.push('');
  if (localFeatures) {
    lines.push('## Métricas Morfométricas (motor local)');
    lines.push('');
    lines.push('| Métrica | Valor |');
    lines.push('| --- | --- |');
    lines.push(`| Núcleos segmentados | ${localFeatures.n_nuclei} |`);
    lines.push(`| Densidade nuclear | ${Number(localFeatures.nuclei_per_mm2 ?? 0).toFixed(0)}/mm² |`);
    lines.push(`| Área nuclear mediana | ${localFeatures.median_nucleus_area} px² |`);
    lines.push(`| Circularidade mediana | ${Number(localFeatures.median_circularity ?? 0).toFixed(2)} |`);
    lines.push(`| Elongação mediana | ${Number(localFeatures.median_elongation ?? 0).toFixed(2)} |`);
    lines.push(`| Razão de estroma | ${(Number(localFeatures.stromal_ratio ?? 0) * 100).toFixed(1)}% |`);
    lines.push(`| Espaços claros | ${(Number(localFeatures.empty_ratio ?? 0) * 100).toFixed(1)}% |`);
    lines.push('');
  }
  if (analysis.diagnosticCriteria.artifactsAndCaveats.length) {
    lines.push('## Limitações e Artefactos');
    lines.push('');
    for (const a of analysis.diagnosticCriteria.artifactsAndCaveats) lines.push(`- ${a}`);
    lines.push('');
  }
  if (annotations && annotations.length) {
    lines.push('## Anotações do Utilizador');
    lines.push('');
    for (const a of annotations) {
      lines.push(`- **${a.label}** (${a.category || '—'}): ${a.notes || 'sem notas'}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push(
    '*Relatório gerado automaticamente pelo HistoScope-AI — ferramenta educativa; não substitui diagnóstico patológico.*',
  );
  return lines.join('\n');
}

/** Descarrega o relatório como ficheiro .md (B3). */
export function downloadReport(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Abre a caixa de impressão do navegador com o relatório (PDF via print CSS). */
export function printReport(markdown: string, title: string): void {
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return;
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = esc(markdown)
    .split('\n')
    .map((l) => {
      if (l.startsWith('### ')) return `<h3>${l.slice(4)}</h3>`;
      if (l.startsWith('## ')) return `<h2>${l.slice(3)}</h2>`;
      if (l.startsWith('# ')) return `<h1>${l.slice(2)}</h1>`;
      if (l.startsWith('| ')) return `<div class="row">${l}</div>`;
      if (l.startsWith('---')) return '<hr/>';
      if (l.startsWith('- ')) return `<li>${l.slice(2)}</li>`;
      if (!l.trim()) return '';
      return `<p>${l}</p>`;
    })
    .join('\n');
  win.document.write(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1e293b; line-height: 1.6; }
  h1 { font-size: 1.5rem; border-bottom: 2px solid #4f46e5; padding-bottom: .4rem; }
  h2 { font-size: 1.15rem; color: #4f46e5; margin-top: 1.6rem; }
  h3 { font-size: 1rem; }
  li { margin-left: 1.2rem; }
  .row { font-family: monospace; font-size: .85rem; color: #475569; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 1.5rem 0; }
  @media print { body { margin: 0; } }
</style></head><body>${body}<script>window.onload = () => setTimeout(() => window.print(), 200);</script></body></html>`);
  win.document.close();
}
