import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  Divider,
  TextField,
  FormControlLabel,
  Switch,
  Stack
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  Error,
  Info,
  ArrowBack
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const UploadTest = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [error, setError] = useState(null);
  const [jobStatuses, setJobStatuses] = useState({});
  const [useCustomUuid, setUseCustomUuid] = useState(false);
  const [customUuid, setCustomUuid] = useState('');

  // Default test UUID that ends in c4a9 (proper hex)
  const testUuid = 'f47ac10b-58cc-4372-a567-0e02b2c4c4a9';

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const validExtensions = ['.mp3', '.wav', '.m4a'];
    const validMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac'];
    
    const validFiles = [];
    const errors = [];

    selectedFiles.forEach((file, index) => {
      const fileName = file.name.toLowerCase();
      
      // Accept if it has a valid extension OR valid MIME type OR starts with audio/
      const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
      const hasValidMimeType = validMimeTypes.includes(file.type);
      const isAudioType = file.type && file.type.startsWith('audio/');
      
      if (!hasValidExtension && !hasValidMimeType && !isAudioType) {
        errors.push(`${file.name}: Invalid file type. Please select MP3, WAV, or M4A files.`);
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        errors.push(`${file.name}: File size must be under 50MB`);
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    } else {
      setFiles(validFiles);
      setError(null);
      setUploadResults([]);
      setJobStatuses({});
    }
  };

  const generateDeviceFilename = (originalFile, index = 0) => {
    const deviceUuid = useCustomUuid && customUuid ? customUuid : testUuid;
    // Add small delay between timestamps to ensure uniqueness
    const timestamp = Date.now() + index;
    const fileName = originalFile.name.toLowerCase();
    let extension = '.mp3'; // default
    if (fileName.endsWith('.m4a')) {
      extension = '.m4a';
    } else if (fileName.endsWith('.wav')) {
      extension = '.wav';
    } else if (fileName.endsWith('.mp3')) {
      extension = '.mp3';
    }
    return `${deviceUuid}_${timestamp}${extension}`;
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    setUploadResults([]);
    setJobStatuses({});

    try {
      // If multiple files, use batch upload (creates one workout)
      // If single file, use regular upload
      if (files.length > 1) {
        // Batch upload: all files = one workout
        const renamedFiles = files.map((file, i) => {
          const deviceFilename = generateDeviceFilename(file, i);
          return new File([file], deviceFilename, { type: file.type });
        });
        
        const result = await api.uploadAudioBatch(renamedFiles);
        
        // Create result entries for each file showing they're part of one workout
        const batchResults = files.map((file, index) => ({
          file: file.name,
          result: {
            ...result,
            audioFileId: result.audioFileIds?.[index] || `batch-${index}`,
            filename: file.name,
            isBatch: true,
            fileCount: files.length
          }
        }));
        
        setUploadResults(batchResults);
      } else {
        // Single file upload
        const file = files[0];
        const deviceFilename = generateDeviceFilename(file, 0);
        const renamedFile = new File([file], deviceFilename, { type: file.type });
        
        const result = await api.uploadAudio(renamedFile);
        setUploadResults([{ file: file.name, result }]);
        
        // Start polling for job status if queued
        if (result.queued && result.jobId) {
          pollJobStatus(result.jobId, file.name);
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const pollJobStatus = async (jobId, fileName) => {
    try {
      const status = await api.getUploadStatus(jobId);
      setJobStatuses(prev => ({ ...prev, [fileName]: status }));
      
      // Continue polling if still processing
      if (status.status === 'pending' || status.status === 'processing') {
        setTimeout(() => pollJobStatus(jobId, fileName), 2000);
      }
    } catch (err) {
      console.error('Status check failed:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ mr: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>
      
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUpload />
          Audio Upload Test
        </Typography>
        
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Testing Only:</strong> This is a legacy upload endpoint for testing purposes. 
            In production, audio files are typically uploaded directly from devices.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Device Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure the device UUID for testing. Files will be uploaded with format: deviceUuid_timestamp.mp3|wav|m4a
          </Typography>
          
          <Card variant="outlined" sx={{ mb: 2, p: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={useCustomUuid}
                  onChange={(e) => setUseCustomUuid(e.target.checked)}
                />
              }
              label="Use Custom Device UUID"
            />
            
            {useCustomUuid ? (
              <TextField
                fullWidth
                label="Custom Device UUID"
                value={customUuid}
                onChange={(e) => setCustomUuid(e.target.value)}
                placeholder="Enter device UUID"
                sx={{ mt: 2 }}
                helperText="Enter a device UUID for testing"
              />
            ) : (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Using default test UUID: <code>{testUuid}</code>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  This UUID ends in 'c4a9' for easy searching
                </Typography>
              </Box>
            )}
          </Card>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select Audio Files
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose one or more MP3, WAV, or M4A files (max 50MB each) for transcription and workout extraction.
          </Typography>
          
          <input
            accept="audio/*,.mp3,.wav,.m4a"
            style={{ display: 'none' }}
            id="file-upload"
            type="file"
            multiple
            onChange={handleFileSelect}
          />
          <label htmlFor="file-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudUpload />}
              size="large"
              sx={{ mr: 2 }}
            >
              Choose Files
            </Button>
          </label>
          
          {files.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {files.length} {files.length === 1 ? 'file' : 'files'} selected
              </Typography>
              <Stack spacing={1}>
                {files.map((file, index) => (
                  <Card key={index} variant="outlined">
                    <CardContent sx={{ py: 1.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {file.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(file.size)}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            startIcon={uploading ? null : <CloudUpload />}
            sx={{ minWidth: 150 }}
          >
            {uploading ? `Uploading ${files.length} file${files.length === 1 ? '' : 's'}...` : `Upload ${files.length || ''} File${files.length === 1 ? '' : 's'}`}
          </Button>
          
          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Uploading and queuing for processing...
              </Typography>
            </Box>
          )}
        </Box>

        {uploadResults.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle color="success" />
              Upload Results ({uploadResults.length} {uploadResults.length === 1 ? 'file' : 'files'})
            </Typography>
            
            <Stack spacing={2}>
              {uploadResults.map((uploadItem, index) => {
                const result = uploadItem.result;
                const status = jobStatuses[uploadItem.file];
                return (
                  <Card key={index} variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        {uploadItem.file}
                      </Typography>
                      {/* Display parsed workout information if available */}
                      {result.workout && result.workout.exercises && result.workout.exercises.length > 0 && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="h6" gutterBottom color="primary">
                            🏋️ {result.workout.title || 'Workout'} Detected
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Found {result.workout.exercises.length} exercise{result.workout.exercises.length === 1 ? '' : 's'} in your audio
                          </Typography>

                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {result.workout.exercises.map((exercise, idx) => (
                              <Card key={idx} variant="outlined" sx={{ backgroundColor: 'background.default' }}>
                                <CardContent sx={{ py: 2 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                      {exercise.name || exercise.exercise_name}
                                    </Typography>
                                    <Chip
                                      label={exercise.category || exercise.exercise_type || 'Strength'}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                    />
                                  </Box>

                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                                    {exercise.sets && (
                                      <Typography variant="body2" color="text.secondary">
                                        <strong>Sets:</strong> {exercise.sets}
                                      </Typography>
                                    )}
                                    {exercise.reps && (
                                      <Typography variant="body2" color="text.secondary">
                                        <strong>Reps:</strong> {exercise.reps}
                                      </Typography>
                                    )}
                                    {exercise.weight && (
                                      <Typography variant="body2" color="text.secondary">
                                        <strong>Weight:</strong> {exercise.weight} lbs
                                      </Typography>
                                    )}
                                    {exercise.duration_seconds && (
                                      <Typography variant="body2" color="text.secondary">
                                        <strong>Duration:</strong> {Math.floor(exercise.duration_seconds / 60)}m {exercise.duration_seconds % 60}s
                                      </Typography>
                                    )}
                                  </Box>

                                  {exercise.notes && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                      {exercise.notes}
                                    </Typography>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* Show minimal upload info */}
                      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Upload Details
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          <Chip
                            label={
                              result.processed ? '✓ Workout Created' :
                              result.status === 'pending' ? '⏳ Pending' :
                              result.status === 'completed' ? '✓ Completed' :
                              result.status === 'failed' ? '✗ Failed' :
                              result.queued ? '⏸️ Queued' :
                              '⏳ Processing...'
                            }
                            color={
                              result.processed ? 'success' :
                              result.status === 'pending' ? 'warning' :
                              result.status === 'completed' ? 'success' :
                              result.status === 'failed' ? 'error' :
                              result.queued ? 'info' :
                              'info'
                            }
                            size="small"
                          />
                          {result.session?.isNewSession && (
                            <Chip
                              label="🆕 New Session Started"
                              color="primary"
                              size="small"
                            />
                          )}
                          {result.session?.timeGapMinutes > 0 && (
                            <Chip
                              label={`${result.session.timeGapMinutes}min since last workout`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
  
                      {status && (
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Processing Status
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {status.status === 'completed' && <CheckCircle color="success" />}
                            {status.status === 'failed' && <Error color="error" />}
                            {(status.status === 'pending' || status.status === 'processing') && <Info color="info" />}
                            <Chip 
                              label={status.status || 'Unknown'} 
                              color={getStatusColor(status.status)}
                              size="small" 
                            />
                          </Box>
                          
                          {status.status === 'processing' && (
                            <LinearProgress sx={{ mt: 1 }} />
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default UploadTest;