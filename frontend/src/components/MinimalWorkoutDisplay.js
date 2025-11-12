import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Chip, Button, Input } from '@mui/material';
import { FitnessCenter, CalendarToday, CloudUpload } from '@mui/icons-material';
import api from '../services/api';
import UploadProgress from './UploadProgress';

const MinimalWorkoutDisplay = ({ deviceUuid }) => {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadWorkouts();
  }, [deviceUuid]);

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      const response = await api.getWorkouts(deviceUuid, { limit: 100 });
      setWorkouts(response.workouts || []);
    } catch (error) {
      // If user doesn't exist (404), that's okay - they just haven't uploaded anything yet
      if (error.response?.status !== 404) {
        console.error('Failed to load workouts:', error);
      }
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // File validation
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
    const allowedExtensions = ['.mp3', '.m4a'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      alert('Please upload an MP3 or M4A audio file.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      alert('File size must be less than 50MB.');
      return;
    }

    setUploading(true);
    try {
      console.log('Starting upload for file:', file.name, 'Size:', file.size, 'Type:', file.type);
      const result = await api.uploadAudio(file);
      console.log('Upload successful:', result);

      // Update the device UUID if it's different from the current one
      if (result.deviceUuid && result.deviceUuid !== deviceUuid) {
        console.log('Updating device UUID from', deviceUuid, 'to', result.deviceUuid);
        localStorage.setItem('morse_device_uuid', result.deviceUuid);
        // Notify parent component to update its state
        window.location.reload(); // Simple approach to refresh with new UUID
      }

      alert(`Upload successful! Audio file queued for processing.`);
      // Refresh workouts after upload
      setTimeout(() => loadWorkouts(), 2000);
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
      alert(`Upload failed: ${errorMessage}. Please try again.`);
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (workouts.length === 0) {
    return (
      <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
        {/* Upload Section */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            border: '2px dashed',
            borderColor: 'grey.300',
            backgroundColor: '#fafafa',
            textAlign: 'center',
            '&:hover': {
              borderColor: 'primary.main',
              backgroundColor: '#f5f5f5'
            }
          }}
        >
          <input
            type="file"
            accept=".m4a,.mp3"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="audio-upload-empty"
          />
          <label htmlFor="audio-upload-empty">
            <Button
              component="span"
              variant="outlined"
              disabled={uploading}
              startIcon={<CloudUpload />}
              sx={{
                px: 3,
                py: 1.5,
                textTransform: 'none',
                fontSize: '1rem',
                borderWidth: '2px',
                '&:hover': {
                  borderWidth: '2px'
                }
              }}
            >
              {uploading ? 'Uploading...' : 'Upload Your First Workout'}
            </Button>
          </label>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            Record your workout and upload the audio file
          </Typography>
        </Paper>

        <UploadProgress deviceUuid={deviceUuid} />
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography color="text.secondary">No workouts found</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
      {/* Upload Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: '2px dashed',
          borderColor: 'grey.300',
          backgroundColor: '#fafafa',
          textAlign: 'center',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: '#f5f5f5'
          }
        }}
      >
        <input
          type="file"
          accept=".m4a,.mp3"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          id="audio-upload"
        />
        <label htmlFor="audio-upload">
          <Button
            component="span"
            variant="outlined"
            disabled={uploading}
            startIcon={<CloudUpload />}
            sx={{
              px: 3,
              py: 1.5,
              textTransform: 'none',
              fontSize: '1rem',
              borderWidth: '2px',
              '&:hover': {
                borderWidth: '2px'
              }
            }}
          >
            {uploading ? 'Uploading...' : 'Upload Workout Audio'}
          </Button>
        </label>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          M4A or MP3 files only
        </Typography>
      </Paper>

      <UploadProgress deviceUuid={deviceUuid} />
      {workouts.map((workout, workoutIndex) => (
        <Paper
          key={workoutIndex}
          sx={{
            p: 2,
            mb: 2,
            backgroundColor: '#ffffff',
            border: '1px solid #e0e0e0'
          }}
        >
          {/* Date Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CalendarToday sx={{ fontSize: 18, mr: 1, color: '#666' }} />
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {formatDate(workout.workout_date)}
            </Typography>
            <Chip
              label={`${workout.total_sets} set${workout.total_sets !== '1' ? 's' : ''}`}
              size="small"
              sx={{ ml: 'auto', backgroundColor: '#f5f5f5' }}
            />
          </Box>

          {/* Sets/Exercises */}
          <Box>
            {workout.sets.map((set, setIndex) => {
              // Calculate set number for this exercise
              const exerciseSets = workout.sets.filter(s => s.exercise_name === set.exercise_name);
              const currentSetNumber = exerciseSets.findIndex(s => s.order_in_workout === set.order_in_workout) + 1;

              return (
                <Box
                  key={set.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: 1.5,
                    borderBottom: setIndex < workout.sets.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}
                >
                  {/* Order - Small */}
                  <Typography
                    variant="body2"
                    sx={{
                      minWidth: 30,
                      fontSize: '0.75rem',
                      color: '#999',
                      textAlign: 'center'
                    }}
                  >
                    {set.order_in_workout}
                  </Typography>

                  {/* Exercise Name */}
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, minWidth: 140 }}>
                    <FitnessCenter sx={{ fontSize: 16, mr: 1, color: '#666' }} />
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {set.exercise_name}
                    </Typography>
                  </Box>

                  {/* Set Number */}
                  <Typography
                    variant="body2"
                    sx={{
                      ml: 2,
                      minWidth: 60,
                      color: '#666'
                    }}
                  >
                    Set {currentSetNumber}
                  </Typography>

                  {/* Weight and Reps */}
                  <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                    {set.weight_lbs && set.weight_lbs.length > 0 && set.reps && set.reps.length > 0 ? (
                      set.weight_lbs.map((weight, i) => (
                        <Typography key={i} variant="body1" sx={{ fontWeight: 600 }}>
                          {weight} lbs × {set.reps[i]} reps
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No data
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default MinimalWorkoutDisplay;