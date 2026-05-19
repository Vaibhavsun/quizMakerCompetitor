import roomService from './room.service.js';
import { createQuiz } from '../quiz/index.js';

class RoomController {
  async createRoom(req, res) {
    try {
      const { userId, topic, difficulty, description } = req.body;

      // Generate quiz if difficulty and description are provided
      let quizData = null;
      if (difficulty && description) {
        const quizResult = await createQuiz({ userId, difficulty, description });
        if (!quizResult.success) {
          return res.status(502).json({ error: quizResult.error });
        }
        quizData = quizResult.data.quiz;
      }

      const result = await roomService.createRoom({
        hostId: userId,
        topic,
        quizdata: quizData ?? [],
      });

      return res.status(201).json({
        message: "Room created successfully",
        data: {
          ...result,
          quiz: quizData
        }
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        error: error.message || "Failed to create room"
      });
    }
  }

  async getRoom(req, res) {
    try {
      const room = await roomService.getRoom(req.params.id);
      return res.json(room);
    } catch (error) {
      return res.status(error.status || 500).json({
        error: error.message || "Error fetching room"
      });
    }
  }

  async getAllRooms(req, res) {
    try {
      const rooms = await roomService.getAllRooms();
      return res.json(rooms);
    } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async updateRoom(req, res) {
    try {
      const result = await roomService.updateRoom(req.params.id, req.body);
      return res.json({ message: "Room updated successfully", data: result });
    } catch (error) {
      return res.status(400).json({ error: "Error updating room" });
    }
  }

  async deleteRoom(req, res) {
    try {
      await roomService.deleteRoom(req.params.id);
      return res.json({ message: "Room deleted successfully" });
    } catch (error) {
      return res.status(400).json({ error: "Error deleting room" });
    }
  }
}

export default new RoomController();
