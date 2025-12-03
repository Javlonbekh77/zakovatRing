'use server';

import { db } from '@/lib/firebase';
import type { Game } from '@/lib/types';
import { doc, getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { redirect } from 'next/navigation';

export async function joinGame(gameCode: string, teamName: string) {
  const gameRef = doc(db, 'games', gameCode.toUpperCase());
  
  try {
    const gameSnap = await getDoc(gameRef);

    if (!gameSnap.exists()) {
      return { error: 'Game not found. Please check the code and try again.' };
    }

    const game = gameSnap.data() as Game;

    if (game.status !== 'lobby') {
      return { error: 'This game is already in progress or has finished.' };
    }

    let teamSlot: 'team1' | 'team2' | null = null;

    if (!game.team1) {
      teamSlot = 'team1';
    } else if (!game.team2) {
      teamSlot = 'team2';
    }

    if (!teamSlot) {
      return { error: 'This game is already full.' };
    }
    
    const batch = writeBatch(db);

    batch.update(gameRef, {
      [teamSlot]: { name: teamName, score: 0 },
      lastActivityAt: serverTimestamp(),
    });

    // If the second team is joining, start the game
    if (teamSlot === 'team2') {
      batch.update(gameRef, {
        status: 'in_progress',
        gameStartedAt: serverTimestamp(),
        currentTurn: 'team1'
      });
    }

    await batch.commit();
    
    // Redirect on success
  } catch (error) {
    console.error("Error joining game:", error);
    if (error instanceof Error) {
        return { error: `Server error: ${error.message}` };
    }
    return { error: "An unknown error occurred while trying to join the game." };
  }

  let teamSlotForRedirect: 'team1' | 'team2' = 'team1';
  // Re-fetch to determine which team we actually joined as, to be safe
  const finalSnap = await getDoc(gameRef);
  if (finalSnap.exists()) {
      const game = finalSnap.data() as Game;
      if (game.team1?.name === teamName) teamSlotForRedirect = 'team1';
      if (game.team2?.name === teamName) teamSlotForRedirect = 'team2';
  }

  redirect(`/game/${gameCode.toUpperCase()}?team=${teamSlotForRedirect}`);
}
