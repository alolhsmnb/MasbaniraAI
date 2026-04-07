const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');

const LOG = '/home/z/my-project/dev.log';
const PORT = 3000;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG, line);
}

function isRunning() {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', () => { s.close(); resolve(true); });
    s.once('listening', () => { s.close(); resolve(false); });
    s.listen(PORT);
  });
}

async function startServer() {
  while (true) {
    const running = await isRunning();
    if (!running) {
      log('Starting Next.js dev server...');
      const child = spawn(
        '/home/z/my-project/node_modules/.bin/next',
        ['dev', '-p', PORT.toString()],
        { stdio: ['ignore', fs.openSync(LOG, 'a'), fs.openSync(LOG, 'a')] }
      );
      child.on('exit', code => {
        log(`Next.js exited with code ${code}`);
      });
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

log('Server guard started');
startServer();
