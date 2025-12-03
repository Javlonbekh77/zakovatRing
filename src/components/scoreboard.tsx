import type { Team } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './ui/card';
import { Swords, Eye, User, Crown } from 'lucide-react';

interface ScoreboardProps {
  team1?: Team;
  team2?: Team;
  playerTeam: 'team1' | 'team2' | null;
}

function TeamDisplay({ team, isPlayer, isOpponent, isSpectator }: { team?: Team, isPlayer: boolean, isOpponent: boolean, isSpectator: boolean }) {
  const showScore = isPlayer || isSpectator;

  return (
    <div
      className={cn(
        'p-4 rounded-lg transition-all duration-300 w-full text-center md:text-left bg-card border-2',
        isPlayer ? 'border-primary shadow-lg' : 'border-transparent',
        isOpponent ? 'opacity-80' : ''
      )}
    >
      <div className='flex items-center justify-center md:justify-start gap-2 mb-1'>
        {isPlayer && <User className="h-5 w-5 text-primary" />}
        <h3 className="font-headline text-2xl font-bold truncate">
          {team?.name || 'Team ?'}
        </h3>
      </div>
      {isPlayer && <p className='text-xs text-primary -mt-1 mb-2 text-center md:text-left'>Sizning jamoangiz</p>}
      <div className="text-4xl font-bold font-mono flex items-center justify-center md:justify-start gap-2">
        {showScore ? (
            <span>{team?.score !== undefined ? team.score : '-'}</span>
        ) : (
          <>
            <Eye className="h-8 w-8 text-muted-foreground" title="Raqibning ochkolari yashiringan" />
            <span>???</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function Scoreboard({ team1, team2, playerTeam }: ScoreboardProps) {
  const isSpectator = playerTeam === null;

  return (
    <Card className="w-full overflow-hidden bg-muted/50">
      <CardContent className="p-2 md:p-4">
        <div className="flex items-center justify-around gap-2 md:gap-4">
          <TeamDisplay 
            team={team1} 
            isPlayer={playerTeam === 'team1'} 
            isOpponent={playerTeam === 'team2'}
            isSpectator={isSpectator}
          />
          <div className="shrink-0 text-primary p-2 bg-primary/10 rounded-full">
            <Swords className="h-8 w-8" />
          </div>
           <TeamDisplay 
            team={team2} 
            isPlayer={playerTeam === 'team2'} 
            isOpponent={playerTeam === 'team1'}
            isSpectator={isSpectator}
          />
        </div>
      </CardContent>
    </Card>
  );
}
