import type { Game, Team } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './ui/card';
import { Shield, Swords } from 'lucide-react';

interface ScoreboardProps {
  team1?: Team;
  team2?: Team;
  currentTurn?: 'team1' | 'team2';
}

function TeamDisplay({ team, isTurn }: { team?: Team; isTurn: boolean }) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg transition-all duration-300 w-full text-center md:text-left',
        isTurn ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-card'
      )}
    >
      <h3 className="font-headline text-2xl font-bold truncate">
        {team?.name || 'Team ?'}
      </h3>
      <p className="text-4xl font-bold font-mono">
        {team?.score !== undefined ? team.score : '-'}
      </p>
    </div>
  );
}

export default function Scoreboard({ team1, team2, currentTurn }: ScoreboardProps) {
  return (
    <Card className="w-full overflow-hidden">
      <CardContent className="p-2 md:p-4">
        <div className="flex items-center justify-around gap-2 md:gap-4">
          <TeamDisplay team={team1} isTurn={currentTurn === 'team1'} />
          <div className="shrink-0 text-primary p-2 bg-primary/10 rounded-full">
            <Swords className="h-8 w-8" />
          </div>
          <TeamDisplay team={team2} isTurn={currentTurn === 'team2'} />
        </div>
      </CardContent>
    </Card>
  );
}
