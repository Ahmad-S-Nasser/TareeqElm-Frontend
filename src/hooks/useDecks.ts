import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from './useAuth';
import { flashcardKeys } from './useFlashcards';

/** Personal (a trainer's own) or Instructor (published to a course's enrolled trainers). */
export type DeckKind = 'Personal' | 'Instructor';
export type DeckVisibility = 'Private' | 'Published';

export interface Deck {
  Id: string;
  Title: string;
  Description: string | null;
  CourseId: string | null;
  CourseTitle: string | null;
  OwnerId: string;
  OwnerName: string | null;
  Kind: DeckKind;
  Visibility: DeckVisibility;
  CardCount: number;
  CreatedAt: string;
}

export interface DeckCard {
  Id: string;
  DeckId: string;
  Question: string;
  Answer: string;
  Hint: string | null;
  CreatedAt: string;
}

export interface DeckCardSave {
  Question: string;
  Answer: string;
  Hint?: string | null;
}

export interface AddToMyCardsResult {
  Added: number;
  AlreadyOwned: number;
  Total: number;
}

export interface DeckImportResult {
  Imported: number;
  Skipped: number;
  Total: number;
}

export interface DeckFilters {
  courseId?: string;
  kind?: DeckKind;
}

export const deckKeys = {
  all: (userId?: string) => ['decks', userId] as const,
  list: (userId?: string, filters: DeckFilters = {}) => ['decks', userId, filters.courseId ?? '', filters.kind ?? ''] as const,
  detail: (id?: string) => ['decks', 'detail', id] as const,
  cards: (id?: string) => ['decks', id, 'cards'] as const,
};

/** GET /api/decks?courseId=&kind=: the caller's own decks plus published Instructor decks for courses they're enrolled in. */
export const useDecksQuery = (filters: DeckFilters = {}) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: deckKeys.list(user?.Id, filters),
    queryFn: async () =>
      (
        await api.get<Deck[]>('/decks', {
          params: { courseId: filters.courseId || undefined, kind: filters.kind || undefined },
        })
      ).data,
    enabled: !!user,
  });
};

export const useDeckQuery = (id?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: deckKeys.detail(id),
    queryFn: async () => (await api.get<Deck>(`/decks/${id}`)).data,
    enabled: !!user && !!id,
  });
};

const useInvalidateDecks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: deckKeys.all(user?.Id) });
};

export interface DeckSave {
  title: string;
  description?: string | null;
}

/** POST /api/decks: always creates a Personal deck owned by the caller. */
export const useCreatePersonalDeck = () => {
  const invalidate = useInvalidateDecks();
  return useMutation({
    mutationFn: async (body: DeckSave) =>
      (
        await api.post<Deck>('/decks', {
          Title: body.title.trim(),
          Description: body.description?.trim() || null,
        })
      ).data,
    onSuccess: invalidate,
  });
};

export interface InstructorDeckSave extends DeckSave {
  courseId: string;
  visibility?: DeckVisibility;
}

/** POST /api/decks/instructor: always creates an Instructor deck for a course the caller teaches (Admin: any course). */
export const useCreateInstructorDeck = () => {
  const invalidate = useInvalidateDecks();
  return useMutation({
    mutationFn: async (body: InstructorDeckSave) =>
      (
        await api.post<Deck>('/decks/instructor', {
          Title: body.title.trim(),
          Description: body.description?.trim() || null,
          CourseId: body.courseId,
          Visibility: body.visibility,
        })
      ).data,
    onSuccess: invalidate,
  });
};

export const useUpdateDeck = () => {
  const invalidate = useInvalidateDecks();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<DeckSave> & { id: string; visibility?: DeckVisibility }) =>
      (
        await api.put<Deck>(`/decks/${id}`, {
          Title: body.title?.trim() || undefined,
          Description: body.description === undefined ? undefined : body.description?.trim() || null,
          Visibility: body.visibility,
        })
      ).data,
    onSuccess: invalidate,
  });
};

export const useDeleteDeck = () => {
  const invalidate = useInvalidateDecks();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/decks/${id}`);
    },
    onSuccess: invalidate,
  });
};

// ---------- deck cards ----------

export const useDeckCardsQuery = (deckId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: deckKeys.cards(deckId),
    queryFn: async () => (await api.get<DeckCard[]>(`/decks/${deckId}/cards`)).data,
    enabled: !!user && !!deckId,
  });
};

const useInvalidateDeckCards = (deckId?: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => {
    queryClient.invalidateQueries({ queryKey: deckKeys.cards(deckId) });
    queryClient.invalidateQueries({ queryKey: deckKeys.list(user?.Id) });
  };
};

export const useAddDeckCard = (deckId?: string) => {
  const invalidate = useInvalidateDeckCards(deckId);
  return useMutation({
    mutationFn: async (body: DeckCardSave) => (await api.post<DeckCard>(`/decks/${deckId}/cards`, body)).data,
    onSuccess: invalidate,
  });
};

export const useUpdateDeckCard = (deckId?: string) => {
  const invalidate = useInvalidateDeckCards(deckId);
  return useMutation({
    mutationFn: async ({ cardId, ...body }: DeckCardSave & { cardId: string }) =>
      (await api.put<DeckCard>(`/decks/${deckId}/cards/${cardId}`, body)).data,
    onSuccess: invalidate,
  });
};

export const useDeleteDeckCard = (deckId?: string) => {
  const invalidate = useInvalidateDeckCards(deckId);
  return useMutation({
    mutationFn: async (cardId: string) => {
      await api.delete(`/decks/${deckId}/cards/${cardId}`);
    },
    onSuccess: invalidate,
  });
};

/** multipart/form-data: .csv (question,answer,hint header) or .json (array of {question, answer, hint}). */
export const useImportDeckCards = (deckId?: string) => {
  const invalidate = useInvalidateDeckCards(deckId);
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return (await api.post<DeckImportResult>(`/decks/${deckId}/cards/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    },
    onSuccess: invalidate,
  });
};

/** GET /api/decks/{id}/cards/export?format=csv|json: downloads the file through the browser. */
export const useExportDeckCards = (deckId?: string) =>
  useMutation({
    mutationFn: async (format: 'csv' | 'json') => {
      const response = await api.get<Blob>(`/decks/${deckId}/cards/export`, { params: { format }, responseType: 'blob' });
      const disposition = response.headers['content-disposition'] as string | undefined;
      const match = disposition && /filename="?([^";]+)"?/.exec(disposition);
      const fileName = match?.[1] ?? `deck.${format}`;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });

// ---------- add to my cards ----------

/** Clones the deck's cards into the caller's own SRCards (idempotent); invalidates the shared Flashcards query so
 *  the new cards show up immediately on both the Flashcards page and Spaced Repetition. */
export const useAddToMyCards = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => (await api.post<AddToMyCardsResult>(`/decks/${deckId}/add-to-my-cards`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flashcardKeys.list(user?.Id) });
    },
  });
};
