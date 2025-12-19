import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = apiKey 
  ? new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: apiKey
    })
  : null;

export interface GeneratedComment {
  authorName: string;
  body: string;
  likes: number;
}

export async function generateComments(
  videoCaption: string,
  videoUsername: string,
  count: number = 5,
  tone: string = "mixed"
): Promise<GeneratedComment[]> {
  // Mock fallback if validation fails or explicit mock mode
  if (!openai) {
      console.log("No OpenAI API key found, returning mock comments");
      return Array.from({ length: count }).map((_, i) => ({
          authorName: `user_${Math.floor(Math.random() * 1000)}`,
          body: `This is a mock comment ${i + 1} for testing purposes. Nice video!`,
          likes: Math.floor(Math.random() * 100)
      }));
  }

  const toneDescription = tone === "positive" 
    ? "supportive, enthusiastic, and positive" 
    : tone === "negative" 
    ? "critical, skeptical, or negative" 
    : "a realistic mix of positive, neutral, and occasionally critical";

  const prompt = `Generate ${count} realistic social media comments for an Instagram/TikTok video.

Video posted by: @${videoUsername}
Video caption: "${videoCaption}"

The comments should be ${toneDescription}. Make them feel authentic like real user comments - varying lengths, some with emojis, some casual, some more thoughtful.

Respond with a JSON object containing an array of comments. Each comment should have:
- authorName: a realistic username (no @ symbol, lowercase with optional underscores/numbers)
- body: the comment text (1-150 characters)
- likes: number of likes (0-500, most should be low)

JSON format:
{
  "comments": [
    {"authorName": "user_name", "body": "comment text", "likes": 12},
    ...
  ]
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5", 
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return (parsed.comments || []).map((c: any) => ({
      authorName: String(c.authorName || "user"),
      body: String(c.body || ""),
      likes: Number(c.likes) || 0
    }));
  } catch (error) {
    console.error("Failed to parse OpenAI response or API error:", error);
    // Fallback on error too
     return Array.from({ length: count }).map((_, i) => ({
          authorName: `backup_user_${Math.floor(Math.random() * 1000)}`,
          body: `Backup comment ${i + 1} (API Error)`,
          likes: 0
      }));
  }
}
