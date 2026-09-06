const { Server } = require("socket.io");

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"]
    },
    pingTimeout: 30000,
    pingInterval: 25000
  });

  io.on("connection", (socket) => {
    console.log(`🔌 [Socket.io] Client connected: ${socket.id}`);

    // Welcome acknowledgment
    socket.emit("connected", {
      status: "connected",
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Farmer joins their private room
    socket.on("join:farmer", ({ farmerId }) => {
      if (farmerId) {
        socket.join(`farmer:${farmerId}`);
        console.log(`🌾 [Socket.io] Socket ${socket.id} joined room farmer:${farmerId}`);
        socket.emit("room:joined", { room: `farmer:${farmerId}` });
      }
    });

    // Client joins centre room for live queue/telemetry updates
    socket.on("join:centre", ({ centreId }) => {
      if (centreId) {
        socket.join(`centre:${centreId}`);
        console.log(`🏢 [Socket.io] Socket ${socket.id} joined room centre:${centreId}`);
        socket.emit("room:joined", { room: `centre:${centreId}` });
      }
    });

    // Admin joins admin dashboard room for real-time monitoring
    socket.on("join:admin", () => {
      socket.join("admin_room");
      console.log(`🛡️ [Socket.io] Socket ${socket.id} joined admin_room`);
      socket.emit("room:joined", { room: "admin_room" });
    });

    // Client requests immediate queue update
    socket.on("request:queue", async (data) => {
      try {
        const Centre = require("./models/Centre");
        const centres = await Centre.find();
        socket.emit("queue-update", {
          centres: centres || [],
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Error handling request:queue:", err.message);
      }
    });

    // Heartbeat ping/pong
    socket.on("ping:heartbeat", (data) => {
      socket.emit("pong:heartbeat", { clientTime: data?.time, serverTime: Date.now() });
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 [Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

function getIO() {
  return io;
}

// Broadcast queue update to all connected clients & centre rooms
function emitQueueUpdate(data) {
  if (io) {
    io.emit("queue-update", data);
    if (data && data.centreId) {
      io.to(`centre:${data.centreId}`).emit("queue-update", data);
    }
  }
}

// Broadcast procurement update to farmer, admin room and global
function emitProcurementUpdate(farmerId, data) {
  if (io) {
    if (farmerId) {
      io.to(`farmer:${farmerId}`).emit("procurement-update", data);
      io.to(`farmer:${farmerId}`).emit("token:status_changed", data);
    }
    io.to("admin_room").emit("procurement-update", data);
    io.to("admin_room").emit("admin:procurement_updated", data);
    io.emit("procurement-update", data);
  }
}

// Broadcast to a specific farmer
function emitToFarmer(farmerId, event, data) {
  if (io && farmerId) {
    io.to(`farmer:${farmerId}`).emit(event, data);
    // Also notify admin room for operational tracking
    io.to("admin_room").emit(event, data);
  }
}

// Broadcast to a specific centre room
function emitToCentre(centreId, event, data) {
  if (io && centreId) {
    io.to(`centre:${centreId}`).emit(event, data);
  }
}

// Broadcast to all connected clients
function emitToAll(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

// Broadcast to admin room
function emitToAdmin(event, data) {
  if (io) {
    io.to("admin_room").emit(event, data);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitQueueUpdate,
  emitProcurementUpdate,
  emitToFarmer,
  emitToCentre,
  emitToAll,
  emitToAdmin
};
