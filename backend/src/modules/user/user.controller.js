import userRepo from './user.repo.js';
import userService from './user.service.js';

class UserController {
  /**
   * Register a new user
   */
  async register(req, res) {
    try {
      // userService.register accepts { email, password }
      const newUser = await userService.register(req.body);
      return res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Error registering user' });
    }
  }

  /**
   * Login an existing user
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      const user = await userService.login(email, password);
      return res.status(200).json({ message: 'Login successful', user });
    } catch (error) {
      // userService throws errors with `.status` if unauthorized
      return res.status(error.status || 401).json({ error: error.message || 'Error logging in' });
    }
  }

  /**
   * Fetch details for a specific user using ID
   */
  async getMe(req, res) {
    try {
      const { id } = req.params;
      
      const result = await userRepo.findById(id);

      if (!result) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Security practice: Remove plaintext password before returning user
      const { password, ...userWithoutPassword } = result;
      return res.json(userWithoutPassword);
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }

  /**
   * Fetch a user by email (from earlier design)
//    */
//   async getUser(req, res) {
//     try {
//       const { email } = req.params;
//       const result = await userRepo.findByEmail(email);

//       if (!result) {
//         return res.status(404).json({ error: 'User not found' });
//       }

//       // Returning full payload as you requested previously
//       return res.json(result);
//     } catch (error) {
//       return res.status(500).json({ error: error.message || 'Internal Server Error' });
//     }
//   }

//   /**
//    * Update a user's details
//    */
//   async updateUser(req, res) {
//     try {
//       const { email } = req.params;
      
//       if (Object.keys(req.body).length === 0) {
//         return res.status(400).json({ error: 'No valid fields provided for update' });
//       }

//       const result = await userRepo.update(email, req.body);
      
//       const { password, ...userWithoutPassword } = result;
//       return res.json({ message: 'User updated successfully', user: userWithoutPassword });
//     } catch (error) {
//       return res.status(400).json({ error: error.meta?.cause || error.message || 'Error updating user' });
//     }
//   }

//   /**
//    * Delete a user
//    */
//   async deleteUser(req, res) {
//     try {
//       const { email } = req.params;
//       await userRepo.delete(email);

//       return res.json({ message: 'User deleted successfully' });
//     } catch (error) {
//       return res.status(400).json({ error: error.meta?.cause || error.message || 'Error deleting user' });
//     }
//   }
}

const userController = new UserController();
export default userController;
