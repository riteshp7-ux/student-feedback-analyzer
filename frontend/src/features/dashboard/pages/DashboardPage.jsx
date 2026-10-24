import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import OverviewSection from '../components/OverviewSection';
import PerformanceSection from '../components/PerformanceSection';
import TopicsSection from '../components/TopicsSection';
import EvidenceSection from '../components/EvidenceSection';
import { fetchProfessorOfferings, fetchDashboardData, fetchEvidenceComments } from '../api/dashboardApi';

export default function DashboardPage({ onNavigateHome, initialOfferingId = '' }) {
  const [offerings, setOfferings] = useState([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [offeringsError, setOfferingsError] = useState(null);
  const [routeOfferingError, setRouteOfferingError] = useState(null);

  // Dashboard Aggregates (Levels 1 - 3)
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);

  // Evidence Comments (Level 4)
  const [commentsData, setCommentsData] = useState({ comments: [], pagination: {} });
  const [commentsError, setCommentsError] = useState(null);
  const [activeInsightTab, setActiveInsightTab] = useState('performance');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const refreshInFlight = useRef(false);
  const insightTabRefs = useRef({});
  const dashboardRequestSequence = useRef(0);
  const commentsRequestSequence = useRef(0);
  const selectedOfferingRef = useRef(selectedOfferingId);
  selectedOfferingRef.current = selectedOfferingId;
  const evidenceFilterRef = useRef({ currentPage, selectedTopic, selectedSentiment });
  evidenceFilterRef.current = { currentPage, selectedTopic, selectedSentiment };

  // 1. Fetch assigned offerings on mount
  const loadOfferings = useCallback(async () => {
    setIsLoadingOfferings(true);
    setOfferingsError(null);
    try {
      const data = await fetchProfessorOfferings();
      setOfferings(data);
      if (data.length > 0) {
        const requestedOffering = initialOfferingId
          ? data.find((offering) => offering.id === initialOfferingId)
          : null;
        const defaultOffering = requestedOffering || data.find((o) => o.isActive) || data[0];
        setSelectedOfferingId(defaultOffering.id);
        setRouteOfferingError(
          initialOfferingId && !requestedOffering
            ? 'That course offering is not assigned to your account. Showing your current offering instead.'
            : null
        );
      }
    } catch (err) {
      setOfferingsError(err.message || 'Failed to retrieve assigned course offerings.');
    } finally {
      setIsLoadingOfferings(false);
    }
  }, [initialOfferingId]);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  // 2. Fetch dashboard metrics when selectedOfferingId changes
  const loadDashboard = useCallback(async (offeringId, requestSequence) => {
    if (!offeringId) return;
    setIsLoadingDashboard(true);
    setDashboardError(null);
    try {
      const data = await fetchDashboardData(offeringId);
      if (
        requestSequence !== dashboardRequestSequence.current ||
        selectedOfferingRef.current !== offeringId
      ) return;
      setDashboardData(data);
    } catch (err) {
      if (
        requestSequence !== dashboardRequestSequence.current ||
        selectedOfferingRef.current !== offeringId
      ) return;
      setDashboardError(
        err.status === 403
          ? 'You are not authorized to view analytics for this course offering.'
          : err.message || 'Failed to load dashboard analytics.'
      );
    } finally {
      if (
        requestSequence === dashboardRequestSequence.current &&
        selectedOfferingRef.current === offeringId
      ) setIsLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOfferingId) {
      const requestSequence = ++dashboardRequestSequence.current;
      loadDashboard(selectedOfferingId, requestSequence);
      // Reset evidence filters when switching course offerings
      setSelectedTopic(null);
      setSelectedSentiment(null);
      setCurrentPage(1);
      return () => {
        dashboardRequestSequence.current += 1;
      };
    }
    return undefined;
  }, [selectedOfferingId, loadDashboard]);

  // 3. Fetch evidence comments when offering, topic, sentiment, or page changes
  const loadComments = useCallback(async (offeringId, page, topic, sentiment) => {
    if (!offeringId) return;
    const requestSequence = ++commentsRequestSequence.current;
    setIsLoadingComments(true);
    setCommentsError(null);
    try {
      const data = await fetchEvidenceComments(offeringId, {
        page,
        pageSize: 15,
        topic: topic || undefined,
        sentiment: sentiment || undefined,
      });
      if (
        requestSequence !== commentsRequestSequence.current ||
        selectedOfferingRef.current !== offeringId
      ) return;
      setCommentsData(data);
    } catch (err) {
      if (
        requestSequence === commentsRequestSequence.current &&
        selectedOfferingRef.current === offeringId
      ) setCommentsError(err.message || 'Could not load student comments.');
    } finally {
      if (
        requestSequence === commentsRequestSequence.current &&
        selectedOfferingRef.current === offeringId
      ) setIsLoadingComments(false);
    }
  }, []);

  // Refresh the currently selected course without replacing the dashboard with
  // a full-page loading state. Polling lets faculty see submissions from other
  // devices while keeping the existing aggregates and filters intact.
  const refreshDashboard = useCallback(async () => {
    if (!selectedOfferingId || refreshInFlight.current) return;
    const offeringId = selectedOfferingId;
    const evidenceRequestSequence = ++commentsRequestSequence.current;
    const evidenceFilter = { currentPage, selectedTopic, selectedSentiment };
    refreshInFlight.current = true;
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const dashboard = await fetchDashboardData(offeringId);
      if (selectedOfferingRef.current !== offeringId) return;
      setDashboardData(dashboard);

      if (dashboard.privacyThresholdMet) {
        try {
          const evidence = await fetchEvidenceComments(offeringId, {
            page: currentPage,
            pageSize: 15,
            topic: selectedTopic || undefined,
            sentiment: selectedSentiment || undefined,
          });
          if (
            selectedOfferingRef.current !== offeringId ||
            commentsRequestSequence.current !== evidenceRequestSequence ||
            JSON.stringify(evidenceFilterRef.current) !== JSON.stringify(evidenceFilter)
          ) return;
          setCommentsData(evidence);
          setCommentsError(null);
        } catch (err) {
          if (
            selectedOfferingRef.current === offeringId &&
            commentsRequestSequence.current === evidenceRequestSequence &&
            JSON.stringify(evidenceFilterRef.current) === JSON.stringify(evidenceFilter)
          ) setCommentsError(err.message || 'Could not load student comments.');
        }
      } else {
        commentsRequestSequence.current += 1;
        setCommentsData({ comments: [], pagination: {}, privacySuppressed: false });
        setCommentsError(null);
      }
      setLastUpdatedAt(new Date());
    } catch (err) {
      if (selectedOfferingRef.current === offeringId) {
        setRefreshError(err.message || 'Could not refresh course feedback.');
      }
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }, [selectedOfferingId, currentPage, selectedTopic, selectedSentiment]);

  // Keep the visible dashboard current while it is open. Hidden tabs pause
  // polling; the Refresh button remains available for an immediate update.
  useEffect(() => {
    if (!selectedOfferingId) return undefined;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshDashboard();
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [selectedOfferingId, refreshDashboard]);

  useEffect(() => {
    if (selectedOfferingId && dashboardData?.privacyThresholdMet) {
      loadComments(selectedOfferingId, currentPage, selectedTopic, selectedSentiment);
    } else {
      commentsRequestSequence.current += 1;
      setCommentsData({ comments: [], pagination: {}, privacySuppressed: false });
      setCommentsError(null);
    }
    return () => {
      commentsRequestSequence.current += 1;
    };
  }, [selectedOfferingId, dashboardData?.privacyThresholdMet, currentPage, selectedTopic, selectedSentiment, loadComments]);

  const handleSelectOffering = (id) => {
    setRouteOfferingError(null);
    setSelectedOfferingId(id);
  };

  const handleTopicFilter = (topicKey) => {
    setSelectedTopic(topicKey);
    setCurrentPage(1);
    if (topicKey) setActiveInsightTab('comments');
  };

  const handleInsightTabKeyDown = (event, tabIndex) => {
    const tabKeys = ['performance', 'topics', 'comments'];
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (tabIndex + 1) % tabKeys.length;
    if (event.key === 'ArrowLeft') nextIndex = (tabIndex - 1 + tabKeys.length) % tabKeys.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabKeys.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      const nextTab = tabKeys[nextIndex];
      setActiveInsightTab(nextTab);
      insightTabRefs.current[nextTab]?.focus();
    }
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
        onNavigateHome={onNavigateHome}
      />

      <main className="dashboard-main">
        {routeOfferingError && (
          <div className="banner banner-info" role="status">
            <div className="banner-icon" aria-hidden="true">ℹ</div>
            <div className="banner-content">
              <p className="banner-message">{routeOfferingError}</p>
            </div>
          </div>
        )}
        {refreshError && dashboardData && (
          <div className="banner banner-error" role="status">
            <span className="banner-icon" aria-hidden="true">!</span>
            <div className="banner-content">
              <p className="banner-message">{refreshError} Showing the last loaded results.</p>
            </div>
          </div>
        )}
        {/* Course Context Banner */}
        <div className="course-context-bar">
          <div className="context-left">
            <label htmlFor="dashboard-offering-select" className="context-label">Course offering</label>
            <select
              id="dashboard-offering-select"
              className="select-input context-offering-select"
              value={selectedOfferingId}
              onChange={(event) => handleSelectOffering(event.target.value)}
            >
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.courseCode}: {offering.courseTitle}
                </option>
              ))}
            </select>
          </div>
          <div className="context-meta">
            {currentOffering.departmentName && (
              <span className="context-pill">{currentOffering.departmentName}</span>
            )}
            <span className={`status-pill ${currentOffering.isActive ? 'pill-active' : 'pill-archived'}`}>
              {currentOffering.isActive ? 'Active Feedback Window' : 'Past Term / Archived'}
            </span>
            <div className="dashboard-refresh-control">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={refreshDashboard}
                disabled={isRefreshing}
                aria-busy={isRefreshing}
              >
                {isRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <span className="dashboard-updated-at" role="status" aria-live="polite">
                {lastUpdatedAt
                  ? `Updated ${lastUpdatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'Auto-refreshes every 15 seconds'}
              </span>
            </div>
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
              performance={dashboardData.performance}
              privacyThresholdMet={dashboardData.privacyThresholdMet}
              commentInsightsAvailable={dashboardData.commentInsightsAvailable}
              commentInsightsMessage={dashboardData.commentInsightsMessage}
              message={dashboardData.message}
            />

            {dashboardData.privacyThresholdMet && (
              <div className="dashboard-insights">
                <div className="dashboard-tabs" role="tablist" aria-label="Feedback details">
                  {[
                    { id: 'performance', label: 'Performance', count: dashboardData.performance?.length || 0 },
                    { id: 'topics', label: 'Themes', count: dashboardData.topics?.length || 0 },
                    {
                      id: 'comments',
                      label: 'Comments',
                      count: commentsData.pagination?.totalComments || 0,
                      error: Boolean(commentsError),
                    },
                  ].map((tab, index) => (
                    <button
                      key={tab.id}
                      ref={(element) => { insightTabRefs.current[tab.id] = element; }}
                      id={`insights-tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={activeInsightTab === tab.id}
                      aria-controls="insights-panel"
                      tabIndex={activeInsightTab === tab.id ? 0 : -1}
                      className={`dashboard-tab ${activeInsightTab === tab.id ? 'is-active' : ''}`}
                      onClick={() => setActiveInsightTab(tab.id)}
                      onKeyDown={(event) => handleInsightTabKeyDown(event, index)}
                    >
                      {tab.label}
                      {tab.error ? (
                        <span className="dashboard-tab-error" aria-label="Comments failed to load">!</span>
                      ) : (
                        <span className="dashboard-tab-count">{tab.count}</span>
                      )}
                    </button>
                  ))}
                </div>
                <div
                  id="insights-panel"
                  className="dashboard-tab-panel"
                  role="tabpanel"
                  aria-labelledby={`insights-tab-${activeInsightTab}`}
                  tabIndex={0}
                >
                  {activeInsightTab === 'performance' && (
                    <PerformanceSection performance={dashboardData.performance} />
                  )}
                  {activeInsightTab === 'topics' && (
                    <TopicsSection
                      topics={dashboardData.topics}
                commentInsightsAvailable={dashboardData.commentInsightsAvailable}
                emptyMessage={dashboardData.commentInsightsMessage}
                      selectedTopicKey={selectedTopic}
                      onSelectTopic={handleTopicFilter}
                    />
                  )}
                  {activeInsightTab === 'comments' && (
                    <EvidenceSection
                      comments={commentsData.comments}
                      pagination={commentsData.pagination}
                privacySuppressed={commentsData.privacySuppressed}
                privacyMessage={commentsData.message}
                      selectedTopic={selectedTopic}
                      selectedSentiment={selectedSentiment}
                      onTopicChange={handleTopicFilter}
                      onSentimentChange={handleSentimentFilter}
                      onPageChange={handlePageChange}
                      isLoading={isLoadingComments}
                      error={commentsError}
                      onRetry={() => loadComments(selectedOfferingId, currentPage, selectedTopic, selectedSentiment)}
                    />
                  )}
                </div>
              </div>
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
