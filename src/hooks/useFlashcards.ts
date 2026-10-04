import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';

/** Rating posted to POST /Flashcards/{id}/review. */
export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

/** Wire shape of Nafea.Application.DTOs.FlashcardDto. */
export interface FlashcardDto {
  Id: string;
  Topic: string | null;
  Question: string;
  Answer: string;
  Hint: string | null;
  /** Set when this card was cloned from a deck; null for a card created directly. */
  DeckId: string | null;
  EaseFactor: number;
  IntervalDays: number;
  Repetitions: number;
  NextReview: string;
  LastReviewed: string | null;
  /** Derived server-side (Repetitions >= 3 && IntervalDays >= 21); never recompute this on the client. */
  IsMastered: boolean;
}

/**
 * A trainer's own study card (an SRCard), the single review-state record shared by the Flashcards deck
 * browser and the Spaced Repetition review screen. Both pages read/write this through the same query key
 * so an edit, import or review made on one page is immediately reflected on the other.
 */
export interface FlashcardCard {
  id: string;
  question: string;
  answer: string;
  hint: string | null;
  /** Null when the card has no topic; UI shows the localized "General". */
  topic: string | null;
  deckId: string | null;
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReview: Date;
  lastReviewed: Date | null;
  isMastered: boolean;
}

export const toFlashcardCard = (d: FlashcardDto): FlashcardCard => ({
  id: d.Id,
  question: d.Question,
  answer: d.Answer,
  hint: d.Hint || null,
  topic: d.Topic || null,
  deckId: d.DeckId || null,
  interval: d.IntervalDays,
  easeFactor: Number(d.EaseFactor),
  repetitions: d.Repetitions,
  nextReview: new Date(d.NextReview),
  lastReviewed: d.LastReviewed ? new Date(d.LastReviewed) : null,
  isMastered: d.IsMastered,
});

export const flashcardKeys = {
  list: (userId?: string) => ['flashcards', userId] as const,
};

/** The signed-in trainer's own review cards (SRCards), scheduling included. Shared by Flashcards.tsx and SpacedRepetition.tsx. */
export const useFlashcardsQuery = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: flashcardKeys.list(user?.Id),
    queryFn: async () => (await api.get<FlashcardDto[]>('/Flashcards')).data.map(toFlashcardCard),
    enabled: !!user,
  });
};

const useInvalidateFlashcards = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: flashcardKeys.list(user?.Id) });
};

export interface FlashcardSave {
  question: string;
  answer: string;
  topic?: string | null;
  hint?: string | null;
}

export const useCreateFlashcard = () => {
  const invalidate = useInvalidateFlashcards();
  return useMutation({
    mutationFn: async (body: FlashcardSave) =>
      toFlashcardCard(
        (
          await api.post<FlashcardDto>('/Flashcards', {
            Question: body.question,
            Answer: body.answer,
            Topic: body.topic?.trim() || null,
            Hint: body.hint?.trim() || null,
          })
        ).data
      ),
    onSuccess: invalidate,
  });
};

/** PUT /Flashcards/{id}: edits question/answer/topic/hint only; scheduling fields are untouched. */
export const useUpdateFlashcard = () => {
  const invalidate = useInvalidateFlashcards();
  return useMutation({
    mutationFn: async ({ id, ...body }: FlashcardSave & { id: string }) =>
      toFlashcardCard(
        (
          await api.put<FlashcardDto>(`/Flashcards/${id}`, {
            Question: body.question,
            Answer: body.answer,
            Topic: body.topic?.trim() || null,
            Hint: body.hint?.trim() || null,
          })
        ).data
      ),
    onSuccess: invalidate,
  });
};

export const useDeleteFlashcard = () => {
  const invalidate = useInvalidateFlashcards();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/Flashcards/${id}`);
    },
    onSuccess: invalidate,
  });
};

/** POST /Flashcards/{id}/review: the server owns the SM-2 schedule; the response replaces this card in the shared cache. */
export const useReviewFlashcard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: FlashcardRating }) =>
      toFlashcardCard((await api.post<FlashcardDto>(`/Flashcards/${id}/review`, { Rating: rating })).data),
    onSuccess: (updated) => {
      queryClient.setQueryData<FlashcardCard[]>(flashcardKeys.list(user?.Id), (prev) =>
        (prev ?? []).map((c) => (c.id === updated.id ? updated : c))
      );
    },
  });
};

export const useGenerateFlashcards = () => {
  const invalidate = useInvalidateFlashcards();
  return useMutation({
    mutationFn: async ({ topic, count }: { topic: string; count?: number }) =>
      (await api.post<FlashcardDto[]>('/Flashcards/generate', { Topic: topic, Count: count ?? 8 })).data.map(toFlashcardCard),
    onSuccess: invalidate,
  });
};

export const useExplainFlashcard = () =>
  useMutation({
    mutationFn: async (id: string) => (await api.post<{ Explanation: string; Generator: string }>(`/Flashcards/${id}/explain`)).data,
  });
