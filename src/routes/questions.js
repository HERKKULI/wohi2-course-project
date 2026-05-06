const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require('path');

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Apply authentication to ALL routes
router.use(authenticate);

// 1. UPDATED: Format Question logic for Attempts, Badges, and Frontend Naming
function formatQuestion(question) {
  // 1. Lasketaan yritykset
  // 'attempts' sisältää vain TÄMÄN käyttäjän yritykset (koska haku on rajattu GET-reitissä)
  // '_count.attempts' sisältää KAIKKIEN käyttäjien yritysten määrän
  const userAttempts = question.attempts || [];
  const isSolved = userAttempts.some(a => a.isCorrect);

  return {
    ...question,
    question: question.title, 
    answer: question.content,
    date: question.date.toISOString().split("T")[0],
    keywords: question.keywords ? question.keywords.map((k) => k.name) : [],
    userName: question.user?.name || null,
    
    // TÄMÄ ON TÄRKEÄ: Lähetetään yritysten määrä useammalla eri nimellä varmuuden vuoksi
    attemptCount: question._count?.attempts ?? 0,
    attemptsCount: question._count?.attempts ?? 0, 
    
    // Solved-status
    isSolved: isSolved, 
    solved: isSolved, 
    
    // Siivotaan Prisman omat liitostaulut pois
    title: undefined,
    content: undefined,
    user: undefined,
    attempts: undefined, 
    _count: undefined,
  };
}

// GET /questions 
// List all questions
router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const where = keyword
    ? { keywords: { some: { name: keyword } } }
    : {};

  const [filteredQuestions, total] = await Promise.all([
    prisma.question.findMany({
        where,
        include: {
            keywords: true,
            user: true,
            attempts: { where: { userId: req.user.userId } }, 
            _count: { select: { attempts: true } },
        },
        orderBy: { id: "asc" },
        skip,
        take: limit,
    }),
    prisma.question.count({ where }),
  ]);

  res.json({
    data: filteredQuestions.map(formatQuestion),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { 
        keywords: true, 
        user: true,
        attempts: { where: { userId: req.user.userId } },
        _count: { select: { attempts: true } }  
    },
  });

  if (!question) {
    return res.status(404).json({ message: "question not found" });
  }

  res.json(formatQuestion(question));
});

// POST /questions
// Create a new question
router.post("/", upload.single("image"), async (req, res) => {
  // MUUTETTU: Luetaan frontendin lähettämät 'question' ja 'answer'
  const { question, answer, keywords } = req.body; 

  if (!question || !answer) {
    return res.status(400).json({
      message: "question and answer are required"
    });
  }
  
  const keywordsArray = Array.isArray(keywords) ? keywords : [];
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  try {
    const newQuestion = await prisma.question.create({
        data: {
        // MUUTETTU: Tallennetaan tietokantaan nimillä 'title' ja 'content'
        title: question, 
        content: answer, 
        imageUrl,
        date: new Date(), 
        userId: req.user.userId,
        keywords: {
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw }, create: { name: kw },
          })), 
        },
      },
      include: { keywords: true, user: true, _count: { select: { attempts: true } } },
      });
      res.status(201).json(formatQuestion(newQuestion));
  } catch (error) {
      res.status(500).json({ message: "Error creating question", error: error.message });
  }
});


// PUT /questions/:questionId
// Edit a question
router.put("/:questionId", upload.single("image"), isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);
  
  // MUUTETTU: Luetaan frontendin lähettämät 'question' ja 'answer'
  const { question, answer, keywords } = req.body;

  const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
  if (!existingQuestion) {
    return res.status(404).json({ message: "Question not found" });
  }

  if (!question || !answer) {
    return res.status(400).json({ msg: "question and answer are mandatory" });
  }
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : existingQuestion.imageUrl;

  const keywordsArray = Array.isArray(keywords) ? keywords : [];
  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      // MUUTETTU: Tallennetaan tietokantaan nimillä 'title' ja 'content'
      title: question, 
      content: answer, 
      imageUrl,
      keywords: {
        set: [],
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true, user: true, _count: { select: { attempts: true } } },
  });
  res.json(formatQuestion(updatedQuestion));
});


// DELETE /questions/:questionId
// Delete a question
router.delete("/:questionId", isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true, user: true, _count: { select: { attempts: true } } },
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

// POST /questions/:questionId/play
// Attempts / Play (M:N + correctness + "solved" badge)
router.post("/:questionId/play", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const { answer } = req.body; 
  
    if (!answer) {
      return res.status(400).json({ message: "Answer is required" });
    }
  
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
  
    // Check correctness (case-insensitive and ignoring extra spaces)
    const isCorrect = answer.trim().toLowerCase() === question.content.trim().toLowerCase();
  
    // Save the attempt
    const attempt = await prisma.attempt.create({
      data: {
        userId: req.user.userId,
        questionId: questionId,
        userAnswer: answer,
        isCorrect: isCorrect,
      },
    });
  
    // Calculate the "Solved" badge status
    const correctAttemptsCount = await prisma.attempt.count({
      where: { 
        userId: req.user.userId, 
        questionId: questionId, 
        isCorrect: true 
      }
    });
  
    res.status(201).json({
      message: isCorrect ? "Correct!" : "Incorrect!",
      correct: isCorrect, // Frontendin if-lause tarvitsee tämän
      isSolved: correctAttemptsCount > 0,
      
      // Korjataan "undefined" paljastamatta vastausta:
      // Koska frontti näyttää "The answer was: ${result.correctAnswer}", 
      // tämä saa sen näyttämään: "The answer was: not this one! Try again."
      correctAnswer: isCorrect ? question.content : "not this one! Try again.",
      
      attempt: attempt
    });
});

module.exports = router;