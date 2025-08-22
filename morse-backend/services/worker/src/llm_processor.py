import os
import json
import logging
import asyncio
from typing import Dict, Any, List
from datetime import datetime, date
import anthropic

logger = logging.getLogger(__name__)

class WorkoutLLMProcessor:
    def __init__(self):
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is required")
        
        self.client = anthropic.Anthropic(
            api_key=api_key
        )
        self.model = "claude-sonnet-4-20250514"

    async def extract_workout_data(self, transcription: str, device_uuid: str, is_session: bool = False, recording_count: int = 1) -> Dict[str, Any]:
        """Extract structured workout data from transcription using Claude"""
        try:
            logger.info(f"Processing transcription with LLM for device {device_uuid}")
            
            # Prepare the prompt for Claude
            prompt = self._build_extraction_prompt(transcription, is_session, recording_count)
            
            # Call Claude API
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self._call_claude_sync,
                prompt
            )
            
            # Parse the response
            workout_data = self._parse_claude_response(response)
            
            if not workout_data:
                return {
                    'success': False,
                    'error': 'Failed to parse workout data from LLM response'
                }
            
            exercise_count = len(workout_data.get('exercises', []))
            logger.info(f"Successfully extracted workout data: {exercise_count} exercises from {recording_count} recording(s)")
            
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

    def _build_extraction_prompt(self, transcription: str, is_session: bool = False, recording_count: int = 1) -> str:
        """Build the prompt for Claude to extract workout data"""
        session_context = ""
        if is_session and recording_count > 1:
            session_context = f"""
IMPORTANT: This transcription contains {recording_count} separate audio recordings from a single workout session.
The recordings are labeled as "Recording 1:", "Recording 2:", etc. These are NOT separate workouts - they are all part of ONE workout session.

Examples of how to interpret multiple recordings:
- Recording 1: "bench press 185 5 reps" + Recording 2: "bench press 205 5 reps" = One exercise (Bench Press) with 2 sets at different weights
- Recording 1: "squats 185 8 reps" + Recording 2: "squats 185 8 reps" + Recording 3: "squats 185 6 reps" = One exercise (Squats) with 3 sets
- Recording 1: "bench press 3 sets 185" + Recording 2: "push-ups 20 reps" = Two different exercises in the same workout

CRITICAL: Combine all recordings into a SINGLE workout with multiple exercises. Do not create separate workouts."""

        return f"""You are a fitness expert assistant. Extract structured workout data from the following audio transcription of someone describing their workout.
{session_context}
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
  "workout_date": null,
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
7. Do not extract workout dates - always set workout_date to null
8. Estimate effort level from descriptive words (easy=3-4, moderate=5-6, hard=7-8, very hard=9-10)
9. Order exercises as they appear in the transcription
10. If unclear about data, use null rather than guessing
11. Look for corrections in speech - if someone mentions different numbers for the same parameter, use the last mentioned value
12. For multiple recordings: Intelligently combine related exercises (same exercise name) into single exercises with multiple sets
13. For multiple recordings: Maintain the chronological order of exercises as they appear across all recordings

Transcription:
"{transcription}"

Respond with ONLY the JSON object, no additional text or explanation."""

    def _call_claude_sync(self, prompt: str) -> str:
        """Synchronous call to Claude API"""
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                temperature=0.1,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            return message.content[0].text
            
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise

    def _parse_claude_response(self, response: str) -> Dict[str, Any]:
        """Parse Claude's JSON response"""
        try:
            # Clean up the response - sometimes Claude adds extra text
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
            # Set defaults - always use today's date for new uploads
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
        """Generate personalized workout feedback using Claude"""
        try:
            prompt = self._build_feedback_prompt(workout_data, user_history)
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                self._call_claude_sync,
                prompt
            )
            
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

    async def extract_session_workout_data(self, session_transcription_data: Dict[str, Any], device_uuid: str) -> Dict[str, Any]:
        """Extract workout data from a complete session with multiple recordings"""
        try:
            combined_text = session_transcription_data['combinedText']
            recording_count = session_transcription_data['totalRecordings']
            
            logger.info(f"Processing session with {recording_count} recordings for device {device_uuid}")
            
            return await self.extract_workout_data(
                combined_text, 
                device_uuid, 
                is_session=True, 
                recording_count=recording_count
            )
            
        except Exception as e:
            logger.error(f"Session LLM processing error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def health_check(self) -> bool:
        """Check if the LLM processor is working"""
        try:
            return bool(os.getenv('ANTHROPIC_API_KEY'))
        except Exception:
            return False