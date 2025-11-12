import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  Collapse,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty
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

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await api.getQueueStats();
        const newStats = {
          total: response.waiting + response.active + response.completed + response.failed,
          completed: response.completed,
          processing: response.active,
          failed: response.failed,
          waiting: response.waiting
        };
        setStats(newStats);

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

  // Only show if there's activity or recent files
  if (stats.total === 0 && recentFiles.length === 0) {
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
          <Typography variant="caption" color="text.secondary">
            {stats.waiting > 0 && `${stats.waiting} files waiting in queue...`}
            {stats.total === 0 && 'No files uploaded yet. Record your workout audio to get started!'}
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default UploadProgress;