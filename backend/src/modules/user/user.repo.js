import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class UserRepository {
  async create(data) {
    return prisma.user.create({
      data,
    });
  }
  async findById(id) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async update(email, data) {
    return prisma.user.update({
      where: { email },
      data,
    });
  }

  async delete(email) {
    return prisma.user.delete({
      where: { email },
    });
  }
}

const userRepo = new UserRepository();
export default userRepo;
