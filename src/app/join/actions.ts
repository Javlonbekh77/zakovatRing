'use server';

// This is a server action, but it will receive the game data from the client
// and return it. This is a workaround for not having a real backend.
// In a real app, this would read/write from a database.

import { Game } from '@/lib/types';
import { redirect } from 'next/navigation';

export async function joinGameLocal(gameData: Game, teamName: string, teamSlot: 'team1' | 'team2') {
  
  const updatedGameData: Game = {
    ...gameData,
    [teamSlot]: { name: teamName, score: 0 },
    lastActivityAt: new Date().toISOString(),
  };

  // If the second team is joining, start the game
  if (teamSlot === 'team2') {
    updatedGameData.status = 'in_progress';
    updatedGameData.gameStartedAt = new Date().toISOString();
    updatedGameData.currentTurn = 'team1';
  }
  
  // The client will handle saving this updated data back to localStorage.
  // We just need to trigger the redirect from the server action.
  redirect(`/game/${gameData.id.toUpperCase()}?team=${teamSlot}`);
}
