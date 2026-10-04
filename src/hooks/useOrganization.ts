import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { OrganizationKind } from '@/hooks/useOrganizationsAdmin';

/** `OrganizationProfileDto` — the caller's own tenant (GET /api/Organization/profile). */
export interface OrganizationProfile {
    Id: string;
    Name: string;
    LogoUrl: string | null;
    Kind: OrganizationKind;
    /** Code a Trainee enters at signup to join this org immediately, no approval needed. */
    JoinCode: string;
}

/**
 * The signed-in user's own organization and its `Kind`. The API answers 204 (no tenant) for Admin, which becomes
 * `null` here. Only a `School` turns on academic years and grades.
 */
export const useOrganizationProfile = () => {
    const { user } = useAuth();
    const query = useQuery({
        queryKey: ['organization-profile', user?.Id ?? ''],
        queryFn: async () => {
            const res = await api.get<OrganizationProfile | ''>('/Organization/profile');
            return res.status === 204 || !res.data ? null : res.data;
        },
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
    const kind = query.data?.Kind;
    return { ...query, profile: query.data ?? null, kind, isSchool: kind === 'School' };
};

/** POST /api/Organization/join-code/regenerate — invalidates the old code immediately. */
export const useRegenerateJoinCode = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    return useMutation({
        mutationFn: async () => (await api.post<{ joinCode: string }>('/Organization/join-code/regenerate')).data.joinCode,
        onSuccess: (joinCode) => {
            queryClient.setQueryData(['organization-profile', user?.Id ?? ''], (current: OrganizationProfile | null | undefined) =>
                current ? { ...current, JoinCode: joinCode } : current);
        },
    });
};

export const useOrganization = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const getDashboardStats = async () => {
        setLoading(true);
        try {
            const response = await api.get('/Organization/stats');
            return response.data;
        } catch (error) {
            console.error('Error fetching organization stats:', error);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const getDepartments = async () => {
        setLoading(true);
        try {
            const response = await api.get('/Organization/departments');
            return response.data;
        } catch (error) {
            console.error('Error fetching departments:', error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const getInstructors = async () => {
        setLoading(true);
        try {
            const response = await api.get('/Organization/instructors');
            return response.data;
        } catch (error) {
            console.error('Error fetching instructors:', error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const getTrainers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/Organization/trainers');
            return response.data;
        } catch (error) {
            console.error('Error fetching trainers:', error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const getTerms = async () => {
        setLoading(true);
        try {
            const response = await api.get('/Organization/terms');
            return response.data;
        } catch (error) {
            console.error('Error fetching academic terms:', error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const getProfile = async (): Promise<OrganizationProfile | null> => {
        try {
            const response = await api.get<OrganizationProfile | ''>('/Organization/profile');
            return response.status === 204 || !response.data ? null : response.data;
        } catch (error) {
            console.error('Error fetching organization profile:', error);
            return null;
        }
    };

    return {
        loading,
        getProfile,
        getDashboardStats,
        getDepartments,
        getInstructors,
        getTrainers,
        getTerms
    };
};
