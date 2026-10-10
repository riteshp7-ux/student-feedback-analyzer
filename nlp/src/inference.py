import os
import logging
from typing import Optional
from pathlib import Path

from .config import settings
from .pipeline import FeedbackNLPBaseline
from .schemas import AnalyzeResponse, SentimentResult, TopicResult

logger = logging.getLogger("nlp.inference")

class InferenceEngine:
    """
    In-memory model manager for inference.
    Loads trained artifacts once at startup and serves deterministic predictions.
    """
    def __init__(self, artifact_dir: Optional[str] = None):
        self.artifact_dir = artifact_dir or settings.artifact_dir
        self.pipeline: Optional[FeedbackNLPBaseline] = None
        self._is_ready: bool = False
        self._load_error: Optional[str] = None

    def load_artifacts(self) -> bool:
        """Loads and verifies trained model artifacts from disk."""
        try:
            art_path = Path(self.artifact_dir)
            if not art_path.exists():
                raise FileNotFoundError(f"Artifact directory does not exist: {self.artifact_dir}")

            required_files = ["feature_extractor.json", "sentiment_model.json", "topics_model.json"]
            for rf in required_files:
                if not (art_path / rf).exists():
                    raise FileNotFoundError(f"Missing required artifact: {rf} in {self.artifact_dir}")

            logger.info("Loading model artifacts from %s...", self.artifact_dir)
            self.pipeline = FeedbackNLPBaseline.load(str(art_path))

            # Warm-up sanity check
            test_res = self.pipeline.predict_one("Sample warm up text.")
            if not test_res or "sentiment" not in test_res:
                raise RuntimeError("Pipeline warm-up inference failed validation.")

            self._is_ready = True
            self._load_error = None
            logger.info("Model artifacts loaded and verified successfully. Version: %s", settings.model_version)
            return True

        except Exception as exc:
            self._is_ready = False
            self._load_error = str(exc)
            logger.error("Failed to load model artifacts: %s", exc)
            return False

    @property
    def is_ready(self) -> bool:
        return self._is_ready

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    def analyze(self, text: str) -> AnalyzeResponse:
        """Performs sentiment and multi-label topic inference on input text."""
        if not self._is_ready or self.pipeline is None:
            raise RuntimeError(f"Inference engine is not ready: {self._load_error or 'Model not loaded'}")

        raw_pred = self.pipeline.predict_one(text)

        sentiment = SentimentResult(
            label=raw_pred["sentiment"],
            confidence=round(float(raw_pred["sentiment_score"]), 4),
            probabilities={k: round(float(v), 4) for k, v in raw_pred["sentiment_probabilities"].items()}
        )

        topics = [
            TopicResult(
                label=t,
                confidence=round(float(raw_pred["topic_scores"].get(t, 0.0)), 4)
            )
            for t in raw_pred["topics"]
        ]

        return AnalyzeResponse(
            sentiment=sentiment,
            topics=topics,
            modelVersion=settings.model_version
        )

engine = InferenceEngine()
