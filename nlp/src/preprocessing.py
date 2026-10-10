import re
import unicodedata

# Contractions mapping common in student reviews
CONTRACTIONS = {
    "can't": "cannot",
    "won't": "will not",
    "n't": " not",
    "'re": " are",
    "'s": " is",
    "'d": " would",
    "'ll": " will",
    "'t": " not",
    "'ve": " have",
    "'m": " am",
}

# Approved Controlled Taxonomies
APPROVED_SENTIMENTS = {"positive", "neutral", "negative"}

APPROVED_TOPICS = [
    "teaching_clarity",
    "teaching_pace",
    "practical_examples",
    "doubt_handling",
    "engagement",
    "assignments",
    "course_content",
]

def expand_contractions(text: str) -> str:
    """Expands common English contractions to preserve negative polarity."""
    text_lower = text.lower()
    for contraction, expansion in CONTRACTIONS.items():
        text_lower = text_lower.replace(contraction, expansion)
    return text_lower

def preprocess_text(text: str) -> str:
    """
    Cleans and normalizes text for classical TF-IDF models:
    - Unicode normalization (NFKC)
    - Contraction expansion
    - Replaces consecutive punctuation (e.g. '????' -> '?')
    - Preserves negation tokens ('not', 'no', 'never', 'cannot')
    - Normalizes excessive whitespace
    """
    if not text or not isinstance(text, str):
        return ""

    # 1. Unicode normalization
    text = unicodedata.normalize("NFKC", text)

    # 2. Lowercase and expand contractions
    text = expand_contractions(text)

    # 3. Collapse repeated punctuation
    text = re.sub(r'([!?.])\1+', r'\1', text)

    # 4. Remove special non-alphanumeric characters, keeping standard punctuation
    text = re.sub(r'[^a-z0-9\s.,!?]', ' ', text)

    # 5. Collapse excessive whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    return text
