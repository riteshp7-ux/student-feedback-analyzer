import json
import random
from pathlib import Path
from collections import defaultdict

RANDOM_SEED = 42

def create_splits():
    random.seed(RANDOM_SEED)
    data_dir = Path(__file__).resolve().parent.parent / "data"
    input_file = data_dir / "feedback_dataset.json"

    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Group records by sentiment for stratified sampling
    by_sentiment = defaultdict(list)
    for item in data:
        by_sentiment[item["sentiment"]].append(item)

    train_data = []
    val_data = []
    test_data = []

    for sentiment, items in by_sentiment.items():
        random.shuffle(items)
        n = len(items)
        n_train = int(round(n * 0.70))
        n_val = int(round(n * 0.15))
        # remainder to test
        train_data.extend(items[:n_train])
        val_data.extend(items[n_train:n_train + n_val])
        test_data.extend(items[n_train + n_val:])

    # Shuffle splits
    random.shuffle(train_data)
    random.shuffle(val_data)
    random.shuffle(test_data)

    print(f"Stratified Split Created -> Train: {len(train_data)}, Val: {len(val_data)}, Test: {len(test_data)}")

    # Verify no data leakage
    train_texts = set(" ".join(item["text"].lower().split()) for item in train_data)
    val_texts = set(" ".join(item["text"].lower().split()) for item in val_data)
    test_texts = set(" ".join(item["text"].lower().split()) for item in test_data)

    assert not train_texts.intersection(val_texts), "Leakage between train and val!"
    assert not train_texts.intersection(test_texts), "Leakage between train and test!"
    assert not val_texts.intersection(test_texts), "Leakage between val and test!"

    # Save to disk
    with open(data_dir / "train.json", "w", encoding="utf-8") as f:
        json.dump(train_data, f, indent=2)
    with open(data_dir / "val.json", "w", encoding="utf-8") as f:
        json.dump(val_data, f, indent=2)
    with open(data_dir / "test.json", "w", encoding="utf-8") as f:
        json.dump(test_data, f, indent=2)

    print("Successfully saved train.json, val.json, and test.json with 0 data leakage.")

if __name__ == "__main__":
    create_splits()
