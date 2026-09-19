import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  Collapse,
  IconButton,
  Chip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  PlayArrow,
  Pause,
  AudioFile
} from '@mui/icons-material';
import api from '../services/api';

const UploadProgress = ({ deviceUuid }) => {
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0
  });
  const [expanded, setExpanded] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const [activeFiles, setActiveFiles] = useState([]);
  const [detailedProgress, setDetailedProgress] = useState({});

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [queueStatsResponse, activeFilesResponse] = await Promise.all([
          api.getQueueStats(),
          api.getActiveProcessingFiles()
        ]);

        const newStats = {
          total: queueStatsResponse.waiting + queueStatsResponse.active + queueStatsResponse.completed + queueStatsResponse.failed,
          completed: queueStatsResponse.completed,
          processing: queueStatsResponse.active,
          failed: queueStatsResponse.failed,
          waiting: queueStatsResponse.waiting
        };
        setStats(newStats);
        setActiveFiles(activeFilesResponse);

        // Get detailed progress for each active file
        const progressPromises = activeFilesResponse.map(async (file) => {
          try {
            const progress = await api.getFileProgress(file.audioFileId);
            return { [file.audioFileId]: progress };
          } catch (error) {
            console.error(`Failed to get progress for file ${file.audioFileId}:`, error);
            return { [file.audioFileId]: null };
          }
        });

        const progressResults = await Promise.all(progressPromises);
        const newDetailedProgress = progressResults.reduce((acc, result) => ({ ...acc, ...result }), {});
        setDetailedProgress(newDetailedProgress);

        // If we have recent activity, show expanded
        if (newStats.processing > 0 || newStats.waiting > 0) {
          setExpanded(true);
        }
      } catch (error) {
        console.error('Failed to fetch queue stats:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [deviceUuid]);

  const getProgress = () => {
    if (stats.total === 0) return 0;
    return ((stats.completed + stats.failed) / stats.total) * 100;
  };

  const getStatusColor = () => {
    if (stats.failed > 0) return 'warning';
    if (stats.processing > 0) return 'info';
    if (stats.total === stats.completed) return 'success';
    return 'primary';
  };

  const renderFileProgress = (file) => {
    const progress = detailedProgress[file.audioFileId];
    if (!progress) {
      return (
        <Box key={file.audioFileId} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AudioFile sx={{ fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {file.filename}
            </Typography>
            <Chip size="small" label="Loading..." />
          </Box>
          <LinearProgress />
        </Box>
      );
    }

    const stages = [
      { key: 'transcription', label: 'Audio Transcription', icon: AudioFile },
      { key: 'llm_processing', label: 'AI Analysis', icon: PlayArrow },
      { key: 'data_saving', label: 'Saving Data', icon: CheckCircle }
    ];

    const currentStageIndex = stages.findIndex(stage => stage.key === progress.currentStage);

    return (
      <Box key={file.audioFileId} sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
        {/* File header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AudioFile sx={{ fontSize: 16 }} />
          <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }}>
            {progress.filename}
          </Typography>
          <Chip
            size="small"
            label={`${progress.overallProgress}%`}
            color={progress.status === 'failed' ? 'error' : progress.status === 'completed' ? 'success' : 'primary'}
          />
        </Box>

        {/* Overall progress bar */}
        <LinearProgress
          variant="determinate"
          value={progress.overallProgress}
          color={progress.status === 'failed' ? 'error' : progress.status === 'completed' ? 'success' : 'primary'}
          sx={{ mb: 2, height: 6, borderRadius: 3 }}
        />

        {/* Stage stepper */}
        <Stepper activeStep={currentStageIndex} orientation="vertical" sx={{ ml: 1 }}>
          {stages.map((stage, index) => {
            const stageData = progress.stages?.find(s => s.name === stage.key);
            const StageIcon = stage.icon;

            let stepIcon;
            let stepColor = 'grey';

            if (stageData) {
              if (stageData.status === 'completed') {
                stepIcon = <CheckCircle sx={{ color: 'success.main' }} />;
                stepColor = 'success';
              } else if (stageData.status === 'failed') {
                stepIcon = <ErrorIcon sx={{ color: 'error.main' }} />;
                stepColor = 'error';
              } else if (stageData.status === 'in_progress') {
                stepIcon = <HourglassEmpty sx={{ color: 'primary.main' }} />;
                stepColor = 'primary';
              } else {
                stepIcon = <StageIcon sx={{ color: 'grey.500' }} />;
              }
            } else {
              stepIcon = <StageIcon sx={{ color: 'grey.500' }} />;
            }

            return (
              <Step key={stage.key} active={index <= currentStageIndex}>
                <StepLabel
                  icon={stepIcon}
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontSize: '0.875rem',
                      color: `${stepColor}.main`
                    }
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {stage.label}
                    </Typography>
                    {stageData && stageData.message && (
                      <Typography variant="caption" color="text.secondary">
                        {stageData.message}
                      </Typography>
                    )}
                    {stageData && stageData.progress > 0 && (
                      <Box sx={{ mt: 0.5, width: '100%' }}>
                        <LinearProgress
                          variant="determinate"
                          value={stageData.progress}
                          size="small"
                          color={stepColor}
                          sx={{ height: 3, borderRadius: 2 }}
                        />
                      </Box>
                    )}
                  </Box>
                </StepLabel>
                <StepContent>
                  {/* Additional content can go here */}
                </StepContent>
              </Step>
            );
          })}
        </Stepper>

        {/* Current message */}
        {progress.currentMessage && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {progress.currentMessage}
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  // Only show if there's activity or recent files
  if (stats.total === 0 && recentFiles.length === 0 && activeFiles.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden'
      }}
    >
      <Box
        sx={{
          p: 2,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.02)'
          }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {stats.processing > 0 ? 'Processing files...' : 'Upload Progress'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {stats.completed + stats.failed}/{stats.total} sets tracked
            </Typography>
            <IconButton size="small" sx={{ p: 0.5 }}>
              <ExpandMoreIcon
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              />
            </IconButton>
          </Box>
        </Box>

        <LinearProgress
          variant="determinate"
          value={getProgress()}
          color={getStatusColor()}
          sx={{
            mt: 1.5,
            height: 6,
            borderRadius: 3,
            backgroundColor: 'grey.200'
          }}
        />

        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          {stats.processing > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <HourglassEmpty sx={{ fontSize: 16, color: 'info.main' }} />
              <Typography variant="caption" color="text.secondary">
                {stats.processing} processing
              </Typography>
            </Box>
          )}
          {stats.completed > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
              <Typography variant="caption" color="text.secondary">
                {stats.completed} completed
              </Typography>
            </Box>
          )}
          {stats.failed > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ErrorIcon sx={{ fontSize: 16, color: 'warning.main' }} />
              <Typography variant="caption" color="text.secondary">
                {stats.failed} failed
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box
          sx={{
            p: 2,
            pt: 0,
            borderTop: '1px solid',
            borderColor: 'divider'
          }}
        >
          {/* Detailed progress for active files */}
          {activeFiles.length > 0 ? (
            <>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 2 }}>
                Processing Details:
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {activeFiles.map(file => renderFileProgress(file))}
            </>
          ) : (
            <>
              {stats.waiting > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {stats.waiting} files waiting in queue...
                </Typography>
              )}
              {stats.total === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No files uploaded yet. Record your workout audio to get started!
                </Typography>
              )}
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default UploadProgress;