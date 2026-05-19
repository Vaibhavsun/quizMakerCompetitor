import express from 'express';
import roomController from './room.controller.js';
import { validateRoomInput } from './room.validation.js';
import { validateUserExists } from '../user/user.validation.js';
import { validateQuizInput } from '../quiz/quiz.validation.js';
const router = express.Router();
router.post('/create', validateUserExists, validateQuizInput, validateRoomInput, roomController.createRoom);
router.get('/:id', roomController.getRoom);
router.get('/', roomController.getAllRooms);
router.put('/:id', roomController.updateRoom);
router.delete('/:id', roomController.deleteRoom);

export default router;
