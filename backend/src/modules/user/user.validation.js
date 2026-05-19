import { z } from "zod";
import userRepo from "./user.repo.js";
// We make fields optional for updates since we might only want to update one field
export const updateUserSchema = z.object({
  email: z.string().trim().email("Invalid email").optional(),
  password: z.string().min(6, "Minimum 6 characters").max(50, "Too long").optional()
}).strict(); // Prevents any extra arbitrary fields from being injected

export const userValidator = async (req, res, next) => {
  try {
    const validatedData = updateUserSchema.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Validator specifically for ID parameter routes (like getMe)
export const idParamSchema = z.object({
  id: z.string()
});

export const idValidator = async (req, res, next) => {
  try {
    // We parse req.params instead of req.body since ID is in the URL
    const validatedParams = idParamSchema.parse(req.params);
    req.params = validatedParams;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid ID parameter", details: error.errors });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Validates that provided user ID exists by checking DB via User Repo
 */
export const validateUserExists = async (req, res, next) => {
  try {
    const { userId } = req.body;

    // Call user repo to check if they exist (similar to getMe logic)
    const user = await userRepo.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "The provided User ID does not exist" });
    }

    // Attach user to request securely if downstream functions need it
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Failed to verify user ID existence" });
  }
};
