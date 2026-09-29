"""Histological image analysis engine.

Pure-computer-vision pipeline for H&E-stained histology images:
- Color deconvolution (Hematoxylin / Eosin separation)
- Nucleus segmentation (hematoxylin channel, global Otsu threshold + morphology
  + distance-transform seeded watershed for touching nuclei)
- Feature extraction (density, size, ellipticity, stromal ratio, color stats)
- Rule-based tissue classification with confidence
"""
from __future__ import annotations

import base64
import math
from dataclasses import dataclass, asdict
from typing import Any

import cv2
import numpy as np

# Ruifrok & Johnston H&E stain matrix (OD space: rows = H, E, residual)
_STAIN = np.array([
    [0.65, 0.70, 0.29],
    [0.07, 0.99, 0.11],
    [0.27, 0.57, 0.78],
], dtype=np.float64)
_STAIN_INV = np.linalg.inv(_STAIN)

TISSUE_TYPES = ["epithelial", "connective", "muscular", "nervous", "adipose", "liver", "cartilage", "kidney", "lung"]


def _decompose_he(bgr: np.ndarray) -> dict[str, np.ndarray]:
    """Unmix H&E via color deconvolution in optical-density space."""
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float64) / 255.0
    od = -np.log10(np.clip(rgb, 1e-6, 1.0))
    flat = od.reshape(-1, 3).T
    channels = _STAIN_INV @ flat
    out = {}
    for i, name in enumerate(["H", "E", "residual"]):
        ch = np.clip(channels[i], 0, None).reshape(bgr.shape[:2])
        p99 = float(np.percentile(ch, 99))
        ch = np.clip(ch / (p99 + 1e-9), 0, 1)
        out[name] = (ch * 255).astype(np.uint8)
    return out


def _split_touching_nuclei(clean: np.ndarray, labels: np.ndarray, stats: np.ndarray,
                           min_area: int) -> np.ndarray:
    """Split touching nuclei via distance-transform seeded watershed.

    Only components plausibly holding 2+ nuclei (area >= 2 * min_area and
    elongated/large) are split; small round ones pass through untouched.
    Returns new label map where each split part gets a unique label.
    """
    out = np.zeros_like(labels)
    next_label = 0
    for i in range(1, stats.shape[0]):
        comp = labels == i
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 6 * min_area:
            next_label += 1
            out[comp] = next_label
            continue
        dist = cv2.distanceTransform(comp.astype(np.uint8), cv2.DIST_L2, 5)
        if dist.max() <= 0:
            next_label += 1
            out[comp] = next_label
            continue
        # Seeds = local maxima at ~60% of the component's peak distance
        _, sure = cv2.threshold(dist, 0.70 * dist.max(), 255, cv2.THRESH_BINARY)
        sure = np.uint8(sure)
        # Seeds must be substantial: each >= min_area/3 px, else noise
        nseeds, seed_lab, seed_stats, _ = cv2.connectedComponentsWithStats(sure)
        valid_seeds = 0
        seed_map = np.zeros_like(seed_lab)
        next_seed = 0
        for s in range(1, nseeds):
            if seed_stats[s, cv2.CC_STAT_AREA] >= max(min_area // 3, 5):
                valid_seeds += 1
                next_seed += 1
                seed_map[seed_lab == s] = next_seed
        if valid_seeds < 2:
            next_label += 1
            out[comp] = next_label
            continue
        # Marcadores = sementes (máximos locais da transformada de distância);
        # o watershed corre sobre a componente isolada.
        markers = seed_map.astype(np.int32)
        markers = markers + 1
        markers[~comp] = 0
        bgr3 = cv2.cvtColor((comp * 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
        cv2.watershed(bgr3, markers)
        markers[markers <= 1] = 0
        markers[~comp] = 0
        for lab in np.unique(markers):
            if lab > 0:
                next_label += 1
                out[markers == lab] = next_label
    return out


def _segment_nuclei(h_ch: np.ndarray, min_area: int = 15, max_area: int = 4000):
    """Threshold hematoxylin channel and split touching nuclei (watershed)."""
    blurred = cv2.GaussianBlur(h_ch, (5, 5), 0)
    # Adaptive normalization: Otsu on images with weak basophilia fails to
    # find nuclei; stretch the channel by p99 before thresholding.
    _, th = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(th, cv2.MORPH_OPEN, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    keep = np.zeros(n, dtype=bool)
    keep[1:] = (stats[1:, cv2.CC_STAT_AREA] >= min_area) & (stats[1:, cv2.CC_STAT_AREA] <= max_area)
    clean = keep[labels].astype(np.uint8) * 255

    # Split touching nuclei inside kept components (A1)
    lab_kept = labels.copy()
    lab_kept[~keep[labels]] = 0
    if lab_kept.max() > 0:
        sub_n, sub_lab, sub_stats, _ = cv2.connectedComponentsWithStats((lab_kept > 0).astype(np.uint8), 8)
        # Rebuild per-component label map for the splitter
        markers = _split_touching_nuclei(clean, sub_lab, sub_stats, min_area)
        # Enforce min_area on split parts
        final_n, final_lab, final_stats, _ = cv2.connectedComponentsWithStats((markers > 0).astype(np.uint8), 8)
        good = np.zeros(final_n, dtype=bool)
        good[1:] = final_stats[1:, cv2.CC_STAT_AREA] >= max(min_area, 10)
        markers = np.where(good[final_lab], final_lab, 0).astype(np.int32)
        clean = np.where(markers > 0, 255, 0).astype(np.uint8)
    else:
        markers = lab_kept
    return markers, clean


@dataclass
class NucleusInfo:
    x: int
    y: int
    area: float
    perimeter: float
    circularity: float
    elongation: float


def _nucleus_metrics(markers: np.ndarray) -> tuple[list[NucleusInfo], np.ndarray]:
    infos: list[NucleusInfo] = []
    overlay = np.zeros((*markers.shape, 3), dtype=np.uint8)
    rng = np.random.default_rng(42)
    for lab in range(1, int(markers.max()) + 1):
        m = markers == lab
        if m.sum() < 10:
            continue
        ys, xs = np.nonzero(m)
        x, y = float(xs.mean()), float(ys.mean())
        area = float(m.sum())
        contours, _ = cv2.findContours(
            m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        per = cv2.arcLength(contours[0], True) if contours else 2 * math.sqrt(math.pi * area)
        circ = 4 * math.pi * area / (per * per + 1e-9)
        elong = 1.0
        if contours and len(contours[0]) >= 5:
            (cx, cy), (w, h), _ = cv2.fitEllipse(contours[0])
            a, b = max(w, h), min(w, h)
            if 1 <= a <= 500 and 0.5 <= b <= 500 and b > 0:
                elong = float(a / (b + 1e-9))
        infos.append(NucleusInfo(int(x), int(y), area, float(per), round(circ, 3), round(elong, 2)))
        color = tuple(int(c) for c in rng.integers(120, 255, 3))
        overlay[m] = color
    return infos, overlay


def _classify(features: dict[str, float]) -> tuple[str, float, list[dict[str, Any]]]:
    """Robust rule-based scoring over median morphometric features.

    Estado "indeterminate": sem núcleos suficientes ou sem consenso entre
    regras, o resultado honesto é admitir indeterminação — nunca devolver um
    tecido com confiança inflada (bug corrigido 2026-09-28: imagem vazia
    devolvia "adipose" a 100%; imagem preta devolvia "epithelial" a 0%).
    """
    density = features["nuclei_per_mm2"]
    circularity = features["median_circularity"]
    elong = features["median_elongation"]
    area = features["median_nucleus_area"]
    stroma = features["stromal_ratio"]
    eosin = features["eosin_mean"]
    hema = features["hematoxylin_mean"]
    empty = features["empty_ratio"]
    cv = features["nucleus_area_cv"]

    # Guarda 1 — campo sem tecido classificável (vazio, preto, não histológico).
    if features["n_nuclei"] < 15:
        return "indeterminate", 0.0, [{
            "type": "insuficiente",
            "confidence": 0.0,
            "criteria": [
                f"apenas {features['n_nuclei']} núcleos segmentados (<15) — "
                "campo vazio, coloração fraca ou imagem não histológica"
            ],
        }]

    scores: dict[str, float] = {t: 0.0 for t in TISSUE_TYPES}
    reasons: dict[str, list[str]] = {t: [] for t in TISSUE_TYPES}

    # --- Adipose: dominant white vacuoles with peripheral nuclei ---
    if empty > 0.45:
        scores["adipose"] += 8.0
        reasons["adipose"].append("vacúolos lipídicos claros dominam o campo")
    elif empty > 0.30 and density > 20:
        scores["adipose"] += 3.0
        reasons["adipose"].append("espaços claros extensos com núcleos periféricos")

    # --- Muscle: elongated nuclei and/or intense eosin with sparse basophilia ---
    if elong > 3.0:
        scores["muscular"] += 5.0
        reasons["muscular"].append("núcleos fortemente alongados (fusiformes)")
    elif elong > 2.1:
        scores["muscular"] += 2.0
    if eosin > 120 and hema < 15:
        scores["muscular"] += 3.0
        reasons["muscular"].append("eosinofilia intensa com escassa basofilia nuclear")
    elif eosin > 100 and hema < 20:
        scores["muscular"] += 1.5

    # --- Connective: eosin-rich matrix, sparse scattered nuclei, NOT empty-white ---
    if stroma > 0.45 and density < 15 and empty < 0.12:
        scores["connective"] += 4.0
        reasons["connective"].append("matriz eosinofílica abundante com núcleos raros")
    elif stroma > 0.55 and density < 40:
        scores["connective"] += 1.5
    if eosin > 120 and 3 < density < 25 and empty < 0.1 and elong < 2.6:
        scores["connective"] += 1.5
        reasons["connective"].append("predomínio de eosina com núcleos dispersos")

    # --- Epithelial: dense basophilic nuclei, round, low stroma ---
    if density > 30 and hema > 20:
        scores["epithelial"] += 3.0
        reasons["epithelial"].append("densidade nuclear elevada com basofilia")
    elif density > 20 and hema > 18:
        scores["epithelial"] += 1.5
    if circularity > 0.8 and 1.2 <= elong <= 1.9 and density > 15:
        scores["epithelial"] += 1.5
        reasons["epithelial"].append("núcleos arredondados e compactos")
    if stroma < 0.3 and density > 15 and hema > 15:
        scores["epithelial"] += 1.0

    # --- Nervous: very low density, small round nuclei, moderate H, not eosin-dominant ---
    if density < 10 and 1.2 <= elong < 2.2 and hema >= 15 and stroma < 0.5 and empty < 0.12 and eosin < 120:
        scores["nervous"] += 4.5
        reasons["nervous"].append("baixa densidade nuclear com neuropilo claro")
    elif density < 18 and elong < 2.2 and 15 <= hema < 40:
        scores["nervous"] += 1.5

    # --- Liver: VERY high density, uniform small round nuclei, low stroma, moderate H+E ---
    if density > 70 and area < 120 and cv < 1.6 and stroma < 0.35 and empty < 0.15:
        scores["liver"] += 6.0
        reasons["liver"].append("núcleos muito numerosos, pequenos e monótonos (cordas hepáticas)")
    elif density > 40 and area < 150 and circularity > 0.7 and stroma < 0.3:
        scores["liver"] += 2.0

    # --- Cartilage (A3): sparse nuclei, uniform small round chondrocytes in
    # lacunae, abundant eosinophilic matrix, low density, low empty ---
    if 5 <= density < 60 and stroma > 0.40 and area < 200 and circularity > 0.65 and empty < 0.08 and hema < 30:
        scores["cartilage"] += 3.5
        reasons["cartilage"].append("condrócitos pequenos e regulares dispersos em matriz eosinofílica abundante")
    if eosin > 110 and 3 < density < 35 and elong < 2.0 and hema < 20 and stroma > 0.45:
        scores["cartilage"] += 1.5

    # --- Kidney (A3): córtex renal com basofilia tubular MUITO intensa —
    # assinatura distinta do fígado (hema baixo, eosina dominante): túbulos
    # justapostos com núcleos pequenos, densos e regulares em estroma escasso.
    if hema > 70 and density > 35 and area < 100 and stroma < 0.10:
        scores["kidney"] += 6.5
        reasons["kidney"].append("basofilia tubular intensa com núcleos pequenos, densos e regulares (córtex renal)")
    elif hema > 50 and density > 30 and area < 120 and stroma < 0.15:
        scores["kidney"] += 2.0

    # --- Lung (A3): parênquima alveolar — espaços aéreos claros moderados
    # (28–45%, abaixo do adiposo unilocular >45%) com septos finos e
    # densidade nuclear apreciável nas paredes alveolares.
    if 0.28 < empty <= 0.45 and density > 40:
        scores["lung"] += 7.0
        reasons["lung"].append("espaços aéreos alveolares com septos finos e núcleos nas paredes")
    if empty > 0.30 and hema < 40 and stroma < 0.35:
        scores["lung"] += 1.5
    if 0.28 < empty <= 0.45 and density > 40 and stroma < 0.35 and circularity > 0.85:
        scores["lung"] += 1.5

    total = sum(scores.values()) + 1e-9
    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    conf = scores[best] / total
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:3]
    evidence = [
        {"type": k, "confidence": round(v / total, 3),
         "criteria": reasons[k][:3]}
        for k, v in ranked if v > 0
    ]

    # Guarda 2 — sem consenso entre regras (todas fracas), não forçar tecido.
    if conf < 0.45:
        return "indeterminate", round(conf, 3), evidence or [{
            "type": "ambíguo",
            "confidence": round(conf, 3),
            "criteria": ["nenhum tipo de tecido reúne critérios morfológicos claros"],
        }]

    return best, round(conf, 3), evidence


def analyze_image(bgr: np.ndarray, px_per_mm: float = 500.0) -> dict[str, Any]:
    he = _decompose_he(bgr)
    h_ch, e_ch = he["H"], he["E"]

    markers, clean = _segment_nuclei(h_ch)
    infos, overlay = _nucleus_metrics(markers)

    # Stroma = eosin-positive pixels NOT covered by nuclei
    nuclei_mask = clean > 0
    eosin_mask = e_ch > 90
    stromal_px = int(np.count_nonzero(eosin_mask & ~nuclei_mask))
    total_px = bgr.shape[0] * bgr.shape[1]
    empty_mask = (cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY) > 215) & ~nuclei_mask
    empty_ratio = float(np.count_nonzero(empty_mask)) / total_px

    areas = [i.area for i in infos]
    circs = [i.circularity for i in infos]
    elongs = [i.elongation for i in infos]
    area_mm2 = total_px / (px_per_mm ** 2)
    density = len(infos) / area_mm2

    features = {
        "n_nuclei": len(infos),
        "nuclei_per_mm2": round(density, 1),
        "median_nucleus_area": round(float(np.median(areas)) if areas else 0.0, 1),
        "nucleus_area_cv": round(float(np.std(areas) / np.mean(areas)) if areas and np.mean(areas) else 0.0, 3),
        "median_circularity": round(float(np.median(circs)) if circs else 0.0, 3),
        "median_elongation": round(float(np.median(elongs)) if elongs else 1.0, 2),
        "stromal_ratio": round(stromal_px / total_px, 3),
        "empty_ratio": round(empty_ratio, 3),
        "hematoxylin_mean": round(float(h_ch.mean()), 1),
        "eosin_mean": round(float(e_ch.mean()), 1),
    }

    tissue, confidence, evidence = _classify(features)

    # Composite overlay for visualization
    vis = bgr.copy()
    if nuclei_mask.any():
        blended = cv2.addWeighted(vis, 0.75, overlay, 0.25, 0)
        vis[nuclei_mask] = blended[nuclei_mask]
    for i in infos[:400]:
        cv2.circle(vis, (i.x, i.y), 1, (255, 255, 255), -1)

    # O overlay é JPEG (não PNG): codificado a 88 de qualidade para o payload
    # base64 não rebentar com imagens grandes — o nome do campo diz isso.
    enc = cv2.imencode(".jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tobytes()
    overlay_b64 = base64.b64encode(enc).decode()
    return {
        "features": features,
        "tissue": tissue,
        "tissue_confidence": confidence,
        "evidence": evidence,
        "nuclei": [asdict(i) for i in infos[:800]],
        "overlay_jpg_b64": overlay_b64,
    }
