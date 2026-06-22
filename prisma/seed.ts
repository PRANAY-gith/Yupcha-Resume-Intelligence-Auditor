import { PrismaClient, UserRole, TaskStatus, TaskPriority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1) Clean database
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
  console.log('🧹 Cleaned existing database tables.');

  // 2) Create hashed passwords
  const adminPassword = await bcrypt.hash('admin123', 12);
  const userPassword = await bcrypt.hash('user123', 12);

  // 3) Create Admin User
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  });
  console.log(`👤 Created Admin user: ${admin.email}`);

  // 4) Create Standard User
  const user = await prisma.user.create({
    data: {
      email: 'user@example.com',
      name: 'Jane Doe',
      password: userPassword,
      role: UserRole.USER,
    },
  });
  console.log(`👤 Created Standard user: ${user.email}`);

  // 5) Create Tasks for Admin
  await prisma.task.createMany({
    data: [
      {
        title: 'Review system architecture',
        description: 'Complete the review of the database design and schema structure.',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        userId: admin.id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      },
      {
        title: 'Deploy to production environment',
        description: 'Set up pipelines and launch the backend service to AWS / Render.',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        userId: admin.id,
      },
    ],
  });

  // 6) Create Tasks for Standard User
  await prisma.task.createMany({
    data: [
      {
        title: 'Write unit tests for authentication routes',
        description: 'Ensure coverage of registration, login, and profile fetching endpoints.',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        userId: user.id,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      },
      {
        title: 'Design API documentation',
        description: 'Build a Swagger schema or comprehensive markdown documentation explaining all endpoints.',
        status: TaskStatus.DONE,
        priority: TaskPriority.LOW,
        userId: user.id,
      },
      {
        title: 'Research front-end frameworks',
        description: 'Check Next.js, React, and Vue to see which works best for client dashboard.',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        userId: user.id,
      },
    ],
  });

  console.log('✅ Database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
