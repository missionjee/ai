import unittest
import numpy as np
from ml_engine.entropy import compute_entropy_suite
from ml_engine.pipeline import extract_features_for_index, build_dataset, QuantitativePipeline
from ml_engine.service import calculate_next_period
from ml_engine.models import (
    ContinuousLatentRegressor,
    DeepSequenceAttention,
    StackingMetaLearner,
    OnlinePlattCalibrator,
    ADWINDriftDetector,
    EvidentialDeepLearner,
    SparseMoERouter,
    FailureAnalysisTrigger,
    SpectralFourierPredictor,
    RunsMartingalePredictor
)


class TestMLEngine(unittest.TestCase):
    def test_entropy_suite(self):
        nums = [1.0, 7.0, 2.0, 8.0, 3.0, 9.0, 0.0, 5.0, 4.0, 6.0] * 3
        suite = compute_entropy_suite(nums)
        
        self.assertIn("shannon_entropy_10", suite)
        self.assertIn("shannon_entropy_25", suite)
        self.assertIn("permutation_entropy", suite)
        self.assertIn("spectral_entropy", suite)
        self.assertIn("hurst_exponent", suite)
        
        self.assertGreaterEqual(suite["shannon_entropy_10"], 0.0)
        self.assertLessEqual(suite["shannon_entropy_10"], 1.0)
        self.assertGreaterEqual(suite["permutation_entropy"], 0.0)
        self.assertLessEqual(suite["permutation_entropy"], 1.0)
        self.assertGreaterEqual(suite["hurst_exponent"], 0.0)
        self.assertLessEqual(suite["hurst_exponent"], 1.0)

    def test_feature_extraction(self):
        records = [
            {"issue_number": f"202609011000100{i:02d}", "actual_number": (i * 3 + 2) % 10}
            for i in range(25)
        ]
        feats = extract_features_for_index(records, 20, lookback=12)
        self.assertIsInstance(feats, list)
        self.assertGreater(len(feats), 20)
        for f in feats:
            self.assertFalse(np.isnan(f))
            self.assertFalse(np.isinf(f))

    def test_dataset_building(self):
        records = [
            {"issue_number": f"202609011000100{i:02d}", "actual_number": (i * 3 + 2) % 10}
            for i in range(30)
        ]
        X, y = build_dataset(records)
        self.assertEqual(len(X), len(y))
        self.assertEqual(len(X), 30 - 12)

    def test_python_calendar_rollover(self):
        # Sequential next period
        self.assertEqual(calculate_next_period("20260901100010001"), "20260901100010002")
        # Midnight rollover
        self.assertEqual(calculate_next_period("20260901100011440"), "20260902100010001")
        # Month rollover
        self.assertEqual(calculate_next_period("20260831100011440"), "20260901100010001")
        # Year rollover
        self.assertEqual(calculate_next_period("20261231100011440"), "20270101100010001")

    def test_continuous_latent_regressor(self):
        reg = ContinuousLatentRegressor()
        X = np.random.randn(20, 26)
        y = np.random.randint(0, 10, size=20)
        reg.fit(X, y)
        self.assertTrue(reg.is_fitted)
        pred = reg.predict(X[0])
        self.assertIn("continuous_val", pred)
        self.assertIn("pred_type", pred)
        self.assertIn(pred["pred_type"], ["BIG", "SMALL"])
        self.assertGreaterEqual(pred["continuous_val"], 0.0)
        self.assertLessEqual(pred["continuous_val"], 9.0)

    def test_deep_sequence_attention(self):
        attn = DeepSequenceAttention()
        nums = [1, 2, 7, 8, 3, 4, 9, 0, 5, 6] * 4
        attn.fit(nums)
        dist = attn.predict_distribution(nums)
        self.assertEqual(len(dist), 10)
        self.assertAlmostEqual(float(np.sum(dist)), 1.0, places=4)

    def test_online_platt_calibrator(self):
        cal = OnlinePlattCalibrator()
        p0 = cal.calibrate(0.8)
        self.assertGreater(p0, 0.5)
        self.assertLessEqual(p0, 0.99)
        
        # Train on positive examples
        for _ in range(10):
            res = cal.update_step(0.8, 1)
            self.assertIn("loss", res)
            self.assertIn("a", res)
            self.assertIn("b", res)

    def test_adwin_drift_detector(self):
        adwin = ADWINDriftDetector(delta=0.01)
        # Feed 30 wins (error 0.0)
        for _ in range(30):
            res = adwin.add_element(0.0)
        self.assertFalse(res["drift_detected"])
        
        # Sudden shift to losses (error 1.0)
        shift_detected = False
        for _ in range(40):
            res = adwin.add_element(1.0)
            if res["drift_detected"]:
                shift_detected = True
                break
        self.assertTrue(shift_detected)

    def test_quantitative_pipeline_end_to_end(self):
        pipeline = QuantitativePipeline()
        records = [
            {"issue_number": f"202609011000100{i:02d}", "actual_number": (i * 7 + 3) % 10, "actual_result": "BIG" if ((i * 7 + 3) % 10) >= 5 else "SMALL"}
            for i in range(35)
        ]
        res = pipeline.run(records)
        self.assertIn("prediction", res)
        self.assertIn(res["prediction"], ["BIG", "SMALL", "HOLD"])
        self.assertIn("confidence", res)
        self.assertGreaterEqual(res["confidence"], 50)
        self.assertIn("drift_state", res)
        self.assertIn("calibration_params", res)
        self.assertIn("evidential_metrics", res)
        self.assertIn("moe_routing", res)

    def test_evidential_deep_learner(self):
        edl = EvidentialDeepLearner()
        nums = [1, 2, 7, 8, 9, 3, 4, 8, 9, 7] * 3
        edl.fit(nums)
        pred = edl.predict_evidential(nums)
        self.assertIn("epistemic_uncertainty", pred)
        self.assertIn("aleatoric_uncertainty", pred)
        self.assertIn("evidence_strength", pred)
        self.assertGreater(pred["evidence_strength"], 0.0)
        self.assertGreaterEqual(pred["epistemic_uncertainty"], 0.0)

    def test_sparse_moe_router(self):
        moe = SparseMoERouter()
        context = {"hurst_exponent": 0.65, "shannon_entropy": 0.70, "cur_streak": 3, "is_alternating": False}
        expert_dists = {
            "streak_momentum": np.ones(10)/10.0,
            "harmonic_oscillator": np.ones(10)/10.0,
            "micro_anomaly": np.ones(10)/10.0
        }
        res = moe.route_and_blend(context, expert_dists)
        self.assertIn("active_expert", res)
        self.assertIn("gating_weights", res)
        self.assertEqual(len(res["blended_distribution"]), 10)

    def test_failure_analysis_trigger(self):
        trigger = FailureAnalysisTrigger(confidence_threshold=70)
        pred_record = {"issue_number": "20260901100010025", "prediction": "BIG", "confidence": 85}
        feat_names = ["lag1", "lag2", "velocity", "hurst", "entropy"]
        feat_vec = [8.0, 9.0, 1.0, 0.62, 0.75]
        incident = trigger.inspect_loss(pred_record, "SMALL", feat_names, feat_vec)
        self.assertIsNotNone(incident)
        self.assertEqual(incident["predicted"], "BIG")
        self.assertEqual(incident["actual"], "SMALL")
    def test_spectral_fourier_predictor(self):
        fourier = SpectralFourierPredictor()
        # Alternating series has period ~ 2.0
        alt_nums = [1, 9, 2, 8, 1, 9, 2, 8, 1, 9, 2, 8, 1, 9, 2, 8]
        fourier.fit(alt_nums)
        self.assertTrue(fourier.is_fitted)
        self.assertGreater(fourier.dominant_period, 0.0)
        dist = fourier.predict_distribution(alt_nums)
        self.assertEqual(len(dist), 10)
        self.assertAlmostEqual(float(np.sum(dist)), 1.0, places=4)

    def test_runs_martingale_predictor(self):
        martingale = RunsMartingalePredictor()
        trend_nums = [8, 9, 7, 8, 9, 8, 9, 8, 7, 9, 8, 9] * 2
        martingale.fit(trend_nums)
        self.assertTrue(martingale.is_fitted)
        dist = martingale.predict_distribution(trend_nums)
        self.assertEqual(len(dist), 10)
        self.assertAlmostEqual(float(np.sum(dist)), 1.0, places=4)


if __name__ == "__main__":
    unittest.main()
