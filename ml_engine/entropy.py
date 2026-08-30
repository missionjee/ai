"""
Information Theory & Non-Linear Dynamics Entropy Suite for PRNG Analysis.

Calculates:
1. Shannon Entropy (information density & compression factor)
2. Permutation Entropy (Bandt-Pompe ordinal pattern complexity)
3. Sample Entropy (regularity & repetition quantification)
4. Spectral Entropy (Fourier frequency harmonic energy decay)
5. Hurst Exponent (memory persistence vs mean-reversion)
"""

import math
import numpy as np
from scipy.signal import periodogram


def shannon_entropy(series, num_bins=10, base=2):
    """
    Computes Shannon Entropy H(X) = - sum(p_i * log_base(p_i)).
    Low entropy (< 0.70) indicates deterministic algorithmic cycles or low diversity.
    High entropy (> 0.92) indicates white noise / chop.
    """
    if len(series) == 0:
        return 1.0
    
    counts = np.bincount(np.clip(series, 0, num_bins - 1).astype(int), minlength=num_bins)
    probs = counts / float(len(series))
    probs = probs[probs > 0]
    
    if len(probs) <= 1:
        return 0.0
    
    h = -np.sum(probs * (np.log(probs) / np.log(base)))
    max_h = np.log(num_bins) / np.log(base)
    # Normalized Shannon entropy [0.0, 1.0]
    return float(np.clip(h / max_h, 0.0, 1.0))


def permutation_entropy(series, order=3, delay=1):
    """
    Bandt-Pompe Permutation Entropy:
    Measures the dynamic complexity of ordinal rank patterns in time series.
    """
    n = len(series)
    if n < order * delay + 2:
        return 1.0
    
    # Generate all embedded ordinal permutations
    patterns = {}
    total_patterns = 0
    
    for i in range(n - (order - 1) * delay):
        window = [series[i + j * delay] for j in range(order)]
        # Get permutation rank indices
        perm = tuple(np.argsort(window))
        patterns[perm] = patterns.get(perm, 0) + 1
        total_patterns += 1
        
    if total_patterns == 0:
        return 1.0
    
    probs = np.array(list(patterns.values())) / float(total_patterns)
    pe = -np.sum(probs * np.log2(probs))
    max_pe = np.log2(math.factorial(order))
    
    return float(np.clip(pe / max_pe, 0.0, 1.0))


def sample_entropy(series, m=2, r=0.2):
    """
    Sample Entropy (SampEn):
    Quantifies the likelihood that runs of patterns that are close remain close on next step.
    """
    n = len(series)
    if n < 10:
        return 1.0
    
    x = np.array(series, dtype=float)
    std = np.std(x)
    tolerance = r * (std if std > 1e-4 else 1.0)
    
    def _phi(dim):
        patterns = np.array([x[i:i + dim] for i in range(n - dim + 1)])
        count = 0
        total_pairs = 0
        for i in range(len(patterns)):
            for j in range(i + 1, len(patterns)):
                if np.max(np.abs(patterns[i] - patterns[j])) <= tolerance:
                    count += 1
                total_pairs += 1
        return (count / total_pairs) if total_pairs > 0 else 1e-5

    a = _phi(m + 1)
    b = _phi(m)
    if b <= 0 or a <= 0:
        return 1.0
    return float(np.clip(-np.log(a / b), 0.0, 3.0))


def spectral_entropy(series):
    """
    Computes Spectral Entropy via Fast Fourier Transform (FFT).
    Reveals periodic cycle peaks and harmonic resonance in the PRNG generator.
    """
    if len(series) < 8:
        return 1.0
    
    _, psd = periodogram(series)
    psd_norm = psd / np.sum(psd) if np.sum(psd) > 0 else psd
    psd_norm = psd_norm[psd_norm > 0]
    
    if len(psd_norm) <= 1:
        return 0.0
    
    se = -np.sum(psd_norm * np.log2(psd_norm))
    max_se = np.log2(len(psd))
    return float(np.clip(se / max_se if max_se > 0 else 1.0, 0.0, 1.0))


def hurst_exponent(series):
    """
    Computes Hurst Exponent (H) via Rescaled Range (R/S) Analysis:
    H < 0.5 -> Mean-reverting / anti-persistent series (oscillations)
    H = 0.5 -> Random walk / geometric Brownian motion
    H > 0.5 -> Persistent / trending series (dragon streaks)
    """
    if len(series) < 16:
        return 0.5
    
    x = np.array(series, dtype=float)
    n = len(x)
    max_k = min(n // 2, 32)
    k_vals = []
    rs_vals = []
    
    for k in [4, 8, 12, 16, 24, max_k]:
        if k > n // 2:
            continue
        num_splits = n // k
        rs_list = []
        for i in range(num_splits):
            chunk = x[i * k:(i + 1) * k]
            mean = np.mean(chunk)
            std = np.std(chunk)
            if std < 1e-4:
                continue
            cum_dev = np.cumsum(chunk - mean)
            r = np.max(cum_dev) - np.min(cum_dev)
            rs_list.append(r / std)
        if rs_list:
            k_vals.append(k)
            rs_vals.append(np.mean(rs_list))
            
    if len(k_vals) < 3:
        return 0.5
    
    poly = np.polyfit(np.log(k_vals), np.log(rs_vals), 1)
    return float(np.clip(poly[0], 0.05, 0.95))


def compute_entropy_suite(series):
    """
    Returns a unified feature dictionary containing all information-theoretic metrics.
    """
    clean_series = [float(x) for x in series if x is not null_check(x)]
    if len(clean_series) < 6:
        return {
            "shannon_entropy_10": 1.0,
            "shannon_entropy_25": 1.0,
            "permutation_entropy": 1.0,
            "spectral_entropy": 1.0,
            "hurst_exponent": 0.5,
            "is_low_entropy_edge": False
        }
        
    s10 = clean_series[-10:] if len(clean_series) >= 10 else clean_series
    s25 = clean_series[-25:] if len(clean_series) >= 25 else clean_series
    
    h_s10 = shannon_entropy(s10)
    h_s25 = shannon_entropy(s25)
    p_ent = permutation_entropy(s10, order=3, delay=1)
    s_ent = spectral_entropy(s25)
    hurst = hurst_exponent(s25)
    
    # Low entropy = systematic deterministic regime where model accuracy peaks
    is_edge = (h_s10 < 0.78 or p_ent < 0.75) and (hurst > 0.60 or hurst < 0.40)
    
    return {
        "shannon_entropy_10": round(h_s10, 3),
        "shannon_entropy_25": round(h_s25, 3),
        "permutation_entropy": round(p_ent, 3),
        "spectral_entropy": round(s_ent, 3),
        "hurst_exponent": round(hurst, 3),
        "is_low_entropy_edge": bool(is_edge)
    }


def null_check(val):
    return val is not None and not np.isnan(val)
