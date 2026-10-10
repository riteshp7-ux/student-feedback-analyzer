import os
import json
import math
from pathlib import Path
from typing import List, Dict, Any, Tuple
from collections import defaultdict

from nlp.src.pipeline import FeedbackNLPBaseline
from nlp.src.preprocessing import APPROVED_SENTIMENTS, APPROVED_TOPICS

def calculate_multiclass_metrics(
    y_true: List[str],
    y_pred: List[str],
    classes: List[str]
) -> Dict[str, Any]:
    """Calculates multiclass Accuracy, Macro/Micro Precision, Recall, F1, and Confusion Matrix."""
    n_samples = len(y_true)
    class_to_idx = {c: i for i, c in enumerate(classes)}
    n_classes = len(classes)

    # Confusion matrix: rows = true, cols = pred
    cm = [[0 for _ in range(n_classes)] for _ in range(n_classes)]
    for t, p in zip(y_true, y_pred):
        cm[class_to_idx[t]][class_to_idx[p]] += 1

    per_class = {}
    macro_p, macro_r, macro_f1 = 0.0, 0.0, 0.0

    for c in classes:
        idx = class_to_idx[c]
        tp = cm[idx][idx]
        fp = sum(cm[r][idx] for r in range(n_classes) if r != idx)
        fn = sum(cm[idx][c_pred] for c_pred in range(n_classes) if c_pred != idx)
        total_true = sum(cm[idx])

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

        per_class[c] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "support": total_true
        }
        macro_p += prec
        macro_r += rec
        macro_f1 += f1

    macro_p /= n_classes
    macro_r /= n_classes
    macro_f1 /= n_classes

    accuracy = sum(cm[i][i] for i in range(n_classes)) / n_samples if n_samples > 0 else 0.0

    return {
        "accuracy": round(accuracy, 4),
        "macro_precision": round(macro_p, 4),
        "macro_recall": round(macro_r, 4),
        "macro_f1": round(macro_f1, 4),
        "per_class": per_class,
        "confusion_matrix": {
            "classes": classes,
            "matrix": cm
        }
    }


def calculate_multilabel_metrics(
    y_true: List[List[str]],
    y_pred: List[List[str]],
    labels: List[str]
) -> Dict[str, Any]:
    """Calculates multi-label binary metrics per topic, macro F1, Hamming loss, and subset accuracy."""
    n_samples = len(y_true)
    per_topic = {}
    macro_p, macro_r, macro_f1 = 0.0, 0.0, 0.0
    total_hamming_errors = 0
    exact_matches = 0

    for label in labels:
        tp, fp, fn, tn = 0, 0, 0, 0
        for true_set, pred_set in zip(y_true, y_pred):
            is_true = label in true_set
            is_pred = label in pred_set
            if is_true and is_pred:
                tp += 1
            elif not is_true and is_pred:
                fp += 1
            elif is_true and not is_pred:
                fn += 1
            else:
                tn += 1

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

        per_topic[label] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "support": tp + fn
        }
        macro_p += prec
        macro_r += rec
        macro_f1 += f1

    macro_p /= len(labels)
    macro_r /= len(labels)
    macro_f1 /= len(labels)

    # Hamming loss and exact match
    for true_set, pred_set in zip(y_true, y_pred):
        set_true = set(true_set)
        set_pred = set(pred_set)
        sym_diff = set_true.symmetric_difference(set_pred)
        total_hamming_errors += len(sym_diff)
        if set_true == set_pred:
            exact_matches += 1

    total_possible_labels = n_samples * len(labels)
    hamming_loss = total_hamming_errors / total_possible_labels if total_possible_labels > 0 else 0.0
    subset_accuracy = exact_matches / n_samples if n_samples > 0 else 0.0

    return {
        "subset_accuracy": round(subset_accuracy, 4),
        "hamming_loss": round(hamming_loss, 4),
        "macro_precision": round(macro_p, 4),
        "macro_recall": round(macro_r, 4),
        "macro_f1": round(macro_f1, 4),
        "per_topic": per_topic
    }


def run_evaluation(model_dir: str, split_name: str = "test") -> Dict[str, Any]:
    base_dir = Path(model_dir).resolve().parent.parent
    data_path = base_dir / "data" / f"{split_name}.json"

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    pipeline = FeedbackNLPBaseline.load(model_dir)

    y_true_sentiment = [s["sentiment"] for s in data]
    y_true_topics = [s["topics"] for s in data]

    predictions = pipeline.predict_batch([s["text"] for s in data])
    y_pred_sentiment = [p["sentiment"] for p in predictions]
    y_pred_topics = [p["topics"] for p in predictions]

    sentiment_metrics = calculate_multiclass_metrics(
        y_true_sentiment,
        y_pred_sentiment,
        sorted(list(APPROVED_SENTIMENTS))
    )

    topic_metrics = calculate_multilabel_metrics(
        y_true_topics,
        y_pred_topics,
        APPROVED_TOPICS
    )

    # Error analysis
    sentiment_errors = []
    for i, s in enumerate(data):
        if s["sentiment"] != predictions[i]["sentiment"]:
            sentiment_errors.append({
                "id": s.get("id", f"sample_{i}"),
                "text": s["text"],
                "true_sentiment": s["sentiment"],
                "predicted_sentiment": predictions[i]["sentiment"],
                "probabilities": predictions[i]["sentiment_probabilities"]
            })

    topic_errors = []
    for i, s in enumerate(data):
        true_set = set(s["topics"])
        pred_set = set(predictions[i]["topics"])
        if true_set != pred_set:
            topic_errors.append({
                "id": s.get("id", f"sample_{i}"),
                "text": s["text"],
                "true_topics": sorted(list(true_set)),
                "predicted_topics": sorted(list(pred_set)),
                "false_positives": sorted(list(pred_set - true_set)),
                "false_negatives": sorted(list(true_set - pred_set)),
                "scores": predictions[i]["topic_scores"]
            })

    report = {
        "split": split_name,
        "sample_count": len(data),
        "sentiment_metrics": sentiment_metrics,
        "topic_metrics": topic_metrics,
        "error_analysis": {
            "sentiment_error_count": len(sentiment_errors),
            "sentiment_errors": sentiment_errors,
            "topic_error_count": len(topic_errors),
            "topic_errors": topic_errors
        }
    }

    return report

if __name__ == "__main__":
    import sys
    model_dir = "nlp/artifacts/v1.0.0"
    report = run_evaluation(model_dir, "test")

    print("\n" + "="*60)
    print("STAGE 14 BASELINE EVALUATION REPORT (TEST SET)")
    print("="*60)
    print(f"Total Test Samples: {report['sample_count']}")

    print("\n--- SENTIMENT CLASSIFICATION ---")
    sm = report["sentiment_metrics"]
    print(f"Accuracy:        {sm['accuracy']:.4f}")
    print(f"Macro Precision: {sm['macro_precision']:.4f}")
    print(f"Macro Recall:    {sm['macro_recall']:.4f}")
    print(f"Macro F1:        {sm['macro_f1']:.4f}")
    print("\nPer-Class Sentiment:")
    for cls, met in sm["per_class"].items():
        print(f"  {cls:8s} -> Prec: {met['precision']:.4f}, Rec: {met['recall']:.4f}, F1: {met['f1_score']:.4f} (Support: {met['support']})")

    print("\nConfusion Matrix (Rows=True, Cols=Pred):")
    classes = sm["confusion_matrix"]["classes"]
    header = f"{'True/Pred':12s} " + " ".join(f"{c:>10s}" for c in classes)
    print(header)
    for r_idx, r_class in enumerate(classes):
        row_str = f"{r_class:12s} " + " ".join(f"{sm['confusion_matrix']['matrix'][r_idx][c_idx]:>10d}" for c_idx in range(len(classes)))
        print(row_str)

    print("\n--- MULTI-LABEL TOPIC CLASSIFICATION ---")
    tm = report["topic_metrics"]
    print(f"Subset Accuracy: {tm['subset_accuracy']:.4f}")
    print(f"Hamming Loss:    {tm['hamming_loss']:.4f}")
    print(f"Macro Precision: {tm['macro_precision']:.4f}")
    print(f"Macro Recall:    {tm['macro_recall']:.4f}")
    print(f"Macro F1:        {tm['macro_f1']:.4f}")
    print("\nPer-Topic Metrics:")
    for top, met in tm["per_topic"].items():
        print(f"  {top:20s} -> Prec: {met['precision']:.4f}, Rec: {met['recall']:.4f}, F1: {met['f1_score']:.4f} (Support: {met['support']})")

    print(f"\nSentiment Errors: {report['error_analysis']['sentiment_error_count']}")
    print(f"Topic Errors:     {report['error_analysis']['topic_error_count']}")

    metrics_out = Path(model_dir) / "metrics.json"
    with open(metrics_out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nEvaluation metrics and error logs saved to {metrics_out}")

