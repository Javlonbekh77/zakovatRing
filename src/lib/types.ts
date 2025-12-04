import type { Timestamp } from 'firebase/firestore';

export interface Team {
  name: string;
  score: number;
}

export interface AssignedLetterQuestion {
  question: string;
  answer: string;
}

export type RoundStatus = 'pending' | 'in_progress' | 'paused' | 'finished';

export interface Round {
  mainQuestion: string;
  mainAnswer: string;
  // Key is the letter itself + its index, e.g., "A_0", "L_0", "L_1"
  letterQuestions: Record<string, AssignedLetterQuestion>;
  status: RoundStatus;
  winner?: 'team1' | 'team2' | null;
  currentPoints: number;
  team1RevealedLetters: string[];
  team2RevealedLetters: string[];
}

export type GameStatus = 'lobby' | 'in_progress' | 'paused' | 'finished';

export interface Game {
  id: string;
  creatorId: string;
  rounds: Round[];
  currentRoundIndex: number;
  status: GameStatus;
  forfeitedBy?: 'team1' | 'team2';
  team1?: Team;
  team2?: Team;
  createdAt: Timestamp;
  lastActivityAt: Timestamp;
}

// This is a helper type for the form, not for Firestore
export type FormLetterQuestion = {
    letter: string;
    question: string;
    answer: string;
}
