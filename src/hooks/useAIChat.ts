import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import api, { getApiError } from '@/lib/api';
import { useTrainerStatsQuery } from './useTrainerApi';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    tab?: string;
}

export const useAIChat = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // Load history from localStorage on mount
    useEffect(() => {
        if (user) {
            const savedChat = localStorage.getItem(`chat_history_${user.Id}`);
            if (savedChat) {
                try {
                    setMessages(JSON.parse(savedChat));
                } catch (e) {
                    console.error("Failed to parse chat history", e);
                }
            } else {
                setMessages([
                    {
                        id: '1',
                        role: 'assistant',
                        content: 'Hi! I am your AI Tutor. I can help you understand complex topics, create study plans, or quiz you on your courses. What shall we learn today?',
                        timestamp: new Date().toISOString()
                    }
                ]);
            }
        }
    }, [user]);

    // Save history to localStorage whenever it changes
    useEffect(() => {
        if (user && messages.length > 0) {
            localStorage.setItem(`chat_history_${user.Id}`, JSON.stringify(messages));
        }
    }, [messages, user]);

    const { data: trainerData } = useTrainerStatsQuery();

    const sendMessage = useCallback(async (content: string, tab: string = "chat") => {
        if (!content.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content,
            timestamp: new Date().toISOString(),
            tab
        };

        const history = [...messages, userMessage];
        setMessages(history);
        setIsLoading(true);

        try {
            const response = await api.post<{ Content: string }>('/AI/coach', {
                Messages: history.map(m => ({ Role: m.role, Content: m.content })),
                TrainerData: trainerData ?? null,
                Mode: tab
            });

            const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response.data.Content,
                timestamp: new Date().toISOString(),
                tab
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            toast({
                title: "AI Tutor Error",
                description: getApiError(error, "Failed to get a response from the AI Tutor."),
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [messages, isLoading, trainerData, toast]);

    const clearHistory = useCallback(() => {
        setMessages([
            {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Chat history cleared. How else can I help you today?',
                timestamp: new Date().toISOString()
            }
        ]);
        if (user) {
            localStorage.removeItem(`chat_history_${user.Id}`);
        }
    }, [user]);

    return {
        messages,
        isLoading,
        sendMessage,
        clearHistory
    };
};
