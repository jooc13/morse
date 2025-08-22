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
  Switch
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
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [useCustomUuid, setUseCustomUuid] = useState(false);
  const [customUuid, setCustomUuid] = useState('');

  // Default test UUID that ends in c4a9 (proper hex)
  const testUuid = 'f47ac10b-58cc-4372-a567-0e02b2c4c4a9';

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'audio/mpeg' && !selectedFile.name.toLowerCase().endsWith('.mp3')) {
        setError('Please select an MP3 file');
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File size must be under 50MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setUploadResult(null);
      setJobStatus(null);
    }
  };

  const generateDeviceFilename = (originalFile) => {
    const deviceUuid = useCustomUuid && customUuid ? customUuid : testUuid;
    const timestamp = Date.now();
    const extension = originalFile.name.toLowerCase().endsWith('.mp3') ? '.mp3' : '.mp3';
    return `${deviceUuid}_${timestamp}${extension}`;
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      // Create a new file with the proper device filename format
      const deviceFilename = generateDeviceFilename(file);
      const renamedFile = new File([file], deviceFilename, { type: file.type });
      
      const result = await api.uploadAudio(renamedFile);
      setUploadResult(result);
      
      // Start polling for job status if queued
      if (result.queued && result.jobId) {
        pollJobStatus(result.jobId);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const pollJobStatus = async (jobId) => {
    try {
      const status = await api.getUploadStatus(jobId);
      setJobStatus(status);
      
      // Continue polling if still processing
      if (status.status === 'pending' || status.status === 'processing') {
        setTimeout(() => pollJobStatus(jobId), 2000);
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
            Configure the device UUID for testing. Files will be uploaded with format: deviceUuid_timestamp.mp3
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
            Select MP3 File
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose an MP3 file (max 50MB) for transcription and workout extraction.
          </Typography>
          
          <input
            accept="audio/mpeg,.mp3"
            style={{ display: 'none' }}
            id="file-upload"
            type="file"
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
              Choose File
            </Button>
          </label>
          
          {file && (
            <Box sx={{ mt: 2 }}>
              <Card variant="outlined">
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {file.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatFileSize(file.size)}
                  </Typography>
                </CardContent>
              </Card>
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
            disabled={!file || uploading}
            startIcon={uploading ? null : <CloudUpload />}
            sx={{ minWidth: 150 }}
          >
            {uploading ? 'Uploading...' : 'Upload File'}
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

        {uploadResult && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle color="success" />
              Upload Successful
            </Typography>
            
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Upload Details
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Chip label={`File ID: ${uploadResult.audioFileId}`} size="small" />
                  <Chip label={`Device: ${uploadResult.deviceUuid}`} size="small" />
                  <Chip label={`Filename: ${uploadResult.filename}`} size="small" />
                  <Chip 
                    label={uploadResult.queued ? 'Queued for Processing' : 'Not Queued'} 
                    color={uploadResult.queued ? 'success' : 'default'}
                    size="small" 
                  />
                </Box>
                
                {uploadResult.session && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Session Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      <Chip 
                        label={`Session ID: ${uploadResult.session.sessionId}`} 
                        size="small" 
                      />
                      <Chip 
                        label={uploadResult.session.isNewSession ? 'New Session' : 'Existing Session'} 
                        color={uploadResult.session.isNewSession ? 'primary' : 'default'}
                        size="small" 
                      />
                      {uploadResult.session.timeGapMinutes > 0 && (
                        <Chip 
                          label={`Gap: ${uploadResult.session.timeGapMinutes}min`} 
                          size="small" 
                        />
                      )}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>

            {jobStatus && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Processing Status
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {jobStatus.status === 'completed' && <CheckCircle color="success" />}
                    {jobStatus.status === 'failed' && <Error color="error" />}
                    {(jobStatus.status === 'pending' || jobStatus.status === 'processing') && <Info color="info" />}
                    <Chip 
                      label={jobStatus.status || 'Unknown'} 
                      color={getStatusColor(jobStatus.status)}
                      size="small" 
                    />
                  </Box>
                  
                  {jobStatus.status === 'processing' && (
                    <LinearProgress sx={{ mt: 1 }} />
                  )}
                  
                  {jobStatus.result && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Processing Result
                      </Typography>
                      <Typography variant="body2" component="pre" sx={{ 
                        backgroundColor: 'rgba(0,0,0,0.1)', 
                        p: 1, 
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        overflow: 'auto',
                        maxHeight: 200
                      }}>
                        {JSON.stringify(jobStatus.result, null, 2)}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default UploadTest;