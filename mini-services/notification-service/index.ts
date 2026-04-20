import { Server } from 'socket.io'

const PORT = 3003

const io = new Server(PORT, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

console.log(`[Notification Service] Running on port ${PORT}`)

// Store connected clients: userId -> Set<socketId>
const userSockets = new Map<string, Set<string>>()

io.on('connection', (socket) => {
  console.log(`[Notification Service] Client connected: ${socket.id}`)

  // Client registers with their userId
  socket.on('register', (userId: string) => {
    if (!userId) return

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set())
    }
    userSockets.get(userId)!.add(socket.id)
    console.log(`[Notification Service] User ${userId} registered (${userSockets.get(userId)!.size} connections)`)
  })

  socket.on('disconnect', () => {
    // Remove socket from all users
    for (const [userId, sockets] of userSockets) {
      sockets.delete(socket.id)
      if (sockets.size === 0) {
        userSockets.delete(userId)
        console.log(`[Notification Service] User ${userId} fully disconnected`)
      }
    }
    console.log(`[Notification Service] Client disconnected: ${socket.id}`)
  })
})

// HTTP server for callback to notify
const httpServer = io.httpServer

httpServer.on('request', (req, res) => {
  if (req.method === 'POST' && req.url === '/notify') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const { userId, taskId, status, resultUrl, errorTitle, errorMessage } = data

        console.log(`[Notification Service] Received notification: userId=${userId}, taskId=${taskId}, status=${status}`)

        if (userId && userSockets.has(userId)) {
          const sockets = userSockets.get(userId)!
          const payload = { taskId, status, resultUrl: resultUrl || null, errorTitle: errorTitle || null, errorMessage: errorMessage || null }

          for (const socketId of sockets) {
            io.to(socketId).emit('generation-update', payload)
          }
          console.log(`[Notification Service] Notified ${sockets.size} client(s) for user ${userId}`)
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch (err) {
        console.error('[Notification Service] Error parsing notification:', err)
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Invalid body' }))
      }
    })
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', connections: io.engine.clientsCount }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})
