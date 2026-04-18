const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");


function formatQuestion(question) {
  return {
    ...question,
    date: question.date.toISOString().split("T")[0],
    keywords: question.keywords.map((k) => k.name),
  };
}


// GET /questions 
// List all questions
router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const where = keyword
    ? { keywords: { some: { name: keyword } } }
    : {};

  const questions = await prisma.question.findMany({
    where,
    include: { keywords: true },
    orderBy: { id: "asc" },
  });

  res.json(questions.map(formatQuestion));
});

// GET /questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true },
  });

  if (!question) {
    return res.status(404).json({ message: "question not found" });
  }

  res.json(formatQuestion(question));
});



// question /questions
// Create a new question
router.post("/", async (req, res) => {
  const { title, date, content, keywords } = req.body;

  if (!title || !date || !content) {
    return res.status(400).json({
      message: "title, date, and content are required"
    });
  }
  const keywordsArray = Array.isArray(keywords) ? keywords : [];


  const newQuestion = await prisma.question.create({
      data: {
      title, date: new Date(date), content,
      keywords: {
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw }, create: { name: kw },
        })), },
    },
    include: { keywords: true },
  });
  res.status(201).json(formatQuestion(newQuestion));
});


// PUT /questions/:questionId
// Edit a question
router.put("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { title, date, content, keywords } = req.body;

    const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
  if (!existingQuestion) {
    return res.status(404).json({ message: "Question not found" });
  }

  if (!title || !date || !content) {
    return res.status(400).json({ msg: "title, date and content are mandatory" });
  }

  const keywordsArray = Array.isArray(keywords) ? keywords : [];
  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      title, date: new Date(date), content,
      keywords: {
        set: [],
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true },
  });
  res.json(formatQuestion(updatedQuestion));
});


// DELETE /questions/:questionId
// Delete a question
router.delete("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  await prisma.question.delete({ where: { id: questionId } });

  res.json({
    message: "Question deleted successfully",
    question: formatQuestion(question),
  });
});


module.exports = router;
