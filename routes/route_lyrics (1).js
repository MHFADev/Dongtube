import { Router } from "express";
import axios from "axios";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

async function searchLyrics(title) {
  if (!title) throw new Error("Title is required");

  const { data } = await axios.get(
    `https://lrclib.net/api/search?q=${encodeURIComponent(title)}`,
    {
      headers: {
        referer: `https://lrclib.net/search/${encodeURIComponent(title)}`,
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      },
      timeout: 30000
    }
  );

  return data;
}

router.get("/api/lyrics/search", asyncHandler(async (req, res) => {
  const { q } = req.query;
  
  if (!validate.notEmpty(q)) {
    return res.status(400).json({
      success: false,
      error: "Query is required"
    });
  }
  
  const data = await searchLyrics(q);
  res.json({
    success: true,
    query: q,
    count: data.length,
    data
  });
}));

router.post("/api/lyrics/search", asyncHandler(async (req, res) => {
  const { q } = req.body;
  
  if (!validate.notEmpty(q)) {
    return res.status(400).json({
      success: false,
      error: "Query is required"
    });
  }
  
  const data = await searchLyrics(q);
  res.json({
    success: true,
    query: q,
    count: data.length,
    data
  });
}));

export const metadata = {
  name: "Lyrics Search",
  path: "/api/lyrics/search",
  method: "GET, POST",
  description: "Search song lyrics with synchronized timestamps",
  params: [
    {
      name: "q",
      type: "text",
      required: true,
      placeholder: "Shape of You",
      description: "Song title or artist name"
    }
  ]
};

export default router;