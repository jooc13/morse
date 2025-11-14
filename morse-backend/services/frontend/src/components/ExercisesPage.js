import React from 'react';
import { Box, Typography } from '@mui/material';

const ExercisesPage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
        Exercises
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Exercise library coming soon...
      </Typography>
    </Box>
  );
};

export default ExercisesPage;

