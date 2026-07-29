// 本地一键启动：先起后端 server，端口就绪后启动 Electron 桌面壳
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const PORT = process.env.PORT || 3000;

// 启动后端（使用当前 node 进程）
const server = spawn(process.execPath, [path.join(__dirname, 'server', 'index.js')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'inherit',
});

let electronStarted = false;
function startElectron() {
  if (electronStarted) return;
  electronStarted = true;
  const electron = spawn('npx', ['electron', '.'], {
    cwd: __dirname,
    shell: true,
    env: { ...process.env, ZHILIU_SERVER: `http://localhost:${PORT}` },
    stdio: 'inherit',
  });
  electron.on('exit', () => {
    try { server.kill(); } catch (e) {}
    process.exit(0);
  });
}

// 轮询等待后端端口就绪
function waitForServer() {
  const sock = net.connect(PORT, '127.0.0.1');
  sock.on('connect', () => { sock.destroy(); startElectron(); });
  sock.on('error', () => { sock.destroy(); setTimeout(waitForServer, 300); });
}
waitForServer();

server.on('exit', (code) => {
  if (!electronStarted) process.exit(typeof code === 'number' ? code : 0);
});
