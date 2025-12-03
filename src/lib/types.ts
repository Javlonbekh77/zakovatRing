import type { Timestamp } from 'firebase/firestore';

export interface Team {
  name: string;
  score: number;
}

export interface LetterQuestion {
  question: string;
  answer: string;
}

export type RoundStatus = 'pending' | 'in_progress' | 'finished';

export interface Round {
  mainQuestion: string;
  mainAnswer: string;
  letterQuestions: Record<string, LetterQuestion>;
  status: RoundStatus;
  winner?: 'team1' | 'team2' | null;
  currentPoints: number;
  // State for each team within the round
  team1RevealedLetters: string[];
  team2RevealedLetters: string[];
}

export type GameStatus = 'lobby' | 'in_progress' | 'finished';

export interface Game {
  id: string;
  rounds: Round[];
  currentRoundIndex: number;
  status: GameStatus;
  team1?: Team;
  team2?: Team;
  createdAt: Timestamp | string;
  lastActivityAt: Timestamp | string;
}
