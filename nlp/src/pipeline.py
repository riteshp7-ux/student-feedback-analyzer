import os
import json
from typing import List, Dict, Any, Optional

from nlp.src.preprocessing import preprocess_text, APPROVED_SENTIMENTS, APPROVED_TOPICS
from nlp.src.vectorizer import FeatureExtractor
from nlp.src.classifier import MultinomialNBSentimentClassifier, BinaryNBTopicClassifier

class FeedbackNLPBaseline:
    """
    Unified Baseline NLP Pipeline for Student Feedback Analysis.
    Handles text normalization, feature extraction (unigrams, bigrams, lexicon),
    Sentiment classification (3-class), and Multi-label Topic classification (7 topics).
    """
    def __init__(
        self,
        feature_extractor: Optional[FeatureExtractor] = None,
        sentiment_model: Optional[MultinomialNBSentimentClassifier] = None,
        topics_model: Optional[BinaryNBTopicClassifier] = None
    ):
        self.feature_extractor = feature_extractor or FeatureExtractor(ngram_range=(1, 2))
        self.sentiment_model = sentiment_model or MultinomialNBSentimentClassifier(
            classes=list(APPROVED_SENTIMENTS),
            alpha=0.5
        )
        self.topics_model = topics_model or BinaryNBTopicClassifier(
            labels=APPROVED_TOPICS,
            threshold=0.40,
            alpha=0.5
        )

    def fit(self, dataset: List[Dict[str, Any]]) -> "FeedbackNLPBaseline":
        raw_texts = [sample["text"] for sample in dataset]
        cleaned_texts = [preprocess_text(t) for t in raw_texts]

        # 1. Fit Feature Extractor
        self.feature_extractor.fit(cleaned_texts)

        # 2. Extract tokens for each document
        tokenized_docs = [self.feature_extractor.extract_tokens(t) for t in cleaned_texts]

        # 3. Fit Sentiment Model
        sentiments = [sample["sentiment"] for sample in dataset]
        self.sentiment_model.fit(tokenized_docs, sentiments)

        # 4. Fit Topics Model
        topics_list = [sample["topics"] for sample in dataset]
        self.topics_model.fit(tokenized_docs, topics_list)

        return self

    def predict_one(self, text: str) -> Dict[str, Any]:
        cleaned = preprocess_text(text)
        tokens = self.feature_extractor.extract_tokens(cleaned) if cleaned else []
        if not tokens:
            # Deterministic fallback for empty or noise-only text
            return {
                "sentiment": "neutral",
                "sentiment_score": 0.3333,
                "sentiment_probabilities": {
                    "positive": 0.3333,
                    "neutral": 0.3334,
                    "negative": 0.3333
                },
                "topics": [],
                "topic_scores": {topic: 0.0 for topic in APPROVED_TOPICS}
            }


        # Sentiment prediction
        sent_probs = self.sentiment_model.predict_proba(tokens)
        best_sentiment = max(sent_probs.items(), key=lambda item: item[1])[0]
        best_sentiment_score = sent_probs[best_sentiment]

        # Topics prediction
        topic_probs = self.topics_model.predict_proba(tokens)
        predicted_topics = [
            topic for topic in APPROVED_TOPICS
            if topic_probs.get(topic, 0.0) >= self.topics_model.threshold
        ]

        return {
            "sentiment": best_sentiment,
            "sentiment_score": best_sentiment_score,
            "sentiment_probabilities": sent_probs,
            "topics": predicted_topics,
            "topic_scores": topic_probs
        }

    def predict_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        return [self.predict_one(t) for t in texts]

    def save(self, artifact_dir: str):
        os.makedirs(artifact_dir, exist_ok=True)

        with open(os.path.join(artifact_dir, "feature_extractor.json"), "w", encoding="utf-8") as f:
            json.dump(self.feature_extractor.to_dict(), f, indent=2)

        with open(os.path.join(artifact_dir, "sentiment_model.json"), "w", encoding="utf-8") as f:
            json.dump(self.sentiment_model.to_dict(), f, indent=2)

        with open(os.path.join(artifact_dir, "topics_model.json"), "w", encoding="utf-8") as f:
            json.dump(self.topics_model.to_dict(), f, indent=2)

    @classmethod
    def load(cls, artifact_dir: str) -> "FeedbackNLPBaseline":
        with open(os.path.join(artifact_dir, "feature_extractor.json"), "r", encoding="utf-8") as f:
            fe_data = json.load(f)
        with open(os.path.join(artifact_dir, "sentiment_model.json"), "r", encoding="utf-8") as f:
            sent_data = json.load(f)
        with open(os.path.join(artifact_dir, "topics_model.json"), "r", encoding="utf-8") as f:
            topics_data = json.load(f)

        return cls(
            feature_extractor=FeatureExtractor.from_dict(fe_data),
            sentiment_model=MultinomialNBSentimentClassifier.from_dict(sent_data),
            topics_model=BinaryNBTopicClassifier.from_dict(topics_data)
        )
