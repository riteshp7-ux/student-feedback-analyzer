import math
from collections import Counter, defaultdict
from typing import List, Dict, Any, Optional, Set

from nlp.src.vectorizer import FeatureExtractor, TOPIC_KEYWORDS

class MultinomialNBSentimentClassifier:
    """
    Multinomial Naive Bayes classifier for 3-class sentiment (positive, neutral, negative).
    Uses Laplace smoothing and outputs calibrated posterior probabilities.
    """
    def __init__(self, classes: List[str], alpha: float = 0.5):
        self.classes = sorted(classes)
        self.alpha = alpha
        self.class_counts: Dict[str, int] = {c: 0 for c in self.classes}
        self.feature_counts: Dict[str, Dict[str, int]] = {c: {} for c in self.classes}
        self.total_features: Dict[str, int] = {c: 0 for c in self.classes}
        self.vocab_: Set[str] = set()

    def fit(self, tokenized_docs: List[List[str]], labels: List[str]) -> "MultinomialNBSentimentClassifier":
        self.class_counts = {c: 0 for c in self.classes}
        self.feature_counts = {c: defaultdict(int) for c in self.classes}
        self.total_features = {c: 0 for c in self.classes}
        self.vocab_ = set()

        for tokens, label in zip(tokenized_docs, labels):
            self.class_counts[label] += 1
            for t in tokens:
                self.vocab_.add(t)
                self.feature_counts[label][t] += 1
                self.total_features[label] += 1

        # Convert defaultdicts to standard dicts
        self.feature_counts = {c: dict(self.feature_counts[c]) for c in self.classes}
        return self

    def predict_proba(self, tokens: List[str]) -> Dict[str, float]:
        n_docs = sum(self.class_counts.values())
        v_size = len(self.vocab_)
        log_scores: Dict[str, float] = {}

        for c in self.classes:
            # Prior log P(c)
            prior = math.log((self.class_counts[c] + 1.0) / (n_docs + len(self.classes)))
            denom = self.total_features[c] + self.alpha * v_size

            log_likelihood = 0.0
            for t in tokens:
                if t in self.vocab_:
                    count = self.feature_counts[c].get(t, 0)
                    log_likelihood += math.log((count + self.alpha) / denom)

            log_scores[c] = prior + log_likelihood

        # Softmax over log scores for stable normalized probabilities
        max_score = max(log_scores.values())
        exp_scores = {c: math.exp(score - max_score) for c, score in log_scores.items()}
        sum_exp = sum(exp_scores.values())
        return {c: round(exp_scores[c] / sum_exp, 4) for c in self.classes}

    def predict(self, tokens: List[str]) -> str:
        probs = self.predict_proba(tokens)
        return max(probs.items(), key=lambda item: item[1])[0]

    def to_dict(self) -> dict:
        return {
            "classes": self.classes,
            "alpha": self.alpha,
            "class_counts": self.class_counts,
            "feature_counts": self.feature_counts,
            "total_features": self.total_features,
            "vocab": sorted(list(self.vocab_))
        }

    @classmethod
    def from_dict(cls, data: dict) -> "MultinomialNBSentimentClassifier":
        clf = cls(classes=data["classes"], alpha=data["alpha"])
        clf.class_counts = data["class_counts"]
        clf.feature_counts = data["feature_counts"]
        clf.total_features = data["total_features"]
        clf.vocab_ = set(data["vocab"])
        return clf


class BinaryNBTopicClassifier:
    """
    Multi-label topic classifier using independent Binary Naive Bayes per approved topic.
    Includes keyword overlap domain boost and calibrated binary probabilities.
    """
    def __init__(self, labels: List[str], threshold: float = 0.40, alpha: float = 0.5):
        self.labels = sorted(labels)
        self.threshold = threshold
        self.alpha = alpha
        self.models: Dict[str, dict] = {}

    def fit(self, tokenized_docs: List[List[str]], label_sets: List[List[str]]) -> "BinaryNBTopicClassifier":
        self.models = {}

        for label in self.labels:
            pos_counts = Counter()
            neg_counts = Counter()
            pos_total = 0
            neg_total = 0
            n_pos = 0
            n_neg = 0
            topic_vocab = set()

            for tokens, tags in zip(tokenized_docs, label_sets):
                is_active = label in tags
                if is_active:
                    n_pos += 1
                    for t in tokens:
                        pos_counts[t] += 1
                        pos_total += 1
                        topic_vocab.add(t)
                else:
                    n_neg += 1
                    for t in tokens:
                        neg_counts[t] += 1
                        neg_total += 1
                        topic_vocab.add(t)

            self.models[label] = {
                "n_pos": n_pos,
                "n_neg": n_neg,
                "pos_total": pos_total,
                "neg_total": neg_total,
                "pos_counts": dict(pos_counts),
                "neg_counts": dict(neg_counts),
                "vocab": sorted(list(topic_vocab))
            }

        return self

    def predict_proba(self, tokens: List[str]) -> Dict[str, float]:
        token_set = set(tokens)
        topic_probs = {}

        for label in self.labels:
            m = self.models[label]
            v_size = len(m["vocab"])
            m_vocab_set = set(m["vocab"])

            # Class prior
            log_pos = math.log((m["n_pos"] + 1.0) / (m["n_pos"] + m["n_neg"] + 2.0))
            log_neg = math.log((m["n_neg"] + 1.0) / (m["n_pos"] + m["n_neg"] + 2.0))

            pos_denom = m["pos_total"] + self.alpha * v_size
            neg_denom = m["neg_total"] + self.alpha * v_size

            # Keyword overlap boost
            kws = TOPIC_KEYWORDS.get(label, set())
            kw_hits = sum(1 for kw in kws if kw in token_set)
            if kw_hits > 0:
                log_pos += kw_hits * 1.5

            for t in tokens:
                if t in m_vocab_set:
                    c_pos = m["pos_counts"].get(t, 0)
                    c_neg = m["neg_counts"].get(t, 0)
                    log_pos += math.log((c_pos + self.alpha) / pos_denom)
                    log_neg += math.log((c_neg + self.alpha) / neg_denom)

            # Softmax over binary {active, inactive}
            max_log = max(log_pos, log_neg)
            exp_pos = math.exp(log_pos - max_log)
            exp_neg = math.exp(log_neg - max_log)
            p_active = exp_pos / (exp_pos + exp_neg)
            topic_probs[label] = round(p_active, 4)

        return topic_probs

    def predict(self, tokens: List[str]) -> List[str]:
        probs = self.predict_proba(tokens)
        return [label for label, p in probs.items() if p >= self.threshold]

    def to_dict(self) -> dict:
        return {
            "labels": self.labels,
            "threshold": self.threshold,
            "alpha": self.alpha,
            "models": self.models
        }

    @classmethod
    def from_dict(cls, data: dict) -> "BinaryNBTopicClassifier":
        clf = cls(labels=data["labels"], threshold=data["threshold"], alpha=data["alpha"])
        clf.models = data["models"]
        return clf
