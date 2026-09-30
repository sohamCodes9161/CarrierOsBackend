import axios from 'axios';
import { env } from '../config/env.js';

export async function fetchRealVideoUrl(query) {
  if (!env.YOUTUBE_API_KEY) return null;
  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', q: query, type: 'video', maxResults: 1, key: env.YOUTUBE_API_KEY },
    });
    if (res.data.items?.length > 0) {
      return `https://www.youtube.com/watch?v=${res.data.items[0].id.videoId}`;
    }
  } catch (err) {
    console.error('YouTube API error:', err.message);
  }
  return null;
}

export async function fetchRealArticleUrl(query) {
  if (!env.GOOGLE_SEARCH_API_KEY || !env.GOOGLE_SEARCH_CX) return null;
  try {
    const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: { q: query, cx: env.GOOGLE_SEARCH_CX, key: env.GOOGLE_SEARCH_API_KEY, num: 1 },
    });
    if (res.data.items?.length > 0) {
      return res.data.items[0].link;
    }
  } catch (err) {
    console.error('Google Search API error:', err.message);
  }
  return null;
}