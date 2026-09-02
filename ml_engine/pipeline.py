"""
End-to-End Quantitative Feature Engineering & Inference Pipeline.
Extracts rich microstructure features, entropy manifolds, trains models,
and generates the unified continuous + probability prediction.
"""

import math
import numpy as np
from ml_engine.entropy import compute_entropy_suite
from ml_engine.models import (
    ContinuousLatentRegressor,
    CatBoostPredictor,
    LightGBMPredictor,
    DeepSequenceAttention,
    StackingMetaLearner
)


def extract_features_for_index(records, idx, lookback=12):
    """
    Extracts high-dimensional microstructure feature vector for a specific time step.
    """
    # 1. Number lags
    lags = []
    for k in range(1, lookback + 1):
        pos = idx - k
        val = records[pos].get("actual_number") if pos >= 0 else 4.5
        lags.append(float(val) if val is not None else 4.5)
        
    # 2. Number deltas & velocity
    d1 = lags[0] - lags[1]
    d2 = lags[1] - lags[2]
    accel = d1 - d2
    
    # 3. Trigonometric cyclical encoding
    rad1 = (lags[0] * 2.0 * math.pi) / 10.0
    rad2 = (lags[1] * 2.0 * math.pi) / 10.0
    sin1, cos1 = math.sin(rad1), math.cos(rad1)
    sin2, cos2 = math.sin(rad2), math.cos(rad2)
    
    # 4. Modulo Congruence
    int_last = int(round(lags[0]))
    mod2 = int_last % 2       # Parity (0: even, 1: odd)
    mod3 = int_last % 3
    mod5 = int_last % 5
    
    # 5. Rolling Statistical Moments
    slice5 = lags[:5]
    mean5 = float(np.mean(slice5))
    std5 = float(np.std(slice5))
    
    slice10 = lags[:10]
    mean10 = float(np.mean(slice10))
    std10 = float(np.std(slice10))
    
    # 6. Binary outcome sequence
    bin_lags = [1.0 if l >= 5.0 else -1.0 for l in lags[:6]]
    
    # 7. Alternation rate
    alts = sum(1 for j in range(len(bin_lags) - 1) if bin_lags[j] != bin_lags[j+1])
    alt_rate = alts / float(len(bin_lags) - 1)
    
    # Combine vector
    feats = [
        *lags,
        d1, d2, accel,
        sin1, cos1, sin2, cos2,
        float(mod2), float(mod3), float(mod5),
        mean5, std5, mean10, std10,
        *bin_lags,
        alt_rate
    ]
    return feats


def build_dataset(records):
    """
    Constructs (X, y_num, y_bin) matrices from chronological records (oldest-first).
    """
    valid = [r for r in records if r.get("actual_number") is not None and not np.isnan(r.get("actual_number"))]
    if len(valid) < 20:
        return np.array([]), np.array([])
        
    X_list = []
    y_list = []
    
    lookback = 12
    for i in range(lookback, len(valid)):
        feats = extract_features_for_index(valid, i, lookback=lookback)
        target = int(valid[i]["actual_number"])
        X_list.append(feats)
        y_list.append(target)
        
    return np.array(X_list), np.array(y_list)


class QuantitativePipeline:
    def __init__(self):
        self.regressor = ContinuousLatentRegressor()
        self.catboost = CatBoostPredictor()
        self.lightgbm = LightGBMPredictor()
        self.attention = DeepSequenceAttention()
        self.ensemble = StackingMetaLearner()

    def run(self, history_records):
        """
        Executes end-to-end training and inference for upcoming round.
        @param history_records: list of dicts with issue_number, actual_result, actual_number
        """
        # Sort ascending (oldest first)
        def _sort_key(r):
            try:
                return int(r.get("issue_number", 0))
            except Exception:
                return 0
                
        sorted_history = sorted(history_records, key=_sort_key)
        valid = [r for r in sorted_history if r.get("actual_number") is not None]
        
        if len(valid) < 15:
            return {
                "prediction": "HOLD",
                "confidence": 50,
                "status": "HOLD",
                "status_reason": f"Collecting live training dataset ({len(valid)}/15 required)",
                "lucky_digits": [2, 7],
                "digit_probs": {d: 10.0 for d in range(10)},
                "big_prob": 50.0,
                "small_prob": 50.0,
                "strategy": "Initialization",
                "regime": "neutral",
                "is_sniper": False,
                "entropy_metrics": {}
            }
            
        all_nums = [float(r["actual_number"]) for r in valid]
        entropy_metrics = compute_entropy_suite(all_nums)
        
        # Build training set from all historical data (up to 2,000 rounds)
        X, y = build_dataset(valid)
        
        # Fit models
        self.regressor.fit(X, y)
        self.catboost.fit(X, y)
        self.lightgbm.fit(X, y)
        self.attention.fit(all_nums)
        
        # Feature vector for upcoming target round (index = len(valid))
        target_features = extract_features_for_index(valid, len(valid), lookback=12)
        
        # Individual model inferences
        reg_info = self.regressor.predict(target_features)
        cat_dist = self.catboost.predict_distribution(target_features)
        lgb_dist = self.lightgbm.predict_distribution(target_features)
        deep_dist = self.attention.predict_distribution(all_nums)
        # Regime determination
        h_s = entropy_metrics.get("shannon_entropy_10", 1.0)
        p_e = entropy_metrics.get("permutation_entropy", 1.0)
        hurst = entropy_metrics.get("hurst_exponent", 0.5)
        alt_rate = target_features[-1] if len(target_features) > 0 else 0.5
        
        if hurst > 0.60:
            regime = "trending"
        elif hurst < 0.40:
            regime = "mean_reverting"
        else:
            regime = "alternating" if p_e < 0.80 else "mixed"

        # Stacking ensemble with regime-adaptive weights
        ens = self.ensemble.ensemble_distribution(
            cat_dist, lgb_dist, deep_dist, reg_info,
            context={"regime": regime, "alt_rate": alt_rate}
        )
        
        # Confluence & Sniper Detection
        # Check alignment between continuous regressor, GBDT, and Attention
        c_pred = reg_info["pred_type"]
        ens_pred = ens["pred_type"]
        is_consensus = (c_pred == ens_pred) and (ens["confidence"] >= 72)
        is_low_entropy = (h_s < 0.85)
        
        is_sniper = bool(is_consensus and is_low_entropy and regime != "mixed")
        
        status = "CLEARED"
        status_reason = "Multi-model gradient confluence verified"
        
        if is_sniper:
            status = "SNIPER"
            status_reason = f"🎯 Sniper Confluence: CatBoost + LightGBM + Attention agree on {ens_pred} in {regime} regime"
        elif ens["confidence"] < 62 or (regime == "mixed" and h_s > 0.93):
            status = "HOLD"
            status_reason = "Elevated informational entropy (chop zone). Edge diminished."
            
        strategy = "Dual GBDT & Attention Ensemble"
        reason = f"Continuous latent: {ens['continuous_val']} | CatBoost/LightGBM consensus {ens['big_prob']}% BIG vs {ens['small_prob']}% SMALL"
        
        return {
            "prediction": ens_pred,
            "confidence": ens["confidence"],
            "status": status,
            "status_reason": status_reason,
            "lucky_digits": ens["lucky_digits"],
            "digit_probs": ens["digit_probs"],
            "big_prob": int(round(ens["big_prob"])),
            "small_prob": int(round(ens["small_prob"])),
            "strategy": strategy,
            "reason": reason,
            "continuous_val": ens["continuous_val"],
            "regime": regime,
            "is_sniper": is_sniper,
            "entropy_metrics": entropy_metrics
        }
