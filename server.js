/**
 * Mandisathi - Server Entry Point
 * Initialized with Express and Socket.io for real-time queue & procurement updates
 */
const { app, server, io } = require("./backend/server.js");

module.exports = { app, server, io };

