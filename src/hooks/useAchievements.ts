import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { getApiError } from '@/lib/api';
import { useActivitySummaryQuery, useTrainerStatsQuery } from './useTrainerApi';

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  requirement: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  category: 'streak' | 'study' | 'mastery' | 'productivity';
  xp: number;
}

interface AchievementStats {
  streak: number;
  totalStudyHours: number;
  lessonsCompleted: number;
  quizzesPassed: number;
  cardsReviewed: number;
  perfectQuizzes: number;
  studySessions: number;
  coursesEnrolled: number;
  avgQuizScore: number;
  timeBlocksCreated: number;
  totalCards: number;
}

export interface LevelInfo {
  level: number;
  title: string;
  currentXP: number;
  xpForNext: number;
  totalXP: number;
}

const XP_PER_TIER = { bronze: 50, silver: 100, gold: 200, platinum: 500 };

const LEVELS = [
  { level: 1, titleKey: 'beginner', xpThreshold: 0 },
  { level: 2, titleKey: 'learner', xpThreshold: 100 },
  { level: 3, titleKey: 'activeTrainer', xpThreshold: 250 },
  { level: 5, titleKey: 'focusedTrainer', xpThreshold: 500 },
  { level: 7, titleKey: 'dedicatedScholar', xpThreshold: 900 },
  { level: 10, titleKey: 'knowledgeSeeker', xpThreshold: 1500 },
  { level: 15, titleKey: 'expertLearner', xpThreshold: 2500 },
  { level: 20, titleKey: 'studyMaster', xpThreshold: 4000 },
];

const achievementDefs = [
  // Streak
  { id: 'streak-3', icon: '🔥', tier: 'bronze' as const, cat: 'streak' as const, check: (s: AchievementStats) => s.streak >= 3, progress: (s: AchievementStats) => Math.min(100, (s.streak / 3) * 100) },
  { id: 'streak-7', icon: '🔥', tier: 'silver' as const, cat: 'streak' as const, check: (s: AchievementStats) => s.streak >= 7, progress: (s: AchievementStats) => Math.min(100, (s.streak / 7) * 100) },
  { id: 'streak-14', icon: '💪', tier: 'gold' as const, cat: 'streak' as const, check: (s: AchievementStats) => s.streak >= 14, progress: (s: AchievementStats) => Math.min(100, (s.streak / 14) * 100) },
  { id: 'streak-30', icon: '👑', tier: 'platinum' as const, cat: 'streak' as const, check: (s: AchievementStats) => s.streak >= 30, progress: (s: AchievementStats) => Math.min(100, (s.streak / 30) * 100) },
  // Study hours
  { id: 'hours-10', icon: '📚', tier: 'bronze' as const, cat: 'study' as const, check: (s: AchievementStats) => s.totalStudyHours >= 10, progress: (s: AchievementStats) => Math.min(100, (s.totalStudyHours / 10) * 100) },
  { id: 'hours-30', icon: '📖', tier: 'silver' as const, cat: 'study' as const, check: (s: AchievementStats) => s.totalStudyHours >= 30, progress: (s: AchievementStats) => Math.min(100, (s.totalStudyHours / 30) * 100) },
  { id: 'hours-100', icon: '🏆', tier: 'gold' as const, cat: 'study' as const, check: (s: AchievementStats) => s.totalStudyHours >= 100, progress: (s: AchievementStats) => Math.min(100, (s.totalStudyHours / 100) * 100) },
  // Mastery
  { id: 'lessons-10', icon: '✅', tier: 'bronze' as const, cat: 'mastery' as const, check: (s: AchievementStats) => s.lessonsCompleted >= 10, progress: (s: AchievementStats) => Math.min(100, (s.lessonsCompleted / 10) * 100) },
  { id: 'lessons-50', icon: '🎓', tier: 'silver' as const, cat: 'mastery' as const, check: (s: AchievementStats) => s.lessonsCompleted >= 50, progress: (s: AchievementStats) => Math.min(100, (s.lessonsCompleted / 50) * 100) },
  { id: 'cards-50', icon: '🧠', tier: 'bronze' as const, cat: 'mastery' as const, check: (s: AchievementStats) => s.totalCards >= 50, progress: (s: AchievementStats) => Math.min(100, (s.totalCards / 50) * 100) },
  { id: 'cards-100', icon: '🧠', tier: 'silver' as const, cat: 'mastery' as const, check: (s: AchievementStats) => s.cardsReviewed >= 100, progress: (s: AchievementStats) => Math.min(100, (s.cardsReviewed / 100) * 100) },
  { id: 'quiz-ace', icon: '💯', tier: 'gold' as const, cat: 'mastery' as const, check: (s: AchievementStats) => s.perfectQuizzes >= 1, progress: (s: AchievementStats) => s.perfectQuizzes >= 1 ? 100 : Math.min(99, s.avgQuizScore) },
  // Productivity
  { id: 'deep-work', icon: '🎯', tier: 'gold' as const, cat: 'productivity' as const, check: (s: AchievementStats) => s.studySessions >= 5, progress: (s: AchievementStats) => Math.min(100, (s.studySessions / 5) * 100) },
  { id: 'multi-course', icon: '🌟', tier: 'silver' as const, cat: 'productivity' as const, check: (s: AchievementStats) => s.coursesEnrolled >= 3, progress: (s: AchievementStats) => Math.min(100, (s.coursesEnrolled / 3) * 100) },
  { id: 'planner', icon: '📅', tier: 'bronze' as const, cat: 'productivity' as const, check: (s: AchievementStats) => s.timeBlocksCreated >= 10, progress: (s: AchievementStats) => Math.min(100, (s.timeBlocksCreated / 10) * 100) },
  { id: 'planner-pro', icon: '🗓️', tier: 'silver' as const, cat: 'productivity' as const, check: (s: AchievementStats) => s.timeBlocksCreated >= 50, progress: (s: AchievementStats) => Math.min(100, (s.timeBlocksCreated / 50) * 100) },
];

export const useAchievements = () => {
  const { user } = useAuth();
  const { t } = useTranslation('dashboard');
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);
  const summaryQuery = useActivitySummaryQuery();
  const statsQuery = useTrainerStatsQuery();

  const summary = summaryQuery.data;
  const trainer = statsQuery.data;
  const stats: AchievementStats | null = useMemo(() => {
    if (!summary || !trainer) return null;
    return {
      streak: summary.Streak,
      totalStudyHours: Math.round((summary.TotalStudySeconds / 3600) * 10) / 10,
      lessonsCompleted: summary.LessonsCompleted,
      quizzesPassed: summary.QuizzesPassed,
      cardsReviewed: summary.CardsReviewed,
      perfectQuizzes: summary.PerfectQuizzes,
      studySessions: trainer.DeepWorkSessions,
      coursesEnrolled: summary.CoursesEnrolled,
      avgQuizScore: Math.round(trainer.QuizAverage),
      timeBlocksCreated: summary.TimeBlocksPlanned,
      totalCards: summary.CardsCreated,
    };
  }, [summary, trainer]);

  const loading = !!user && (summaryQuery.isLoading || statsQuery.isLoading);
  const queryError = summaryQuery.error || statsQuery.error;
  const error = queryError ? getApiError(queryError, i18n.t('dashboard:achievements.loadFailed')) : null;

  const achievements: Achievement[] = useMemo(() => {
    if (!stats) return [];
    return achievementDefs.map(def => ({
      id: def.id,
      icon: def.icon,
      title: t(`achievements.items.${def.id}.title`),
      description: t(`achievements.items.${def.id}.desc`),
      requirement: t(`achievements.items.${def.id}.req`),
      tier: def.tier,
      unlocked: def.check(stats),
      progress: Math.round(def.progress(stats)),
      category: def.cat,
      xp: XP_PER_TIER[def.tier],
    }));
  }, [stats, t]);

  // XP & Level system
  const { totalXP, levelInfo } = useMemo(() => {
    const earned = achievements.filter(a => a.unlocked);
    const totalXP = earned.reduce((sum, a) => sum + a.xp, 0);

    let currentLevel = LEVELS[0];
    let nextLevel = LEVELS[1];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalXP >= LEVELS[i].xpThreshold) {
        currentLevel = LEVELS[i];
        nextLevel = LEVELS[i + 1] || { ...LEVELS[i], xpThreshold: LEVELS[i].xpThreshold + 1000 };
        break;
      }
    }

    const levelInfo: LevelInfo = {
      level: currentLevel.level,
      title: t(`achievements.levels.${currentLevel.titleKey}`),
      currentXP: totalXP - currentLevel.xpThreshold,
      xpForNext: nextLevel.xpThreshold - currentLevel.xpThreshold,
      totalXP,
    };

    return { totalXP, levelInfo };
  }, [achievements, t]);

  // Track newly unlocked
  useEffect(() => {
    if (!user) return;
    const key = `achievements_${user.Id}`;
    if (achievements.length === 0) return;
    let prev: string[] = [];
    try {
      prev = JSON.parse(localStorage.getItem(key) || '[]') as string[];
    } catch {
      prev = [];
    }
    const currentUnlocked = achievements.filter(a => a.unlocked).map(a => a.id);
    const newOnes = currentUnlocked.filter(id => !prev.includes(id));
    if (newOnes.length > 0) {
      setNewlyUnlocked(newOnes);
      try {
        localStorage.setItem(key, JSON.stringify(currentUnlocked));
      } catch {
        // storage unavailable: the toast simply shows again next time
      }
    }
  }, [achievements, user]);

  const dismissNewlyUnlocked = useCallback(() => setNewlyUnlocked([]), []);

  const earned = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  return { achievements, earned, locked, loading, error, stats, newlyUnlocked, dismissNewlyUnlocked, totalXP, levelInfo };
};
