export interface MatchFoundEvent {
  roomId: string;
  opponentId: string;
}

export interface ReadyStatusEvent {
  status: 'waiting' | 'start';
  readyCount?: number;
}
