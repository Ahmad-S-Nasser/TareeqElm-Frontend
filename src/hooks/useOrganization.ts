import { useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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

    return {
        loading,
        getDashboardStats,
        getDepartments,
        getInstructors,
        getTrainers,
        getTerms
    };
};
