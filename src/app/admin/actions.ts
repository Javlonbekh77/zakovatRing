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

export async function createGame(formData: FormData) {
  const gameId = generateGameCode(4);

  const mainQuestion = formData.get('mainQuestion') as string;
  const mainAnswer = (formData.get('mainAnswer') as string)?.toUpperCase();
  
  if (!mainQuestion || !mainAnswer) {
    return { error: 'Main question and answer are required.' };
  }
  
  const letterQuestionsMap: Record<string, LetterQuestion> = {};
  const uniqueLetters = [...new Set(mainAnswer.replace(/\s/g, '').split(''))];

  for (const letter of uniqueLetters) {
    const question = formData.get(`letterQuestion_${letter}`) as string;
    const answer = formData.get(`letterAnswer_${letter}`) as string;
    
    if (!question || !answer) {
        return { error: `Missing question or answer for letter: ${letter}` };
    }

    letterQuestionsMap[letter] = { question, answer };
  }


  const gameData: Game = {
    id: gameId,
    mainQuestion,
    mainAnswer,
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
    console.error('Error creating game in Firestore:', error);
    if (error instanceof Error) {
        return { error: `Could not create the game in the database: ${error.message}` };
    }
    return { error: 'Could not create the game in the database. Please try again later.' };
  }

  redirect(`/admin/created/${gameId}`);
}