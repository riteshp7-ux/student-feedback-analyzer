import os
import json
from pathlib import Path
from nlp.src.pipeline import FeedbackNLPBaseline

def train_and_save():
    base_dir = Path(__file__).resolve().parent.parent
    train_path = base_dir / "data" / "train.json"
    val_path = base_dir / "data" / "val.json"
    artifact_dir = base_dir / "artifacts" / "v1.0.0"

    print(f"Loading training data from {train_path}...")
    with open(train_path, "r", encoding="utf-8") as f:
        train_data = json.load(f)

    print(f"Loading validation data from {val_path}...")
    with open(val_path, "r", encoding="utf-8") as f:
        val_data = json.load(f)

    print(f"Initializing and training FeedbackNLPBaseline on {len(train_data)} samples...")
    pipeline = FeedbackNLPBaseline()
    pipeline.fit(train_data)

    print(f"Vocabulary size: {len(pipeline.feature_extractor.vocab_)}")

    # Validation check
    val_correct_sentiment = 0
    val_correct_topics = 0
    for sample in val_data:
        pred = pipeline.predict_one(sample["text"])
        if pred["sentiment"] == sample["sentiment"]:
            val_correct_sentiment += 1
        if set(pred["topics"]) == set(sample["topics"]):
            val_correct_topics += 1

    val_acc = val_correct_sentiment / len(val_data)
    val_topic_acc = val_correct_topics / len(val_data)
    print(f"Validation Sentiment Accuracy: {val_acc:.4f} ({val_correct_sentiment}/{len(val_data)})")
    print(f"Validation Topic Exact Match: {val_topic_acc:.4f} ({val_correct_topics}/{len(val_data)})")

    print(f"Saving model artifacts to {artifact_dir}...")
    pipeline.save(str(artifact_dir))
    print("Model training and artifact serialization complete.")

if __name__ == "__main__":
    train_and_save()
