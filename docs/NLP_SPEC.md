# NLP Specification & Annotation Guidelines

## 1. Subsystem Purpose & Boundary

The NLP subsystem is an analytical component designed to transform unstructured free-text student feedback into aggregate signals for professors:
1. **Sentiment Analysis**: Quantifies the overall student sentiment into positive, neutral, or negative categories.
2. **Topic Categorization**: Detects which of the 7 predefined course aspects the comment addresses.

### Non-Goals & Strict Prohibitions
- **No Generative AI or LLMs**: No external OpenAI/Gemini/Anthropic API calls, prompt engineering, or non-deterministic text generation.
- **No Vector Databases or Embeddings**: No opaque vector embeddings or semantic distance clustering.
- **No Prescriptive Advice**: The system never generates teaching recommendations or judgment statements ("The professor should...").
- **No Direct Database Access**: The NLP pipeline operates purely in-memory as an analytical engine without database coupling.

---

## 2. Classification Tasks & Controlled Taxonomies

### 2.1 Sentiment Analysis (3-Class Single-Label)
- **Taxonomy**:
  - `positive`: Expresses satisfaction, appreciation, enthusiasm, or favorable evaluation of course aspects.
  - `neutral`: Primarily factual, descriptive, indifferent, or expresses standard curricular progression without affective judgment.
  - `negative`: Expresses dissatisfaction, frustration, difficulty caused by poor instruction, or critique.
- **Mixed Sentiment Handling Rule**:
  - If a comment contains both positive and negative aspects (e.g., *"Good explanations but pacing is too fast"*), annotators and the model assign the **primary dominant sentiment** indicated by the main clause and tone.
  - We do **not** introduce a fourth `mixed` sentiment class, adhering strictly to the 3-state enum specified in `feedback_sentiment_enum` (`positive`, `neutral`, `negative`).

### 2.2 Multi-Label Topic Categorization (7 Controlled Topics)
A single comment may discuss zero, one, or multiple course dimensions. The system supports multi-label binary relevance across the following 7 controlled topics:

1. `teaching_clarity`
   - **Inclusion**: Conceptual clarity, explanations, depth of explanation, slide reading vs teaching, board work clarity.
   - **Exclusion**: Speed/tempo of speaking (belongs to `teaching_pace`).
2. `teaching_pace`
   - **Inclusion**: Delivery speed, slide changing rate, syllabus rushing, insufficient time to take notes.
   - **Exclusion**: Difficulty of the underlying topic if speed is not mentioned.
3. `practical_examples`
   - **Inclusion**: Real-world applications, coding demonstrations, industry case studies, lab link-ups.
   - **Exclusion**: General assignments or homework problems.
4. `doubt_handling`
   - **Inclusion**: In-class question answering, office hours, query resolution, student encouragement to ask questions.
   - **Exclusion**: General lecture enthusiasm without interaction.
5. `engagement`
   - **Inclusion**: Classroom interaction, lecture energy, enthusiasm, student attentiveness, boring vs lively atmosphere.
   - **Exclusion**: Simple explanation clarity without emotional/interactive engagement.
6. `assignments`
   - **Inclusion**: Homework, lab problem sets, deadlines, grading fairness, rubrics, feedback on submissions.
   - **Exclusion**: In-class exam papers or course content choice.
7. `course_content`
   - **Inclusion**: Syllabus modernity, textbook alignment, curriculum structure, relevance of topics covered.
   - **Exclusion**: Teacher delivery style or teaching speed.

*Zero-Topic Rule*: Feedback that expresses general praise or complaint without specific pedagogical aspect evidence (e.g., *"Overall a great course."* or *"I didn't like this subject."*) receives an empty topic array (`[]`).

---

## 3. Annotation Guidelines

| Label | Meaning | Inclusion Criteria | Exclusion Criteria | Example |
| :--- | :--- | :--- | :--- | :--- |
| **`positive`** | Student is satisfied / praises teaching | Favorable words (`great`, `helpful`, `clear`, `enjoyed`) | Minor praise accompanied by devastating core critique | *"The examples made database indexing very clear."* |
| **`neutral`** | Descriptive, factual, or balanced | Factual statements, syllabus references, average ratings | Evident frustration or evident praise | *"The syllabus follows the prescribed university textbooks."* |
| **`negative`** | Dissatisfaction or pedagogical issue | Criticism, complaint, speed issues, lack of clarity | Factual observations without critique | *"Too fast and doubts are regularly skipped."* |

---

## 4. Model Output Contract

The pipeline returns a structured JSON-serializable dictionary:

```json
{
  "sentiment": "positive",
  "sentiment_score": 0.8842,
  "sentiment_probabilities": {
    "positive": 0.8842,
    "neutral": 0.0812,
    "negative": 0.0346
  },
  "topics": [
    "teaching_clarity",
    "practical_examples"
  ],
  "topic_scores": {
    "teaching_clarity": 0.8245,
    "teaching_pace": 0.0412,
    "practical_examples": 0.9124,
    "doubt_handling": 0.0150,
    "engagement": 0.1205,
    "assignments": 0.0089,
    "course_content": 0.0341
  }
}
```

---

## 5. Model Versioning & Artifacts

- **Model Version**: `v1.0.0`
- **Artifact Location**: `nlp/artifacts/v1.0.0/`
  - `feature_extractor.json`: Vocabulary and n-gram parameters.
  - `sentiment_model.json`: Multinomial Naive Bayes parameters.
  - `topics_model.json`: Binary Naive Bayes per-topic parameters.
  - `metrics.json`: Quantitative test metrics and full error analysis.
