import React, { useState } from 'react';
import CourseSelector from './CourseSelector';
import RatingGroup from './RatingGroup';
import CommentField from './CommentField';
import SubmissionSuccess from './SubmissionSuccess';
import { submitStudentFeedback } from '../api/feedbackApi';

const RATING_DIMENSIONS = [
  {
    key: 'teachingClarity',
    title: 'Teaching Clarity',
    description: 'How clearly did the instructor present core concepts and explain complex topics?',
  },
  {
    key: 'teachingPace',
    title: 'Teaching Pace',
    description: 'Was the pace of instruction appropriate for absorbing and retaining the material?',
  },
  {
    key: 'doubtHandling',
    title: 'Doubt Handling',
    description: 'How responsive, thorough, and approachable was the instructor when addressing student questions?',
  },
  {
    key: 'engagement',
    title: 'Student Engagement',
    description: 'Did the lectures foster active attention, participation, and interest in the subject matter?',
  },
  {
    key: 'practicalExamples',
    title: 'Practical Examples & Applications',
    description: 'Were theoretical principles supported with effective real-world or coding examples?',
  },
];

const INITIAL_RATINGS = {
  teachingClarity: null,
  teachingPace: null,
  doubtHandling: null,
  engagement: null,
  practicalExamples: null,
};

export default function FeedbackForm({
  offerings = [],
  isLoadingCourses = false,
  courseError = null,
  onRetryCourses,
}) {
  const [courseOfferingId, setCourseOfferingId] = useState('');
  const [ratings, setRatings] = useState(INITIAL_RATINGS);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [submitError, setSubmitError] = useState(null);
  const [submittedResult, setSubmittedResult] = useState(null);

  const selectedOffering = offerings.find((o) => o.id === courseOfferingId);

  const handleRatingChange = (key, value) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleCourseChange = (id) => {
    setCourseOfferingId(id);
    if (errors.courseOfferingId) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.courseOfferingId;
        return next;
      });
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!courseOfferingId) {
      nextErrors.courseOfferingId = 'Please select a course offering to evaluate.';
    }

    RATING_DIMENSIONS.forEach((dim) => {
      const val = ratings[dim.key];
      if (val === null || val === undefined) {
        nextErrors[dim.key] = `Please provide a rating for ${dim.title}.`;
      } else if (typeof val !== 'number' || val < 1 || val > 5) {
        nextErrors[dim.key] = `Rating must be an integer between 1 and 5.`;
      }
    });

    if (comment && comment.length > 2000) {
      nextErrors.comment = 'Comments must not exceed 2,000 characters.';
    }

    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Find the first invalid element to focus or scroll to
      const firstErrorKey = Object.keys(validationErrors)[0];
      const errorElement = document.getElementById(
        firstErrorKey === 'courseOfferingId'
          ? 'course-select'
          : firstErrorKey === 'comment'
          ? 'feedback-comment'
          : `${firstErrorKey}-1`
      );
      if (errorElement) {
        errorElement.focus();
      }
      return;
    }

    setErrors({});
    setStatus('submitting');

    const payload = {
      courseOfferingId,
      ratings: {
        teachingClarity: Number(ratings.teachingClarity),
        teachingPace: Number(ratings.teachingPace),
        doubtHandling: Number(ratings.doubtHandling),
        engagement: Number(ratings.engagement),
        practicalExamples: Number(ratings.practicalExamples),
      },
      comment: comment.trim() === '' ? null : comment.trim(),
    };

    try {
      const response = await submitStudentFeedback(payload);
      setSubmittedResult({
        feedbackId: response?.id || 'SUBMISSION_RECORDED',
        offering: selectedOffering,
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      // Format calm, non-technical error message
      setSubmitError(
        err.status === 400
          ? err.message || 'Validation failed. Please review your ratings.'
          : err.status === 404
          ? 'The selected course offering was not found or is closed for feedback.'
          : 'Unable to submit feedback at this time. Please check your connection and try again.'
      );
    }
  };

  const handleReset = () => {
    setCourseOfferingId('');
    setRatings(INITIAL_RATINGS);
    setComment('');
    setErrors({});
    setStatus('idle');
    setSubmitError(null);
    setSubmittedResult(null);
  };

  if (status === 'success' && submittedResult) {
    return (
      <SubmissionSuccess
        feedbackId={submittedResult.feedbackId}
        courseOffering={submittedResult.offering}
        onReset={handleReset}
      />
    );
  }

  const isSubmitting = status === 'submitting';

  return (
    <form className="feedback-form" onSubmit={handleSubmit} noValidate>
      {submitError && (
        <div className="banner banner-error" role="alert">
          <div className="banner-icon" aria-hidden="true">!</div>
          <div className="banner-content">
            <h3 className="banner-title">Submission Error</h3>
            <p className="banner-message">{submitError}</p>
          </div>
        </div>
      )}

      {errors.courseOfferingId && (
        <div className="field-error-msg form-top-error" role="alert">
          {errors.courseOfferingId}
        </div>
      )}

      <CourseSelector
        offerings={offerings}
        selectedId={courseOfferingId}
        onChange={handleCourseChange}
        isLoading={isLoadingCourses}
        error={courseError}
        onRetry={onRetryCourses}
      />

      <section className="ratings-section" aria-label="Structured Course Ratings">
        <div className="section-intro">
          <h2 className="section-title">Course Evaluation Dimensions</h2>
          <p className="section-subtitle">
            Rate each aspect of the instructional experience on a scale of 1 (Poor) to 5 (Excellent).
          </p>
        </div>

        <div className="rating-groups-list">
          {RATING_DIMENSIONS.map((dim) => (
            <RatingGroup
              key={dim.key}
              id={dim.key}
              title={dim.title}
              description={dim.description}
              value={ratings[dim.key]}
              onChange={(val) => handleRatingChange(dim.key, val)}
              error={errors[dim.key]}
            />
          ))}
        </div>
      </section>

      <section className="comment-section" aria-label="Written Feedback">
        <CommentField
          value={comment}
          onChange={(val) => {
            setComment(val);
            if (errors.comment && val.length <= 2000) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.comment;
                return next;
              });
            }
          }}
          error={errors.comment}
        />
      </section>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary btn-submit"
          disabled={isSubmitting || isLoadingCourses || offerings.length === 0}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="spinner spinner-white" aria-hidden="true"></span>
              <span>Submitting Feedback...</span>
            </>
          ) : (
            'Submit Anonymous Feedback'
          )}
        </button>
      </div>
    </form>
  );
}
