'use server';

import { db } from '@/lib/firebase';
import type { Game } from '@/lib/types';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

export async function revealLetter(gameId: string, teamId: 'team1' | 'team2', letter: string, answer: string) {
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await getDoc(gameRef);

    if (!gameSnap.exists()) {
        throw new Error("Game not found.");
    }
    const game = gameSnap.data() as Game;

    if (game.status !== 'in_progress') {
        throw new Error("Game is not active.");
    }

    if (game.currentTurn !== teamId) {
        throw new Error("It's not your turn.");
    }
    
    const letterQuestion = game.letterQuestions[letter.toUpperCase()];
    if (!letterQuestion) {
        throw new Error("Invalid letter question.");
    }

    const nextTurn = teamId === 'team1' ? 'team2' : 'team1';

    if (letterQuestion.answer.toLowerCase() === answer.toLowerCase()) {
        await updateDoc(gameRef, {
            revealedLetters: [...game.revealedLetters, letter.toUpperCase()],
            lastActivityAt: serverTimestamp(),
            // Turn does not change on correct letter answer
        });
        return { correct: true };
    } else {
        await updateDoc(gameRef, {
            lastActivityAt: serverTimestamp(),
            currentTurn: nextTurn,
        });
        return { correct: false };
    }
}


export async function submitMainAnswer(gameId: string, teamId: 'team1' | 'team2', answer: string, points: number) {
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await getDoc(gameRef);

    if (!gameSnap.exists()) {
        throw new Error("Game not found.");
    }
    const game = gameSnap.data() as Game;

    if (game.status !== 'in_progress') {
        throw new Error("Game is not active.");
    }

    if (game.currentTurn !== teamId) {
        throw new Error("It's not your turn.");
    }

    const nextTurn = teamId === 'team1' ? 'team2' : 'team1';

    if (game.mainAnswer.toLowerCase() === answer.toLowerCase()) {
        const currentScore = game[teamId]?.score || 0;
        await updateDoc(gameRef, {
            status: 'finished',
            winner: teamId,
            [`${teamId}.score`]: currentScore + points,
            lastActivityAt: serverTimestamp(),
        });
        return { correct: true };
    } else {
        await updateDoc(gameRef, {
            currentTurn: nextTurn,
            lastActivityAt: serverTimestamp(),
        });
        return { correct: false };
    }
}
