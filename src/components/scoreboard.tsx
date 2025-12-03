import type { Team } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './ui/card';
import { Swords, EyeOff } from 'lucide-react';

interface ScoreboardProps {
  team1?: Team;
  team2?: Team;
  playerTeam: 'team1' | 'team2' | null;
}

function TeamDisplay({ team, isOpponent }: { team?: Team, isOpponent: boolean }) {
  const showScore = !isOpponent || !team;

  return (
    <div
      className={cn(
        'p-4 rounded-lg transition-all duration-300 w-full text-center md:text-left bg-card'
      )}
    >
      <h3 className="font-headline text-2xl font-bold truncate">
        {team?.name || 'Team ?'}
      </h3>
      <div className="text-4xl font-bold font-mono flex items-center justify-center md:justify-start gap-2">
        {showScore ? (
            <span>{team?.score !== undefined ? team.score : '-'}</span>
        ) : (
            <EyeOff className="h-8 w-8 text-muted-foreground" title="Opponent's score is hidden" />
        )}
      </div>
    </div>
  );
}

export default function Scoreboard({ team1, team2, playerTeam }: ScoreboardProps) {
  // A spectator can see both scores. A player can only see their own.
  const isSpectator = playerTeam === null;

  return (
    <Card className="w-full overflow-hidden">
      <CardContent className="p-2 md:p-4">
        <div className="flex items-center justify-around gap-2 md:gap-4">
          <TeamDisplay team={team1} isOpponent={!isSpectator && playerTeam === 'team2'} />
          <div className="shrink-0 text-primary p-2 bg-primary/10 rounded-full">
            <Swords className="h-8 w-8" />
          </div>
          <TeamDisplay team={team2} isOpponent={!isSpectator && playerTeam === 'team1'} />
        </div>
      </CardContent>
    </Card>
  );
}
