import os
import json
import logging
import asyncio
from typing import Dict, Any, List
from datetime import datetime, date
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class LLMProvider(ABC):
    """Abstract base class for LLM providers"""

    @abstractmethod
    def __init__(self, api_key: str):
        pass

    @abstractmethod
    async def generate_response(self, prompt: str) -> str:
        pass

    @abstractmethod
    def health_check(self) -> bool:
        pass

class ClaudeProvider(LLMProvider):
    """Anthropic Claude provider"""

    def __init__(self, api_key: str):
        import anthropic
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-20250514"

    async def generate_response(self, prompt: str) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._call_claude_sync, prompt)

    def _call_claude_sync(self, prompt: str) -> str:
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                temperature=0.1,
                messages=[{"role": "user", "content": prompt}]
            )
            return message.content[0].text
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise

    def health_check(self) -> bool:
        try:
            return bool(os.getenv('ANTHROPIC_API_KEY'))
        except Exception:
            return False

class GeminiProvider(LLMProvider):
    """Google Gemini provider"""

    def __init__(self, api_key: str):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    async def generate_response(self, prompt: str) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._call_gemini_sync, prompt)

    def _call_gemini_sync(self, prompt: str) -> str:
        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    'temperature': 0.1,
                    'max_output_tokens': 2000,
                }
            )
            return response.text
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise

    def health_check(self) -> bool:
        try:
            return bool(os.getenv('GOOGLE_API_KEY'))
        except Exception:
            return False

class WorkoutLLMProcessor:
    """Unified LLM processor supporting multiple providers"""

    def __init__(self):
        self.provider = self._initialize_provider()
        if not self.provider:
            raise ValueError("No valid LLM provider configured. Set ANTHROPIC_API_KEY or GOOGLE_API_KEY")

    def _initialize_provider(self) -> LLMProvider:
        """Initialize the best available LLM provider"""

        # Check for provider preference
        llm_provider = os.getenv('LLM_PROVIDER', 'auto').lower()

        if llm_provider == 'anthropic' or llm_provider == 'claude':
            api_key = os.getenv('ANTHROPIC_API_KEY')
            if api_key:
                logger.info("Using Anthropic Claude provider")
                return ClaudeProvider(api_key)
            else:
                logger.warning("ANTHROPIC_API_KEY not found, trying other providers")

        elif llm_provider == 'google' or llm_provider == 'gemini':
            api_key = os.getenv('GOOGLE_API_KEY')
            if api_key:
                logger.info("Using Google Gemini provider")
                return GeminiProvider(api_key)
            else:
                logger.warning("GOOGLE_API_KEY not found, trying other providers")

        # Auto-detect best available provider
        elif llm_provider == 'auto':
            # Prefer free Gemini if available
            google_key = os.getenv('GOOGLE_API_KEY')
            if google_key:
                logger.info("Auto-selected Google Gemini provider (free)")
                return GeminiProvider(google_key)

            # Fallback to Claude
            anthropic_key = os.getenv('ANTHROPIC_API_KEY')
            if anthropic_key:
                logger.info("Auto-selected Anthropic Claude provider")
                return ClaudeProvider(anthropic_key)

        return None

    async def extract_workout_data(self, transcription: str, device_uuid: str) -> Dict[str, Any]:
        """Extract structured workout data from transcription using configured LLM"""
        try:
            logger.info(f"Processing transcription with {self.provider.__class__.__name__} for device {device_uuid}")

            # Prepare the prompt for the LLM
            prompt = self._build_extraction_prompt(transcription)

            # Call the LLM API
            response = await self.provider.generate_response(prompt)

            # Parse the response
            workout_data = self._parse_llm_response(response)

            if not workout_data:
                return {
                    'success': False,
                    'error': 'Failed to parse workout data from LLM response'
                }

            logger.info(f"Successfully extracted workout data: {len(workout_data.get('exercises', []))} exercises")

            return {
                'success': True,
                'workout': workout_data
            }

        except Exception as e:
            logger.error(f"LLM processing error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _build_extraction_prompt(self, transcription: str) -> str:
        """Build the prompt for LLM to extract workout data"""
        return f"""You are a fitness expert assistant. Extract structured workout data from the following audio transcription of someone describing their workout.

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

{{
  "workout_date": "YYYY-MM-DD",
  "workout_start_time": "HH:MM" or null,
  "workout_duration_minutes": number or null,
  "notes": "string or null",
  "exercises": [
    {{
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
    }}
  ]
}}

Guidelines:
1. Standardize exercise names (e.g., "Push-ups", "Bench Press", "Squats")
2. Infer muscle groups based on exercise names
3. If sets/reps are mentioned as "3 sets of 10", create reps array [10, 10, 10]
4. Handle fragmented speech - if someone says "5 sets 185lbs bench press 4 sets", interpret as "bench press, 4 sets, 185lbs"
5. When numbers appear without clear context, use workout knowledge to assign them (e.g., "bench press 185 5" = 5 reps at 185lbs)
6. If weight varies per set, include all weights in weight_lbs array
7. Use today's date if no date is mentioned
8. Estimate effort level from descriptive words (easy=3-4, moderate=5-6, hard=7-8, very hard=9-10)
9. Order exercises as they appear in the transcription
10. If unclear about data, use null rather than guessing
11. Look for corrections in speech - if someone mentions different numbers for the same parameter, use the last mentioned value

Transcription:
"{transcription}"

Respond with ONLY the JSON object, no additional text or explanation."""

    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM's JSON response"""
        try:
            # Clean up the response - sometimes LLMs add extra text
            response = response.strip()

            # Find JSON object in response
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1

            if start_idx == -1 or end_idx == 0:
                logger.error("No JSON object found in response")
                return None

            json_str = response[start_idx:end_idx]
            workout_data = json.loads(json_str)

            # Validate and clean the data
            workout_data = self._validate_workout_data(workout_data)

            return workout_data

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            logger.error(f"Response: {response}")
            return None
        except Exception as e:
            logger.error(f"Response parsing error: {e}")
            return None

    def _validate_workout_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean the extracted workout data"""
        try:
            # Set defaults
            if 'workout_date' not in data or not data['workout_date']:
                data['workout_date'] = date.today().isoformat()

            if 'exercises' not in data:
                data['exercises'] = []

            # Validate exercises
            validated_exercises = []
            for i, exercise in enumerate(data['exercises']):
                validated_exercise = {
                    'exercise_name': exercise.get('exercise_name', 'Unknown Exercise'),
                    'exercise_type': exercise.get('exercise_type', 'other'),
                    'muscle_groups': exercise.get('muscle_groups', []),
                    'sets': exercise.get('sets'),
                    'reps': exercise.get('reps'),
                    'weight_lbs': exercise.get('weight_lbs'),
                    'duration_minutes': exercise.get('duration_minutes'),
                    'distance_miles': exercise.get('distance_miles'),
                    'effort_level': exercise.get('effort_level'),
                    'rest_seconds': exercise.get('rest_seconds'),
                    'notes': exercise.get('notes'),
                    'order_in_workout': exercise.get('order_in_workout', i + 1)
                }

                # Validate effort level range
                if validated_exercise['effort_level'] is not None:
                    effort = validated_exercise['effort_level']
                    if not isinstance(effort, (int, float)) or effort < 1 or effort > 10:
                        validated_exercise['effort_level'] = None

                # Ensure arrays are lists
                for array_field in ['reps', 'weight_lbs', 'muscle_groups']:
                    if validated_exercise[array_field] and not isinstance(validated_exercise[array_field], list):
                        validated_exercise[array_field] = [validated_exercise[array_field]]

                validated_exercises.append(validated_exercise)

            data['exercises'] = validated_exercises
            data['total_exercises'] = len(validated_exercises)

            return data

        except Exception as e:
            logger.error(f"Data validation error: {e}")
            return data

    async def generate_workout_feedback(self, workout_data: Dict[str, Any], user_history: List[Dict]) -> Dict[str, Any]:
        """Generate personalized workout feedback using configured LLM"""
        try:
            prompt = self._build_feedback_prompt(workout_data, user_history)
            response = await self.provider.generate_response(prompt)

            return {
                'success': True,
                'feedback': response
            }

        except Exception as e:
            logger.error(f"Feedback generation error: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def _build_feedback_prompt(self, workout_data: Dict[str, Any], user_history: List[Dict]) -> str:
        """Build prompt for generating workout feedback"""
        return f"""As a fitness expert, provide personalized feedback on this workout based on the user's exercise history.

Current Workout:
{json.dumps(workout_data, indent=2)}

Recent Workout History (last 5 workouts):
{json.dumps(user_history, indent=2)}

Provide feedback covering:
1. Exercise variety and muscle group coverage
2. Progressive overload opportunities
3. Potential gaps in training
4. Recovery and rest considerations
5. Specific suggestions for improvement

Keep feedback concise, actionable, and encouraging. Focus on 2-3 key insights."""

    def health_check(self) -> bool:
        """Check if the LLM processor is working"""
        return self.provider.health_check() if self.provider else False

    def get_provider_info(self) -> Dict[str, Any]:
        """Get information about the current provider"""
        if not self.provider:
            return {"provider": "none", "status": "error"}

        provider_name = self.provider.__class__.__name__.replace("Provider", "")
        return {
            "provider": provider_name.lower(),
            "status": "ready",
            "health": self.provider.health_check()
        }