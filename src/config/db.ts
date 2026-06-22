import { PrismaClient } from '@prisma/client';

// Support a lightweight in-memory mock DB for local development when Docker is not available.
// Enable by setting USE_MOCK_DB=1 in your environment or backend/.env.
const useMock = process.env.USE_MOCK_DB === '1' || process.env.DATABASE_URL === 'mock';

let defaultExport: any;
let prismaExport: any;

if (useMock) {
  // Lazy-import the mock implementation to keep types and runtime separate.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mockPrisma = require('./mockPrisma').default;
  defaultExport = mockPrisma;
  prismaExport = mockPrisma;
} else {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
  defaultExport = prisma;
  prismaExport = prisma;
}

export default defaultExport;
export { prismaExport as prisma };
