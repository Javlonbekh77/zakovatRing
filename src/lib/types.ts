// Keep Timestamp for server-side compatibility, but use string for client-side.
import type { Timestamp } from 'firebase/firestore';

export interface Team {
  name: string;
  score: number;
  lastAnswerCorrect?: boolean | null;
}

export interface LetterQuestion {
  question: string;
  answer: string;
}

export type GameStatus = 'lobby' | 'in_progress' | 'finished';

export interface Game {
  id: string;
  mainQuestion: string;
  mainAnswer: string;
  letterQuestions: Record<string, LetterQuestion>;
  revealedLetters: string[];
  status: GameStatus;
  team1?: Team;
  team2?: Team;
  winner?: 'team1' | 'team2' | 'draw';
  createdAt: Timestamp | string; // Can be a server timestamp or an ISO string
  gameStartedAt?: Timestamp | string;
  lastActivityAt: Timestamp | string;
  currentPoints: number;
  currentTurn?: 'team1' | 'team2';
}
