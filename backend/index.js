import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Update with your React client URL in production
  },
});

// Configuration
const PORT = process.env.PORT || 5000;
const RELOAD_URL = `http://localhost:${PORT}`;
const RELOAD_INTERVAL = 30000;

// Periodic Website Reload
function reloadWebsite() {
  axios
    .get(RELOAD_URL)
    .then((response) => {
      console.log(
        `Reloaded at ${new Date().toISOString()}: Status Code ${response.status}`
      );
    })
    .catch((error) => {
      console.error(
        `Error reloading at ${new Date().toISOString()}: ${error.message}`
      );
    });
}

setInterval(reloadWebsite, RELOAD_INTERVAL);

// Room Management
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  let currentRoom = null;
  let currentUser = null;

  socket.on("join", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      if (rooms.has(currentRoom)) {
        rooms.get(currentRoom).delete(currentUser);
        io.to(currentRoom).emit(
          "userJoined",
          Array.from(rooms.get(currentRoom))
        );
      }
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);
    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));

    console.log(`User ${userName} joined room ${roomId}`);
  });

  socket.on("codeChange", ({ roomId, code }) => {
    if (roomId) {
      socket.to(roomId).emit("codeUpdate", code);
    }
  });

  socket.on("typing", ({ roomId, userName }) => {
    if (roomId) {
      socket.to(roomId).emit("userTyping", userName);
    }
  });

  socket.on("languageChange", ({ roomId, language }) => {
    if (roomId) {
      io.to(roomId).emit("languageUpdate", language);
    }
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit(
        "userJoined",
        Array.from(rooms.get(currentRoom))
      );
      socket.leave(currentRoom);
    }

    currentRoom = null;
    currentUser = null;
  });

  socket.on("disconnect", () => {
    if (currentRoom && currentUser && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit(
        "userJoined",
        Array.from(rooms.get(currentRoom))
      );
    }
    console.log("User disconnected:", socket.id);
  });
});

// Static File Serving
const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "frontend", "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
