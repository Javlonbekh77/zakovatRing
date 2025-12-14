import type { Timestamp } from 'firebase/firestore';

export interface Team {
  name: string;
  score: number;
  currentRoundIndex: number;
  // New property to track total completed rounds for win condition
  roundsCompleted: number; 
  // New property to store indices of completed rounds for navigation
  completedRounds: number[]; 
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
  letterQuestions: Record<string, AssignedLetterQuestion>;
  status: RoundStatus;
  winner?: 'team1' | 'team2' | null;
  currentPoints: number;
}

export type GameStatus = 'lobby' | 'in_progress' | 'paused' | 'finished';

export interface Game {
  id: string;
  title?: string; 
  creatorId: string; // Remains anonymous user UID for now
  password?: string; // New field for game password
  rounds: Round[];
  currentRoundIndex: number; // "master" or spectator round index
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

export interface Feedback {
    id: string;
    gameId: string;
    teamName: string;
    feedback: string;
    createdAt: Timestamp;
}
