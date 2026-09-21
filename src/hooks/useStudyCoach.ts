import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import api, { getApiError } from '@/lib/api';
import { TrainerData, useTrainerStatsQuery } from './useTrainerApi';
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
        title: "AI Coach Error",
        description: getApiError(e, "Failed to get response from AI Coach"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, trainerData, toast]);

  const generateInsights = useCallback(async (mode: string) => {
    const prompts: Record<string, string> = {
      insights: "Analyze my learning data and give me personalized study insights.",
      recommendations: "Based on my study patterns, what should I improve?",
      weekly_plan: "Create a personalized weekly study plan for me.",
      weak_topics: "What are my weakest topics and how should I improve them?",
      motivation: "Give me a motivational update on my progress.",
    };
    await sendMessage(prompts[mode] || prompts.insights, mode);
  }, [sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, trainerData, dataLoading, sendMessage, generateInsights, clearMessages };
};
