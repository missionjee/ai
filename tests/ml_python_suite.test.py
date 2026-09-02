import unittest
import numpy as np
from ml_engine.entropy import compute_entropy_suite
from ml_engine.pipeline import extract_features_for_index, build_dataset
from ml_engine.service import calculate_next_period
from ml_engine.models import ContinuousLatentRegressor, DeepSequenceAttention, StackingMetaLearner


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

    def test_stacking_meta_learner(self):
        meta = StackingMetaLearner()
        p1 = np.ones(10) / 10.0
        p2 = np.ones(10) / 10.0
        p3 = np.ones(10) / 10.0
        reg_info = {"continuous_val": 7.2, "pred_type": "BIG", "conf": 75}
        
        ens = meta.ensemble_distribution(p1, p2, p3, reg_info)
        self.assertIn("digit_probs", ens)
        self.assertIn("big_prob", ens)
        self.assertIn("small_prob", ens)
        self.assertIn("lucky_digits", ens)
        self.assertEqual(len(ens["lucky_digits"]), 2)
        self.assertIn(ens["pred_type"], ["BIG", "SMALL"])


if __name__ == "__main__":
    unittest.main()
