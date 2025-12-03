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
  createdAt: Timestamp;
  gameStartedAt?: Timestamp;
  lastActivityAt: Timestamp;
  currentPoints: number;
  currentTurn?: 'team1' | 'team2';
}
