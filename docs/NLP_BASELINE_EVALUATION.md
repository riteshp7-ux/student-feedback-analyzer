# NLP Baseline Evaluation & Dataset Specification (Stage 14)

## 1. Overview & Objective

Stage 14 establishes the empirical foundation for the Student Feedback Analyzer's NLP subsystem. Following the architecture defined in Stage 8, the NLP component transforms unstructured student comments into structured, aggregatable signals for course instructors without relying on opaque, high-latency LLM dependencies.

This stage delivers:
1. **Task Definitions & Schema**: Formal definitions for 3-class sentiment and 7-class multi-label topic classification.
2. **Representative Academic Dataset**: 100 realistic, domain-specific student feedback samples reflecting actual engineering university teaching patterns.
3. **Data Splits & Leakage Prevention**: Verified stratified split (70% Train, 15% Validation, 15% Test) with strict data integrity validation.
4. **Text Preprocessing Pipeline**: Contraction expansion, punctuation normalization, and negation preservation.
5. **Pure-Python Baseline Classifiers**: Standalone, reproducible Multinomial and Binary Naive Bayes models with JSON serialization (immune to OS C-extension blocks).
6. **Quantitative Evaluation & Error Analysis**: Evaluation on the unseen test split with full confusion matrix and failure mode documentation.

---

## 2. Task Formulation & Approved Taxonomies

### 2.1 Sentiment Classification
- **Type**: Single-label 3-class classification.
- **Classes**: `negative`, `neutral`, `positive`.
- **Output**: Calibrated posterior probability distribution summing to $1.0$ and top predicted sentiment.
- **Edge Case Rule**: Empty text, pure punctuation, or non-informative noise falls back deterministically to `neutral` ($0.3333$ probability).

### 2.2 Multi-Label Topic Categorization
- **Type**: Multi-label binary classification across 7 controlled pedagogical topics.
- **Controlled Taxonomies**:
  1. `teaching_clarity` — Explanations, conceptual depth, slide reading vs teaching.
  2. `teaching_pace` — Lecture speed, syllabus rush, time allocation.
  3. `practical_examples` — Hands-on demos, real-world case studies, lab links.
  4. `doubt_handling` — Answering queries, responsiveness in and out of class.
  5. `engagement` — Student attention, interactive discussions, lecture energy.
  6. `assignments` — Homework load, deadline reasonableness, grading fairness.
  7. `course_content` — Syllabus relevance, textbook alignment, curriculum structure.
- **Fallback**: Comments with no specific pedagogical topic activate zero topics (`[]`).

---

## 3. Dataset Specification & Splits

### 3.1 Distribution
The dataset contains $N = 100$ verified student comments:
- **Sentiment Balance**: 42 Negative, 19 Neutral, 39 Positive.
- **Topic Coverage**: All 7 approved topics are represented across positive, neutral, and negative contexts.
- **Zero-Topic Samples**: 10 samples (10%) represent general feedback with no specific topic tag.

### 3.2 Stratified Splits
Splits were constructed using pure-Python stratified sampling to guarantee balanced sentiment distribution across splits while preventing data leakage:
- **Train ($N = 69$)**: 29 Negative, 13 Neutral, 27 Positive.
- **Validation ($N = 15$)**: 6 Negative, 3 Neutral, 6 Positive.
- **Test ($N = 16$)**: 7 Negative, 3 Neutral, 6 Positive.

Leakage verification confirmed:
- Zero ID overlap between train, val, and test.
- Zero raw text or normalized text overlap across splits.

---

## 4. Text Preprocessing & Feature Engineering

Implemented in [`nlp/src/preprocessing.py`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/src/preprocessing.py) and [`nlp/src/vectorizer.py`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/src/vectorizer.py):

1. **Unicode Normalization**: NFKC normalization to handle non-standard student inputs.
2. **Contraction Expansion**: Expands `can't` $\to$ `cannot`, `don't` $\to$ `do not`, `didn't` $\to$ `did not` to maintain explicit negation markers.
3. **Punctuation Compaction**: Replaces excessive punctuation (`paced!!!!!` $\to$ `paced!`) without stripping expressive cues.
4. **Selective Stopword Filtering**: Standard English stopwords are removed from unigram tokens, while preserving negation markers (`not`, `no`, `never`, `cannot`, `neither`, `nor`, `without`) and degree modifiers.
5. **N-Gram Representation**: Unigrams and bigrams capture phrases like `hands on`, `real world`, `too fast`, `not clear`.
6. **Lexical Domain Features**: Lexicon-assisted sentiment markers (`__lex_pos__`, `__lex_neg__`, `__lex_neu__`) and negation indicators (`__has_negation__`) provide out-of-vocabulary resilience.

---

## 5. Quantitative Evaluation Results (Test Set, $N = 16$)

> **Methodological caveat (read before citing these numbers).** All three splits (train/val/test) are drawn from the same hand-curated synthetic corpus in `nlp/src/generate_dataset.py`, written by the project authors. These metrics therefore measure *in-domain* performance against the authors' own phrasing distribution. They do **not** estimate accuracy on real student feedback, and no drift monitoring or real-world labeled evaluation set exists yet. Treat the figures below as a pipeline sanity check, not a validated quality claim.

Evaluated using [`nlp/src/evaluate.py`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/src/evaluate.py) on the held-out test split.

### 5.1 Sentiment Classification Performance

| Metric | Score |
| :--- | :---: |
| **Accuracy** | **81.25%** |
| **Macro Precision** | **80.24%** |
| **Macro Recall** | **84.13%** |
| **Macro F1** | **81.39%** |

#### Per-Class Performance:
| Sentiment Class | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: |
| `negative` | 0.8571 | 0.8571 | 0.8571 | 7 |
| `neutral` | 0.7500 | 1.0000 | 0.8571 | 3 |
| `positive` | 0.8000 | 0.6667 | 0.7273 | 6 |

#### 3x3 Sentiment Confusion Matrix:
| True \ Predicted | `negative` | `neutral` | `positive` | Total |
| :--- | :---: | :---: | :---: | :---: |
| **`negative`** | **6** | 0 | 1 | 7 |
| **`neutral`** | 0 | **3** | 0 | 3 |
| **`positive`** | 1 | 1 | **4** | 6 |
| **Total** | 7 | 4 | 5 | 16 |

### 5.2 Multi-Label Topic Classification Performance

| Metric | Score |
| :--- | :---: |
| **Subset Accuracy (Exact Match)** | **37.50%** |
| **Hamming Loss** | **0.1071** |
| **Macro Precision** | **64.29%** |
| **Macro Recall** | **75.00%** |
| **Macro F1** | **66.50%** |

#### Per-Topic Breakdown:
| Topic | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: |
| `teaching_clarity` | 0.6000 | 1.0000 | 0.7500 | 3 |
| `teaching_pace` | 1.0000 | 1.0000 | 1.0000 | 5 |
| `practical_examples` | 1.0000 | 1.0000 | 1.0000 | 3 |
| `doubt_handling` | 0.0000 | 0.0000 | 0.0000 | 1 |
| `engagement` | 0.5000 | 0.2500 | 0.3333 | 4 |
| `assignments` | 1.0000 | 1.0000 | 1.0000 | 1 |
| `course_content` | 0.4000 | 1.0000 | 0.5714 | 2 |

---

## 6. Qualitative Error Analysis & Failure Modes

Analysis of the 3 sentiment misclassifications and topic discrepancies revealed distinct failure modes:

1. **Compositional Negation vs. Keyword Priming**:
   - Sample `c007`: *"Concept clarity is lacking, sir just reads the bullet points from slides."*
   - True: `negative` | Predicted: `positive` ($P = 0.5351$)
   - *Cause*: The word `clarity` is a strong positive feature. The negation phrase `is lacking` was split, and `lacking` was out-of-vocabulary in the training set, causing the positive signal of `clarity` to overpower the subtle critique.
2. **Novel Academic Vocabulary in Positive Praise**:
   - Sample `c038`: *"Professor asks thought-provoking questions to spark discussion."*
   - True: `positive` | Predicted: `negative` ($P = 0.7715$)
   - *Cause*: Words `thought-provoking`, `spark`, and `discussion` did not appear in the 69 training samples. The token `questions` had high co-occurrence with complaints in the training set, biasing the output.
3. **Implicit vs. Explicit Doubt Handling**:
   - Sample `c053`: *"Pacing is too fast and doubts are regularly skipped during class."*
   - True: `['doubt_handling', 'teaching_pace']` | Predicted: `['teaching_pace']`
   - *Cause*: `pacing is too fast` carried overwhelming pace evidence ($P = 1.0$). `doubts are regularly skipped` scored $P = 0.0838$ because `skipped` was unobserved in the doubt-handling positive slice of the small training split.

---

## 7. Artifacts & Serialization

Model artifacts are serialized into standard JSON files inside [`nlp/artifacts/v1.0.0/`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/artifacts/v1.0.0):
- [`feature_extractor.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/artifacts/v1.0.0/feature_extractor.json): Vocabulary and n-gram configuration.
- [`sentiment_model.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/artifacts/v1.0.0/sentiment_model.json): Class frequencies, feature likelihood counts, smoothing parameters.
- [`topics_model.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/artifacts/v1.0.0/topics_model.json): Binary topic models, keyword priors, and decision thresholds.
- [`metrics.json`](file:///c:/Users/rites/OneDrive/Desktop/projects/NLP-sys-minor/nlp/artifacts/v1.0.0/metrics.json): Full evaluation metrics and structured error logs.

---

## 8. Verification & Test Suite

The test suite validates pipeline robustness, serialization fidelity, and deterministic fallbacks:
- `python -m unittest discover -s nlp/tests -p "test_*.py"`: **16/16 tests passing**.
- `npm --prefix backend test`: **32/32 backend tests passing**.
