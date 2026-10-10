import os
import tempfile
import unittest

from nlp.src.preprocessing import preprocess_text, APPROVED_SENTIMENTS, APPROVED_TOPICS
from nlp.src.vectorizer import FeatureExtractor
from nlp.src.classifier import MultinomialNBSentimentClassifier, BinaryNBTopicClassifier
from nlp.src.pipeline import FeedbackNLPBaseline

class TestPreprocessing(unittest.TestCase):
    def test_empty_and_none(self):
        self.assertEqual(preprocess_text(""), "")
        self.assertEqual(preprocess_text(None), "")
        self.assertEqual(preprocess_text("   \n\t  "), "")

    def test_contraction_expansion(self):
        cleaned = preprocess_text("Don't can't won't shouldn't")
        self.assertIn("not", cleaned)
        self.assertIn("cannot", cleaned)
        self.assertIn("will not", cleaned)

    def test_punctuation_reduction(self):
        cleaned = preprocess_text("Very fast paced!!!!!! What is this???")
        self.assertIn("paced!", cleaned)
        self.assertIn("this?", cleaned)

    def test_preserves_negation_words(self):
        cleaned = preprocess_text("Not clear, never explains, cannot understand.")
        for word in ["not", "never", "cannot"]:
            self.assertIn(word, cleaned)


class TestFeatureExtractor(unittest.TestCase):
    def test_stopword_filtering_unigram(self):
        extractor = FeatureExtractor()
        tokens = extractor.extract_tokens("The professor is in the classroom")
        self.assertNotIn("the", tokens)
        self.assertNotIn("is", tokens)
        self.assertIn("professor", tokens)
        self.assertIn("classroom", tokens)

    def test_preserves_bigrams_with_stops(self):
        extractor = FeatureExtractor(ngram_range=(1, 2))
        tokens = extractor.extract_tokens("hands on coding")
        self.assertIn("hands on", tokens)
        self.assertIn("on coding", tokens)

    def test_lexicon_and_negation_indicators(self):
        extractor = FeatureExtractor()
        tokens = extractor.extract_tokens("Not clear and very confusing lecture.")
        self.assertIn("__has_negation__", tokens)
        self.assertIn("__lex_neg__", tokens)


class TestModelPipeline(unittest.TestCase):
    def setUp(self):
        self.sample_data = [
            {
                "text": "The lectures are exceptionally clear and well explained.",
                "sentiment": "positive",
                "topics": ["teaching_clarity"]
            },
            {
                "text": "Too fast and rushed through slides without explaining.",
                "sentiment": "negative",
                "topics": ["teaching_pace", "teaching_clarity"]
            },
            {
                "text": "The course follows regular university textbook syllabus.",
                "sentiment": "neutral",
                "topics": ["course_content"]
            },
            {
                "text": "General feedback without any specific comment on lectures.",
                "sentiment": "neutral",
                "topics": []
            }
        ]

    def test_pipeline_train_and_predict(self):
        pipeline = FeedbackNLPBaseline()
        pipeline.fit(self.sample_data)

        res = pipeline.predict_one("Lectures are exceptionally clear and well structured.")
        self.assertIn(res["sentiment"], APPROVED_SENTIMENTS)
        self.assertIsInstance(res["sentiment_score"], float)
        self.assertTrue(0.0 <= res["sentiment_score"] <= 1.0)

        probs = res["sentiment_probabilities"]
        self.assertEqual(len(probs), 3)
        prob_sum = sum(probs.values())
        self.assertAlmostEqual(prob_sum, 1.0, places=2)

        self.assertIsInstance(res["topics"], list)
        for t in res["topics"]:
            self.assertIn(t, APPROVED_TOPICS)

        self.assertIsInstance(res["topic_scores"], dict)
        self.assertEqual(set(res["topic_scores"].keys()), set(APPROVED_TOPICS))

    def test_empty_input_fallback(self):
        pipeline = FeedbackNLPBaseline()
        pipeline.fit(self.sample_data)

        res = pipeline.predict_one("")
        self.assertEqual(res["sentiment"], "neutral")
        self.assertEqual(res["sentiment_score"], 0.3333)
        self.assertEqual(res["topics"], [])

    def test_whitespace_and_noise_fallback(self):
        pipeline = FeedbackNLPBaseline()
        pipeline.fit(self.sample_data)

        res = pipeline.predict_one("   ??? !!! ...   ")
        self.assertEqual(res["sentiment"], "neutral")
        self.assertEqual(res["topics"], [])

    def test_deterministic_output(self):
        pipeline = FeedbackNLPBaseline()
        pipeline.fit(self.sample_data)

        text = "Very fast teaching speed and no doubts solved."
        res1 = pipeline.predict_one(text)
        res2 = pipeline.predict_one(text)
        self.assertEqual(res1, res2)

    def test_save_and_load_roundtrip(self):
        pipeline = FeedbackNLPBaseline()
        pipeline.fit(self.sample_data)

        with tempfile.TemporaryDirectory() as tmp_dir:
            pipeline.save(tmp_dir)
            loaded = FeedbackNLPBaseline.load(tmp_dir)

            test_text = "Good real world examples and clear explanations."
            pred_orig = pipeline.predict_one(test_text)
            pred_loaded = loaded.predict_one(test_text)

            self.assertEqual(pred_orig["sentiment"], pred_loaded["sentiment"])
            self.assertEqual(pred_orig["topics"], pred_loaded["topics"])
            self.assertEqual(pred_orig["sentiment_probabilities"], pred_loaded["sentiment_probabilities"])
            self.assertEqual(pred_orig["topic_scores"], pred_loaded["topic_scores"])


class TestPretrainedArtifacts(unittest.TestCase):
    def test_load_production_artifacts(self):
        artifact_dir = "nlp/artifacts/v1.0.0"
        self.assertTrue(os.path.exists(os.path.join(artifact_dir, "feature_extractor.json")))
        self.assertTrue(os.path.exists(os.path.join(artifact_dir, "sentiment_model.json")))
        self.assertTrue(os.path.exists(os.path.join(artifact_dir, "topics_model.json")))
        self.assertTrue(os.path.exists(os.path.join(artifact_dir, "metrics.json")))

        pipeline = FeedbackNLPBaseline.load(artifact_dir)
        pred = pipeline.predict_one("Excellent practical demonstrations and live coding examples.")
        self.assertEqual(pred["sentiment"], "positive")
        self.assertIn("practical_examples", pred["topics"])

if __name__ == "__main__":
    unittest.main()
