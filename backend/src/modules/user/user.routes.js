import express from 'express';
import userController from './user.controller.js';
import { userValidator, idValidator } from './user.validation.js';

const UserRouter = express.Router();

// ---- specific paths must go before dynamic parameters like /:email

// Register a new user (uses strict auth validation middleware)
UserRouter.post('/register', userValidator, userController.register);

// Login a user (uses strict auth validation middleware)
UserRouter.post('/login', userController.login);

// Fetch a user strictly by their ID
UserRouter.get('/me/:id', idValidator, userController.getMe);

// ---- dynamic paths (these treat whatever string comes after / as an email)

// // Fetch a user by Email
// UserRouter.get('/:email', userController.getUser);

// // Update a user by Email
// // Includes userValidator (optional fields) middleware before hitting the controller
// UserRouter.put('/:email', userValidator, userController.updateUser);

// // Delete a user by Email
// UserRouter.delete('/:email', userController.deleteUser);

export default UserRouter;
