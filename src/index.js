const express = require("express");
const app = express();

const postsRouter = require("./routes/posts"); 

app.use(express.json());

// everything under /api/posts
app.use("/api/posts", postsRouter);

app.use((req, res) => {
  res.json({msg: "Not found"});
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
