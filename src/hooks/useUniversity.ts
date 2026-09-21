import { useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export const useUniversity = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const getDashboardStats = async () => {
        setLoading(true);
        try {
            const response = await api.get('/University/stats');
            return response.data;
        } catch (error) {
            console.error('Error fetching university stats:', error);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const getDepartments = async () => {
        setLoading(true);
        try {
            const response = await api.get('/University/departments');
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
            const response = await api.get('/University/instructors');
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
            const response = await api.get('/University/trainers');
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
            const response = await api.get('/University/terms');
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
