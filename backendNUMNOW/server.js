require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");

connectDB();
const app = express();

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

/* -------------------- Security -------------------- */

// HTTP security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // معطل لضمان عمل Socket.io بكل الحالات
  }),
);

// Rate limit عام — 100 طلب / 15 دقيقة لكل IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Rate limit صارم على login و forgot-password — 10 طلبات / 15 دقيقة لكل IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again in 15 minutes." },
});

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5000",
      "https://nomnow-1.onrender.com",
      "https://nomnow-restaurant.onrender.com",
    ],
    credentials: true,
  }),
);

// Rate limit عام — يُطبَّق على restaurant/user/driver فقط، الأدمن مستثنى
app.use("/api/restaurant", generalLimiter);
app.use("/api/user", generalLimiter);
app.use("/api/driver", generalLimiter);

app.use("/api/restaurant/loginwithphone", authLimiter);
app.use("/api/restaurant/loginwithemail", authLimiter);
app.use("/api/restaurant/forgot-password", authLimiter);
app.use("/api/user/loginwithphone", authLimiter);
app.use("/api/user/loginwithemail", authLimiter);
app.use("/api/user/forgot-password", authLimiter);
app.use("/api/driver/loginwithphone", authLimiter);
app.use("/api/driver/forgot-password", authLimiter);

app.use(express.json());
app.use(cookieParser());
/* -------------------- Routes -------------------- */
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/restaurant", require("./routes/restaurant.routes"));
app.use("/api/user", require("./routes/user.routes"));
app.use("/api/driver", require("./routes/driver.routes"));

/* -------------------- Create HTTP Server -------------------- */
const server = http.createServer(app);

/* -------------------- Socket.io -------------------- */
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5000",
      "https://nomnow-1.onrender.com",
      "https://nomnow-restaurant.onrender.com",
    ],
    credentials: true,
  },
});

const driverNS = io.of("/driver");
const restaurantNS = io.of("/restaurant");
const userNS = io.of("/user");

const socketAuth = require("./sockets/middlewares/socketAuth");
const driverSocketAuth = require("./sockets/middlewares/driverSocketAuth");
const initSockets = require("./sockets");
const restaurantSocketAuth = require("./sockets/middlewares/restaurantSocketAuth");

driverNS.use(driverSocketAuth);
restaurantNS.use(restaurantSocketAuth);
userNS.use(socketAuth);

initSockets({ io, driverNS, restaurantNS, userNS });

/* -------------------- Start Server -------------------- */
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
