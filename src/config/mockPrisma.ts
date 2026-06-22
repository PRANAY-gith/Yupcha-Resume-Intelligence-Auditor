/**
 * Very small in-memory mock of Prisma client used for local development
 * when Docker/Postgres is not available. Implements only the subset of
 * methods used by this project (user & task models and $connect/$disconnect).
 */

type User = any;
type Task = any;

const users: User[] = [];
const tasks: Task[] = [];

const now = () => new Date();
const genId = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;

const userModel = {
  findUnique: async ({ where }: any) => {
    if (where.email) return users.find(u => u.email === where.email) || null;
    if (where.id) return users.find(u => u.id === where.id) || null;
    return null;
  },
  create: async ({ data, select }: any) => {
    const u = {
      id: genId(),
      email: data.email,
      password: data.password,
      name: data.name || null,
      role: data.role || 'USER',
      createdAt: now(),
      updatedAt: now(),
    };
    users.push(u);
    if (select) {
      const out: any = {};
      Object.keys(select).forEach(k => { if (select[k]) out[k] = (u as any)[k]; });
      return out;
    }
    return u;
  },
  deleteMany: async () => {
    users.length = 0;
    return { count: 0 };
  }
};

const taskModel = {
  create: async ({ data }: any) => {
    const t = {
      id: genId(),
      title: data.title,
      description: data.description || null,
      status: data.status || 'PENDING',
      priority: data.priority || 'MEDIUM',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      userId: data.userId,
      createdAt: now(),
      updatedAt: now(),
    };
    tasks.push(t);
    return t;
  },
  findMany: async ({ where, orderBy }: any) => {
    let res = tasks.slice();
    if (where) {
      if (where.userId) res = res.filter((t: any) => t.userId === where.userId);
      if (where.status) res = res.filter((t: any) => t.status === where.status);
      if (where.priority) res = res.filter((t: any) => t.priority === where.priority);
      if (where.OR && Array.isArray(where.OR)) {
        const q = where.OR[0];
        if (q.title && q.title.contains) {
          const s = q.title.contains.toLowerCase();
          res = res.filter((t: any) => (t.title || '').toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s));
        }
      }
    }
    if (orderBy && orderBy.createdAt === 'desc') {
      res.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return res;
  },
  findUnique: async ({ where }: any) => {
    return tasks.find((t: any) => t.id === where.id) || null;
  },
  update: async ({ where, data }: any) => {
    const idx = tasks.findIndex((t: any) => t.id === where.id);
    if (idx === -1) return null;
    const current = tasks[idx];
    const updated = { ...current, ...data, updatedAt: now() };
    tasks[idx] = updated;
    return updated;
  },
  delete: async ({ where }: any) => {
    const idx = tasks.findIndex((t: any) => t.id === where.id);
    if (idx === -1) return null;
    const removed = tasks.splice(idx, 1)[0];
    return removed;
  },
  createMany: async ({ data }: any) => {
    const created = data.map((d: any) => {
      const t = {
        id: genId(),
        title: d.title,
        description: d.description || null,
        status: d.status || 'PENDING',
        priority: d.priority || 'MEDIUM',
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        userId: d.userId,
        createdAt: now(),
        updatedAt: now(),
      };
      tasks.push(t);
      return t;
    });
    return { count: created.length };
  }
};

const mockPrisma = {
  $connect: async () => { console.log('🔧 MockPrisma: connected (in-memory)'); },
  $disconnect: async () => { console.log('🔧 MockPrisma: disconnected'); },
  user: userModel,
  task: taskModel,
};

export default mockPrisma;
