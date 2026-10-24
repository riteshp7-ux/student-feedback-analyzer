import React, { useEffect, useRef, useState } from 'react';
import CourseSelector from './CourseSelector';
import RatingGroup from './RatingGroup';
import CommentField from './CommentField';
import SubmissionSuccess from './SubmissionSuccess';
import { submitStudentFeedback } from '../api/feedbackApi';

const RATING_DIMENSIONS = [
  {
    key: 'teachingClarity',
    title: 'Teaching Clarity',
    description: 'Were ideas explained clearly?',
  },
  {
    key: 'teachingPace',
    title: 'Teaching Pace',
    description: 'Was the pace right for learning?',
  },
  {
    key: 'doubtHandling',
    title: 'Doubt Handling',
    description: 'Were questions answered helpfully?',
  },
  {
    key: 'engagement',
    title: 'Student Engagement',
    description: 'Did class keep you engaged?',
  },
  {
    key: 'practicalExamples',
    title: 'Practical Examples & Applications',
    description: 'Were ideas supported with useful examples?',
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
  student,
  offerings = [],
  isLoadingCourses = false,
  courseError = null,
  onRetryCourses,
  onFeedbackSubmitted,
  initialOfferingId = '',
}) {
  const [courseOfferingId, setCourseOfferingId] = useState(initialOfferingId);
  const [ratings, setRatings] = useState(INITIAL_RATINGS);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [submitError, setSubmitError] = useState(null);
  const [submittedResult, setSubmittedResult] = useState(null);
  const idempotencyRequest = useRef(null);

  useEffect(() => {
    if (isLoadingCourses) return;
    setCourseOfferingId(
      initialOfferingId && offerings.some((offering) => offering.id === initialOfferingId)
        ? initialOfferingId
        : offerings.length === 1
        ? offerings[0].id
        : ''
    );
  }, [initialOfferingId, isLoadingCourses, offerings]);

  const selectedOffering = offerings.find((o) => o.id === courseOfferingId);
  const completedRatingCount = Object.values(ratings).filter((rating) => rating !== null).length;
  const isAlreadySubmitted = Boolean(selectedOffering?.hasSubmitted);

  const handleRatingChange = (key, value) => {
    if (isAlreadySubmitted) return;
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
    setSubmitError(null);
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
      nextErrors.courseOfferingId = 'Please select an enrolled course offering to evaluate.';
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
    if (status === 'submitting') return;
    setSubmitError(null);

    if (isAlreadySubmitted) {
      setSubmitError('You have already submitted feedback for this course offering.');
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const firstErrorKey = Object.keys(validationErrors)[0];
      const errorElement = document.getElementById(
        firstErrorKey === 'courseOfferingId'
          ? 'course-select'
          : firstErrorKey === 'comment'
          ? 'feedback-comment'
          : `${firstErrorKey}-1`
      );
      if (errorElement) {
        window.requestAnimationFrame(() => {
          errorElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
          errorElement.focus();
        });
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

    const fingerprint = JSON.stringify(payload);
    if (!idempotencyRequest.current || idempotencyRequest.current.fingerprint !== fingerprint) {
      idempotencyRequest.current = {
        fingerprint,
        key: window.crypto.randomUUID(),
      };
    }

    try {
      const response = await submitStudentFeedback({
        ...payload,
        idempotencyKey: idempotencyRequest.current.key,
      });
      idempotencyRequest.current = null;
      setSubmittedResult({
        feedbackId: response?.id || null,
        offering: selectedOffering,
        commentPending: Boolean(payload.comment),
      });
      setStatus('success');
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    } catch (err) {
      setStatus('error');
      setSubmitError(
        err.status === 403
          ? 'You are not enrolled in this course offering.'
          : err.status === 409
          ? 'You have already submitted feedback for this course offering.'
          : err.status === 401
          ? 'Authentication required. Please sign in with your student account.'
          : err.status === 400
          ? err.message || 'Validation failed. Please review your ratings.'
          : err.status === 422
          ? err.message || 'Please review the feedback form and try again.'
          : err.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : err.status === 404
          ? 'The selected course offering was not found or is closed for feedback.'
          : 'Unable to submit feedback at this time. Please check your connection and try again.'
      );
    }
  };

  const handleReset = () => {
    idempotencyRequest.current = null;
    setCourseOfferingId('');
    setRatings(INITIAL_RATINGS);
    setComment('');
    setErrors({});
    setStatus('idle');
    setSubmitError(null);
    setSubmittedResult(null);
    if (onFeedbackSubmitted) {
      onFeedbackSubmitted();
    }
  };

  if (status === 'success' && submittedResult) {
    return (
      <SubmissionSuccess
        feedbackId={submittedResult.feedbackId}
        courseOffering={submittedResult.offering}
        commentPending={submittedResult.commentPending}
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

      {!isLoadingCourses && initialOfferingId && offerings.length > 0 &&
        !offerings.some((offering) => offering.id === initialOfferingId) && (
          <div className="banner banner-warning" role="alert" style={{ marginTop: '0.75rem' }}>
            <div className="banner-icon" aria-hidden="true">!</div>
            <div className="banner-content">
              <h3 className="banner-title">Course Not Enrolled</h3>
              <p className="banner-message">
                You are not enrolled in the requested course offering. Please select one of your enrolled courses above.
              </p>
            </div>
          </div>
        )}

      {selectedOffering && isAlreadySubmitted && (
        <div className="banner banner-info" role="status" style={{ margin: '1rem 0' }}>
          <div className="banner-icon" aria-hidden="true">✓</div>
          <div className="banner-content">
            <h3 className="banner-title">Feedback Already Submitted</h3>
            <p className="banner-message">
              You have already submitted feedback for this course offering. In accordance with university policy, feedback cannot be edited or resubmitted.
            </p>
          </div>
        </div>
      )}

      {!isAlreadySubmitted && (
        <>
          <section className="ratings-section" aria-label="Structured Course Ratings">
            <div className="section-intro">
              <div>
                <h2 className="section-title">Rate the course</h2>
                <p className="section-subtitle">Choose one score for each area.</p>
              </div>
              <span className="rating-progress" role="status" aria-live="polite">
                {completedRatingCount} of {RATING_DIMENSIONS.length} rated
              </span>
            </div>

            <div className="rating-groups-list">
              <div className="rating-scale-row">
                <span aria-hidden="true" />
                <div className="rating-scale-legend" role="group" aria-label="Rating scale, from poor to excellent">
                  {['Poor', 'Fair', 'Satisfactory', 'Very good', 'Excellent'].map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>
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
        </>
      )}
    </form>
  );
}
