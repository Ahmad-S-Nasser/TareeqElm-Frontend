import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api, { getApiError } from '@/lib/api';
import i18n from '@/i18n';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Course {
  Id: string;
  InstructorId: string;
  Title: string;
  Description: string | null;
  Category: string | null;
  Level: string | null;
  DurationHours: number | null;
  LessonsCount: number;
  ImageUrl: string | null;
  Status: 'Draft' | 'Published' | 'Archived';
  IsFeatured: boolean;
  InstructorName?: string | null;
  EnrolledCount?: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface Enrollment {
  Id: string;
  TrainerId: string;
  CourseId: string;
  EnrolledAt: string;
  CompletedAt: string | null;
  ProgressPercentage: number;
}

export interface EnrollmentWithCourse extends Enrollment {
  Course: Course;
}

export interface CourseWithEnrollment extends Course {
  Enrollment?: Enrollment;
  EnrollmentCount?: number;
}

export const useCourses = () => {
  const [courses, setCourses] = useState<CourseWithEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, role } = useAuth();
  const { toast } = useToast();

  const fetchPublishedCourses = useCallback(async () => {
    setLoading(true);
    try {
      // The server only returns courses the caller may see; ask it for the published catalog.
      const response = await api.get('/Courses', { params: { status: 'Published' } });
      setCourses(response.data as CourseWithEnrollment[]);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast({
        title: i18n.t('courses:toast.errorTitle'),
        description: i18n.t('courses:toast.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchInstructorCourses = useCallback(async () => {
    if (!user || (role !== 'instructor' && role !== 'admin')) return;

    setLoading(true);
    try {
      // The server returns only the caller's own courses (all statuses).
      const response = await api.get('/Courses/mine');
      setCourses(response.data as CourseWithEnrollment[]);
    } catch (error) {
      console.error('Error fetching instructor courses:', error);
      toast({
        title: i18n.t('courses:toast.errorTitle'),
        description: i18n.t('courses:toast.loadMineFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, role, toast]);

  const fetchEnrolledCourses = useCallback(async () => {
    if (!user || role !== 'applicant') return;

    setLoading(true);
    try {
      const response = await api.get('/Enrollments/me');
      const enrollments = response.data as EnrollmentWithCourse[];

      const enrolledCourses = enrollments.map(e => ({
        ...e.Course,
        Enrollment: {
          Id: e.Id,
          TrainerId: e.TrainerId,
          CourseId: e.CourseId,
          EnrolledAt: e.EnrolledAt,
          CompletedAt: e.CompletedAt,
          ProgressPercentage: e.ProgressPercentage,
        }
      }));

      setCourses(enrolledCourses as CourseWithEnrollment[]);
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      toast({
        title: i18n.t('courses:toast.errorTitle'),
        description: i18n.t('courses:toast.loadEnrolledFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, role, toast]);

  const enrollInCourse = async (courseId: string, courseTitle?: string | null) => {
    if (!user) {
      toast({
        title: i18n.t('courses:toast.notAuthenticated'),
        description: i18n.t('courses:toast.loginToEnroll'),
        variant: 'destructive',
      });
      return { error: new Error('Not authenticated') };
    }

    try {
      // The server takes the trainer from the sign-in token.
      await api.post('/Enrollments', { CourseId: courseId });

      toast({
        title: i18n.t('courses:toast.enrolled'),
        description: courseTitle
          ? i18n.t('courses:toast.enrolledIn', { course: courseTitle })
          : i18n.t('courses:toast.enrolledDesc'),
      });

      fetchPublishedCourses();
      return { error: null };
    } catch (error: unknown) {
      // 409 = already enrolled: not a failure from the trainer's point of view.
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast({ title: i18n.t('courses:toast.alreadyEnrolled'),
          description: courseTitle
            ? i18n.t('courses:toast.alreadyEnrolledIn', { course: courseTitle })
            : i18n.t('courses:toast.alreadyEnrolledDesc'), });
        return { error: null };
      }
      toast({
        title: i18n.t('courses:toast.enrollFailed'),
        description: getApiError(error, i18n.t('courses:toast.enrollFailedDesc')),
        variant: 'destructive',
      });
      return { error: error as Error };
    }
  };

  const createCourse = async (courseData: Partial<Course>) => {
    if (!user || role !== 'instructor') return { error: new Error('Not authorized') };

    try {
      const response = await api.post('/Courses', {
        ...courseData,
        InstructorId: user.Id
      });
      
      toast({
        title: i18n.t('courses:toast.created'),
        description: i18n.t('courses:toast.createdDesc'),
      });

      return { error: null, data: response.data };
    } catch (error) {
      toast({
        title: i18n.t('courses:toast.errorTitle'),
        description: i18n.t('courses:toast.createFailed'),
        variant: 'destructive',
      });
      return { error: error as Error, data: null };
    }
  };

  const updateCourse = async (courseId: string, updates: Partial<Course>) => {
    try {
      await api.put(`/Courses/${courseId}`, updates);
      toast({
        title: i18n.t('courses:toast.updated'),
        description: i18n.t('courses:toast.updatedDesc'),
      });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const publishCourse = async (courseId: string) => updateCourse(courseId, { Status: 'Published' });
  const archiveCourse = async (courseId: string) => updateCourse(courseId, { Status: 'Archived' });

  const deleteCourse = async (courseId: string) => {
    try {
      await api.delete(`/Courses/${courseId}`);
      toast({
        title: i18n.t('courses:toast.deleted'),
        description: i18n.t('courses:toast.deletedDesc'),
      });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const getCourseById = useCallback(async (courseId: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/Courses/${courseId}`);
      return { course: response.data, error: null };
    } catch (error) {
      return { course: null, error: error as Error };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    courses,
    loading,
    fetchPublishedCourses,
    fetchInstructorCourses,
    fetchEnrolledCourses,
    enrollInCourse,
    createCourse,
    updateCourse,
    publishCourse,
    archiveCourse,
    deleteCourse,
    getCourseById,
  };
};
