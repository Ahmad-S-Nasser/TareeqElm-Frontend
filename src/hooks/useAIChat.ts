import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './useAuth';
import i18n from '@/i18n';
import { useToast } from './use-toast';
import api, { getApiError } from '@/lib/api';
import { useTrainerStatsQuery } from './useTrainerApi';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    tab?: string;
    /** Localized system messages are stored as a kind and translated when read. */
    kind?: 'welcome' | 'cleared';
}

export const useAIChat = () => {
    const { t } = useTranslation('dashboard');
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
                        id: 'welcome',
                        role: 'assistant',
                        kind: 'welcome',
                        content: '',
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

    // System messages (welcome / cleared) follow the active language.
    const localized = useMemo(
        () =>
            messages.map(m => {
                if (m.kind === 'welcome' || m.id === '1' || m.id === 'welcome') return { ...m, content: t('tutor.welcome') };
                if (m.kind === 'cleared') return { ...m, content: t('tutor.cleared') };
                return m;
            }),
        [messages, t]
    );

    const sendMessage = useCallback(async (content: string, tab: string = "chat") => {
        if (!content.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content,
            timestamp: new Date().toISOString(),
            tab
        };

        const history = [...localized, userMessage];
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
                title: i18n.t('dashboard:tutor.errorTitle'),
                description: getApiError(error, i18n.t('dashboard:tutor.errorFallback')),
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }, [localized, isLoading, trainerData, toast]);

    const clearHistory = useCallback(() => {
        setMessages([
            {
                id: crypto.randomUUID(),
                role: 'assistant',
                kind: 'cleared',
                content: '',
                timestamp: new Date().toISOString()
            }
        ]);
        if (user) {
            localStorage.removeItem(`chat_history_${user.Id}`);
        }
    }, [user]);

    return {
        messages: localized,
        isLoading,
        sendMessage,
        clearHistory
    };
};
