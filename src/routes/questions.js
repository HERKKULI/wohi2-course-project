const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth"); // TARKISTA ONKO TÄMÄ KANSIO middleware VAI middlewares
const isOwner = require("../middleware/isOwner");

// Kaikki tämän tiedoston reitit vaativat kirjautumisen
router.use(authenticate);

// Apufunktio siistimään päivämäärät ja avainsanat vastaukseen
function formatQuestion(question) {
  if (!question) return null;
  return {
    ...question,
    date: question.date instanceof Date ? question.date.toISOString().split("T")[0] : question.date,
    keywords: question.keywords ? question.keywords.map((k) => k.name) : [],
  };
}

// GET /questions - Listaa kaikki tai suodata avainsanalla
router.get("/", async (req, res) => {
  try {
    const { keyword } = req.query;
    const where = keyword ? { keywords: { some: { name: keyword } } } : {};

    const questions = await prisma.question.findMany({
      where,
      include: { keywords: true },
      orderBy: { id: "asc" },
    });

    res.json(questions.map(formatQuestion));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Virhe haettaessa kysymyksiä" });
  }
});

// GET /questions/:questionId - Näytä yksi
router.get("/:questionId", async (req, res) => {
  try {
    const questionId = Number(req.params.questionId);
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { keywords: true },
    });

    if (!question) return res.status(404).json({ message: "Kysymystä ei löytynyt" });
    res.json(formatQuestion(question));
  } catch (error) {
    res.status(500).json({ error: "Palvelinvirhe" });
  }
});

// POST /questions - Luo uusi
router.post("/", async (req, res) => {
  try {
    const { title, date, content, keywords } = req.body;
    if (!title || !date || !content) {
      return res.status(400).json({ message: "title, date, and content are required" });
    }

    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    const newQuestion = await prisma.question.create({
      data: {
        title,
        date: new Date(date),
        content,
        userId: req.user.userId, // Varmista että middleware asettaa req.user.userId:n
        keywords: {
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
      include: { keywords: true },
    });
    res.status(201).json(formatQuestion(newQuestion));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Kysymyksen luonti epäonnistui" });
  }
});

// PUT /questions/:questionId - Muokkaa (vain omistajalle)
router.put("/:questionId", isOwner, async (req, res) => {
  try {
    const questionId = Number(req.params.questionId);
    const { title, date, content, keywords } = req.body;

    if (!title || !date || !content) {
      return res.status(400).json({ msg: "title, date and content are mandatory" });
    }

    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        title,
        date: new Date(date),
        content,
        keywords: {
          set: [], // Nollataan vanhat avainsanat
          connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
      include: { keywords: true },
    });
    res.json(formatQuestion(updatedQuestion));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Muokkaus epäonnistui" });
  }
});

// DELETE /questions/:questionId - Poista (vain omistajalle)
router.delete("/:questionId", isOwner, async (req, res) => {
  try {
    const questionId = Number(req.params.questionId);
    const deleted = await prisma.question.delete({
      where: { id: questionId },
      include: { keywords: true },
    });
    res.json({ message: "Deleted successfully", question: formatQuestion(deleted) });
  } catch (error) {
    res.status(500).json({ error: "Poisto epäonnistui" });
  }
});

module.exports = router;