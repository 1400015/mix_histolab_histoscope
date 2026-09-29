"""Question generator for academic training/assessment.

Generates multiple-choice and open questions from analysis features,
with difficulty scaling, answer key and pedagogical explanations.
"""
from __future__ import annotations

import random
from typing import Any

TISSUE_PT = {
    "epithelial": ("epitelial", "Estes núcleos densos, arredondados e com pouca matriz extracelular indicam epitélio — tecido de cobertura/revestimento com polaridade celular e junções intercelulares."),
    "connective": ("conjuntivo", "A abundante matriz extracelular eosinofílica com núcleos dispersos indica tecido conjuntivo — funções de suporte, preenchimento e defesa."),
    "muscular": ("muscular", "Núcleos alongados/fusiformes e citoplasma intensamente eosinofílico indicam tecido muscular — células contráteis ricas em filamentos de actina e miosina."),
    "nervous": ("nervoso", "Baixa densidade nuclear com neuropilo claro e núcleos pequenos arredondados indica tecido nervoso — neurónios e gliócitos."),
    "adipose": ("adiposo", "Grandes espaços claros correspondendo a vacúolos lipídicos únicos indicam tecido adiposo — adipócitos especializados em armazenamento de energia."),
    "liver": ("hepático (fígado)", "Núcleos monótonos dispostos em cordas com estroma mínimo indicam parênquima hepático — hepatócitos em lâminas de 1–2 células."),
    "cartilage": ("cartilaginoso", "Matriz extracelular avascular homogénea e basofílica com condrócitos em lacunas, isolados ou em grupos isógenos, indicam tecido cartilagíneo — matriz rica em glicosaminoglicanos."),
    "kidney": ("renal (rim)", "Parênquima epitelial altamente organizado com túbulos e glomérulos densamente celular e estroma escasso indica córtex renal — néfrones com cápsula de Bowman e túbulo contornado."),
    "lung": ("respiratório (pulmão)", "Estruturas epiteliais de paredes finas com espaços aéreos claros abundantes e septos interalveolares delgados indicam parênquima pulmonar — alvéolos com pneumócitos e capilares."),
}

STRUCTURE_GLOSSARY = {
    "epithelial": ["membrana basal", "junções intercelulares (desmossomas, zonula occludens)", "polaridade apical-basal", "microvilosidades"],
    "connective": ["fibras colagénicas", "fibroblastos", "matriz extracelular", "células inflamatórias"],
    "muscular": ["miofibrilhas", "estrias transversais", "discos intercalares (cardíaco)", "células de Purkinje"],
    "nervous": ["corpo celular (pericário)", "dendrites", "neurofibrilhas", "células satélite"],
    "adipose": ["vacúolo lipídico único", "núcleo periférico achatado", "septo conjuntivo"],
    "liver": ["sinusoides", "tríada portal", "space of Disse", "veia central"],
    "cartilage": ["condrócitos em lacunas", "grupos isógenos", "matriz territorial basofílica", "pericôndrio"],
    "kidney": ["glomérulo", "cápsula de Bowman", "túbulo contornado proximal", "túbulo coletor"],
    "lung": ["alvéolos", "septos interalveolares", "pneumócitos tipo I", "macrófagos alveolares"],
}


def generate_questions(analysis: dict[str, Any], n: int = 6, difficulty: str = "medium",
                       seed: int | None = None) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    f = analysis["features"]
    tissue = analysis["tissue"]
    # Análise indeterminada não gera perguntas — o erro sobe claro para a UI
    # (contrato 2026-09-28: estado "indeterminate" do classificador).
    if tissue == "indeterminate" or not f:
        raise ValueError(
            "análise indeterminada — sem tecido classificável para gerar perguntas"
        )
    if tissue not in TISSUE_PT:
        raise ValueError(
            f"tecido '{tissue}' sem entrada pedagógica em TISSUE_PT — perguntas para este tecido não estão definidas"
        )
    t_pt, t_desc = TISSUE_PT[tissue]
    density = f["nuclei_per_mm2"]
    n_nuc = f["n_nuclei"]
    circ = f["median_circularity"]
    elong = f["median_elongation"]
    stroma = f["stromal_ratio"]

    pool: list[dict[str, Any]] = []

    # 1. Tissue identification MCQ
    correct_opts = [t_pt]
    others = [v[0] for k, v in TISSUE_PT.items() if k != tissue]
    rng.shuffle(others)
    opts = correct_opts + others[:3]
    rng.shuffle(opts)
    pool.append({
        "type": "mcq",
        "difficulty": "easy" if difficulty != "hard" else "medium",
        "question": "Com base nas características morfométricas da imagem, que tipo de tecido está representado?",
        "options": opts,
        "answer": t_pt,
        "explanation": t_desc,
        "topic": "classificação tecidular",
    })

    # 2. Justification question
    pool.append({
        "type": "open",
        "difficulty": "medium",
        "question": f"Justifique a classificação como tecido {t_pt}, indicando pelo menos duas características morfológicas observáveis na imagem que a sustentam.",
        "answer": t_desc or f"Características morfológicas típicas do tecido {t_pt} observáveis na preparação.",
        "explanation": "Critérios esperados: " + "; ".join(TISSUE_PT[tissue][1].split("—")[-1].strip(" .").split(", ")[:3]) if tissue in TISSUE_PT else "Comparar densidade nuclear, cromatina e matriz extracelular com atlas.",
        "topic": "raciocínio morfológico",
    })

    # 3. Quantitative interpretation
    pool.append({
        "type": "mcq",
        "difficulty": difficulty,
        "question": f"A densidade nuclear estimada na imagem é aproximadamente {density:.0f} núcleos/mm² e a razão de estroma é {stroma:.2f}. O que esta combinação indica?",
        "options": [
            "Tecido com elevada celularidade e escassa matriz extracelular, típico de epitélios",
            "Tecido com predomínio de matriz extracelular e células raras, típico de conjuntivo frouxo",
            "Tecido necrótico com perda de núcleos",
            "Artefacto de coloração insuficiente com hematoxilina",
        ],
        "answer": "Tecido com predomínio de matriz extracelular e células raras, típico de conjuntivo frouxo" if stroma > 0.5 else "Tecido com elevada celularidade e escassa matriz extracelular, típico de epitélios",
        "explanation": "A densidade nuclear correlaciona-se inversamente com a fração de estroma; valores elevados de ambas as métricas são mutuamente exclusivos em preparações bem coradas.",
        "topic": "interpretação quantitativa",
    })

    # 4. Nucleus morphology
    if elong > 1.5:
        q = "A elongação média nuclear observada é superior a 1,5. Que tipo de célula tipicamente apresenta núcleos alongados/fusiformes em cortes histológicos?"
        correct = "Célula muscular lisa"
        opts = ["Célula muscular lisa", "Hepatócito", "Adipócito", "Neurónio"]
    elif circ > 0.7:
        q = "A circularidade média nuclear observada é elevada (>0,7). O que indica alta circularidade nuclear em cortes histológicos?"
        correct = "Núcleos arredondados, frequentemente em epitélios ou tecidos com alta taxa proliferativa"
        opts = [correct, "Núcleos picnóticos em necrose", "Sempre artefacto de corte tangencial", "Núcleos de células apoptóticas em fragmentação"]
    else:
        q = f"Foram identificados cerca de {n_nuc} núcleos no campo analisado. Qual é a principal limitação da contagem automática de núcleos em cortes histológicos?"
        correct = "Núcleos sobrepostos e cortes tangenciais podem fundir-se, subestimando a contagem real"
        opts = [correct, "A contagem automática é sempre exata", "A hematoxilina não colore núcleos", "Não é possível segmentar núcleos em H&E"]
    rng.shuffle(opts)
    pool.append({"type": "mcq", "difficulty": difficulty, "question": q, "options": opts, "answer": correct,
                 "explanation": "A forma nuclear é um dos critérios morfológicos fundamentais na diferenciação celular.", "topic": "morfologia nuclear"})

    # 5. Staining mechanics
    pool.append({
        "type": "mcq",
        "difficulty": "easy",
        "question": "Na coloração H&E, que estruturas são coradas preferencialmente pela hematoxilina?",
        "options": ["Núcleos (ácidos nucleicos, basofilia)", "Matriz extracelular colagénica", "Membranas lipídicas", "Glóbulos vermelhos (que ficam azuis)"],
        "answer": "Núcleos (ácidos nucleicos, basofilia)",
        "explanation": "A hematoxilina é básica e colore componentes ácidos (DNA/RNA) em azul-púrpura; a eosina é ácida e colore estruturas básicas como proteínas citoplasmáticas e colagénio em rosa.",
        "topic": "técnicas histológicas",
    })

    # 6. Structure recall
    gloss = STRUCTURE_GLOSSARY.get(tissue, ["matriz extracelular"])
    correct = rng.choice(gloss)
    others_all = [s for k, v in STRUCTURE_GLOSSARY.items() if k != tissue for s in v]
    rng.shuffle(others_all)
    opts = [correct] + others_all[:3]
    rng.shuffle(opts)
    pool.append({
        "type": "mcq",
        "difficulty": difficulty,
        "question": f"Que estrutura é característica do tecido {t_pt} e tipicamente observável neste tipo de preparação?",
        "options": opts,
        "answer": correct,
        "explanation": f"Estruturas características do tecido {t_pt}: " + "; ".join(gloss) + ".",
        "topic": "estruturas tecidulares",
    })

    # Preenchimento de lacunas (novo 2026-09-28) (novo 2026-09-28 — o modo offline só
    # gerava MCQ e a UI oferecia o filtro "Apenas Preenchimento de Lacunas").
    pool.append({
        "type": "fill_blank",
        "difficulty": "easy",
        "question": "Na coloração H&E, a ______ é o corante básico que cora os núcleos (basofilia).",
        "options": ["hematoxilina", "eosina", "safranina", "verde de metilo"],
        "answer": "hematoxilina",
        "acceptableAnswers": ["hematoxilina", "hematoxylin"],
        "explanation": "A hematoxilina é básica e cora componentes ácidos (DNA/RNA) em azul-violeta.",
        "topic": "técnicas histológicas",
    })
    pool.append({
        "type": "fill_blank",
        "difficulty": "easy",
        "question": f"A razão de espaços claros desta imagem é {f['empty_ratio']:.2f}; valores elevados sugerem tecido ______.",
        "options": ["adiposo", "nervoso", "muscular estriado", "ósseo"],
        "answer": "adiposo",
        "acceptableAnswers": ["adiposo", "adipose", "gordo"],
        "explanation": "Os adipócitos têm um vacúolo lipídico único extraído na preparação — grandes espaços claros com núcleo periférico.",
        "topic": "classificação tecidular",
    })
    pool.append({
        "type": "fill_blank",
        "difficulty": "medium",
        "question": f"A elongação nuclear mediana desta amostra é {elong:.2f}; núcleos fortemente alongados (>3) sugerem células ______ (tecido muscular).",
        "options": ["fusiformes", "poligonais", "estreladas", "cúbicas"],
        "answer": "fusiformes",
        "acceptableAnswers": ["fusiformes", "fusiforme", "alongadas fusiformes"],
        "explanation": "No músculo liso as células são fusiformes, com núcleo central alongado; a elongação nuclear elevada é o sinal morfométrico.",
        "topic": "morfologia nuclear",
    })

    # 7. Pathology bridge (hard)
    pool.append({
        "type": "open",
        "difficulty": "hard",
        "question": "Se a densidade nuclear nesta amostra aumentasse drasticamente com perda da arquitetura tecidular e aumento da razão nuclear/citoplasmática, que diagnóstico deveria ser considerado e porquê?",
        "answer": "Neoplasia — a perda de polaridade, aumento da razão N/C, pleomorfismo nuclear e desorganização arquitetural são critérios de malignidade segundo as características de anaplasia.",
        "explanation": "Critérios de malignidade: pleomorfismo, hipercromatismo, figuras mitóticas atípicas e perda da diferenciação tecidular.",
        "topic": "patologia",
    })

    # 8. Acidophilic structures
    pool.append({
        "type": "mcq",
        "difficulty": "medium",
        "question": "O que representa a fração eosinofílica da imagem no contexto da análise tecidular?",
        "options": ["Conteúdo proteico citoplasmático e matriz extracelular", "Exclusivamente glóbulos vermelhos", "Fibras elásticas apenas", "Núcleos em apoptose"],
        "answer": "Conteúdo proteico citoplasmático e matriz extracelular",
        "explanation": "A eosina colore estruturas acidófilas: proteínas citoplasmáticas, colagénio, fibras musculares e eritrócitos.",
        "topic": "técnicas histológicas",
    })

    if difficulty == "hard":
        rng.shuffle(pool)
    else:
        easy_first = sorted(pool, key=lambda q: {"easy": 0, "medium": 1, "hard": 2}[q["difficulty"]])
        pool = easy_first
    return pool[:max(1, n)]
