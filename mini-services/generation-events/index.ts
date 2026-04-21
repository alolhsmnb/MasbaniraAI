/**
 * PixelForge - Real-time Generation Events Service
 *
 * Socket.io server that broadcasts generation completion/failure events
 * to connected frontend clients in real-time.
 *
 * API Endpoints:
 *   POST /emit          - Emit an event to specific user(s)
 *   GET  /health         - Health check
 *
 * Events Emitted:
 *   generation:completed - { taskId, userId, resultUrl, modelId, type }
 *   generation:failed    - { taskId, userId, errorMessage, modelId }
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Server } from 'socket.io'

const PORT = 3005

// ─── Helpers ───

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
    // Timeout after 5s
    setTimeout(() => reject(new Error('Body read timeout')), 5000)
  })
}

// ─── Socket.IO User Map ───

const userSocketMap: Record<string, Set<any>> = {}

function getUserSockets(userId: string): any[] {
  return Array.from(userSocketMap[userId] || [])
}

function addUserSocket(userId: string, socket: any) {
  if (!userSocketMap[userId]) {
    userSocketMap[userId] = new Set()
  }
  userSocketMap[userId].add(socket)
}

function removeUserSocket(userId: string, socket: any) {
  if (userSocketMap[userId]) {
    userSocketMap[userId].delete(socket)
    if (userSocketMap[userId].size === 0) {
      delete userSocketMap[userId]
    }
  }
}

// ─── Create HTTP Server ───

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // POST /emit
  if (req.method === 'POST' && req.url === '/emit') {
    readBody(req).then(body => {
      try {
        const data = JSON.parse(body)
        const { event, userId, payload } = data

        if (!event || !userId || !payload) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Missing event, userId, or payload' }))
          return
        }

        const userSockets = getUserSockets(userId)
        if (userSockets.length > 0) {
          console.log(`[Events] Emitting "${event}" to user ${userId} (${userSockets.length} socket(s))`)
          userSockets.forEach(socket => {
            socket.emit(event, payload)
          })
        } else {
          console.log(`[Events] No active sockets for user ${userId}. Event "${event}" not delivered.`)
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, sockets: userSockets.length }))
      } catch (err) {
        console.error('[Events] Error processing /emit:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }))
      }
    }).catch(err => {
      console.error('[Events] Error reading body:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'Failed to read request body' }))
    })
    return
  }

  // GET /health
  if (req.method === 'GET' && req.url === '/health') {
    const connectedUsers = Object.keys(userSocketMap).length
    const totalSockets = io.engine?.clientsCount ?? 0
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      port: PORT,
      connectedUsers,
      totalSockets,
      uptime: Math.floor(process.uptime()),
    }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

// ─── Socket.IO Setup ───

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
})

io.on('connection', (socket) => {
  console.log(`[Events] Socket connected: ${socket.id}`)

  socket.on('register', (userId: string) => {
    if (!userId || typeof userId !== 'string') {
      socket.emit('error', 'Invalid userId')
      return
    }
    addUserSocket(userId, socket)
    socket.data.userId = userId
    console.log(`[Events] Socket ${socket.id} registered as user ${userId}`)
    socket.emit('registered', { userId, message: 'Registered for generation events' })
  })

  socket.on('disconnect', (reason) => {
    const userId = socket.data?.userId
    if (userId) {
      removeUserSocket(userId, socket)
      console.log(`[Events] Socket ${socket.id} (user ${userId}) disconnected: ${reason}`)
    } else {
      console.log(`[Events] Socket ${socket.id} disconnected: ${reason}`)
    }
  })
})

// ─── Start ───

httpServer.listen(PORT, () => {
  console.log(`[Events] PixelForge Generation Events service running on port ${PORT}`)
  console.log(`[Events] Health: http://localhost:${PORT}/health`)
})
