/**
 * Room Manager for sticky-fight
 * Handles generation of 5-character room codes and manages active game rooms.
 */

class RoomManager {
  constructor() {
    this.rooms = new Map();
    // Start automatic cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanupRooms(), 60000);
  }

  /**
   * Generates a unique 5-character alphanumeric room code.
   * Excludes confusing characters: O, 0, I, 1.
   */
  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Creates a new game room.
   */
  createRoom() {
    const code = this.generateCode();
    const room = {
      code,
      players: new Map(), // socket.id -> player info
      spectators: new Set(), // socket.id
      gameState: 'lobby', // lobby, playing, gameover
      rounds: [], // history of round winners
      score: { p1: 0, p2: 0 }, // round wins
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };
    this.rooms.set(code, room);
    return room;
  }

  /**
   * Retrieves a room by its code.
   */
  getRoom(code) {
    const room = this.rooms.get(code.toUpperCase());
    if (room) {
      room.lastActiveAt = Date.now();
    }
    return room;
  }

  /**
   * Adds a player to a room.
   * Returns: { success: boolean, role: 'player1'|'player2'|'spectator'|null, error: string|null }
   */
  joinRoom(code, socketId, nickname) {
    const room = this.getRoom(code);
    if (!room) {
      return { success: false, error: 'Xona topilmadi!' };
    }

    room.lastActiveAt = Date.now();

    // Check if player is already in room
    if (room.players.has(socketId)) {
      return { success: true, role: room.players.get(socketId).role };
    }

    if (room.players.size < 2) {
      const role = room.players.size === 0 ? 'player1' : 'player2';
      room.players.set(socketId, {
        id: socketId,
        nickname: nickname || `Player_${Math.floor(1000 + Math.random() * 9000)}`,
        role,
        heroColor: null, // to be selected in lobby
        ready: false,
        x: role === 'player1' ? 200 : 600,
        y: 400, // Ground level in arena
        hp: 100,
        maxHp: 100,
        action: 'idle',
        direction: role === 'player1' ? 1 : -1,
        combo: 0,
        lastComboTime: 0
      });
      return { success: true, role };
    } else {
      // Room is full, join as spectator
      room.spectators.add(socketId);
      return { success: true, role: 'spectator' };
    }
  }

  /**
   * Removes a connection (player or spectator) from a room.
   * Returns room details if room still exists, or null.
   */
  leaveRoom(code, socketId) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;

    room.lastActiveAt = Date.now();

    if (room.players.has(socketId)) {
      room.players.delete(socketId);
      // If a primary player leaves and game is playing, reset state
      if (room.gameState === 'playing') {
        room.gameState = 'lobby';
        // reset scores
        room.score = { p1: 0, p2: 0 };
        room.rounds = [];
      }
      
      // If we still have one player left, make sure they are player1
      if (room.players.size === 1) {
        const remainingPlayer = Array.from(room.players.values())[0];
        if (remainingPlayer.role !== 'player1') {
          room.players.delete(remainingPlayer.id);
          remainingPlayer.role = 'player1';
          remainingPlayer.x = 200;
          remainingPlayer.direction = 1;
          remainingPlayer.ready = false;
          room.players.set(remainingPlayer.id, remainingPlayer);
        }
      }
    }

    room.spectators.delete(socketId);

    // If room is completely empty, delete it
    if (room.players.size === 0 && room.spectators.size === 0) {
      this.rooms.delete(code.toUpperCase());
      return null;
    }

    return room;
  }

  /**
   * Cleans up rooms that have been inactive for more than 10 minutes.
   */
  cleanupRooms() {
    const now = Date.now();
    const INACTIVE_LIMIT = 10 * 60 * 1000; // 10 minutes

    for (const [code, room] of this.rooms.entries()) {
      const isExpired = now - room.lastActiveAt > INACTIVE_LIMIT;
      const isEmpty = room.players.size === 0 && room.spectators.size === 0;

      if (isExpired || isEmpty) {
        this.rooms.delete(code);
        console.log(`[RoomManager] Room ${code} cleaned up. Inactive: ${isExpired}, Empty: ${isEmpty}`);
      }
    }
  }
}

module.exports = new RoomManager();
