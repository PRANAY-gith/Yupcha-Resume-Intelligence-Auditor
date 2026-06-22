#!/usr/bin/env node
const { spawnSync } = require('child_process');
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function checkCommand(cmd) {
  const which = spawnSync('which', [cmd], { stdio: 'pipe' });
  return which.status === 0;
}

function run(command, args, opts = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  const res = spawnSync(command, args, { stdio: 'inherit', shell: true, cwd: ROOT, ...opts });
  return res.status === 0;
}

async function waitForPort(host, port, retries = 30, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    await new Promise(r => setTimeout(r, delayMs));
    try {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.once('error', reject);
        socket.once('timeout', () => reject(new Error('timeout')));
        socket.connect(port, host, () => {
          socket.end();
          resolve();
        });
      });
      return true;
    } catch (e) {
      process.stdout.write('.');
    }
  }
  return false;
}

function isPortInUse(port, host = '127.0.0.1', timeout = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let called = false;
    socket.setTimeout(timeout);
    socket.once('error', () => { if (!called) { called = true; resolve(false); } });
    socket.once('timeout', () => { if (!called) { called = true; resolve(false); } });
    socket.connect(port, host, () => {
      if (!called) { called = true; resolve(true); }
      socket.end();
    });
  });
}

function findFreePort(start = 5432, end = 5450) {
  return new Promise(async (resolve) => {
    for (let p = start; p <= end; p++) {
      // eslint-disable-next-line no-await-in-loop
      const inUse = await isPortInUse(p);
      if (!inUse) return resolve(p);
    }
    resolve(null);
  });
}

function updateEnvFile(chosenPort) {
  const envPath = path.join(ROOT, '.env');
  let content = '';
  try {
    content = require('fs').readFileSync(envPath, 'utf8');
  } catch (e) {
    // create base .env if not present
    content = '';
  }

  // Ensure POSTGRES_HOST_PORT is set
  const lines = content.split(/\r?\n/).filter(Boolean);
  const map = {};
  lines.forEach((l) => {
    const idx = l.indexOf('=');
    if (idx > -1) {
      const k = l.slice(0, idx);
      const v = l.slice(idx + 1);
      map[k] = v;
    }
  });

  map.POSTGRES_HOST_PORT = String(chosenPort);

  // Update DATABASE_URL to use chosen port if present
  if (map.DATABASE_URL) {
    // replace :5432 with :<chosenPort>
    map.DATABASE_URL = map.DATABASE_URL.replace(/:\d+\//, `:${chosenPort}/`);
  } else {
    map.DATABASE_URL = `postgresql://postgres:postgrespassword@localhost:${chosenPort}/backend_db?schema=public`;
  }

  // Rebuild file content preserving comments from original (simple approach)
  const header = '# Auto-generated .env by setup_db.js\n';
  const out = [header];
  Object.keys(map).forEach((k) => { out.push(`${k}=${map[k]}`); });
  require('fs').writeFileSync(envPath, out.join('\n') + '\n', 'utf8');
  console.log(`Updated ${envPath} with POSTGRES_HOST_PORT=${chosenPort}`);
}

async function main() {
  console.log('Setting up Postgres via Docker Compose (if available).');

  const hasDocker = checkCommand('docker');
  const hasDockerCompose = checkCommand('docker-compose') || checkCommand('docker');

  if (!hasDocker) {
    console.error('\nDocker not found in PATH. Please install Docker Desktop: https://www.docker.com/get-started');
    process.exit(2);
  }

  // Prefer `docker compose` (new syntax) but fallback to `docker-compose` if available
  const useComposeV2 = checkCommand('docker') && run('docker', ['compose', 'version']) ;
  const composeCmd = useComposeV2 ? ['docker', 'compose'] : ['docker-compose'];

  // Bring up DB
  const upCmd = useComposeV2 ? ['docker', 'compose', 'up', '-d'] : ['docker-compose', 'up', '-d'];
  const downCmd = useComposeV2 ? ['docker', 'compose', 'down'] : ['docker-compose', 'down'];
  // Check if default port 5432 is available on the host. If not, pick a free port and update .env
  const defaultPort = 5432;
  const inUse = await isPortInUse(defaultPort);
  let chosenPort = defaultPort;
  if (inUse) {
    console.warn(`Host port ${defaultPort} appears to be in use. Picking an alternate port.`);
    const freePort = await findFreePort(defaultPort + 1, defaultPort + 50);
    if (!freePort) {
      console.error('No free ports found in range. Please free port 5432 or modify POSTGRES_HOST_PORT in backend/.env manually.');
      process.exit(3);
    }
    chosenPort = freePort;
    // update .env with POSTGRES_HOST_PORT and DATABASE_URL
    updateEnvFile(chosenPort);
  }

  console.log('\nBringing up containers...');
  const upOk = run(upCmd[0], upCmd.slice(1));
  if (!upOk) {
    console.error('Failed to start containers with docker compose. You can try running the command manually in backend/:');
    console.error(`  ${upCmd.join(' ')}`);
    process.exit(3);
  }

  process.stdout.write('Waiting for Postgres to accept connections');
  const ready = await waitForPort('127.0.0.1', chosenPort, 60, 1000);
  if (!ready) {
    console.error('\nPostgres port did not open in time. Check `docker compose logs db` for details.');
    process.exit(4);
  }

  console.log('\nPostgres is up. Applying Prisma schema and generating client...');

  // Run prisma db push then generate
  const pushOk = run('npx', ['prisma', 'db', 'push']);
  if (!pushOk) {
    console.error('prisma db push failed. You may need to run prisma migrate or inspect errors.');
    process.exit(5);
  }

  const genOk = run('npx', ['prisma', 'generate']);
  if (!genOk) {
    console.error('prisma generate failed.');
    process.exit(6);
  }

  console.log('✅ Database is ready and Prisma client generated.');
  process.exit(0);
}

main();
