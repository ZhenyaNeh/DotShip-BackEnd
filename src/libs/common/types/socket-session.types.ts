export interface SocketSession {
  socketId: string;
  userId: string;
  connectedAt: Date;
  gameId?: string;
  roomId?: string;
}
