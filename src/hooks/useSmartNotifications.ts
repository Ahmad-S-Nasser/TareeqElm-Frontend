import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { getApiError } from '@/lib/api';
import { useActivitySummaryQuery, useTrainerStatsQuery } from './useTrainerApi';

export interface SmartNotification {
  id: string;
  type: 'flashcards_due' | 'goal_unmet' | 'focus_drop' | 'streak_risk' | 'achievement' | 'study_reminder' | 'weekly_report';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
}

export const useSmartNotifications = () => {
  const { user } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setPushEnabled(granted);
    return granted;
  }, []);

  const sendPushNotification = useCallback((title: string, body: string) => {
    if (pushEnabled && 'Notification' in window && document.hidden) {
      new Notification(title, { body, icon: '/favicon.ico', badge: '/favicon.ico' });
    }
  }, [pushEnabled]);

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const pushedRef = useRef<Set<string>>(new Set());
  const REFRESH_MS = 5 * 60 * 1000;
  const summaryQuery = useActivitySummaryQuery();
  const statsQuery = useTrainerStatsQuery();
  const summary = summaryQuery.data;
  const trainer = statsQuery.data;
  const dataUpdatedAt = Math.max(summaryQuery.dataUpdatedAt, statsQuery.dataUpdatedAt);

  // Keep the underlying numbers fresh while the app is open.
  const { refetch: refetchSummary } = summaryQuery;
  const { refetch: refetchStats } = statsQuery;
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refetchSummary();
      refetchStats();
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [user, refetchSummary, refetchStats, REFRESH_MS]);

  const generated = useMemo<SmartNotification[]>(() => {
    if (!user || !summary || !trainer) return [];
    const list: SmartNotification[] = [];
    const now = new Date();
    const createdAt = new Date(dataUpdatedAt || Date.now()).toISOString();

    // 1. Flashcards due
    if (summary.CardsDue > 0) {
      list.push({
        id: 'flashcards-due', type: 'flashcards_due',
        title: `${summary.CardsDue} Flashcards Due`,
        message: summary.CardsDue > 5 ? `You have ${summary.CardsDue} flashcards waiting for review. Reviewing now prevents forgetting!` : `${summary.CardsDue} cards are ready for review. A quick session will strengthen your memory.`,
        priority: summary.CardsDue > 10 ? 'high' : 'medium', read: false, createdAt, actionUrl: '/spaced-repetition', actionLabel: 'Review Now',
      });
    }

    // 2. Weekly goal check
    if (trainer.SessionsThisWeek < 3 && now.getDay() >= 3) {
      list.push({ id: 'goal-unmet', type: 'goal_unmet', title: 'Weekly Study Goal at Risk', message: `Only ${trainer.SessionsThisWeek} study sessions this week. Try to fit in ${5 - trainer.SessionsThisWeek} more to stay on track.`, priority: 'high', read: false, createdAt, actionUrl: '/time-blocking', actionLabel: 'Plan Session' });
    }

    // 3. Focus drop
    if (trainer.SessionsThisWeek >= 3 && trainer.AvgFocusScore > 0 && trainer.AvgFocusScore < 60) {
      list.push({ id: 'focus-drop', type: 'focus_drop', title: 'Focus Score Dropping', message: 'Your recent study sessions have had a low focus score. Try the Pomodoro technique for longer, deeper focus.', priority: 'medium', read: false, createdAt, actionUrl: '/time-blocking', actionLabel: 'Start Pomodoro' });
    }

    // 4. Streak risk: an active streak and no review activity yet today, late in the day
    if (summary.Streak > 0 && trainer.CardsReviewedToday === 0 && now.getHours() >= 18) {
      list.push({ id: 'streak-risk', type: 'streak_risk', title: `🔥 ${summary.Streak}-Day Streak at Risk!`, message: 'Complete one lesson or review session today to keep your streak alive!', priority: 'high', read: false, createdAt, actionUrl: '/courses', actionLabel: 'Continue Learning' });
    }

    // 5. Morning planning
    if (now.getHours() < 10 && trainer.TimeBlocksToday === 0) {
      list.push({ id: 'morning-plan', type: 'study_reminder', title: 'Good Morning! Plan Your Day', message: 'Start your day right — create a study schedule to maximize productivity.', priority: 'low', read: false, createdAt, actionUrl: '/time-blocking', actionLabel: 'Plan Day' });
    }

    // 6. Quiz performance
    if (summary.QuizzesTaken >= 2 && trainer.QuizAverage < 60) {
      list.push({ id: 'quiz-drop', type: 'focus_drop', title: 'Quiz Scores Need Attention', message: `Your quiz average is ${Math.round(trainer.QuizAverage)}%. Consider reviewing weak topics with the AI Coach.`, priority: 'medium', read: false, createdAt, actionUrl: '/ai-coach', actionLabel: 'Get Help' });
    }

    return list;
  }, [user, summary, trainer, dataUpdatedAt]);

  const notifications = useMemo(
    () => generated.map(n => (readIds.has(n.id) ? { ...n, read: true } : n)),
    [generated, readIds]
  );

  // Browser push for the urgent ones, once each
  useEffect(() => {
    generated.forEach(n => {
      if (n.priority === 'high' && !pushedRef.current.has(n.id)) {
        pushedRef.current.add(n.id);
        sendPushNotification(n.title, n.message);
      }
    });
  }, [generated, sendPushNotification]);

  const loading = !!user && (summaryQuery.isLoading || statsQuery.isLoading);
  const queryError = summaryQuery.error || statsQuery.error;
  const error = queryError ? getApiError(queryError, 'Failed to load notifications.') : null;

  const markRead = useCallback((id: string) => {
    setReadIds(prev => new Set(prev).add(id));
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(new Set(generated.map(n => n.id)));
  }, [generated]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, error, unreadCount, markRead, markAllRead, pushEnabled, requestPushPermission };
};
