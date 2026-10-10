from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Dict, Optional, Literal

ApprovedSentimentType = Literal["positive", "neutral", "negative"]

ApprovedTopicType = Literal[
    "teaching_clarity",
    "teaching_pace",
    "practical_examples",
    "doubt_handling",
    "engagement",
    "assignments",
    "course_content"
]

class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(
        ...,
        description="Raw student feedback comment to analyze. Must be non-empty.",
        min_length=1,
        max_length=5000
    )

    @field_validator("text")
    @classmethod
    def validate_non_whitespace(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Feedback text cannot be empty or purely whitespace.")
        return stripped


class SentimentResult(BaseModel):
    label: ApprovedSentimentType
    confidence: float = Field(..., ge=0.0, le=1.0)
    probabilities: Optional[Dict[str, float]] = None


class TopicResult(BaseModel):
    label: ApprovedTopicType
    confidence: float = Field(..., ge=0.0, le=1.0)


class AnalyzeResponse(BaseModel):
    sentiment: SentimentResult
    topics: List[TopicResult]
    modelVersion: str


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    model_status: str
    sentiment_model_version: str
    topic_model_version: str
    dataset_version: str


class ReadinessResponse(BaseModel):
    status: str
    ready: bool
    model_version: str
    timestamp: str


class ErrorDetail(BaseModel):
    error: str
    detail: Optional[str] = None
    timestamp: str
