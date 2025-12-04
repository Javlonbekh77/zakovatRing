import type { Timestamp } from 'firebase/firestore';

export interface Team {
  name: string;
  score: number;
}

export interface UnassignedLetterQuestion {
  question: string;
  answer: string;
}

export interface AssignedLetterQuestion extends UnassignedLetterQuestion {
  letter: string;
}

export type RoundStatus = 'pending' | 'in_progress' | 'paused' | 'finished';

export interface Round {
  mainQuestion: string;
  mainAnswer: string;
  // This will store the questions with their assigned letters once the round starts.
  // The key can be 'A_0', 'A_1' for duplicate letters.
  letterQuestions: Record<string, Omit<AssignedLetterQuestion, 'letter'>>;
  // Pool of questions to be assigned randomly at the start of the round.
  unassignedLetterQuestions: UnassignedLetterQuestion[];
  status: RoundStatus;
  winner?: 'team1' | 'team2' | null;
  currentPoints: number;
  team1RevealedLetters: string[];
  team2RevealedLetters: string[];
}

export type GameStatus = 'lobby' | 'in_progress' | 'paused' | 'finished';

export interface Game {
  id: string;
  creatorId: string; // ID of the user who created the game
  rounds: Round[];
  currentRoundIndex: number;
  status: GameStatus;
  forfeitedBy?: 'team1' | 'team2';
  team1?: Team;
  team2?: Team;
  createdAt: Timestamp;
  lastActivityAt: Timestamp;
}
