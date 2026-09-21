import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import api, { getApiError } from '@/lib/api';
import { TrainerData, useTrainerStatsQuery } from './useTrainerApi';
import i18n from '@/i18n';
import { useToast } from './use-toast';

export interface CoachMessage {
  Id: string;
  Role: 'user' | 'assistant';
  Content: string;
}

export type { TrainerData };

export const useStudyCoach = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const statsQuery = useTrainerStatsQuery();
  const trainerData = statsQuery.data ?? null;
  const dataLoading = !!user && statsQuery.isLoading;

  const sendMessage = useCallback(async (content: string, mode: string = 'chat') => {
    if (!content.trim()) return;

    const userMsg: CoachMessage = { Id: crypto.randomUUID(), Role: 'user', Content: content };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const apiMessages = [...messages, userMsg].map(m => ({ Role: m.Role, Content: m.Content }));
      const response = await api.post<{ Content: string }>('/AI/coach', {
        Messages: apiMessages,
        TrainerData: trainerData,
        Mode: mode
      });

      const assistantMsg: CoachMessage = {
        Id: crypto.randomUUID(),
        Role: 'assistant',
        Content: response.data.Content
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      toast({
        title: i18n.t('dashboard:coach.errorTitle'),
        description: getApiError(e, i18n.t('dashboard:coach.errorFallback')),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, trainerData, toast]);

  const generateInsights = useCallback(async (mode: string) => {
    // The prompt is written in the active language so the coach answers in it.
    const known = ['insights', 'recommendations', 'weekly_plan', 'weak_topics', 'motivation'];
    const key = known.includes(mode) ? mode : 'insights';
    await sendMessage(i18n.t(`dashboard:coach.prompts.${key}`), mode);
  }, [sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, trainerData, dataLoading, sendMessage, generateInsights, clearMessages };
};
