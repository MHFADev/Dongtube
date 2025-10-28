import { Router } from "express";
import HTTPClient from "../utils/HTTPClient.js";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

class TikTok extends HTTPClient {
  constructor() {
    super("https://www.tikwm.com");
  }
  
  async download(url) {
    if (!validate.url(url, "tiktok.com")) {
      throw new Error("Invalid TikTok URL");
    }
    const data = await this.get("/api/", { params: { url } });
    if (!data?.data) throw new Error("Failed to fetch TikTok data");
    return data.data;
  }
}

const tiktok = new TikTok();

// GET endpoint
router.get("/api/d/tiktok", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: "URL parameter is required" });
  }
  const result = await tiktok.download(url);
  res.json({ success: true, data: result });
}));

// POST endpoint
router.post("/api/d/tiktok", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required in body" });
  }
  const result = await tiktok.download(url);
  res.json({ success: true, data: result });
}));

export const metadata = {
  name: "TikTok Download",
  path: "/api/d/tiktok",
  method: "GET, POST",
  description: "Download TikTok videos without watermark",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.tiktok.com/@user/video/123",
      description: "TikTok video URL"
    }
  ]
};

export default router;
