const express = require("express");
const router = express.Router();

const posts = require("../data/posts");

// GET /posts 
// List all posts
router.get("/", (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.json(posts);
  }

  const filteredPosts = posts.filter(post =>
    post.keywords.includes(keyword.toLowerCase())
  );

  res.json(filteredPosts);
});

// GET /posts/:postId
// Show a specific post
router.get("/:postId", (req, res) => {
  const postId = Number(req.params.postId);

  const post = posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  res.json(post);
});

module.exports = router;

// POST /posts
// Create a new post
router.post("/", (req, res) => {
  const { title, date, content, keywords } = req.body;

  if (!title || !date || !content) {
    return res.status(400).json({
      message: "title, date, and content are required"
    });
  }
  const maxId = Math.max(...posts.map(p => p.id), 0);

  const newPost = {
    id: posts.length ? maxId + 1 : 1,
    title, date, content,
    keywords: Array.isArray(keywords) ? keywords : []
  };
  posts.push(newPost);
  res.status(201).json(newPost);
});

// PUT /posts/:postId
// Edit a post
router.put("/:postId", (req, res) => {
  const postId = Number(req.params.postId);
  const { title, date, content, keywords } = req.body;

  const post = posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (!title || !date || !content) {
    return res.json({
      message: "title, date, and content are required"
    });
  }

  post.title = title;
  post.date = date;
  post.content = content;
  post.keywords = Array.isArray(keywords) ? keywords : [];

  res.json(post);
});

// DELETE /posts/:postId
// Delete a post
router.delete("/:postId", (req, res) => {
  const postId = Number(req.params.postId);

  const postIndex = posts.findIndex((p) => p.id === postId);

  if (postIndex === -1) {
    return res.status(404).json({ message: "Post not found" });
  }

  const deletedPost = posts.splice(postIndex, 1);

  res.json({
    message: "Post deleted successfully",
    post: deletedPost[0]
  });
});
