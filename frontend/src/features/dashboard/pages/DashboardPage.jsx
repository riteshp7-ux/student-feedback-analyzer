import React, { useState, useEffect, useCallback } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import OverviewSection from '../components/OverviewSection';
import PerformanceSection from '../components/PerformanceSection';
import TopicsSection from '../components/TopicsSection';
import EvidenceSection from '../components/EvidenceSection';
import { fetchProfessorOfferings, fetchDashboardData, fetchEvidenceComments } from '../api/dashboardApi';

export default function DashboardPage({ onNavigateHome }) {
  const [offerings, setOfferings] = useState([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [offeringsError, setOfferingsError] = useState(null);

  // Dashboard Aggregates (Levels 1 - 3)
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);

  // Evidence Comments (Level 4)
  const [commentsData, setCommentsData] = useState({ comments: [], pagination: {} });
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Fetch assigned offerings on mount
  const loadOfferings = useCallback(async () => {
    setIsLoadingOfferings(true);
    setOfferingsError(null);
    try {
      const data = await fetchProfessorOfferings();
      setOfferings(data);
      if (data.length > 0) {
        // Default to first active offering or first offering in list
        const defaultOffering = data.find((o) => o.isActive) || data[0];
        setSelectedOfferingId(defaultOffering.id);
      }
    } catch (err) {
      setOfferingsError(err.message || 'Failed to retrieve assigned course offerings.');
    } finally {
      setIsLoadingOfferings(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  // 2. Fetch dashboard metrics when selectedOfferingId changes
  const loadDashboard = useCallback(async (offeringId) => {
    if (!offeringId) return;
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      const data = await fetchDashboardData(offeringId);
      setDashboardData(data);
    } catch (err) {
      setDashboardError(
        err.status === 403
          ? 'You are not authorized to view analytics for this course offering.'
          : err.message || 'Failed to load dashboard analytics.'
      );
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOfferingId) {
      loadDashboard(selectedOfferingId);
      // Reset evidence filters when switching course offerings
      setSelectedTopic(null);
      setSelectedSentiment(null);
      setCurrentPage(1);
    }
  }, [selectedOfferingId, loadDashboard]);

  // 3. Fetch evidence comments when offering, topic, sentiment, or page changes
  const loadComments = useCallback(async (offeringId, page, topic, sentiment) => {
    if (!offeringId) return;
    setIsLoadingComments(true);
    try {
      const data = await fetchEvidenceComments(offeringId, {
        page,
        pageSize: 15,
        topic: topic || undefined,
        sentiment: sentiment || undefined,
      });
      setCommentsData(data);
    } catch (err) {
      // If privacy threshold is not met, evidence returns 200 with empty comments
      setCommentsData({ comments: [], pagination: {} });
    } finally {
      setIsLoadingComments(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOfferingId && dashboardData?.privacyThresholdMet) {
      loadComments(selectedOfferingId, currentPage, selectedTopic, selectedSentiment);
    } else {
      setCommentsData({ comments: [], pagination: {} });
    }
  }, [selectedOfferingId, dashboardData?.privacyThresholdMet, currentPage, selectedTopic, selectedSentiment, loadComments]);

  const handleSelectOffering = (id) => {
    setSelectedOfferingId(id);
  };

  const handleTopicFilter = (topicKey) => {
    setSelectedTopic(topicKey);
    setCurrentPage(1);
  };

  const handleSentimentFilter = (sentiment) => {
    setSelectedSentiment(sentiment);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  if (isLoadingOfferings) {
    return (
      <div className="dashboard-container">
        <DashboardHeader onNavigateHome={onNavigateHome} />
        <main className="dashboard-main">
          <div className="dashboard-loading-state" role="status">
            <span className="spinner"></span>
            <p>Loading course offerings...</p>
          </div>
        </main>
      </div>
    );
  }

  if (offeringsError) {
    return (
      <div className="dashboard-container">
        <DashboardHeader onNavigateHome={onNavigateHome} />
        <main className="dashboard-main">
          <div className="banner banner-error" role="alert">
            <span className="banner-icon">!</span>
            <div className="banner-content">
              <p className="banner-message">{offeringsError}</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadOfferings}
                style={{ marginTop: '8px' }}
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (offerings.length === 0) {
    return (
      <div className="dashboard-container">
        <DashboardHeader onNavigateHome={onNavigateHome} />
        <main className="dashboard-main">
          <div className="dashboard-empty-card" role="status">
            <h2>No Assigned Course Offerings</h2>
            <p>You are not currently assigned as instructor for any course offerings.</p>
          </div>
        </main>
      </div>
    );
  }

  const currentOffering = offerings.find((o) => o.id === selectedOfferingId) || offerings[0];

  return (
    <div className="dashboard-container">
      <DashboardHeader
        offerings={offerings}
        selectedOfferingId={selectedOfferingId}
        onSelectOffering={handleSelectOffering}
        onNavigateHome={onNavigateHome}
      />

      <main className="dashboard-main">
        {/* Course Context Banner */}
        <div className="course-context-bar">
          <div className="context-left">
            <span className="context-code mono">{currentOffering.courseCode}</span>
            <h1 className="context-title">{currentOffering.courseTitle}</h1>
          </div>
          <div className="context-meta">
            <span className="context-pill">{currentOffering.term}</span>
            <span className={`status-pill ${currentOffering.isActive ? 'pill-active' : 'pill-archived'}`}>
              {currentOffering.isActive ? 'Active Feedback Window' : 'Past Term / Archived'}
            </span>
          </div>
        </div>

        {isLoadingDashboard ? (
          <div className="dashboard-loading-state" role="status">
            <span className="spinner"></span>
            <p>Aggregating course feedback and NLP patterns...</p>
          </div>
        ) : dashboardError ? (
          <div className="banner banner-error" role="alert">
            <span className="banner-icon">!</span>
            <div className="banner-content">
              <p className="banner-message">{dashboardError}</p>
            </div>
          </div>
        ) : dashboardData ? (
          <div className="dashboard-content-stack">
            {/* Level 1: Overall State */}
            <OverviewSection
              overall={dashboardData.overall}
              privacyThresholdMet={dashboardData.privacyThresholdMet}
              message={dashboardData.message}
            />

            {/* Level 2: Structured Teaching Dimensions (Rendered only when N >= 5) */}
            {dashboardData.privacyThresholdMet && (
              <PerformanceSection performance={dashboardData.performance} />
            )}

            {/* Level 3: Recurring Topics & Sentiment (Rendered only when N >= 5) */}
            {dashboardData.privacyThresholdMet && (
              <TopicsSection
                topics={dashboardData.topics}
                selectedTopicKey={selectedTopic}
                onSelectTopic={handleTopicFilter}
              />
            )}

            {/* Level 4: Anonymous Written Feedback Evidence (Rendered only when N >= 5) */}
            {dashboardData.privacyThresholdMet && (
              <EvidenceSection
                comments={commentsData.comments}
                pagination={commentsData.pagination}
                selectedTopic={selectedTopic}
                selectedSentiment={selectedSentiment}
                onTopicChange={handleTopicFilter}
                onSentimentChange={handleSentimentFilter}
                onPageChange={handlePageChange}
                isLoading={isLoadingComments}
              />
            )}
          </div>
        ) : null}
      </main>

      <footer className="dashboard-footer">
        <p className="footer-note">
          Student Feedback Analyzer • Faculty Analytics Portal • Academic Minor Project
        </p>
      </footer>
    </div>
  );
}
