import { z } from "zod";

export const createRoomSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
}).passthrough();


export const validateRoomInput = (req, res, next) => {
  try {
    createRoomSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

