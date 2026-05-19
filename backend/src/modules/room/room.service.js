import roomRepo from './room.repo.js';

class RoomService {
  async createRoom(data) {
    const room = await roomRepo.create(data);
    return {
      url: `/room/${room.id}`
    };
  }

  async getRoom(roomid) {
    const room = await roomRepo.findById(roomid);
    if (!room) {
      throw { status: 404, message: "Room not found" };
    }
    return room;
  }

  async getAllRooms() {
    return roomRepo.findAll();
  }

  async updateRoom(roomid, data) {
    return roomRepo.update(roomid, data);
  }

  async deleteRoom(roomid) {
    return roomRepo.delete(roomid);
  }
}

export default new RoomService();
