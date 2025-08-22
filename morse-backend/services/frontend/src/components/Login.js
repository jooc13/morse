import React, { useState } from 'react';
import { 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Alert, 
  Link,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

function Login({ onLogin }) {
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!passphrase.trim()) {
      setError('Please enter your passphrase');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await onLogin(passphrase);
      if (!result.success) {
        setError(result.error);
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 6, 
        maxWidth: 440, 
        mx: 'auto',
        background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.9) 0%, rgba(26, 26, 26, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 229, 255, 0.2)',
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      <Box component="form" onSubmit={handleSubmit}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{ 
              background: 'linear-gradient(135deg, #00e5ff 0%, #ff6b6b 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              fontWeight: 800,
              mb: 1
            }}
          >
            Welcome Back
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ opacity: 0.8 }}>
            Enter your passphrase to access your workout data
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Passphrase"
          type={showPassphrase ? 'text' : 'password'}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          margin="normal"
          required
          autoFocus
          disabled={loading}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  edge="end"
                >
                  {showPassphrase ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          sx={{ 
            mt: 4, 
            mb: 3,
            py: 1.5,
            background: 'linear-gradient(135deg, #00e5ff 0%, #0288d1 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #00b8cc 0%, #0277bd 100%)',
            },
            fontWeight: 600,
            fontSize: '1.1rem',
          }}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>

        <Box textAlign="center">
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.8 }}>
            Don't have an account?{' '}
            <Link 
              component={RouterLink} 
              to="/register" 
              sx={{ 
                color: '#00e5ff',
                textDecoration: 'none',
                fontWeight: 600,
                '&:hover': {
                  textDecoration: 'underline',
                  color: '#00b8cc',
                }
              }}
            >
              Create one here
            </Link>
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default Login;