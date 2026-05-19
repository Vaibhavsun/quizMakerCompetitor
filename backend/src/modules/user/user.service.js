import userRepo from './user.repo.js';
import crypto from 'crypto';
import util from 'util';

// Converting standard callback-based scrypt to Async/Await Promises
const scryptAsync = util.promisify(crypto.scrypt);

class UserService {
  /**
   * Method for creating hashing.
   * Generates a random salt and securely hashes the password using scrypt.
   * @param {string} password 
   * @returns {Promise<string>} Format returned is "salt:hash"
   */
  async hashPassword(password) {
    // Generate a random 16-byte salt
    const salt = crypto.randomBytes(16).toString('hex');
    
    // Hash the password with the salt (64 is the derived key length)
    const derivedKey = await scryptAsync(password, salt, 64);
    
    // Store both the salt and the key so they can be compared later!
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  /**
   * Method for hashing verification against the database object.
   * Extracts the salt from the stored password and hashes the input to check for a match.
   * @param {string} plainPassword 
   * @param {string} dbPassword 
   * @returns {Promise<boolean>}
   */
  async verifyPassword(plainPassword, dbPassword) {
    const [salt, key] = dbPassword.split(':');
    
    // If the db record doesn't have a salt:key format, immediately fail
    if (!salt || !key) return false; 
    
    const derivedKey = await scryptAsync(plainPassword, salt, 64);
    
    // Compare the newly formed hash against the DB one using simple string match
    return key === derivedKey.toString('hex');
  }

  /**
   * Register a new user
   * @param {Object} userData - Contains email and password
   */
  async register({ email, password }) {
    // 1. Check if user already exists
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      const error = new Error('User with this email already exists');
      error.status = 409;
      throw error;
    }

    // 2. Hash the incoming plaintext password using our new method
    const hashedPassword = await this.hashPassword(password);

    // 3. Save user to DB securely
    const newUser = await userRepo.create({
      email,
      password: hashedPassword,
    });

    // 4. Return new user without exposing the hash or salt
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  /**
   * Login an existing user
   * @param {string} email 
   * @param {string} password 
   */
  async login(email, password) {
    // 1. Check if user exists
    const user = await userRepo.findByEmail(email);
    if (!user) {
      const error = new Error('Invalid email or password');
      error.status = 401; // Unauthorized
      throw error;
    }

    // 2. Verify Password using our secure hashing method
    const isMatch = await this.verifyPassword(password, user.password);
    if (!isMatch) {
      const error = new Error('Invalid email or password');
      error.status = 401;
      throw error;
    }

    // 3. Login successful, return sanitized user object
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

const userService = new UserService();
export default userService;
