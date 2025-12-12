import type { Timestamp } from 'firebase/firestore';

export interface Team {
  name: string;
  score: number;
  // Each team now tracks their own progress
  currentRoundIndex: number;
  // Revealed letters are now a record mapping round index to an array of letter keys
  revealedLetters: Record<number, string[]>;
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
}

export type GameStatus = 'lobby' | 'in_progress' | 'paused' | 'finished';

export interface Game {
  id: string;
  title?: string; // New optional title field
  creatorId: string;
  rounds: Round[];
  currentRoundIndex: number; // This can now be considered a "master" or spectator round index
  status: GameStatus;
  forfeitedBy?: 'team1' | 'team2';
  winner?: 'team1' | 'team2' | null;
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
