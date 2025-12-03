'use server';

import { db } from '@/lib/firebase';
import type { Game, LetterQuestion } from '@/lib/types';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { redirect } from 'next/navigation';
import * as z from 'zod';

const formSchema = z.object({
  mainQuestion: z.string().min(10),
  mainAnswer: z.string().min(1),
  letterQuestions: z.array(
    z.object({
      letter: z.string(),
      question: z.string().min(1),
      answer: z.string().min(1),
    })
  ),
});

function generateGameCode(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export async function createGame(values: z.infer<typeof formSchema>) {
  const validatedFields = formSchema.safeParse(values);

  if (!validatedFields.success) {
    // This should ideally not be reached if client-side validation is working
    throw new Error('Invalid form data submitted.');
  }

  const { mainQuestion, mainAnswer, letterQuestions } = validatedFields.data;
  
  // Server-side validation to ensure all unique letters have a corresponding question.
  const uniqueLettersInAnswer = [...new Set(mainAnswer.toUpperCase().replace(/[^A-Z]/g, ''))];
  const lettersWithQuestions = new Set(letterQuestions.map(q => q.letter.toUpperCase()));

  if (uniqueLettersInAnswer.length !== letterQuestions.length || !uniqueLettersInAnswer.every(letter => lettersWithQuestions.has(letter))) {
    throw new Error('Please provide a valid question and answer for every unique letter in the main answer.');
  }

  const gameId = generateGameCode(4);

  const letterQuestionsMap: Record<string, LetterQuestion> = {};
  letterQuestions.forEach((item) => {
    letterQuestionsMap[item.letter.toUpperCase()] = {
      question: item.question,
      answer: item.answer,
    };
  });
  
  const gameData: Game = {
    id: gameId,
    mainQuestion,
    mainAnswer: mainAnswer.toUpperCase(),
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
    // Propagate a more user-friendly error
    throw new Error('Could not create the game in the database. Please try again later.');
  }

  // Redirect on success
  redirect(`/admin/created/${gameId}`);
}
