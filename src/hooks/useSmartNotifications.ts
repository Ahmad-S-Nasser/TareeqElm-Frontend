import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { formatPercent } from '@/lib/format';
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
  const { t } = useTranslation('dashboard');
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
        title: t('notifications.items.flashcardsDue.title', { count: summary.CardsDue }),
        message: summary.CardsDue > 5
          ? t('notifications.items.flashcardsDue.messageMany', { count: summary.CardsDue })
          : t('notifications.items.flashcardsDue.messageFew', { count: summary.CardsDue }),
        priority: summary.CardsDue > 10 ? 'high' : 'medium', read: false, createdAt, actionUrl: '/spaced-repetition', actionLabel: t('notifications.items.flashcardsDue.action'),
      });
    }

    // 2. Weekly goal check
    if (trainer.SessionsThisWeek < 3 && now.getDay() >= 3) {
      list.push({ id: 'goal-unmet', type: 'goal_unmet', title: t('notifications.items.goalUnmet.title'), message: t('notifications.items.goalUnmet.message', { count: trainer.SessionsThisWeek, remaining: 5 - trainer.SessionsThisWeek }), priority: 'high', read: false, createdAt, actionUrl: '/time-blocking', actionLabel: t('notifications.items.goalUnmet.action') });
    }

    // 3. Focus drop
    if (trainer.SessionsThisWeek >= 3 && trainer.AvgFocusScore > 0 && trainer.AvgFocusScore < 60) {
      list.push({ id: 'focus-drop', type: 'focus_drop', title: t('notifications.items.focusDrop.title'), message: t('notifications.items.focusDrop.message'), priority: 'medium', read: false, createdAt, actionUrl: '/time-blocking', actionLabel: t('notifications.items.focusDrop.action') });
    }

    // 4. Streak risk: an active streak and no review activity yet today, late in the day
    if (summary.Streak > 0 && trainer.CardsReviewedToday === 0 && now.getHours() >= 18) {
      list.push({ id: 'streak-risk', type: 'streak_risk', title: t('notifications.items.streakRisk.title', { count: summary.Streak }), message: t('notifications.items.streakRisk.message'), priority: 'high', read: false, createdAt, actionUrl: '/courses', actionLabel: t('notifications.items.streakRisk.action') });
    }

    // 5. Morning planning
    if (now.getHours() < 10 && trainer.TimeBlocksToday === 0) {
      list.push({ id: 'morning-plan', type: 'study_reminder', title: t('notifications.items.morningPlan.title'), message: t('notifications.items.morningPlan.message'), priority: 'low', read: false, createdAt, actionUrl: '/time-blocking', actionLabel: t('notifications.items.morningPlan.action') });
    }

    // 6. Quiz performance
    if (summary.QuizzesTaken >= 2 && trainer.QuizAverage < 60) {
      list.push({ id: 'quiz-drop', type: 'focus_drop', title: t('notifications.items.quizDrop.title'), message: t('notifications.items.quizDrop.message', { score: formatPercent(trainer.QuizAverage) }), priority: 'medium', read: false, createdAt, actionUrl: '/ai-coach', actionLabel: t('notifications.items.quizDrop.action') });
    }

    return list;
  }, [user, summary, trainer, dataUpdatedAt, t]);

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
  const error = queryError ? getApiError(queryError, i18n.t('dashboard:notifications.loadFailed')) : null;

  const markRead = useCallback((id: string) => {
    setReadIds(prev => new Set(prev).add(id));
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(new Set(generated.map(n => n.id)));
  }, [generated]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, error, unreadCount, markRead, markAllRead, pushEnabled, requestPushPermission };
};
