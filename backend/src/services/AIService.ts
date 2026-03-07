import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppDataSource } from '../database';
import { Settings } from '../entities/Settings';
import axios from 'axios';

export class AIService {
  private static genAI: GoogleGenerativeAI | null = null;
  private static model: any = null;

  static initialize() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    }
  }

  static async generateVideoContent(
    videoTitle: string,
    videoDescription: string,
    category: string = 'general',
    language: string = 'bn'
  ): Promise<{
    title: string;
    description: string;
    tags: string[];
    hashtags: string[];
  }> {
    const settings = await AppDataSource.getRepository(Settings).findOne({ where: {} });
    const aiConfig = settings?.aiConfig || {};
    
    const targetLanguage = aiConfig.language || language;
    const maxTitleLength = aiConfig.maxTitleLength || 100;
    const maxDescriptionLength = aiConfig.maxDescriptionLength || 500;
    const maxHashtags = aiConfig.maxHashtags || 15;

    // Determine content type for better SEO
    const contentType = this.detectContentType(videoTitle, videoDescription);
    
    const prompt = this.buildPrompt(
      videoTitle,
      videoDescription,
      category,
      targetLanguage,
      contentType,
      maxTitleLength,
      maxDescriptionLength,
      maxHashtags
    );

    try {
      let result;
      
      if (aiConfig.model === 'grok' && process.env.GROK_API_KEY) {
        result = await this.callGrokAPI(prompt);
      } else if (this.model) {
        result = await this.callGemini(prompt);
      } else {
        // Fallback to template-based generation
        return this.generateTemplateContent(videoTitle, category, targetLanguage);
      }

      return this.parseAIResponse(result, targetLanguage);
    } catch (error) {
      console.error('AI generation error:', error);
      return this.generateTemplateContent(videoTitle, category, targetLanguage);
    }
  }

  private static buildPrompt(
    videoTitle: string,
    videoDescription: string,
    category: string,
    language: string,
    contentType: string,
    maxTitleLength: number,
    maxDescriptionLength: number,
    maxHashtags: number
  ): string {
    const languageName = language === 'bn' ? 'Bengali/Bangla' : 
                        language === 'en' ? 'English' : language;

    return `
You are an expert YouTube SEO specialist and content creator. Generate engaging, SEO-optimized content for a YouTube Shorts video.

ORIGINAL VIDEO INFO:
- Title: ${videoTitle}
- Description: ${videoDescription || 'N/A'}
- Category: ${category}
- Content Type: ${contentType}

REQUIREMENTS:
1. TITLE (in ${languageName}):
   - Maximum ${maxTitleLength} characters
   - Must be attention-grabbing and click-worthy
   - Include power words and emotional triggers
   - Should create curiosity
   - SEO optimized with relevant keywords

2. DESCRIPTION (in ${languageName}):
   - Maximum ${maxDescriptionLength} characters
   - First 2 lines must hook the viewer
   - Include relevant keywords naturally
   - Add call-to-action (subscribe, like, comment)
   - Make it engaging and informative

3. TAGS (in English):
   - 10-15 relevant tags
   - Mix of broad and specific keywords
   - Include trending tags if applicable
   - Focus on searchability

4. HASHTAGS (in ${languageName} and English mix):
   - Maximum ${maxHashtags} hashtags
   - Mix popular and niche hashtags
   - Include: #Shorts #YouTubeShorts
   - Relevant to content type

CONTENT TYPE GUIDELINES:
${this.getContentTypeGuidelines(contentType)}

Respond in this exact JSON format:
{
  "title": "your generated title",
  "description": "your generated description",
  "tags": ["tag1", "tag2", ...],
  "hashtags": ["#hashtag1", "#hashtag2", ...]
}

IMPORTANT: Response must be valid JSON only, no markdown formatting.
`;
  }

  private static async callGemini(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini not initialized');
    }
    
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  private static async callGrokAPI(prompt: string): Promise<string> {
    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      throw new Error('Grok API key not configured');
    }

    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  }

  private static parseAIResponse(response: string, language: string): {
    title: string;
    description: string;
    tags: string[];
    hashtags: string[];
  } {
    try {
      // Clean up response
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/```\n?$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/```\n?$/, '');
      }

      const parsed = JSON.parse(cleanResponse);

      return {
        title: parsed.title || 'Amazing Video',
        description: parsed.description || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.generateTemplateContent('Video', 'general', language);
    }
  }

  private static generateTemplateContent(
    originalTitle: string,
    category: string,
    language: string
  ): {
    title: string;
    description: string;
    tags: string[];
    hashtags: string[];
  } {
    const templates = this.getTemplates(language, category);
    
    return {
      title: templates.title.replace('{topic}', originalTitle).substring(0, 100),
      description: templates.description.replace('{topic}', originalTitle),
      tags: templates.tags,
      hashtags: templates.hashtags,
    };
  }

  private static getTemplates(language: string, category: string) {
    if (language === 'bn') {
      return {
        title: '🔥 {topic} | আপনি বিশ্বাস করবেন না! 😱',
        description: `🎬 আজকের ভিডিওতে দেখুন {topic}

❤️ ভালো লাগলে লাইক করুন
💬 মতামত জানান কমেন্টে
🔔 সাবস্ক্রাইব করে পাশে থাকুন

#Shorts #YouTubeShorts #Viral`,
        tags: ['shorts', 'viral', 'trending', 'bangla', 'youtube shorts', category],
        hashtags: ['#Shorts', '#YouTubeShorts', '#Viral', '#Trending', '#Bangla', `#${category}`],
      };
    }

    return {
      title: '🔥 {topic} | You Won\'t Believe This! 😱',
      description: `🎬 Watch this amazing ${category} video!

❤️ Like if you enjoyed
💬 Share your thoughts in comments
🔔 Subscribe for more

#Shorts #YouTubeShorts #Viral`,
      tags: ['shorts', 'viral', 'trending', 'youtube shorts', category],
      hashtags: ['#Shorts', '#YouTubeShorts', '#Viral', '#Trending', `#${category}`],
    };
  }

  private static detectContentType(title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('cook') || text.includes('recipe') || text.includes('food') || 
        text.includes('রান্না') || text.includes('খাবার')) {
      return 'cooking';
    }
    
    if (text.includes('waz') || text.includes('islamic') || text.includes('quran') ||
        text.includes('allah') || text.includes('ওয়াজ') || text.includes('ইসলামিক')) {
      return 'islamic';
    }
    
    if (text.includes('funny') || text.includes('comedy') || text.includes('joke') ||
        text.includes('মজা') || text.includes('হাস্য')) {
      return 'entertainment';
    }
    
    if (text.includes('tutorial') || text.includes('how to') || text.includes('tips') ||
        text.includes('শিখুন') || text.includes('টিপস')) {
      return 'educational';
    }
    
    return 'general';
  }

  private static getContentTypeGuidelines(contentType: string): string {
    const guidelines: Record<string, string> = {
      cooking: `
- Focus on food, recipe, cooking techniques
- Use appetizing words: delicious, tasty, mouth-watering
- Include ingredient names and cooking methods
- Target food lovers and home cooks`,
      
      islamic: `
- Focus on religious teachings, Quran, Hadith
- Use respectful and spiritual language
- Include Islamic phrases and references
- Target Muslim audience seeking knowledge`,
      
      entertainment: `
- Focus on humor, fun, entertainment
- Use casual and engaging language
- Include trending references
- Target young audience`,
      
      educational: `
- Focus on learning, knowledge, tips
- Use clear and informative language
- Include actionable advice
- Target learners and curious minds`,
      
      general: `
- Focus on general appeal
- Use engaging and curiosity-driven language
- Include emotional triggers
- Target broad audience`,
    };

    return guidelines[contentType] || guidelines.general;
  }

  static async analyzeVideoForSEO(videoInfo: any): Promise<{
    keywords: string[];
    suggestions: string[];
    bestUploadTime: string;
  }> {
    const prompt = `
Analyze this video information and provide SEO insights:
Title: ${videoInfo.title}
Description: ${videoInfo.description}
Category: ${videoInfo.category}

Provide:
1. Top 10 keywords for this content
2. 5 SEO improvement suggestions
3. Best upload time (considering Bangladesh/Asia timezone)

Respond in JSON format:
{
  "keywords": ["keyword1", "keyword2", ...],
  "suggestions": ["suggestion1", "suggestion2", ...],
  "bestUploadTime": "HH:00"
}
`;

    try {
      let response;
      if (this.model) {
        const result = await this.model.generateContent(prompt);
        response = await result.response.text();
      } else {
        return {
          keywords: ['viral', 'shorts', 'trending'],
          suggestions: ['Use trending hashtags', 'Post at peak hours'],
          bestUploadTime: '20:00',
        };
      }

      return JSON.parse(response);
    } catch (error) {
      return {
        keywords: ['viral', 'shorts', 'trending'],
        suggestions: ['Use trending hashtags', 'Post at peak hours'],
        bestUploadTime: '20:00',
      };
    }
  }
}
