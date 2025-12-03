import GameClient from '@/components/game-client';
import { Suspense } from 'react';

export default function GamePage({
  params: { gameId },
  searchParams,
}: {
  params: { gameId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const team = searchParams.team as 'team1' | 'team2' | undefined;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6">
       <Suspense fallback={<div className="text-xl">Loading Game...</div>}>
         <GameClient gameId={gameId} assignedTeam={team} />
       </Suspense>
    </div>
  );
}
