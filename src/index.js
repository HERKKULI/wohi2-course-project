const express = require("express");
const app = express();
const questionRouter = require("./routes/questions"); 
const prisma = require("./lib/prisma");
const authRouter = require("./routes/auth");

app.use(express.json());

// everything under /api/posts
app.use("/api/auth", authRouter);
app.use("/api/questions", questionRouter);

app.use((req, res) => {
  res.json({msg: "Not found"});
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
