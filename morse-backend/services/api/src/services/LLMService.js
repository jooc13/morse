const os = require('os');

// Abstract base class for LLM providers
class LLMProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async generateResponse(prompt) {
    throw new Error('generateResponse must be implemented');
  }

  healthCheck() {
    throw new Error('healthCheck must be implemented');
  }
}

class ClaudeProvider extends LLMProvider {
  constructor(apiKey) {
    super(apiKey);
    try {
      const anthropic = require('@anthropic-ai/sdk');
      this.client = new anthropic({ apiKey });
      this.model = "claude-sonnet-4-20250514";
    } catch (error) {
      console.warn('Anthropic SDK not available, falling back to HTTP requests');
      this.client = null;
    }
  }

  async generateResponse(prompt) {
    if (!this.client) {
      throw new Error('Claude provider not properly initialized');
    }
    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }]
      });
      return message.content[0].text;
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  healthCheck() {
    try {
      return !!(this.apiKey && this.client);
    } catch (error) {
      return false;
    }
  }
}

class GeminiProvider extends LLMProvider {
  constructor(apiKey) {
    super(apiKey);
    const axios = require('axios');
    this.axios = axios;
    this.model = 'gemini-2.0-flash-001';
  }

  async generateResponse(prompt) {
    try {
      const response = await this.axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );
      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  healthCheck() {
    try {
      return !!this.apiKey;
    } catch (error) {
      return false;
    }
  }
}

class OpenAIProvider extends LLMProvider {
  constructor(apiKey) {
    super(apiKey);
    try {
      const OpenAI = require('openai');
      this.client = new OpenAI({ apiKey });
      this.model = 'gpt-4o-mini'; // Use the most cost-effective model
    } catch (error) {
      console.warn('OpenAI SDK not available:', error.message);
      this.client = null;
    }
  }

  async generateResponse(prompt) {
    if (!this.client) {
      throw new Error('OpenAI provider not properly initialized');
    }
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });
      return completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error);

      // Check if it's a quota or rate limit error
      const errorMessage = error.message || '';
      const isQuotaError = errorMessage.includes('quota') ||
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('insufficient_quota') ||
                          error.status === 429 ||
                          error.status === 402;

      if (isQuotaError) {
        error.quotaError = true;
      }

      throw error;
    }
  }

  healthCheck() {
    try {
      return !!(this.apiKey && this.client);
    } catch (error) {
      return false;
    }
  }
}

class LLMService {
  constructor() {
    this.provider = this._initializeProvider();
    if (!this.provider) {
      console.error("LLM Provider initialization failed. Environment check:");
      console.error("LLM_PROVIDER:", process.env.LLM_PROVIDER);
      console.error("OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);
      console.error("ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY);
      console.error("GOOGLE_API_KEY present:", !!process.env.GOOGLE_API_KEY);
      throw new Error("No valid LLM provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY");
    }
  }

  _initializeProvider() {
    // Check for provider preference
    const llmProvider = (process.env.LLM_PROVIDER || 'auto').toLowerCase();

    if (llmProvider === 'anthropic' || llmProvider === 'claude') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        console.log("Using Anthropic Claude provider");
        return new ClaudeProvider(apiKey);
      } else {
        console.warn("ANTHROPIC_API_KEY not found, trying other providers");
      }
    } else if (llmProvider === 'google' || llmProvider === 'gemini') {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (apiKey) {
        console.log("Using Google Gemini provider");
        return new GeminiProvider(apiKey);
      } else {
        console.warn("GOOGLE_API_KEY not found, trying other providers");
      }
    } else if (llmProvider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        console.log("Using OpenAI provider");
        return new OpenAIProvider(apiKey);
      } else {
        console.warn("OPENAI_API_KEY not found, trying other providers");
      }
    } else if (llmProvider === 'auto') {
      // Auto-detect best available provider
      // Priority: OpenAI > Claude > Gemini (due to recent Gemini key issues)
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        console.log("Auto-selected OpenAI provider");
        return new OpenAIProvider(openaiKey);
      }

      // Fallback to Claude
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        console.log("Auto-selected Anthropic Claude provider");
        return new ClaudeProvider(anthropicKey);
      }

      // Last resort: Gemini
      const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (googleKey) {
        console.log("Auto-selected Google Gemini provider (last resort)");
        return new GeminiProvider(googleKey);
      }
    }

    return null;
  }

  async extractWorkoutData(transcription, deviceUuid, isSession = false, recordingCount = 1) {
    try {
      console.log(`Processing transcription with ${this.provider.constructor.name} for device ${deviceUuid}`);

      // Use the proven extraction prompt from 656-main with session handling from vibecode
      const prompt = this._buildExtractionPrompt(transcription, isSession, recordingCount);

      const response = await this.provider.generateResponse(prompt);
      const workoutData = this._parseLLMResponse(response);

      if (!workoutData) {
        throw new Error('Failed to parse workout data from LLM response');
      }

      const exerciseCount = workoutData.exercises?.length || 0;
      console.log(`Successfully extracted workout data: ${exerciseCount} exercises from ${recordingCount} recording(s)`);

      return {
        success: true,
        workout: workoutData
      };

    } catch (error) {
      console.error('LLM processing error:', error.message);

      // Check if it's a quota/rate limit error - these should be retried later
      const errorMessage = error.response?.data?.error?.message || error.message;
      let isQuotaError = errorMessage.includes('quota') ||
                          errorMessage.includes('rate limit') ||
                          errorMessage.includes('insufficient_quota') ||
                          error.response?.status === 429 ||
                          error.status === 429 ||
                          error.status === 402;

      // Also check the custom quotaError flag from OpenAI provider
      if (error.quotaError) {
        isQuotaError = true;
      }

      if (isQuotaError) {
        const retryAfter = error.response?.data?.error?.retryAfter ||
                          error.response?.headers?.['retry-after'] ||
                          3600; // Default 1 hour for quota errors
        return {
          success: false,
          error: errorMessage,
          retryable: true,
          retryAfter: retryAfter
        };
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  _buildExtractionPrompt(transcription, isSession = false, recordingCount = 1) {
    // Session context for handling multiple recordings
    let sessionContext = "";
    if (isSession && recordingCount > 1) {
      sessionContext = `
IMPORTANT: This transcription contains ${recordingCount} separate audio recordings from a single workout session.
The recordings are labeled as "Recording 1:", "Recording 2:", etc. These are NOT separate workouts - they are all part of ONE workout session.

Examples of how to interpret multiple recordings:
- Recording 1: "bench press 185 5 reps" + Recording 2: "bench press 205 5 reps" = One exercise (Bench Press) with 2 sets at different weights
- Recording 1: "squats 185 8 reps" + Recording 2: "squats 185 8 reps" + Recording 3: "squats 185 6 reps" = One exercise (Squats) with 3 sets
- Recording 1: "bench press 3 sets 185" + Recording 2: "push-ups 20 reps" = Two different exercises in the same workout

CRITICAL: Combine all recordings into a SINGLE workout with multiple exercises. Do not create separate workouts.`;
    }

    return `You are a fitness expert assistant. Extract structured workout data from the following audio transcription of someone describing their workout.
${sessionContext}
IMPORTANT: The transcription may contain fragmented or incomplete sentences. Users may say things like:
- "5 sets 185lbs bench press 4 sets" (where they correct themselves)
- "bench press 185 5 sets 8 reps"
- "did some push-ups 3 sets 10 reps each"
- "squats with 185 pounds 4 sets"
- Numbers and weights mentioned separately from exercise names

Parse these fragments intelligently and extract the most likely intended workout data.

The transcription may contain:
- Exercise names (may be abbreviated or colloquial)
- Number of sets and reps (may be mentioned in any order)
- Weights used (in lbs, may be said as "pounds" or just numbers)
- Duration for cardio exercises
- Effort level (1-10 scale, or descriptive words)
- Rest periods
- General notes about the workout

Extract the data and format it as JSON with this exact structure:

{
  "date_completed": null,
  "workout_start_time": "HH:MM" or null,
  "workout_duration_minutes": number or null,
  "notes": "string or null",
  "exercises": [
    {
      "exercise_name": "standardized exercise name",
      "exercise_type": "strength|cardio|flexibility|other",
      "muscle_groups": ["list", "of", "muscle", "groups"],
      "sets": number or null,
      "reps": [array, of, rep, counts] or null,
      "weight_lbs": [array, of, weights] or null,
      "duration_minutes": number or null,
      "distance_miles": number or null,
      "effort_level": number (1-10) or null,
      "rest_seconds": number or null,
      "notes": "string or null",
      "order_in_workout": number
    }
  ]
}

Guidelines:
1. Standardize exercise names (e.g., "Push-ups", "Bench Press", "Squats")
2. Infer muscle groups based on exercise names
3. If sets/reps are mentioned as "3 sets of 10", create reps array [10, 10, 10]
4. Handle fragmented speech - if someone says "5 sets 185lbs bench press 4 sets", interpret as "bench press, 4 sets, 185lbs"
5. When numbers appear without clear context, use workout knowledge to assign them (e.g., "bench press 185 5" = 5 reps at 185lbs)
6. If weight varies per set, include all weights in weight_lbs array
7. Do not extract workout dates - always set date_completed to null
8. Estimate effort level from descriptive words (easy=3-4, moderate=5-6, hard=7-8, very hard=9-10)
9. Order exercises as they appear in the transcription
10. If unclear about data, use null rather than guessing
11. Look for corrections in speech - if someone mentions different numbers for the same parameter, use the last mentioned value
12. For multiple recordings: Intelligently combine related exercises (same exercise name) into single exercises with multiple sets
13. For multiple recordings: Maintain the chronological order of exercises as they appear across all recordings

Transcription:
"${transcription}"

Respond with ONLY the JSON object, no additional text or explanation.`;
  }

  _parseLLMResponse(response) {
    try {
      // Clean up the response - sometimes LLMs add extra text
      response = response.trim();

      // Find JSON object in response
      const startIdx = response.indexOf('{');
      const endIdx = response.lastIndexOf('}') + 1;

      if (startIdx === -1 || endIdx === 0) {
        console.error("No JSON object found in response");
        return null;
      }

      const jsonStr = response.substring(startIdx, endIdx);
      const workoutData = JSON.parse(jsonStr);

      // Validate and clean the data
      return this._validateWorkoutData(workoutData);

    } catch (error) {
      console.error('JSON parsing error:', error);
      console.error('Response:', response);
      return null;
    }
  }

  _validateWorkoutData(data) {
    try {
      // Set defaults - always use today's date for new uploads
      data.date_completed = new Date().toISOString().split('T')[0];

      if (!data.exercises) {
        data.exercises = [];
      }

      // Validate exercises
      const validatedExercises = [];
      for (let i = 0; i < data.exercises.length; i++) {
        const exercise = data.exercises[i];
        const validatedExercise = {
          exercise_name: exercise.exercise_name || 'Unknown Exercise',
          exercise_type: exercise.exercise_type || 'other',
          muscle_groups: exercise.muscle_groups || [],
          sets: exercise.sets || null,
          reps: exercise.reps || null,
          weight_lbs: exercise.weight_lbs || null,
          duration_minutes: exercise.duration_minutes || null,
          distance_miles: exercise.distance_miles || null,
          effort_level: exercise.effort_level || null,
          rest_seconds: exercise.rest_seconds || null,
          notes: exercise.notes || null,
          order_in_workout: exercise.order_in_workout || (i + 1)
        };

        // Validate effort level range
        if (validatedExercise.effort_level !== null) {
          const effort = validatedExercise.effort_level;
          if (!Number.isFinite(effort) || effort < 1 || effort > 10) {
            validatedExercise.effort_level = null;
          }
        }

        // Ensure arrays are arrays
        for (const arrayField of ['reps', 'weight_lbs', 'muscle_groups']) {
          if (validatedExercise[arrayField] && !Array.isArray(validatedExercise[arrayField])) {
            validatedExercise[arrayField] = [validatedExercise[arrayField]];
          }
        }

        validatedExercises.push(validatedExercise);
      }

      data.exercises = validatedExercises;
      data.total_exercises = validatedExercises.length;

      return data;

    } catch (error) {
      console.error('Data validation error:', error);
      return data;
    }
  }

  healthCheck() {
    return this.provider ? this.provider.healthCheck() : false;
  }

  getProviderInfo() {
    if (!this.provider) {
      return { provider: "none", status: "error" };
    }

    const providerName = this.provider.constructor.name.replace("Provider", "").toLowerCase();
    return {
      provider: providerName,
      status: "ready",
      health: this.provider.healthCheck()
    };
  }
}

let llmServiceInstance = null;

function getLLMService() {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}

module.exports = {
  extractWorkoutData: (...args) => getLLMService().extractWorkoutData(...args),
  healthCheck: () => getLLMService().healthCheck(),
  getProviderInfo: () => getLLMService().getProviderInfo()
};