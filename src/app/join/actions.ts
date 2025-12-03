'use server';

import { db } from '@/lib/firebase';
import type { Game } from '@/lib/types';
import { doc, getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { redirect } from 'next/navigation';

export async function joinGame(gameCode: string, teamName: string) {
  const gameRef = doc(db, 'games', gameCode);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    throw new Error('Game not found. Please check the code and try again.');
  }

  const game = gameSnap.data() as Game;

  if (game.status !== 'lobby') {
    throw new Error('This game is already in progress or has finished.');
  }

  let teamSlot: 'team1' | 'team2' | null = null;

  if (!game.team1) {
    teamSlot = 'team1';
  } else if (!game.team2) {
    teamSlot = 'team2';
  }

  if (!teamSlot) {
    throw new Error('This game is already full.');
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
  
  // We will store the team assignment on the client side
  // but the redirect will trigger the game page to load
  redirect(`/game/${gameCode}?team=${teamSlot}`);
}
