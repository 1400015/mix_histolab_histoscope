import { ReferenceTissueSlide } from '../types/histology';

// High-fidelity SVG renderers for authentic microscopic appearances:
// 1. Pele grossa (Epitélio estratificado queratinizado com cristas e derme)
const skinThickSvg = `
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-full object-cover">
  <defs>
    <radialGradient id="microLens" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2a0845" stop-opacity="0.15"/>
    </radialGradient>
    <filter id="cellTexture" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0.9  0 1 0 0 0.8  0 0 1 0 0.88  0 0 0 0.12 0" />
      <feComposite in="SourceGraphic" in2="noise" operator="in" />
    </filter>
  </defs>

  <!-- Fundo da lâmina -->
  <rect width="800" height="600" fill="#fdf5f8"/>

  <!-- Camada Córnea Queratinizada (Laranja/Rosa vivo anucleado estratificado) -->
  <path d="M0,0 L800,0 L800,105 Q600,115 400,95 Q200,110 0,100 Z" fill="#e86b8b" opacity="0.85"/>
  <path d="M0,20 Q200,35 400,15 Q600,30 800,18" stroke="#d44b6b" stroke-width="2.5" fill="none" stroke-dasharray="8 4"/>
  <path d="M0,50 Q200,65 400,45 Q600,60 800,48" stroke="#c43b5b" stroke-width="2" fill="none" stroke-dasharray="12 5"/>
  <path d="M0,80 Q200,95 400,75 Q600,90 800,78" stroke="#d44b6b" stroke-width="1.8" fill="none"/>

  <!-- Camada Lúcida / Granulosa (Grânulos basofílicos densos de querato-hialina) -->
  <path d="M0,98 Q200,112 400,93 Q600,113 800,103 L800,145 Q600,155 400,140 Q200,158 0,148 Z" fill="#581d6d" opacity="0.75"/>
  <!-- Grânulos de queratohialina -->
  <g fill="#2d083d" opacity="0.9">
    ${Array.from({ length: 45 }).map((_, i) => `<circle cx="${(i * 18 + (i % 3) * 5) % 800}" cy="${110 + (i % 5) * 6}" r="${2 + (i % 2.5)}"/>`).join('')}
  </g>

  <!-- Camada Espinhosa (Células poliédricas com citoplasma eosinofílico e pontes intercelulares) -->
  <path d="M0,148 Q200,158 400,140 Q600,155 800,145 L800,340 C720,380 680,260 600,350 C520,390 480,270 400,360 C320,390 280,280 200,370 C120,390 80,270 0,360 Z" fill="#e898b0" opacity="0.7"/>

  <!-- Núcleos da Camada Espinhosa (Ovais, cromatina aberta, nucléolos) -->
  <g fill="#431459" opacity="0.85">
    ${Array.from({ length: 70 }).map((_, i) => `<ellipse cx="${(i * 26 + 15) % 780 + 10}" cy="${165 + (i * 14) % 150}" rx="6" ry="7" transform="rotate(${((i * 17) % 40) - 20} ${(i * 26 + 15) % 780 + 10} ${165 + (i * 14) % 150})"/>`).join('')}
  </g>

  <!-- Cristas Epiteliais e Camada Basal (Células cilíndricas/cúbicas alinhadas na membrana basal) -->
  <path d="M0,360 C80,270 120,390 200,370 C280,280 320,390 400,360 C480,270 520,390 600,350 C680,260 720,380 800,340" stroke="#310a42" stroke-width="4" fill="none" opacity="0.9"/>

  <!-- Núcleos basais em paliçada -->
  <g fill="#2d083d">
    ${Array.from({ length: 55 }).map((_, i) => {
      const x = i * 14 + 10;
      const y = 330 + Math.sin(i * 0.45) * 35;
      return `<ellipse cx="${x}" cy="${y}" rx="4.5" ry="7" transform="rotate(${Math.cos(i * 0.45) * 25} ${x} ${y})"/>`;
    }).join('')}
  </g>

  <!-- Derme Papilar e Reticular (Tecido conjuntivo frouxo e denso irregular: fibras colagénias eosinofílicas onduladas e capilares) -->
  <rect x="0" y="380" width="800" height="220" fill="#f5cbd6" opacity="0.6"/>
  <!-- Feixes colagénios ondulados -->
  <g stroke="#d4708d" stroke-width="3" fill="none" opacity="0.6">
    <path d="M10,420 Q60,400 120,430 T240,410 T360,435 T480,415 T600,430 T720,410 T800,425"/>
    <path d="M0,470 Q80,450 160,480 T320,460 T480,485 T640,465 T800,480"/>
    <path d="M20,530 Q90,510 180,540 T360,520 T540,545 T720,525 T800,540"/>
    <path d="M0,580 Q70,560 150,590 T300,570 T450,595 T600,575 T750,590"/>
  </g>

  <!-- Núcleos de Fibroblastos da derme (alongados, afilados) -->
  <g fill="#3a1147" opacity="0.8">
    ${Array.from({ length: 30 }).map((_, i) => `<ellipse cx="${(i * 55 + 20) % 780}" cy="${410 + (i * 17) % 170}" rx="9" ry="2.5" transform="rotate(${((i * 23) % 50) - 25} ${(i * 55 + 20) % 780} ${410 + (i * 17) % 170})"/>`).join('')}
  </g>

  <!-- Vaso capilar com hemácias na papila dérmica -->
  <ellipse cx="290" cy="355" rx="14" ry="10" fill="#f8e4e9" stroke="#b23b5c" stroke-width="1.8"/>
  <circle cx="287" cy="355" r="3.5" fill="#c42b3b"/>
  <circle cx="294" cy="354" r="3.2" fill="#c42b3b"/>

  <rect width="800" height="600" fill="url(#microLens)" pointer-events="none"/>
</svg>
`;

// 2. Cartilagem Hialina (Traqueia - Matriz basofílica homogênea e condrócitos em grupos isogénicos)
const hyalineCartilageSvg = `
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-full object-cover">
  <defs>
    <radialGradient id="matrixGrad" cx="50%" cy="55%" r="60%">
      <stop offset="0%" stop-color="#9a80b8"/>
      <stop offset="60%" stop-color="#b19cc9"/>
      <stop offset="100%" stop-color="#caa4cf"/>
    </radialGradient>
    <radialGradient id="territorialGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#4e2168" stop-opacity="0.9"/>
      <stop offset="70%" stop-color="#6e398d" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#9a80b8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="microLens" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2a0845" stop-opacity="0.15"/>
    </radialGradient>
  </defs>

  <!-- Matriz cartilagínea interterritorial vítrea basofílica -->
  <rect width="800" height="600" fill="url(#matrixGrad)"/>

  <!-- Pericôndrio Superior (Camada Fibrosa externa eosinofílica e Camada Condrogénica interna) -->
  <rect x="0" y="0" width="800" height="90" fill="#dd839d" opacity="0.85"/>
  <g stroke="#9d3b5b" stroke-width="2" fill="none" opacity="0.7">
    <path d="M0,25 C150,15 300,35 450,20 C600,35 750,20 800,28"/>
    <path d="M0,50 C150,40 300,60 450,45 C600,60 750,45 800,53"/>
    <path d="M0,75 C150,65 300,85 450,70 C600,85 750,70 800,78"/>
  </g>
  <!-- Núcleos afilados do pericôndrio (fibroblastos e condroblastos achatados) -->
  <g fill="#360846">
    ${Array.from({ length: 28 }).map((_, i) => `<ellipse cx="${(i * 45 + 15) % 780}" cy="${20 + (i * 9) % 65}" rx="10" ry="2.8" transform="rotate(${((i * 11) % 20) - 10} ${(i * 45 + 15) % 780} ${20 + (i * 9) % 65})"/>`).join('')}
  </g>

  <!-- Condrócitos Jovens Achatados Subpericondrais -->
  <g>
    ${[120, 260, 410, 560, 710].map((cx) => `
      <g transform="translate(${cx}, 125)">
        <ellipse cx="0" cy="0" rx="22" ry="12" fill="#e8d5ec" stroke="#5a216f" stroke-width="1.8"/>
        <ellipse cx="0" cy="0" rx="8" ry="5" fill="#3b0f4d"/>
      </g>
    `).join('')}
  </g>

  <!-- Grupos Isogénicos Coronários (Matriz Territorial escura circundante e lacunas de Howship) -->
  <!-- Grupo 1 (Centro-Esquerda) -->
  <g transform="translate(230, 260)">
    <circle cx="0" cy="0" r="75" fill="url(#territorialGrad)"/>
    <!-- Lacuna 1 -->
    <ellipse cx="-16" cy="-12" rx="20" ry="18" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="-16" cy="-12" r="9" fill="#2d063b"/>
    <circle cx="-14" cy="-14" r="2.5" fill="#f8e5fa"/>
    <!-- Lacuna 2 -->
    <ellipse cx="18" cy="-10" rx="21" ry="17" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="18" cy="-10" r="9.5" fill="#2d063b"/>
    <circle cx="20" cy="-12" r="2.5" fill="#f8e5fa"/>
    <!-- Lacuna 3 -->
    <ellipse cx="2" cy="22" rx="22" ry="18" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="2" cy="22" r="10" fill="#2d063b"/>
    <circle cx="4" cy="20" r="2.8" fill="#f8e5fa"/>
  </g>

  <!-- Grupo 2 (Centro-Direita) -->
  <g transform="translate(560, 310)">
    <circle cx="0" cy="0" r="85" fill="url(#territorialGrad)"/>
    <!-- Lacunas aos pares (grupo isogénico axial) -->
    <ellipse cx="-18" cy="-15" rx="22" ry="19" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="-18" cy="-15" r="10" fill="#2d063b"/>
    <ellipse cx="18" cy="-12" rx="21" ry="18" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="18" cy="-12" r="9.5" fill="#2d063b"/>
    <ellipse cx="-16" cy="24" rx="22" ry="19" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="-16" cy="24" r="10" fill="#2d063b"/>
    <ellipse cx="20" cy="26" rx="23" ry="18" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="20" cy="26" r="10.5" fill="#2d063b"/>
  </g>

  <!-- Grupo 3 (Inferior Esquerda) -->
  <g transform="translate(160, 480)">
    <circle cx="0" cy="0" r="65" fill="url(#territorialGrad)"/>
    <ellipse cx="-14" cy="-2" rx="20" ry="17" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="-14" cy="-2" r="9" fill="#2d063b"/>
    <ellipse cx="16" cy="2" rx="21" ry="18" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="16" cy="2" r="9.5" fill="#2d063b"/>
  </g>

  <!-- Grupo 4 (Inferior Direita) -->
  <g transform="translate(680, 490)">
    <circle cx="0" cy="0" r="60" fill="url(#territorialGrad)"/>
    <ellipse cx="0" cy="-10" rx="22" ry="18" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="0" cy="-10" r="9.5" fill="#2d063b"/>
    <ellipse cx="2" cy="18" rx="21" ry="17" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="2" cy="18" r="9" fill="#2d063b"/>
  </g>

  <!-- Condrócitos Isolados na Matriz -->
  <g transform="translate(380, 420)">
    <circle cx="0" cy="0" r="45" fill="url(#territorialGrad)"/>
    <ellipse cx="0" cy="0" rx="24" ry="20" fill="#f4ebf8" stroke="#4a1863" stroke-width="2"/>
    <circle cx="0" cy="0" r="11" fill="#2d063b"/>
    <circle cx="2" cy="-2" r="3" fill="#f8e5fa"/>
  </g>

  <rect width="800" height="600" fill="url(#microLens)" pointer-events="none"/>
</svg>
`;

// 3. Músculo Estriado Esquelético (Corte longitudinal com estriações A e I e núcleos periféricos)
const skeletalMuscleSvg = `
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-full object-cover">
  <defs>
    <!-- Padrão de estriações transversais (Banda A escura / Banda I clara com Linha Z) -->
    <pattern id="striations" width="16" height="40" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="8" height="40" fill="#cc5279"/>
      <rect x="8" y="0" width="8" height="40" fill="#e889a7"/>
      <!-- Linha Z tênue -->
      <line x1="12" y1="0" x2="12" y2="40" stroke="#a43358" stroke-width="1.2"/>
    </pattern>
    <radialGradient id="microLens" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2a0845" stop-opacity="0.15"/>
    </radialGradient>
  </defs>

  <rect width="800" height="600" fill="#fae8ef"/>

  <!-- Fibra Muscular 1 (Superior) -->
  <g transform="translate(0, 30)">
    <rect x="0" y="0" width="800" height="110" fill="url(#striations)"/>
    <line x1="0" y1="0" x2="800" y2="0" stroke="#8d1c44" stroke-width="2.5"/>
    <line x1="0" y1="110" x2="800" y2="110" stroke="#8d1c44" stroke-width="2.5"/>
    <!-- Núcleos periféricos achatados subsarcolemais -->
    <ellipse cx="140" cy="8" rx="26" ry="6" fill="#300742"/>
    <ellipse cx="380" cy="102" rx="28" ry="6.5" fill="#300742"/>
    <ellipse cx="640" cy="9" rx="25" ry="6" fill="#300742"/>
  </g>

  <!-- Endomísio (Tecido conjuntivo frouxo com capilares) -->
  <rect x="0" y="140" width="800" height="18" fill="#fcedf2"/>
  <ellipse cx="480" cy="149" rx="10" ry="5" fill="#d25875" opacity="0.6"/>

  <!-- Fibra Muscular 2 (Central Alta) -->
  <g transform="translate(0, 158)">
    <rect x="0" y="0" width="800" height="120" fill="url(#striations)"/>
    <line x1="0" y1="0" x2="800" y2="0" stroke="#8d1c44" stroke-width="2.5"/>
    <line x1="0" y1="120" x2="800" y2="120" stroke="#8d1c44" stroke-width="2.5"/>
    <!-- Núcleos periféricos -->
    <ellipse cx="90" cy="112" rx="27" ry="6.5" fill="#300742"/>
    <ellipse cx="320" cy="7" rx="26" ry="6" fill="#300742"/>
    <ellipse cx="530" cy="113" rx="29" ry="7" fill="#300742"/>
    <ellipse cx="730" cy="8" rx="24" ry="6" fill="#300742"/>
  </g>

  <!-- Endomísio intermediário -->
  <rect x="0" y="278" width="800" height="18" fill="#fcedf2"/>

  <!-- Fibra Muscular 3 (Central Baixa) -->
  <g transform="translate(0, 296)">
    <rect x="0" y="0" width="800" height="125" fill="url(#striations)"/>
    <line x1="0" y1="0" x2="800" y2="0" stroke="#8d1c44" stroke-width="2.5"/>
    <line x1="0" y1="125" x2="800" y2="125" stroke="#8d1c44" stroke-width="2.5"/>
    <ellipse cx="180" cy="8" rx="28" ry="6.5" fill="#300742"/>
    <ellipse cx="420" cy="117" rx="27" ry="6.5" fill="#300742"/>
    <ellipse cx="670" cy="9" rx="25" ry="6" fill="#300742"/>
  </g>

  <!-- Endomísio -->
  <rect x="0" y="421" width="800" height="18" fill="#fcedf2"/>

  <!-- Fibra Muscular 4 (Inferior) -->
  <g transform="translate(0, 439)">
    <rect x="0" y="0" width="800" height="130" fill="url(#striations)"/>
    <line x1="0" y1="0" x2="800" y2="0" stroke="#8d1c44" stroke-width="2.5"/>
    <line x1="0" y1="130" x2="800" y2="130" stroke="#8d1c44" stroke-width="2.5"/>
    <ellipse cx="80" cy="121" rx="27" ry="6.5" fill="#300742"/>
    <ellipse cx="280" cy="8" rx="26" ry="6" fill="#300742"/>
    <ellipse cx="510" cy="122" rx="29" ry="7" fill="#300742"/>
    <ellipse cx="710" cy="9" rx="24" ry="6" fill="#300742"/>
  </g>

  <rect width="800" height="600" fill="url(#microLens)" pointer-events="none"/>
</svg>
`;

// 4. Tecido Ósseo Compacto (Ósteons de Havers, Canal Central, Lamelas e Canalículos)
const compactBoneSvg = `
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-full object-cover">
  <defs>
    <radialGradient id="boneBase" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#eddcc6"/>
      <stop offset="100%" stop-color="#dfcaa8"/>
    </radialGradient>
    <radialGradient id="haversCanal" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#2a1405"/>
      <stop offset="85%" stop-color="#4a250b"/>
      <stop offset="100%" stop-color="#693714"/>
    </radialGradient>
    <radialGradient id="microLens" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2a0845" stop-opacity="0.15"/>
    </radialGradient>
  </defs>

  <rect width="800" height="600" fill="url(#boneBase)"/>

  <!-- Ósteon 1 (Grande Central Esquerdo) -->
  <g transform="translate(280, 300)">
    <!-- Lamelas concêntricas -->
    <circle cx="0" cy="0" r="230" stroke="#795328" stroke-width="1.8" fill="none" opacity="0.45" stroke-dasharray="14 3"/>
    <circle cx="0" cy="0" r="185" stroke="#795328" stroke-width="2.2" fill="none" opacity="0.6"/>
    <circle cx="0" cy="0" r="145" stroke="#795328" stroke-width="2" fill="none" opacity="0.65"/>
    <circle cx="0" cy="0" r="105" stroke="#795328" stroke-width="2.2" fill="none" opacity="0.7"/>
    <circle cx="0" cy="0" r="65" stroke="#795328" stroke-width="2" fill="none" opacity="0.75"/>

    <!-- Canal de Havers central (contém vaso sanguíneo e nervo) -->
    <ellipse cx="0" cy="0" rx="36" ry="34" fill="url(#haversCanal)"/>
    <circle cx="-6" cy="-4" r="8" fill="#9d2020" opacity="0.7"/>
    <circle cx="8" cy="6" r="6" fill="#20509d" opacity="0.7"/>

    <!-- Canalículos e Osteócitos nas lacunas (em aneis concêntricos) -->
    <!-- Anel 1 (raio 65) -->
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x = Math.cos(rad) * 65;
      const y = Math.sin(rad) * 65;
      return `<g transform="translate(${x}, ${y}) rotate(${deg + 90})">
        <ellipse cx="0" cy="0" rx="6" ry="3" fill="#221105"/>
        <line x1="-12" y1="0" x2="12" y2="0" stroke="#503015" stroke-width="0.8"/>
        <line x1="0" y1="-8" x2="0" y2="8" stroke="#503015" stroke-width="0.8"/>
      </g>`;
    }).join('')}

    <!-- Anel 2 (raio 105) -->
    ${[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x = Math.cos(rad) * 105;
      const y = Math.sin(rad) * 105;
      return `<g transform="translate(${x}, ${y}) rotate(${deg + 90})">
        <ellipse cx="0" cy="0" rx="7" ry="3.2" fill="#221105"/>
        <line x1="-15" y1="0" x2="15" y2="0" stroke="#503015" stroke-width="0.9"/>
        <line x1="0" y1="-10" x2="0" y2="10" stroke="#503015" stroke-width="0.9"/>
      </g>`;
    }).join('')}

    <!-- Anel 3 (raio 145) -->
    ${[0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 264, 288, 312, 336].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x = Math.cos(rad) * 145;
      const y = Math.sin(rad) * 145;
      return `<g transform="translate(${x}, ${y}) rotate(${deg + 90})">
        <ellipse cx="0" cy="0" rx="7.5" ry="3.5" fill="#221105"/>
        <line x1="-16" y1="0" x2="16" y2="0" stroke="#503015" stroke-width="0.9"/>
        <line x1="0" y1="-12" x2="0" y2="12" stroke="#503015" stroke-width="0.9"/>
      </g>`;
    }).join('')}

    <!-- Linha de cimentação externa (limite do ósteon) -->
    <circle cx="0" cy="0" r="232" stroke="#4a2c0c" stroke-width="2.5" fill="none" opacity="0.75"/>
  </g>

  <!-- Ósteon 2 (Secundário / Adjacente Direita) -->
  <g transform="translate(680, 220)">
    <circle cx="0" cy="0" r="160" stroke="#795328" stroke-width="1.8" fill="none" opacity="0.5"/>
    <circle cx="0" cy="0" r="115" stroke="#795328" stroke-width="2" fill="none" opacity="0.6"/>
    <circle cx="0" cy="0" r="70" stroke="#795328" stroke-width="2.2" fill="none" opacity="0.7"/>
    <ellipse cx="0" cy="0" rx="30" ry="28" fill="url(#haversCanal)"/>

    ${[20, 70, 120, 170, 220, 270, 320].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x = Math.cos(rad) * 70;
      const y = Math.sin(rad) * 70;
      return `<ellipse cx="${x}" cy="${y}" rx="6" ry="3" fill="#221105" transform="rotate(${deg + 90} ${x} ${y})"/>`;
    }).join('')}
    ${[10, 50, 90, 130, 170, 210, 250, 290, 330].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x = Math.cos(rad) * 115;
      const y = Math.sin(rad) * 115;
      return `<ellipse cx="${x}" cy="${y}" rx="7" ry="3.2" fill="#221105" transform="rotate(${deg + 90} ${x} ${y})"/>`;
    }).join('')}
  </g>

  <!-- Lamelas Intersticiais (Restos de ósteons antigos reabsorvidos) -->
  <g stroke="#6e461b" stroke-width="1.6" fill="none" opacity="0.5">
    <path d="M520,380 Q560,440 500,520"/>
    <path d="M540,390 Q580,450 520,530"/>
    <path d="M560,400 Q600,460 540,540"/>
  </g>

  <rect width="800" height="600" fill="url(#microLens)" pointer-events="none"/>
</svg>
`;

// 5. Epitélio Cilíndrico Simples com Células Caliciformes (Intestino Delgado / Jejuno - H&E)
const smallIntestineSvg = `
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-full object-cover">
  <defs>
    <radialGradient id="microLens" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2a0845" stop-opacity="0.15"/>
    </radialGradient>
  </defs>

  <!-- Lúmen intestinal (espaço claro livre superior) -->
  <rect width="800" height="600" fill="#fdf7f9"/>

  <!-- Vilosidade Intestinal 1 (Esquerda) -->
  <g>
    <!-- Lâmina própria central (estroma conjuntivo frouxo, capilares e quilífero central) -->
    <path d="M120,600 L120,180 C120,100 240,100 240,180 L240,600 Z" fill="#f6d3dd" stroke="#cf6282" stroke-width="1.5"/>
    <line x1="180" y1="180" x2="180" y2="580" stroke="#e8a8b8" stroke-width="8" stroke-linecap="round"/> <!-- Quilífero central -->

    <!-- Epitélio Colunar / Enterócitos com bordo em escova -->
    <!-- Bordo apical em escova (microvilosidades intensamente eosinofílicas) -->
    <path d="M98,600 L98,175 C98,75 262,75 262,175 L262,600" stroke="#b22b52" stroke-width="4" fill="none"/>
    <path d="M120,600 L120,180 C120,100 240,100 240,180 L240,600" stroke="#481032" stroke-width="2" fill="none"/>

    <!-- Enterócitos laterais esquerdos com núcleos ovais no terço basal -->
    ${[200, 235, 270, 305, 340, 375, 410, 445, 480, 515, 550].map((y) => `
      <g>
        <rect x="98" y="${y - 15}" width="22" height="30" fill="#f09db3" opacity="0.4"/>
        <ellipse cx="112" cy="${y}" rx="4.5" ry="8" fill="#3e0f4f"/>
      </g>
    `).join('')}

    <!-- Células Caliciformes (Secretoras de muco - cálice apical claro/mucina e núcleo basal triangular) -->
    <g transform="translate(100, 250)">
      <ellipse cx="9" cy="0" rx="9" ry="12" fill="#fff9fb" stroke="#791b45" stroke-width="1.8"/>
      <ellipse cx="10" cy="11" rx="4.5" ry="2.5" fill="#300740"/>
    </g>
    <g transform="translate(100, 390)">
      <ellipse cx="9" cy="0" rx="9" ry="12" fill="#fff9fb" stroke="#791b45" stroke-width="1.8"/>
      <ellipse cx="10" cy="11" rx="4.5" ry="2.5" fill="#300740"/>
    </g>

    <!-- Enterócitos laterais direitos -->
    ${[200, 235, 270, 305, 340, 375, 410, 445, 480, 515, 550].map((y) => `
      <g>
        <rect x="240" y="${y - 15}" width="22" height="30" fill="#f09db3" opacity="0.4"/>
        <ellipse cx="248" cy="${y}" rx="4.5" ry="8" fill="#3e0f4f"/>
      </g>
    `).join('')}

    <!-- Célula Caliciforme lado direito -->
    <g transform="translate(242, 320)">
      <ellipse cx="9" cy="0" rx="9" ry="12" fill="#fff9fb" stroke="#791b45" stroke-width="1.8"/>
      <ellipse cx="8" cy="11" rx="4.5" ry="2.5" fill="#300740"/>
    </g>
    <g transform="translate(242, 470)">
      <ellipse cx="9" cy="0" rx="9" ry="12" fill="#fff9fb" stroke="#791b45" stroke-width="1.8"/>
      <ellipse cx="8" cy="11" rx="4.5" ry="2.5" fill="#300740"/>
    </g>
  </g>

  <!-- Vilosidade Intestinal 2 (Direita) -->
  <g transform="translate(380, 0)">
    <path d="M120,600 L120,150 C120,70 240,70 240,150 L240,600 Z" fill="#f6d3dd" stroke="#cf6282" stroke-width="1.5"/>
    <line x1="180" y1="150" x2="180" y2="580" stroke="#e8a8b8" stroke-width="8" stroke-linecap="round"/>

    <path d="M98,600 L98,145 C98,45 262,45 262,145 L262,600" stroke="#b22b52" stroke-width="4" fill="none"/>
    <path d="M120,600 L120,150 C120,70 240,70 240,150 L240,600" stroke="#481032" stroke-width="2" fill="none"/>

    ${[170, 205, 240, 275, 310, 345, 380, 415, 450, 485, 520].map((y) => `
      <g>
        <ellipse cx="112" cy="${y}" rx="4.5" ry="8" fill="#3e0f4f"/>
        <ellipse cx="248" cy="${y}" rx="4.5" ry="8" fill="#3e0f4f"/>
      </g>
    `).join('')}

    <!-- Células caliciformes -->
    <g transform="translate(100, 290)">
      <ellipse cx="9" cy="0" rx="9" ry="12" fill="#fff9fb" stroke="#791b45" stroke-width="1.8"/>
      <ellipse cx="10" cy="11" rx="4.5" ry="2.5" fill="#300740"/>
    </g>
    <g transform="translate(242, 230)">
      <ellipse cx="9" cy="0" rx="9" ry="12" fill="#fff9fb" stroke="#791b45" stroke-width="1.8"/>
      <ellipse cx="8" cy="11" rx="4.5" ry="2.5" fill="#300740"/>
    </g>
    <g transform="translate(242, 420)">
      <ellipse cx="9" cy="0" rx="9" ry="12" fill="#fff9fb" stroke="#791b45" stroke-width="1.8"/>
      <ellipse cx="8" cy="11" rx="4.5" ry="2.5" fill="#300740"/>
    </g>
  </g>

  <rect width="800" height="600" fill="url(#microLens)" pointer-events="none"/>
</svg>
`;

// 6. Tecido Nervoso (Substância Cinzenta / Medula Espinal - Neurónio Motor Multipolar)
const motorNeuronSvg = `
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-full object-cover">
  <defs>
    <radialGradient id="microLens" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2a0845" stop-opacity="0.15"/>
    </radialGradient>
    <filter id="neuropil">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" result="noise"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0.92  0 1 0 0 0.82  0 0 1 0 0.88  0 0 0 0.25 0" />
    </filter>
  </defs>

  <!-- Fundo do Neuropilo (emaranhado eosinofílico de prolongamentos gliais e neuronais) -->
  <rect width="800" height="600" fill="#f7dbe3"/>

  <!-- Prolongamentos fibrilares do neuropilo -->
  <g stroke="#d88aa2" stroke-width="1.5" fill="none" opacity="0.45">
    <path d="M0,80 Q200,120 400,60 T800,90"/>
    <path d="M0,210 Q300,180 500,240 T800,190"/>
    <path d="M0,380 Q250,420 550,370 T800,430"/>
    <path d="M0,520 Q350,480 600,540 T800,500"/>
    <path d="M120,0 Q160,250 110,600"/>
    <path d="M720,0 Q680,280 740,600"/>
  </g>

  <!-- Núcleos da Glia dispersos no neuropilo (astrócitos, oligodendrócitos, micróglia) -->
  <g fill="#360a48">
    ${Array.from({ length: 45 }).map((_, i) => `<ellipse cx="${(i * 47 + 25) % 770}" cy="${(i * 37 + 35) % 560}" rx="${3 + (i % 2.5)}" ry="${3 + (i % 2.5)}" opacity="0.85"/>`).join('')}
  </g>

  <!-- Motoneurónios Multipolares Gigantes (Corno anterior da medula espinal) -->
  <!-- Neurónio 1 (Grande Central) -->
  <g transform="translate(370, 290)">
    <!-- Soma / Corpo Celular estrelado com dendritos ramificados -->
    <path d="M-60,-50 C-110,-120 -150,-150 -180,-180 C-140,-130 -90,-80 -50,-50
             C-70,-10 -130,20 -200,10 C-130,40 -70,30 -40,40
             C-60,110 -110,180 -160,230 C-100,170 -50,110 -20,60
             C20,90 70,160 110,240 C90,160 60,100 40,50
             C90,60 160,90 230,120 C160,60 100,30 50,10
             C100,-20 180,-70 240,-130 C170,-70 100,-30 40,-20
             C40,-80 70,-150 100,-220 C60,-150 30,-80 -10,-40
             Z" fill="#cf7796" stroke="#90264d" stroke-width="3"/>

    <!-- Cone de Implantação do Axónio (desprovido de corpúsculos de Nissl) no quadrante inferior direito -->
    <path d="M40,50 C90,60 160,90 230,120" stroke="#f6cad6" stroke-width="8" stroke-linecap="round"/>

    <!-- Grânulos / Corpúsculos de Nissl (Reticulo endoplasmático rugoso intensamente basofílico) -->
    <g fill="#370a48" opacity="0.85">
      ${Array.from({ length: 55 }).map((_, i) => {
        const angle = (i * 27 * Math.PI) / 180;
        const dist = 18 + (i % 5) * 8;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        return `<ellipse cx="${x}" cy="${y}" rx="${2.5 + (i % 2)}" ry="${1.8 + (i % 1.5)}" transform="rotate(${i * 15} ${x} ${y})"/>`;
      }).join('')}
    </g>

    <!-- Núcleo Vesicular Central Gigante (Cromatina frouxa / eucromatina pálida) -->
    <circle cx="0" cy="0" r="26" fill="#f8e8f0" stroke="#481035" stroke-width="2.2"/>
    <!-- Nucléolo proeminente hipercorado "olho de coruja" -->
    <circle cx="2" cy="-2" r="8.5" fill="#290435"/>
    <circle cx="4" cy="-4" r="2.5" fill="#ffffff" opacity="0.8"/>
  </g>

  <!-- Capilar sanguíneo no tecido nervoso com hemácias -->
  <g transform="translate(180, 480)">
    <path d="M-40,-15 Q0,-10 40,-15 L40,15 Q0,10 -40,15 Z" fill="#fae1e8" stroke="#891a38" stroke-width="1.8"/>
    <circle cx="-18" cy="0" r="5" fill="#b01b2a"/>
    <circle cx="6" cy="1" r="5.2" fill="#b01b2a"/>
  </g>

  <rect width="800" height="600" fill="url(#microLens)" pointer-events="none"/>
</svg>
`;

// 7. Esfregaço Sanguíneo (Giemsa / Wright - Eritrócitos, Neutrófilo multilobado, Linfócito, Plaquetas)
const bloodSmearSvg = `
<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" class="w-full h-full object-cover">
  <defs>
    <radialGradient id="rbcGrad" cx="40%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#f7bec9"/>
      <stop offset="65%" stop-color="#df627a"/>
      <stop offset="100%" stop-color="#b62c45"/>
    </radialGradient>
    <radialGradient id="rbcDepressed" cx="50%" cy="50%" r="40%">
      <stop offset="0%" stop-color="#fbe4ea"/>
      <stop offset="70%" stop-color="#f295aa"/>
      <stop offset="100%" stop-color="#df627a"/>
    </radialGradient>
    <radialGradient id="microLens" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#fff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2a0845" stop-opacity="0.15"/>
    </radialGradient>
  </defs>

  <!-- Plasma / fundo límpido de esfregaço -->
  <rect width="800" height="600" fill="#fcf6f9"/>

  <!-- Eritrócitos bicôncavos anucleados (halos centrais claros) -->
  <g>
    ${Array.from({ length: 65 }).map((_, i) => {
      const x = ((i * 73 + 30) % 760) + 20;
      const y = ((i * 59 + 25) % 550) + 25;
      // Skip cells near center where leukocytes are
      if (Math.abs(x - 380) < 95 && Math.abs(y - 280) < 95) return '';
      if (Math.abs(x - 620) < 70 && Math.abs(y - 190) < 70) return '';
      return `
        <g transform="translate(${x}, ${y})">
          <circle cx="0" cy="0" r="21" fill="url(#rbcGrad)"/>
          <circle cx="0" cy="0" r="10" fill="url(#rbcDepressed)"/>
        </g>
      `;
    }).join('')}
  </g>

  <!-- Neutrófilo Segmentado Polimorfonuclear (Centro) -->
  <g transform="translate(380, 280)">
    <!-- Citoplasma com grânulos neutros finos rosa/salmão -->
    <circle cx="0" cy="0" r="48" fill="#fde6ee" stroke="#873255" stroke-width="2"/>
    <g fill="#d86e8e" opacity="0.6">
      ${Array.from({ length: 30 }).map((_, i) => `<circle cx="${(i * 13) % 70 - 35}" cy="${(i * 17) % 70 - 35}" r="1.5"/>`).join('')}
    </g>
    <!-- Núcleo polilobulado (3 a 5 lobos unidos por filamentos de cromatina condensada roxa) -->
    <!-- Lobo 1 -->
    <ellipse cx="-18" cy="-16" rx="13" ry="11" fill="#320645"/>
    <!-- Ponte de cromatina -->
    <path d="M-10,-10 Q0,-5 12,-16" stroke="#320645" stroke-width="3" fill="none"/>
    <!-- Lobo 2 -->
    <ellipse cx="18" cy="-15" rx="14" ry="10" fill="#320645"/>
    <!-- Ponte de cromatina -->
    <path d="M18,-5 Q20,10 10,18" stroke="#320645" stroke-width="3.2" fill="none"/>
    <!-- Lobo 3 -->
    <ellipse cx="8" cy="20" rx="15" ry="12" fill="#320645"/>
    <!-- Ponte -->
    <path d="M-2,20 Q-15,18 -18,6" stroke="#320645" stroke-width="3" fill="none"/>
    <!-- Lobo 4 -->
    <ellipse cx="-20" cy="6" rx="12" ry="10" fill="#320645"/>
  </g>

  <!-- Linfócito Pequeno (Superior Direito - Núcleo esférico condensado que ocupa quase todo o citoplasma) -->
  <g transform="translate(620, 190)">
    <!-- Halo delgado de citoplasma azul-celeste claro basofílico -->
    <circle cx="0" cy="0" r="32" fill="#d2e3f5" stroke="#486895" stroke-width="1.8"/>
    <!-- Núcleo esférico hipercromático azul/roxo escuro -->
    <circle cx="0" cy="0" r="26" fill="#25043d"/>
    <circle cx="-5" cy="-5" r="3" fill="#3d095f" opacity="0.5"/>
  </g>

  <!-- Plaquetas / Trombócitos (Pequenos fragmentos celulares anucleados basofílicos) -->
  <g fill="#43085a" opacity="0.85">
    <ellipse cx="230" cy="180" rx="4.5" ry="3.5"/>
    <ellipse cx="236" cy="184" rx="4" ry="3"/>
    <ellipse cx="225" cy="187" rx="3.5" ry="3"/>

    <ellipse cx="510" cy="420" rx="4" ry="3"/>
    <ellipse cx="516" cy="425" rx="4.5" ry="3.2"/>
  </g>

  <rect width="800" height="600" fill="url(#microLens)" pointer-events="none"/>
</svg>
`;

export const REFERENCE_SLIDES: ReferenceTissueSlide[] = [
  {
    id: 'skin-thick-he',
    title: 'Pele Grossa (Epiderme e Derme)',
    tissueFamily: 'Epitelial',
    organ: 'Pele (Região Palmar ou Plantar)',
    staining: 'Hematoxilina e Eosina (H&E)',
    magnification: '200x',
    thumbnailSvg: skinThickSvg,
    description: 'Secção histológica de pele espessa humana evidenciando a clássica estratificação da epiderme (camada córnea, granulosa, espinhosa e basal) sobreposta às papilas dérmicas conjuntivas.',
    analysis: {
      tissueClassification: {
        primaryTissue: 'Epitélio Pavimentoso Estratificado Queratinizado',
        tissueFamily: 'Epitelial',
        probableOrgan: 'Pele Espessa (Palma das mãos / Planta dos pés)',
        confidenceLevel: 'Elevada (99%)',
        stainType: 'Hematoxilina e Eosina (H&E)',
        magnificationEstimate: '200x',
        generalDescription: 'Observa-se um epitélio pluriestratificado com transição morfológica desde células cúbicas basais até escamas anucleadas eosinofílicas na camada córnea espessa, delimitado inferiormente por cristas epiteliais interdigitadas com papilas dérmicas.',
      },
      stainingAnalysis: {
        stainName: 'H&E (Hematoxilina e Eosina)',
        basophilicElements: 'Núcleos celulares da camada basal e espinhosa (azul/roxo escuro por afinidade da hematoxilina com os ácidos nucleicos DNA/RNA) e grânulos de querato-hialina na camada granulosa.',
        acidophilicElements: 'Queratina anucleada da camada córnea (rosa/vermelho vivo devido às pontes dissulfeto e proteínas básicas) e feixes de colagénio da derme.',
        chemicalRationale: 'A hematoxilina comporta-se como corante básico após mordente de alumínio, ligando-se a radicais fosfato basofílicos. A eosina (ânion ácido) liga-se a grupos amina carregados positivamente nas proteínas.',
      },
      cellularConstituents: [
        {
          name: 'Queratinócitos da Camada Córnea',
          cellularCategory: 'Célula Funcional / Escama',
          morphologyDescription: 'Lamelas anucleadas aplanadas repletas de filamentos de queratina compactada.',
          nuclearCharacteristics: 'Anucleadas (apoptose terminal / cornificação completa).',
          stainingAffinity: 'Fortemente Eosinofílica (Rosa intenso / avermelhado)',
          functionalSignificance: 'Barreira física impermeável, proteção mecânica e prevenção de perda hídrica.',
          pinpoint: { x: 50, y: 12, label: 'Camada Córnea Queratinizada' },
        },
        {
          name: 'Queratinócitos da Camada Granulosa',
          cellularCategory: 'Célula Funcional',
          morphologyDescription: 'Células fusiformes/romboidais com grânulos basofílicos grosseiros no citoplasma.',
          nuclearCharacteristics: 'Núcleos em vias de picnose ou cariólise.',
          stainingAffinity: 'Intensamente Basofílica (Grânulos roxo-escuros de querato-hialina)',
          functionalSignificance: 'Síntese de profilagrina e invólucro celular cornificado.',
          pinpoint: { x: 50, y: 20, label: 'Grânulos de Querato-hialina' },
        },
        {
          name: 'Queratinócitos da Camada Espinhosa',
          cellularCategory: 'Célula Funcional',
          morphologyDescription: 'Células poliédricas volumosas com espículas/pontes intercelulares (desmossomas com tonofilamentos).',
          nuclearCharacteristics: 'Núcleos esféricos centrais com cromatina frouxa e nucléolo visível.',
          stainingAffinity: 'Eosinofílica suave a anfofílica.',
          functionalSignificance: 'Coesão mecânica celular contra tração mecânica.',
          pinpoint: { x: 38, y: 38, label: 'Camada Espinhosa (Desmossomas)' },
        },
        {
          name: 'Células Basais / Células Estaminais',
          cellularCategory: 'Célula Estaminal / Progenitora',
          morphologyDescription: 'Células prismáticas baixas dispostas em paliçada sobre a membrana basal.',
          nuclearCharacteristics: 'Núcleos ovoides volumosos hipercromáticos com alta relação núcleo-citoplasma.',
          stainingAffinity: 'Basofílica (alta concentração de ribossomas livres).',
          functionalSignificance: 'Renovação mitótica contínua de todo o epitélio.',
          pinpoint: { x: 48, y: 58, label: 'Camada Basal (Mitoses contínuas)' },
        },
        {
          name: 'Fibroblastos da Derme Papilar',
          cellularCategory: 'Célula Estromal',
          morphologyDescription: 'Células fusiformes afiladas entre feixes de colagénio tipo I e III.',
          nuclearCharacteristics: 'Núcleo alongado com extremidades afiladas e cromatina densa.',
          stainingAffinity: 'Citoplasma acidófilo indistinto.',
          functionalSignificance: 'Síntese e remodelação contínua da matriz extracelular conjuntiva.',
          pinpoint: { x: 62, y: 76, label: 'Fibroblastos da Derme' },
        },
      ],
      diagnosticCriteria: {
        keyIdentificationRules: [
          'Estratificação pluriestratificada evidente com achatamento progressivo da base para o topo.',
          'Presença inconfundível de estrato córneo anucleado espesso (patognomónico de pele queratinizada).',
          'Interdigitações profundas (cristas epiteliais epidérmicas penetrando nas papilas dérmicas).',
          'Camada granulosa nítida com grânulos basofílicos grosseiros logo abaixo do estrato córneo.',
        ],
        differentialDiagnosis: [
          {
            confusedWith: 'Epitélio Pavimentoso Estratificado Não Queratinizado (ex: Esófago, Vagina)',
            howToDistinguish: 'No esófago/vagina as células superficiais mantêm núcleos viáveis achatados e não há camada córnea espessa nem camada granulosa evidente.',
          },
          {
            confusedWith: 'Epitélio de Transição / Urotélio (Bexiga)',
            howToDistinguish: 'O urotélio possui células em guarda-chuva volumosas globosas na superfície, sem queratinização e com menor número de estratos.',
          },
        ],
        artifactsAndCaveats: [
          'Retração por desidratação na técnica histológica acentua o aspeto "espinhoso" dos desmossomas.',
          'Cortes tangenciais podem simular ninhos epiteliais isolados na derme (falsa invasão tumoral).',
        ],
      },
      academicQuizQuestions: [
        {
          id: 'skin-q1',
          question: 'Qual é o evento bioquímico e morfológico determinante que ocorre na Camada Granulosa da epiderme?',
          options: [
            'Início da divisão mitótica assimétrica com migração para a derme.',
            'Acumulação de grânulos densos de querato-hialina contendo profilagrina e corpos lamelares lipídicos.',
            'Síntese exclusiva de melanina pelos queratinócitos sem intervenção de melanócitos.',
            'Produção de fibras elásticas e feixes de colagénio tipo I.',
          ],
          correctOptionIndex: 1,
          explanation: 'Na camada granulosa, os queratinócitos acumulam grânulos basofílicos de querato-hialina (ricos em profilagrina que agrega os tonofilamentos de queratina) e corpos lamelares que exocitam lípidos para formar a barreira impermeável.',
          category: 'Histoquímica',
          difficulty: 'Intermédio',
        },
        {
          id: 'skin-q2',
          question: 'Como se explica a intensa eosinofilia (coloração rosa viva) da Camada Córnea na coloração de H&E?',
          options: [
            'Elevada concentração de DNA desoxirribonucleico condensado.',
            'Presença massiva de proteínas básicas de queratina rica em ligações dissulfeto que atraem a eosina.',
            'Deposição anormal de sais de cálcio e hidroxiapatite.',
            'Falta de lavagem do corante básico hematoxilina.',
          ],
          correctOptionIndex: 1,
          explanation: 'A queratina é uma escleroproteína com resíduos de aminoácidos básicos que interagem eletrostaticamente com o corante aniónico ácido (Eosina), conferindo a sua tonalidade rosa/vermelha viva característica.',
          category: 'Histoquímica',
          difficulty: 'Iniciação',
        },
        {
          id: 'skin-q3',
          question: 'Num corte histológico suspeito, que estrutura descarta com certeza o diagnóstico de Epitélio do Esófago em favor da Pele Grossa?',
          options: [
            'Presença de membrana basal delgada subjacente.',
            'Presença de camada córnea anucleada compacta e estrato granuloso bem desenvolvido.',
            'Presença de desmossomas entre as células poliédricas.',
            'Presença de tecido conjuntivo frouxo subepitelial.',
          ],
          correctOptionIndex: 1,
          explanation: 'O esófago é revestido por epitélio estratificado pavimentoso não queratinizado, retendo núcleos até às camadas mais apicais e desprovido de camada granulosa proeminente.',
          category: 'Diagnóstico Diferencial',
          difficulty: 'Avançado',
        },
      ],
    },
  },
  {
    id: 'hyaline-cartilage-he',
    title: 'Cartilagem Hialina (Traqueia / Costal)',
    tissueFamily: 'Conjuntivo',
    organ: 'Traqueia (Anel cartilagíneo)',
    staining: 'Hematoxilina e Eosina (H&E)',
    magnification: '400x',
    thumbnailSvg: hyalineCartilageSvg,
    description: 'Secção transversal de anel cartilagíneo hialino traqueal evidenciando pericôndrio periférico, matriz basofílica homogênea e condrócitos alojados em lacunas formando grupos isogénicos.',
    analysis: {
      tissueClassification: {
        primaryTissue: 'Tecido Cartilagíneo Hialino',
        tissueFamily: 'Conjuntivo Especializado',
        probableOrgan: 'Traqueia ou Laringe',
        confidenceLevel: 'Elevada (99%)',
        stainType: 'Hematoxilina e Eosina (H&E)',
        magnificationEstimate: '400x',
        generalDescription: 'Apresenta uma matriz extracelular aparentemente amorfa e vítrea basofílica (devido a agrecano e glicosaminoglicanos sulfatados), contendo lacunas condrocitárias agrupadas em ninhos de divisão (grupos isogénicos).',
      },
      stainingAnalysis: {
        stainName: 'Hematoxilina e Eosina (H&E)',
        basophilicElements: 'Matriz territorial (em redor das lacunas) intensamente basofílica devido à alta densidade de proteoglicanos sulfatados com cargas negativas.',
        acidophilicElements: 'Pericôndrio fibroso externo (feixes de colagénio tipo I eosinofílicos).',
        chemicalRationale: 'O agrecano possui grupos sulfato e carboxilo ionizados negativamente que se complexam fortemente com o cátion azul da hematoxilina, gerando basofilia ou metacromasia.',
      },
      cellularConstituents: [
        {
          name: 'Condrócito em Lacuna',
          cellularCategory: 'Célula Funcional',
          morphologyDescription: 'Célula esférica a ovalada retraída na sua lacuna de Howship.',
          nuclearCharacteristics: 'Núcleo central esférico com 1 ou 2 nucléolos visíveis.',
          stainingAffinity: 'Citoplasma levemente basofílico.',
          functionalSignificance: 'Manutenção e síntese da matriz cartilagínea (colagénio tipo II e proteoglicanos).',
          pinpoint: { x: 29, y: 43, label: 'Grupo Isogénico Coronário' },
        },
        {
          name: 'Matriz Territorial (Cápsula pericelular)',
          cellularCategory: 'Matriz Extracelular',
          morphologyDescription: 'Halo escuro circundante imediato às lacunas condrocitárias.',
          nuclearCharacteristics: 'Acelular.',
          stainingAffinity: 'Fortemente Basofílica (Roxo escuro)',
          functionalSignificance: 'Área com maior concentração de condroitinossulfato e menor densidade de fibras colagénias.',
          pinpoint: { x: 70, y: 52, label: 'Matriz Territorial Basofílica' },
        },
        {
          name: 'Pericôndrio (Camada Condrogénica)',
          cellularCategory: 'Célula Estaminal / Progenitora',
          morphologyDescription: 'Camada de transição com condroblastos fusiformes.',
          nuclearCharacteristics: 'Núcleo alongado com cromatina ativa.',
          stainingAffinity: 'Anfofílica.',
          functionalSignificance: 'Crescimento aposicional da cartilagem e suporte nutricional por difusão.',
          pinpoint: { x: 50, y: 14, label: 'Pericôndrio (Crescimento Aposicional)' },
        },
      ],
      diagnosticCriteria: {
        keyIdentificationRules: [
          'Matriz extracelular homogénea, vítrea e translúcida sem feixes fibrosos óbvios à microscopia ótica comum.',
          'Presença de condrócitos no interior de lacunas bem delimitadas.',
          'Disposição dos condrócitos em grupos isogénicos (coronários ou axiais resultantes de mitoses recentes).',
          'Matriz territorial pericelular mais corada (basofílica) do que a matriz interterritorial.',
        ],
        differentialDiagnosis: [
          {
            confusedWith: 'Cartilagem Elástica (ex: Epiglote, Pavilhão Auricular)',
            howToDistinguish: 'A cartilagem elástica exibe uma rede densa e escura de fibras elásticas bem visíveis (especialmente com resorcina-fucsina ou orceína) e condrócitos maiores e mais densos.',
          },
          {
            confusedWith: 'Fibrocartilagem (ex: Discos Intervertebrais)',
            howToDistinguish: 'A fibrocartilagem não possui pericôndrio e exibe feixes espessos e paralelos de colagénio tipo I eosinofílicos, com condrócitos em fileiras orientadas.',
          },
        ],
        artifactsAndCaveats: [
          'Os condrócitos retraem-se rotineiramente durante a fixação em formol, criando um espaço artificial aparente entre a membrana celular e a parede da lacuna.',
        ],
      },
      academicQuizQuestions: [
        {
          id: 'cart-q1',
          question: 'Qual é o tipo de colagénio predominante na matriz da Cartilagem Hialina?',
          options: [
            'Colagénio Tipo I (formador de feixes espessos densos).',
            'Colagénio Tipo II (fibrilas delgadas não formadoras de feixes visíveis ao microscópio ótico comum).',
            'Colagénio Tipo IV (da membrana basal).',
            'Colagénio Tipo III (fibras reticulares).',
          ],
          correctOptionIndex: 1,
          explanation: 'A matriz da cartilagem hialina é constituída predominantemente por colagénio tipo II com índice de refração semelhante ao da substância fundamental amorfa, o que confere o aspeto vítreo e homogêneo.',
          category: 'Identificação Estrutural',
          difficulty: 'Iniciação',
        },
        {
          id: 'cart-q2',
          question: 'Como se define e origina um "Grupo Isogénico" observado na cartilagem hialina?',
          options: [
            'Agregado de células inflamatórias que invadiram a matriz vascularizada.',
            'Conjunto de condrócitos descendentes de uma mesma célula progenitora por divisão mitótica intersticial.',
            'Fusão de múltiplos condroblastos periféricos.',
            'Focos de mineralização distrófica da cartilagem senil.',
          ],
          correctOptionIndex: 1,
          explanation: 'Grupos isogénicos são grupos de 2 a 8 condrócitos que se originaram de divisões mitóticas de um único condrócito e ainda compartilham o mesmo nicho de matriz territorial recém-sintetizada (crescimento intersticial).',
          category: 'Fisiopatologia',
          difficulty: 'Intermédio',
        },
      ],
    },
  },
  {
    id: 'skeletal-muscle-he',
    title: 'Músculo Estriado Esquelético',
    tissueFamily: 'Muscular',
    organ: 'Músculo Esquelético Somático (Corte Longitudinal)',
    staining: 'Hematoxilina e Eosina (H&E)',
    magnification: '400x',
    thumbnailSvg: skeletalMuscleSvg,
    description: 'Fibras musculares esqueléticas cilíndricas multinucleadas com núcleos estritamente periféricos e estriações transversais regulares alternadas (bandas A e I).',
    analysis: {
      tissueClassification: {
        primaryTissue: 'Tecido Muscular Estriado Esquelético',
        tissueFamily: 'Muscular',
        probableOrgan: 'Músculo esquelético esquelético (ex: Bíceps, Quadríceps)',
        confidenceLevel: 'Elevada (99%)',
        stainType: 'Hematoxilina e Eosina (H&E)',
        magnificationEstimate: '400x',
        generalDescription: 'Fibras sinciciais longas cilíndricas paralelas, com acidofilia citoplasmática acentuada (miofibrilas com actina e miosina) e múltiplos núcleos periféricos aplanados dispostos imediatamente abaixo do sarcolema.',
      },
      stainingAnalysis: {
        stainName: 'Hematoxilina e Eosina (H&E)',
        basophilicElements: 'Núcleos ovoides periféricos (azul-escuro).',
        acidophilicElements: 'Sarcoplasma repleto de proteínas contráteis (actina, miosina, mioglobina) com coloração rosa viva.',
        chemicalRationale: 'A grande abundância de proteínas filamentosas com cargas positivas confere afinidade intensa pelo corante ácido Eosina.',
      },
      cellularConstituents: [
        {
          name: 'Fibra Muscular (Miócito Esquelético)',
          cellularCategory: 'Célula Funcional (Sincício)',
          morphologyDescription: 'Fibra cilíndrica multinucleada não ramificada com bandas transversais periódicas.',
          nuclearCharacteristics: 'Dezenas a centenas de núcleos alongados situados na periferia.',
          stainingAffinity: 'Fortemente Eosinofílica',
          functionalSignificance: 'Contração rápida, voluntária e potente mediada por potenciais de ação motores.',
          pinpoint: { x: 48, y: 35, label: 'Estriações Transversais (Bandas A e I)' },
        },
        {
          name: 'Núcleo Periférico Subsarcolemar',
          cellularCategory: 'Núcleo Celular',
          morphologyDescription: 'Núcleo alongado e aplanado comprimido contra o sarcolema.',
          nuclearCharacteristics: 'Cromatina moderadamente densa com eixo maior paralelo à fibra.',
          stainingAffinity: 'Basofílica (Roxo/Azul)',
          functionalSignificance: 'Expressão génica para manutenção do volume sarcoplasmático extenso.',
          pinpoint: { x: 40, y: 18, label: 'Núcleo Subsarcolemar Periférico' },
        },
        {
          name: 'Endomísio',
          cellularCategory: 'Matriz / Estroma Conjuntivo',
          morphologyDescription: 'Delicada bainha de fibras reticulares e capilares entre cada fibra muscular individual.',
          nuclearCharacteristics: 'Núcleos raros de fibroblastos ou pericitos capilares.',
          stainingAffinity: 'Eosinofílica pálida.',
          functionalSignificance: 'Transmissão de força mecânica e aporte metabólico vascular individual.',
          pinpoint: { x: 60, y: 47, label: 'Endomísio e Capilar' },
        },
      ],
      diagnosticCriteria: {
        keyIdentificationRules: [
          'Estriações transversais perpendiculares ao eixo maior da fibra.',
          'Localização estritamente periférica dos múltiplos núcleos (fora do centro da fibra).',
          'Fibras cilíndricas paralelas sem ramificações (ao contrário do músculo cardíaco).',
          'Ausência de discos intercalares.',
        ],
        differentialDiagnosis: [
          {
            confusedWith: 'Músculo Cardíaco (Miocárdio)',
            howToDistinguish: 'O músculo cardíaco tem núcleos CENTRAIS (1 ou 2 por célula), células ramificadas e discos intercalares transversais.',
          },
          {
            confusedWith: 'Músculo Liso',
            howToDistinguish: 'O músculo liso NÃO tem estriações transversais, as células são fusiformes mononucleadas com núcleo central em forma de charuto.',
          },
          {
            confusedWith: 'Tendão / Tecido Conjuntivo Denso Regular',
            howToDistinguish: 'O tendão não possui estriações transversais periódicas e é constituído por feixes ondulados de colagénio com núcleos de fibrócitos comprimidos.',
          },
        ],
        artifactsAndCaveats: [
          'Em cortes oblíquos, alguns núcleos podem aparentar falsamente uma localização central. Verifique sempre múltiplos campos para confirmar a posição periférica subsarcolemar.',
        ],
      },
      academicQuizQuestions: [
        {
          id: 'skel-q1',
          question: 'Qual é o critério microscópico mais seguro para diferenciar Músculo Esquelético de Músculo Cardíaco?',
          options: [
            'Presença de eosinofilia no citoplasma.',
            'Localização periférica subsarcolemar dos núcleos vs localização central e presença de discos intercalares.',
            'Ausência de vasos capilares sanguíneos.',
            'Apenas o músculo esquelético possui mitocôndrias.',
          ],
          correctOptionIndex: 1,
          explanation: 'O músculo esquelético é caracterizado por núcleos estritamente periféricos abaixo do sarcolema e ausência de discos intercalares; o músculo cardíaco possui células ramificadas com 1-2 núcleos estritamente centrais e discos intercalares.',
          category: 'Diagnóstico Diferencial',
          difficulty: 'Iniciação',
        },
      ],
    },
  },
  {
    id: 'compact-bone-he',
    title: 'Tecido Ósseo Compacto (Ósteons de Havers)',
    tissueFamily: 'Conjuntivo',
    organ: 'Diáfise de Osso Longo (Corte Transversal por Desgaste)',
    staining: 'Desgaste / H&E',
    magnification: '200x',
    thumbnailSvg: compactBoneSvg,
    description: 'Sistemas de Havers (ósteons) concêntricos exibindo canal de Havers central, lamelas ósseas concêntricas mineralizadas e lacunas com canalículos osteocitários.',
    analysis: {
      tissueClassification: {
        primaryTissue: 'Tecido Ósseo Lamelar Compacto',
        tissueFamily: 'Conjuntivo Especializado',
        probableOrgan: 'Córtex da Diáfise Óssea (ex: Fémur ou Tíbia)',
        confidenceLevel: 'Elevada (99%)',
        stainType: 'Método de Desgaste (Preparação por abrasão mecânica)',
        magnificationEstimate: '200x',
        generalDescription: 'Organização característica em ósteons completos e lamelas intersticiais. Os canais de Havers centrais comunicam entre si através de canais de Volkmann, cercados por lamelas ósseas concêntricas.',
      },
      stainingAnalysis: {
        stainName: 'Técnica de Desgaste / Impregnação',
        basophilicElements: 'Lacunas e canalículos preenchidos por ar ou resíduos que refratam a luz e aparecem negros/acastanhados escuros.',
        acidophilicElements: 'Matriz óssea mineralizada com colagénio tipo I.',
        chemicalRationale: 'No osso desgastado, os espaços outrora ocupados por osteócitos e seus prolongamentos ficam vazios e refratam fortemente a luz microscópica.',
      },
      cellularConstituents: [
        {
          name: 'Canal de Havers',
          cellularCategory: 'Estrutura Vascular',
          morphologyDescription: 'Canal cilíndrico longitudinal no centro do ósteon.',
          nuclearCharacteristics: 'Contém vasos sanguíneos, linfáticos e fibras nervosas amielínicas.',
          stainingAffinity: 'Lúmen circular escuro.',
          functionalSignificance: 'Suporte neurovascular primordial para nutrição dos osteócitos.',
          pinpoint: { x: 35, y: 50, label: 'Canal de Havers Central' },
        },
        {
          name: 'Osteócitos em Lacunas',
          cellularCategory: 'Célula Funcional',
          morphologyDescription: 'Lacunas aplanadas elípticas distribuídas entre as lamelas ósseas.',
          nuclearCharacteristics: 'Núcleo ovoide com cromatina condensada.',
          stainingAffinity: 'Escura no desgaste / basofílica na descalcificação.',
          functionalSignificance: 'Mecanossensoriamento do stress ósseo e manutenção da matriz mineral.',
          pinpoint: { x: 48, y: 50, label: 'Lacunas e Canalículos de Osteócitos' },
        },
        {
          name: 'Lamelas Concêntricas',
          cellularCategory: 'Matriz Extracelular Mineralizada',
          morphologyDescription: 'Anéis concêntricos de matriz colagénia impregnada por cristais de hidroxiapatite.',
          nuclearCharacteristics: 'Acelular.',
          stainingAffinity: 'Matriz translúcida / acidófila.',
          functionalSignificance: 'Confere extraordinária resistência à compressão e torção mecânica.',
          pinpoint: { x: 26, y: 28, label: 'Lamelas Ósseas Concêntricas' },
        },
      ],
      diagnosticCriteria: {
        keyIdentificationRules: [
          'Presença dos anéis concêntricos de lamelas circundando um canal de Havers vascular central.',
          'Canalículos finos radiados conectando lacunas adjacentes.',
          'Linhas de cimentação nítidas delimitando a periferia de cada sistema de Havers.',
          'Lamelas intersticiais angulares entre os ósteons cilíndricos.',
        ],
        differentialDiagnosis: [
          {
            confusedWith: 'Tecido Ósseo Esponjoso / Trabecular',
            howToDistinguish: 'O osso esponjoso é constituído por trabéculas ósseas anastomosadas sem sistemas de Havers típicos, rodeadas por medula óssea.',
          },
        ],
        artifactsAndCaveats: [
          'Em cortes ligeiramente oblíquos, os canais de Havers podem parecer elípticos em vez de circulares.',
        ],
      },
      academicQuizQuestions: [
        {
          id: 'bone-q1',
          question: 'Através de que estrutura os osteócitos aprisionados nas lamelas mineralizadas estabelecem comunicação e trocas metabólicas?',
          options: [
            'Junções comunicantes (gap junctions) situadas nos canalículos ósseos.',
            'Canais de Volkmann exclusivos para cada célula.',
            'Difusão livre através da hidroxiapatite sólida sem necessidade de prolongamentos.',
            'Fibras de Sharpey.',
          ],
          correctOptionIndex: 0,
          explanation: 'Os osteócitos emitem prolongamentos citoplasmáticos delgados que viajam pelos canalículos ósseos e comunicam através de gap junctions (nexos), permitindo transporte de iões e nutrientes a partir do canal de Havers.',
          category: 'Fisiopatologia',
          difficulty: 'Intermédio',
        },
      ],
    },
  },
  {
    id: 'small-intestine-he',
    title: 'Intestino Delgado (Epitélio Cilíndrico Simples)',
    tissueFamily: 'Epitelial',
    organ: 'Intestino Delgado (Jejuno - Vilosidades)',
    staining: 'Hematoxilina e Eosina (H&E)',
    magnification: '400x',
    thumbnailSvg: smallIntestineSvg,
    description: 'Vilosidades intestinais revestidas por epitélio cilíndrico simples com células absortivas (enterócitos) exibindo bordo em escova e células caliciformes mucossecretoras.',
    analysis: {
      tissueClassification: {
        primaryTissue: 'Epitélio Cilíndrico Simples com Bordo em Escova e Células Caliciformes',
        tissueFamily: 'Epitelial',
        probableOrgan: 'Intestino Delgado (Jejuno / Íleo)',
        confidenceLevel: 'Elevada (99%)',
        stainType: 'Hematoxilina e Eosina (H&E)',
        magnificationEstimate: '400x',
        generalDescription: 'Projeções digitiformes (vilosidades) com eixo conjuntivo vascularizado (lâmina própria com quilífero central), revestidas por monocamada de células colunares altas com microvilosidades apicais e células mucossecretoras.',
      },
      stainingAnalysis: {
        stainName: 'Hematoxilina e Eosina (H&E)',
        basophilicElements: 'Núcleos dos enterócitos e linfócitos intraepiteliais (azul/roxo).',
        acidophilicElements: 'Bordo em escova apical dos enterócitos (rosa vivo denso devido ao citoesqueleto de actina) e citoplasma colunar.',
        chemicalRationale: 'A mucina das células caliciformes é lavada na técnica padrão de H&E, conferindo um aspeto pálido ou "vazio" ao cálice apical (sendo corada intensamente por PAS).',
      },
      cellularConstituents: [
        {
          name: 'Enterócito (Célula Absortiva)',
          cellularCategory: 'Célula Funcional',
          morphologyDescription: 'Célula prismática alta com especialização apical de microvilosidades densas (bordo em escova).',
          nuclearCharacteristics: 'Núcleo ovalado situado no terço basal.',
          stainingAffinity: 'Eosinofílica.',
          functionalSignificance: 'Absorção de nutrientes e digestão terminal por enzimas de membrana.',
          pinpoint: { x: 23, y: 48, label: 'Enterócitos e Bordo em Escova' },
        },
        {
          name: 'Célula Caliciforme (Goblet Cell)',
          cellularCategory: 'Célula Glandular Exócrina Unicelular',
          morphologyDescription: 'Forma de cálice com ápice dilatado por grânulos de mucigénio e base estreita.',
          nuclearCharacteristics: 'Núcleo basal aplanado comprimido.',
          stainingAffinity: 'Ápice cromófobo/claro em H&E (PAS positivo intenso).',
          functionalSignificance: 'Secreção de muco lubrificante e protetor da mucosa.',
          pinpoint: { x: 18, y: 42, label: 'Célula Caliciforme Mucosa' },
        },
        {
          name: 'Lâmina Própria e Quilífero Central',
          cellularCategory: 'Estroma / Vaso',
          morphologyDescription: 'Tecido conjuntivo frouxo rico em capilares fenestrados e um capilar linfático central de fundo cego.',
          nuclearCharacteristics: 'Núcleos de fibroblastos, plasmócitos e linfócitos.',
          stainingAffinity: 'Eosinofílica suave.',
          functionalSignificance: 'Absorção de quilomícrons lipídicos e defesa imunitária da mucosa.',
          pinpoint: { x: 28, y: 62, label: 'Lâmina Própria e Quilífero' },
        },
      ],
      diagnosticCriteria: {
        keyIdentificationRules: [
          'Epitélio em monocamada simples de células colunares altas alinhadas.',
          'Presença do bordo em escova eosinofílico nítido no polo apical.',
          'Intercalação de células caliciformes secretoras de muco em formato de cálice.',
          'Arquitetura em vilosidades projetadas para o lúmen intestinal.',
        ],
        differentialDiagnosis: [
          {
            confusedWith: 'Epitélio Gástrico (Estômago)',
            howToDistinguish: 'O estômago NÃO possui células caliciformes nem vilosidades; todas as células superficiais são do tipo mucoso gástrico e formam fossetas gástricas.',
          },
          {
            confusedWith: 'Cólon / Intestino Grosso',
            howToDistinguish: 'O cólon não tem vilosidades, tem apenas criptas tubulares retas com uma proporção muito mais elevada de células caliciformes.',
          },
        ],
        artifactsAndCaveats: [
          'Autólise precoce post-mortem frequentemente descola o epitélio do ápice da vilosidade (espaço de Gruenhagen).',
        ],
      },
      academicQuizQuestions: [
        {
          id: 'int-q1',
          question: 'Que coloração histoquímica específica confirmaria com precisão diagnóstica o conteúdo mucoso das células caliciformes?',
          options: [
            'Reação do Ácido Periódico de Schiff (PAS) revelando cor púrpura/magenta intensa.',
            'Impregnação argêntica de Bielschowsky.',
            'Coloração de Sudão para triglicerídeos neutros.',
            'Tricrómio de Masson.',
          ],
          correctOptionIndex: 0,
          explanation: 'O PAS cora hidratos de carbono e mucinas neutras em magenta vivo, pois o ácido periódico oxida os dióis vicinais a aldeídos que reagem com o reativo de Schiff.',
          category: 'Histoquímica',
          difficulty: 'Intermédio',
        },
      ],
    },
  },
  {
    id: 'motor-neuron-he',
    title: 'Tecido Nervoso (Neurónio Motor da Medula Espinal)',
    tissueFamily: 'Nervoso',
    organ: 'Substância Cinzenta do Corno Anterior da Medula Espinal',
    staining: 'H&E / Cresil Violeta',
    magnification: '400x',
    thumbnailSvg: motorNeuronSvg,
    description: 'Corpo de motoneurónios gigantes multipolares evidenciando corpúsculos de Nissl citoplasmáticos, núcleo vesicular eucromático com nucléolo em "olho de coruja" e neuropilo adjacente.',
    analysis: {
      tissueClassification: {
        primaryTissue: 'Tecido Nervoso (Substância Cinzenta)',
        tissueFamily: 'Nervoso',
        probableOrgan: 'Medula Espinal (Corno Ventral / Anterior)',
        confidenceLevel: 'Elevada (99%)',
        stainType: 'Hematoxilina e Eosina (H&E)',
        magnificationEstimate: '400x',
        generalDescription: 'Pericário estrelado volumoso de neurónio motor alfa imerso num denso neuropilo composto por prolongamentos de neurónios e da glia.',
      },
      stainingAnalysis: {
        stainName: 'Hematoxilina e Eosina (H&E)',
        basophilicElements: 'Corpúsculos de Nissl (retículo endoplasmático rugoso e polirribossomas livres com RNA) e o proeminente nucléolo central.',
        acidophilicElements: 'Neuropilo circundante e axónio (rico em neurofilamentos e microtúbulos).',
        chemicalRationale: 'A imensa síntese de neurotransmissores e proteínas estruturais requer alta densidade de ribossomas com RNA basofílico corado pela hematoxilina.',
      },
      cellularConstituents: [
        {
          name: 'Pericário / Soma Neuronal',
          cellularCategory: 'Célula Funcional',
          morphologyDescription: 'Corpo celular poligonal/estrelado volumoso (30 a 100 µm).',
          nuclearCharacteristics: 'Núcleo vesicular eucromático com cromatina dispersa e nucléolo proeminente.',
          stainingAffinity: 'Corpúsculos de Nissl fortemente basofílicos.',
          functionalSignificance: 'Centro trófico e integrador de sinapses motoras somáticas.',
          pinpoint: { x: 46, y: 48, label: 'Pericário com Corpúsculos de Nissl' },
        },
        {
          name: 'Nucléolo em "Olho de Coruja"',
          cellularCategory: 'Estrutura Nuclear',
          morphologyDescription: 'Nucléolo esférico volumoso fortemente basofílico central.',
          nuclearCharacteristics: 'Transcrições ativas de rRNA ribossomal.',
          stainingAffinity: 'Hipercorado (Roxo/Negro)',
          functionalSignificance: 'Biogénese ribossómica intensa para manter o enorme volume axoplásmico.',
          pinpoint: { x: 47, y: 46, label: 'Nucléolo Prominente' },
        },
        {
          name: 'Células da Glia no Neuropilo',
          cellularCategory: 'Célula de Suporte Glial',
          morphologyDescription: 'Apenas os núcleos são visíveis com clareza em microscopia ótica convencional.',
          nuclearCharacteristics: 'Núcleos esféricos pequenos ou ovoides de astrócitos, oligodendrócitos e micróglia.',
          stainingAffinity: 'Basofílica.',
          functionalSignificance: 'Suporte metabólico, barreira hematoencefálica, mielinização e imunovigilância.',
          pinpoint: { x: 74, y: 35, label: 'Núcleos de Células Gliais' },
        },
      ],
      diagnosticCriteria: {
        keyIdentificationRules: [
          'Neurónio multipolar gigante com prolongamentos dendríticos e cone axónico sem substância de Nissl.',
          'Núcleo claro eucromático (vesicular) com nucléolo muito proeminente.',
          'Grumos basofílicos intensos de substância de Nissl no citoplasma.',
          'Neuropilo fibrilar de fundo pontilhado por núcleos gliais.',
        ],
        differentialDiagnosis: [
          {
            confusedWith: 'Neurónio Pseudounipolar (Gânglio Sensitivo da Raiz Dorsal)',
            howToDistinguish: 'Os neurónios ganglionares sensoriais são esféricos, arredondados, sem dendritos ramificados partindo do soma e rodeados por uma coroa contínua de células-satélite.',
          },
        ],
        artifactsAndCaveats: [
          'O cone de implantação do axónio é uma região diagnóstica chave por estar livre de corpúsculos de Nissl.',
        ],
      },
      academicQuizQuestions: [
        {
          id: 'neur-q1',
          question: 'O que representam morfologicamente e ultraestruturalmente os Corpúsculos de Nissl no citoplasma neuronal?',
          options: [
            'Agregados de mitocôndrias em apoptose.',
            'Cisternas paralelas de Retículo Endoplasmático Rugoso (RER) e polirribossomas livres com RNA mensageiro e ribossómico.',
            'Depósitos de lipofuscina e pigmento de desgaste senil.',
            'Filamentos de tubulina e actina concentrados.',
          ],
          correctOptionIndex: 1,
          explanation: 'Os corpúsculos de Nissl correspondem a conjuntos de cisternas de retículo endoplasmático rugoso repletas de ribossomas com alta concentração de RNA, essenciais para a intensa síntese proteica neuronal.',
          category: 'Identificação Estrutural',
          difficulty: 'Iniciação',
        },
      ],
    },
  },
  {
    id: 'blood-smear-wright',
    title: 'Esfregaço Sanguíneo Periférico',
    tissueFamily: 'Sangue e Linfóide',
    organ: 'Sangue Periférico Circulante',
    staining: 'Giemsa / Wright',
    magnification: '1000x (Imersão em Óleo)',
    thumbnailSvg: bloodSmearSvg,
    description: 'Esfregaço citológico mostrando hemácias bicôncavas anucleadas, neutrófilo segmentado polimorfonuclear com grânulos específicos, linfócito pequeno com alta relação N/C e plaquetas.',
    analysis: {
      tissueClassification: {
        primaryTissue: 'Tecido Sanguíneo (Esfregaço Citológico)',
        tissueFamily: 'Conjuntivo Especializado / Sangue',
        probableOrgan: 'Sangue Periférico',
        confidenceLevel: 'Elevada (100%)',
        stainType: 'Coloração Panótica de Romanowsky (Wright / Giemsa)',
        magnificationEstimate: '1000x',
        generalDescription: 'Monocamada de eritrócitos com distribuição uniforme, permitindo a identificação e contagem diferencial de leucócitos (neutrófilos, linfócitos, monócitos, eosinófilos, basófilos) e plaquetas anucleadas.',
      },
      stainingAnalysis: {
        stainName: 'Wright-Giemsa',
        basophilicElements: 'Cromatina nuclear de leucócitos (azul-violeta escuro por azul de metileno) e ribossomas residuais.',
        acidophilicElements: 'Hemoglobina dos eritrócitos (rosa-salmão pela eosina).',
        chemicalRationale: 'Mistura clássica de azur de metileno (básico) e eosina Y (ácido) que gera metacromasia e permite diferenciar grânulos leucocitários primários e específicos.',
      },
      cellularConstituents: [
        {
          name: 'Eritrócito (Hemácia)',
          cellularCategory: 'Célula Anucleada',
          morphologyDescription: 'Disco bicôncavo de ~7.5 µm com palor central cobrindo um terço do diâmetro.',
          nuclearCharacteristics: 'Anucleada.',
          stainingAffinity: 'Eosinofílica / Rosa.',
          functionalSignificance: 'Transporte de oxigénio ligado à hemoglobina e dióxido de carbono.',
          pinpoint: { x: 25, y: 35, label: 'Eritrócitos Bicôncavos' },
        },
        {
          name: 'Neutrófilo Segmentado',
          cellularCategory: 'Granulócito',
          morphologyDescription: 'Célula de 12-14 µm com citoplasma pontilhado por grânulos finos cor salmão.',
          nuclearCharacteristics: 'Núcleo polilobulado segmentado em 3 a 5 lobos unidos por filamentos delgados.',
          stainingAffinity: 'Núcleo violeta escuro, citoplasma neutro/rosado.',
          functionalSignificance: 'Primeira linha de defesa imunológica inata celular (fagocitose bacteriana).',
          pinpoint: { x: 48, y: 47, label: 'Neutrófilo Segmentado (Polimorfonuclear)' },
        },
        {
          name: 'Linfócito Pequeno',
          cellularCategory: 'Agranulócito',
          morphologyDescription: 'Célula esférica de 6-9 µm com finíssimo rebordo citoplasmático azul-celeste.',
          nuclearCharacteristics: 'Núcleo redondo ou ligeiramente chanfrado com cromatina em blocos densos.',
          stainingAffinity: 'Citoplasma basofílico pálido, núcleo intensamente hipercromático.',
          functionalSignificance: 'Imunidade adaptativa específica (Linfócitos T, B e células NK).',
          pinpoint: { x: 77, y: 32, label: 'Linfócito Pequeno' },
        },
        {
          name: 'Plaquetas (Trombócitos)',
          cellularCategory: 'Fragmento Celular',
          morphologyDescription: 'Corpúsculos afilados de 2 a 4 µm com hialómero periférico claro e granulómero central purpúrico.',
          nuclearCharacteristics: 'Anucleadas (fragmentos do citoplasma de megacariócitos).',
          stainingAffinity: 'Basofílica purpúrica.',
          functionalSignificance: 'Hemostase primária e formação do tampão plaquetar.',
          pinpoint: { x: 30, y: 31, label: 'Plaquetas Sanguíneas' },
        },
      ],
      diagnosticCriteria: {
        keyIdentificationRules: [
          'Leucócito com núcleo dividido em 3 a 5 lobos ligados por pontes delgadas: Neutrófilo segmentado.',
          'Célula mononuclear com núcleo esférico denso ocupando >90% do volume: Linfócito pequeno.',
          'Eritrócitos de diâmetro regular (usados como "régua histológica" de ~7.5 µm no microscópio).',
          'Plaquetas agrupadas em pequenos agregados anucleados de 2-4 µm.',
        ],
        differentialDiagnosis: [
          {
            confusedWith: 'Monócito vs Linfócito Grande',
            howToDistinguish: 'O monócito é a maior célula do sangue periférico (15-20 µm), possui núcleo reniforme/em ferradura com cromatina rendilhada menos densa e citoplasma cinzento-azulado mais abundante com grânulos azurófilos finos.',
          },
        ],
        artifactsAndCaveats: [
          'Na cauda do esfregaço as células podem estar distorcidas ou rompidas (manchas de Gumprecht). Analise sempre na zona de leitura ideal (monocamada).',
        ],
      },
      academicQuizQuestions: [
        {
          id: 'blood-q1',
          question: 'Em condições fisiológicas normais, qual é o leucócito mais abundante no sangue periférico de um adulto humano saudável?',
          options: [
            'Linfócito (cerca de 70%).',
            'Neutrófilo Segmentado (cerca de 50% a 70%).',
            'Monócito (cerca de 20%).',
            'Eosinófilo (cerca de 15%).',
          ],
          correctOptionIndex: 1,
          explanation: 'Os neutrófilos segmentados são os leucócitos circulantes mais numerosos em adultos (50-70%), seguidos pelos linfócitos (20-40%), monócitos (2-8%), eosinófilos (1-4%) e basófilos (0-1%).',
          category: 'Identificação Estrutural',
          difficulty: 'Iniciação',
        },
      ],
    },
  },
];
