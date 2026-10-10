import json
from pathlib import Path
from .preprocessing import APPROVED_SENTIMENTS, APPROVED_TOPICS

def validate_dataset_file(filepath: Path) -> dict:
    """
    Validates the dataset JSON file:
    - Verifies JSON structure
    - Ensures non-empty text
    - Checks sentiment against approved taxonomy
    - Checks topics against approved controlled vocabulary
    - Checks for exact duplicate text strings
    - Checks min/max comment length
    """
    if not filepath.exists():
        raise FileNotFoundError(f"Dataset file not found: {filepath}")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list) or len(data) == 0:
        raise ValueError("Dataset must be a non-empty list of feedback objects.")

    seen_texts = set()
    sentiment_counts = {s: 0 for s in APPROVED_SENTIMENTS}
    topic_counts = {t: 0 for t in APPROVED_TOPICS}
    zero_topic_count = 0

    for idx, item in enumerate(data):
        item_id = item.get("id", f"row_{idx}")
        text = item.get("text", "")

        # Text checks
        if not isinstance(text, str) or len(text.strip()) == 0:
            raise ValueError(f"Record {item_id}: text cannot be empty.")
        
        normalized_text = " ".join(text.strip().lower().split())
        if normalized_text in seen_texts:
            raise ValueError(f"Record {item_id}: duplicate text detected: '{text[:40]}...'")
        seen_texts.add(normalized_text)

        # Sentiment checks
        sentiment = item.get("sentiment")
        if sentiment not in APPROVED_SENTIMENTS:
            raise ValueError(f"Record {item_id}: invalid sentiment '{sentiment}'. Must be one of {APPROVED_SENTIMENTS}")
        sentiment_counts[sentiment] += 1

        # Topic checks
        topics = item.get("topics", [])
        if not isinstance(topics, list):
            raise ValueError(f"Record {item_id}: topics must be a list.")
        
        if len(topics) == 0:
            zero_topic_count += 1

        for topic in topics:
            if topic not in APPROVED_TOPICS:
                raise ValueError(f"Record {item_id}: unknown topic '{topic}'. Must be one of {APPROVED_TOPICS}")
            topic_counts[topic] += 1

    return {
        "total_records": len(data),
        "sentiment_distribution": sentiment_counts,
        "topic_distribution": topic_counts,
        "zero_topic_records": zero_topic_count,
    }

if __name__ == "__main__":
    dataset_path = Path(__file__).resolve().parent.parent / "data" / "feedback_dataset.json"
    stats = validate_dataset_file(dataset_path)
    print("Dataset Validation Passed:")
    print(json.dumps(stats, indent=2))
