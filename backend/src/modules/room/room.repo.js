import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class RoomRepository {
  async create(data) {
    const roomObj = await prisma.room.create({
      data,
    });
    await this.addInRoomPlayer({
      roomId: roomObj.id,
      userId: data.hostId,
    });
    return roomObj;
  }

  async findById(roomid) {
    return prisma.room.findUnique({
      where: { id: roomid },
    });
  }

  async findAll() {
    return prisma.room.findMany();
  }

  async findByUserId(userid) {
    return prisma.roomPlayer.findMany({
      where: { userId: userid }
    });
  }

  async update(roomId, userId, data) {
    const { roomId: _r, userId: _u, ...updates } = data;
    return prisma.roomPlayer.update({
      where: {
        roomId_userId: { roomId, userId },
      },
      data: updates,
    });
  }

  async delete(roomid) {
    return prisma.room.delete({
      where: { id: roomid },
    });
  }

  async addInRoomPlayer(data) {
    return prisma.roomPlayer.create({
      data,
    });
  }

  async getRoomPlayers(roomId) {
    return prisma.roomPlayer.findMany({
      where: { roomId },
    });
  }

  async getScores(roomId) {
    const players = await prisma.roomPlayer.findMany({
      where: { roomId },
      select: { userId: true, score: true },
    });
    return players.map(p => ({ userId: p.userId, score: p.score ?? 0 }));
  }


  /**
     * Update room's quiz index and check if game ended
     * @param {string} roomId - Room ID
     * @param {number} quizIndex - New quiz index
     * @returns {Promise<Object>} - { success: boolean, gameEnded: boolean, error?: string }
     */
  async updateQuestionIndex(roomId) {
    try {
      // Get room to check quiz length
      const room = await prisma.room.findUnique({
        where: { id: roomId }
      });
      if (!room) {
        return { success: false, gameEnded: false, error: "Room not found" };
      }
      const quizIndex = room.quiz_index || 0;
      const totalQuestions = room.quizdata?.length || 0;
      const nextIndex = quizIndex + 1;
      const gameEnded = nextIndex >= totalQuestions;

      // Hold quiz_index at the last valid question when the game ends so
      // getCurrentQuestion doesn't return "Question not found" on later reads.
      const updatedRoom = await prisma.room.update({
        where: { id: roomId },
        data: { quiz_index: gameEnded ? quizIndex : nextIndex }
      });

      return {
        success: true,
        gameEnded: gameEnded,
        room: updatedRoom,
      };
    } catch (error) {
      return { success: false, gameEnded: false, error: error.message };
    }
  }


  /**
   * Update player score by user ID
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID
   * @param {number} score - New score to add
   * @returns {Promise<Object>} - { success: boolean, error?: string }
   */
  async updatePlayerScore(roomId, userId, score) {
  try {
    const updatedPlayer = await prisma.roomPlayer.update({
      where: {
        roomId_userId: { roomId, userId },
      },
      data: {
        score: {
          increment: score
        }
      }
    });

    return { success: true , score: updatedPlayer.score};
  } catch (error) {
    return { success: false, error: error.message };
  }
}

}



export default new RoomRepository();
