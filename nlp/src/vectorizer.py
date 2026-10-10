import re
from typing import List, Dict, Set, Tuple, Optional

POSITIVE_LEXICON = {
    'great', 'good', 'excellent', 'clearly', 'clear', 'clarity', 'interactive', 'lively',
    'helpful', 'encouraging', 'well', 'prompt', 'reasonable', 'modern', 'depth', 'attentive',
    'enthusiasm', 'comfortable', 'best', 'engaging', 'enjoyed', 'approachable', 'patient',
    'supportive', 'relevant', 'organized', 'practical', 'hands-on', 'click', 'appreciate',
    'responsive', 'love', 'liked'
}

NEGATIVE_LEXICON = {
    'poor', 'bad', 'slow', 'fast', 'rushed', 'confusing', 'boring', 'dry', 'harsh',
    'unclear', 'monotone', 'skipped', 'heavy', 'frantic', 'hurry', 'hard', 'difficult',
    'useless', 'zero', 'disorganized', 'unresponsive', 'late', 'irrelevant', 'overload',
    'dull', 'annoyed', 'struggled', 'too', 'never', 'terrible', 'worst', 'opaque'
}

NEUTRAL_LEXICON = {
    'standard', 'average', 'normal', 'follows', 'routine', 'moderate', 'okay', 'schedule',
    'syllabus', 'prescribed', 'regular', 'quiet'
}

TOPIC_KEYWORDS = {
    'teaching_clarity': {'clear', 'clearly', 'clarity', 'explain', 'explains', 'explanation', 'understand', 'confusing', 'unclear', 'reading', 'monotone', 'concept', 'concepts'},
    'teaching_pace': {'pace', 'pacing', 'speed', 'fast', 'slow', 'rushed', 'hurry', 'rapid', 'comfortable', 'frantic', 'breath'},
    'practical_examples': {'example', 'examples', 'practical', 'hands-on', 'code', 'coding', 'demonstrations', 'demonstration', 'theory', 'real-world', 'board', 'implementation'},
    'doubt_handling': {'doubt', 'doubts', 'question', 'questions', 'query', 'queries', 'clearing', 'ignored', 'patient', 'responsive', 'answers', 'clarify'},
    'engagement': {'engaging', 'engagement', 'energy', 'enthusiasm', 'boring', 'interactive', 'discussion', 'attentive', 'monotone', 'dull', 'lively', 'atmosphere', 'hall'},
    'assignments': {'assignment', 'assignments', 'homework', 'grading', 'deadline', 'deadlines', 'rubric', 'submission', 'submissions', 'marks', 'quizzes'},
    'course_content': {'syllabus', 'curriculum', 'content', 'modern', 'outdated', 'structure', 'units', 'topics', 'prescribed', 'textbook'}
}

# Standard English stop words, excluding negations and sentiment modifiers
STOP_WORDS = {
    'a', 'about', 'above', 'after', 'again', 'against', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'by', 'could', 'did', 'do',
    'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
    'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in',
    'into', 'is', 'it', 'its', 'itself', 'me', 'my', 'myself', 'of', 'off', 'on', 'once', 'only', 'or',
    'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
    'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
    'these', 'they', 'this', 'those', 'through', 'to', 'under', 'until', 'up', 'was', 'we', 'were',
    'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
    'yours', 'yourself', 'yourselves'
}

NEGATION_TOKENS = {'not', 'no', 'never', 'cannot', 'neither', 'nor', 'zero', 'without'}

class FeatureExtractor:
    """
    Pure-Python Feature Extractor extracting:
    1. Filtered unigrams and bigrams
    2. Sentiment lexicon frequencies (positive, negative, neutral)
    3. Negation presence indicators
    4. Topic keyword overlap signals
    """
    def __init__(self, ngram_range: Tuple[int, int] = (1, 2)):
        self.ngram_range = ngram_range
        self.vocab_: Set[str] = set()

    def extract_tokens(self, cleaned_text: str) -> List[str]:
        words = re.findall(r"\b[a-z0-9_]+\b", cleaned_text.lower())
        tokens: List[str] = []

        # 1. Unigrams and n-grams
        min_n, max_n = self.ngram_range
        n_words = len(words)

        for n in range(min_n, max_n + 1):
            for i in range(n_words - n + 1):
                gram = words[i:i + n]
                if n == 1 and gram[0] in STOP_WORDS:
                    continue
                tokens.append(" ".join(gram))

        # 2. Sentiment Lexicon Indicators
        pos_hits = sum(1 for w in words if w in POSITIVE_LEXICON)
        neg_hits = sum(1 for w in words if w in NEGATIVE_LEXICON)
        neu_hits = sum(1 for w in words if w in NEUTRAL_LEXICON)

        if pos_hits > 0:
            tokens.extend(["__lex_pos__"] * min(pos_hits, 3))
        if neg_hits > 0:
            tokens.extend(["__lex_neg__"] * min(neg_hits, 3))
        if neu_hits > 0:
            tokens.extend(["__lex_neu__"] * min(neu_hits, 3))

        # 3. Negation presence
        if any(w in NEGATION_TOKENS for w in words):
            tokens.append("__has_negation__")

        return tokens

    def fit(self, cleaned_texts: List[str]) -> "FeatureExtractor":
        self.vocab_ = set()
        for text in cleaned_texts:
            tokens = self.extract_tokens(text)
            self.vocab_.update(tokens)
        return self

    def to_dict(self) -> dict:
        return {
            "ngram_range": list(self.ngram_range),
            "vocab": sorted(list(self.vocab_))
        }

    @classmethod
    def from_dict(cls, data: dict) -> "FeatureExtractor":
        fe = cls(ngram_range=tuple(data["ngram_range"]))
        fe.vocab_ = set(data["vocab"])
        return fe
