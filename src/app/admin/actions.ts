'use server';

import { db } from '@/lib/firebase';
import type { Game, LetterQuestion } from '@/lib/types';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { redirect } from 'next/navigation';

function generateGameCode(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export async function createSampleGame() {
  const gameId = generateGameCode(4);

  const letterQuestionsMap: Record<string, LetterQuestion> = {
    'Q': { question: 'A monarch, often female.', answer: 'Queen' },
    'U': { question: 'A mythical creature, often depicted as a horse with a single horn.', answer: 'Unicorn' },
    'I': { question: 'A frozen dessert made from cream, sugar, and flavoring.', answer: 'Ice Cream' },
    'Z': { question: 'An African equine with distinctive black-and-white stripes.', answer: 'Zebra' },
  };

  const gameData: Game = {
    id: gameId,
    mainQuestion: 'What is a common four-letter word for a test of knowledge?',
    mainAnswer: 'QUIZ',
    letterQuestions: letterQuestionsMap,
    revealedLetters: [],
    status: 'lobby',
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    currentPoints: 1000,
  };

  try {
    await setDoc(doc(db, 'games', gameId), gameData);
  } catch (error) {
    console.error('Error creating sample game in Firestore:', error);
    if (error instanceof Error) {
        return { error: `Could not create the game in the database: ${error.message}` };
    }
    return { error: 'Could not create the game in the database. Please try again later.' };
  }

  redirect(`/admin/created/${gameId}`);
}
