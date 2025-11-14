const axios = require('axios');

class LLMService {
  constructor() {
    this.apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    this.model = 'gemini-2.0-flash-exp'; // or 'gemini-1.5-pro' if 2.0 not available
  }

  async extractWorkoutData(transcription, deviceUuid, isSession = false, recordingCount = 1) {
    if (!this.apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY environment variable is required');
    }

    try {
      const prompt = this.buildExtractionPrompt(transcription, isSession, recordingCount);

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 4096,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000
        }
      );

      const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const workoutData = this.parseGeminiResponse(responseText);

      if (!workoutData) {
        throw new Error('Failed to parse workout data from LLM response');
      }

      return {
        success: true,
        workout: workoutData
      };
    } catch (error) {
      console.error('LLM processing error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error?.message || error.message;
      
      // Check if it's a quota error - these should be retried later
      const isQuotaError = errorMessage.includes('quota') || 
                          errorMessage.includes('rate limit') ||
                          error.response?.status === 429;
      
      if (isQuotaError) {
        return {
          success: false,
          error: errorMessage,
          retryable: true,
          retryAfter: error.response?.data?.error?.retryAfter || 60 // Default 60 seconds
        };
      }
      
      throw new Error(`LLM processing failed: ${errorMessage}`);
    }
  }

  buildExtractionPrompt(transcription, isSession, recordingCount) {
    let sessionContext = '';
    if (isSession && recordingCount > 1) {
      sessionContext = `
IMPORTANT: This transcription contains ${recordingCount} separate audio recordings from a single workout session.
The recordings are labeled as "[Recording 1 of X]", "[Recording 2 of X]", etc. These are NOT separate workouts - they are all part of ONE workout session.

CRITICAL INSTRUCTIONS:
1. Extract ALL exercises from ALL recordings - do not skip any exercises
2. Combine all exercises into a SINGLE workout with multiple exercises
3. Maintain the order of exercises as they appear across all recordings
4. Do not create separate workouts - this is ONE continuous workout session
5. Each exercise entry should represent the sets/reps/weights as described in the transcription - keep them as separate exercise entries if they appear separately`;
    }

    return `You are a fitness expert assistant. Extract structured workout data from the following audio transcription of someone describing their workout.
${sessionContext}

The transcription may contain fragmented or incomplete sentences. Parse these fragments intelligently and extract the most likely intended workout data.

Extract the data and format it as JSON with this exact structure:

{
  "workout_date": null,
  "workout_start_time": null,
  "workout_duration_minutes": null,
  "total_exercises": 0,
  "notes": "",
  "exercises": [
    {
      "exercise_name": "Bench Press",
      "exercise_type": "strength",
      "muscle_groups": ["chest", "triceps", "shoulders"],
      "sets": 4,
      "reps": [8, 8, 6, 6],
      "weight_lbs": [185, 185, 205, 205],
      "duration_minutes": null,
      "distance_miles": null,
      "effort_level": 7,
      "rest_seconds": 90,
      "notes": "",
      "order_in_workout": 1
    }
  ]
}

Rules:
- Set workout_date, workout_start_time, and workout_duration_minutes to null (will be set from metadata)
- For strength exercises: include sets, reps (array), weight_lbs (array), effort_level (1-10)
- For cardio: include duration_minutes or distance_miles
- If reps/weights vary by set, use arrays. If same for all sets, repeat the value in the array.
- muscle_groups should be an array of strings
- exercise_type: "strength", "cardio", or "other"
- order_in_workout: sequential number starting at 1

Transcription:
${transcription}

Return ONLY valid JSON, no additional text.`;
  }

  parseGeminiResponse(responseText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(responseText);
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.error('Response text:', responseText);
      return null;
    }
  }
}

module.exports = new LLMService();

