import { Video } from "@shared/schema";

interface InstagramMedia {
  id: string;
  shortcode: string;
  display_url: string;
  video_url?: string;
  is_video: boolean;
  edge_media_to_caption: {
    edges: {
      node: {
        text: string;
      };
    }[];
  };
  owner: {
    id: string;
    username: string;
    full_name: string;
    profile_pic_url: string;
  };
  edge_media_preview_like: {
    count: number;
  };
  edge_media_to_comment: {
    count: number;
  };
  edge_media_to_parent_comment?: {
    count: number;
  };
  edge_liked_by?: {
      count: number;
  }
}

interface RocketApiResponse {
  status: string; // "ok"
  response: {
    body: {
        shortcode_media: InstagramMedia;
    }
  };
}

export async function getPostDetails(url: string): Promise<Partial<Video> & { authorName: string, authorAvatar: string }> {
  const shortcode = extractShortcode(url);
  if (!shortcode) {
    throw new Error("Invalid Instagram URL");
  }

  const apiKey = process.env.ROCKET_API_KEY;
  if (!apiKey) {
    throw new Error("ROCKET_API_KEY is not set");
  }

  // RocketAPI endpoint for getting info by shortcode
  // Based on common patterns, but we might need to verify the exact path.
  // Often it is get_info with shortcode param or get_info_by_shortcode
  // Docs suggested `get_info_by_shortcode`.
  const apiUrl = "https://v1.rocketapi.io/instagram/media/get_info_by_shortcode";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${apiKey}`
    },
    body: JSON.stringify({ shortcode })
  });
  
  if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RocketAPI Error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as RocketApiResponse;
  
  if (data.status !== "ok" || !data.response?.body?.shortcode_media) {
     console.error("RocketAPI Response:", JSON.stringify(data, null, 2));
     throw new Error("Failed to retrieve media details from RocketAPI");
  }

  const media = data.response.body.shortcode_media;

  // Map to our domain
  const caption = media.edge_media_to_caption.edges[0]?.node?.text || "";
  const likes = media.edge_media_preview_like?.count || media.edge_liked_by?.count || 0;
  const comments = media.edge_media_to_comment?.count || media.edge_media_to_parent_comment?.count || 0;
  
  // Note: RocketAPI might treat shares differently or not expose them directly on public scraping.
  // We'll default shares to 0 or a random number if needed, but for now 0.
  const shares = 0; 
  
  const videoUrl = media.is_video && media.video_url ? media.video_url : media.display_url;

  return {
      url: videoUrl,
      username: media.owner.username,
      caption: caption,
      likes: likes,
      comments: comments,
      shares: shares,
      authorName: media.owner.full_name,
      authorAvatar: media.owner.profile_pic_url
  };
}

function extractShortcode(url: string): string | null {
  // Supports:
  // https://www.instagram.com/p/SHORTCODE/
  // https://www.instagram.com/reel/SHORTCODE/
  // https://instagram.com/p/SHORTCODE
  
  const regex = /instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
