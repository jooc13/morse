import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ExercisesPage from '../ExercisesPage';
import * as api from '../../services/api';

// Mock the API module
jest.mock('../../services/api');

// Mock Material-UI's useTheme
jest.mock('@mui/material/styles', () => ({
  useTheme: () => ({
    palette: {
      primary: { main: '#1976d2' },
      success: { main: '#2e7d32' },
      warning: { main: '#ed6c02' },
      info: { main: '#0288d1' },
      error: { main: '#d32f2f' },
      grey: { 500: '#9e9e9e' }
    },
    shadows: [8]
  }),
  alpha: (color, opacity) => `rgba(${color}, ${opacity})`
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(() => 'test-device-123'),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Test data
const mockWorkouts = [
  {
    id: 'workout-1',
    date_completed: '2025-01-10T10:00:00Z',
    workout_start_time: '10:00',
    duration_seconds: 1800,
    exercises: [
      {
        name: 'Bench Press',
        category: 'strength',
        sets: 3,
        reps: 10,
        weight: 150,
        notes: 'Good form'
      },
      {
        name: 'Squats',
        category: 'strength',
        sets: 4,
        reps: 12,
        weight: 200
      }
    ]
  },
  {
    id: 'workout-2',
    date_completed: '2025-01-08T09:00:00Z',
    workout_start_time: '09:00',
    duration_seconds: 1500,
    exercises: [
      {
        name: 'Running',
        category: 'cardio',
        duration_seconds: 1500,
        distance: 5
      }
    ]
  }
];

const mockStats = {
  totalWorkouts: 10,
  totalExercises: 25,
  exerciseStats: {
    categories: {
      strength: 15,
      cardio: 8,
      flexibility: 2
    }
  }
};

// Helper function to render component
const renderComponent = () => {
  return render(
    <BrowserRouter>
      <ExercisesPage />
    </BrowserRouter>
  );
};

describe('ExercisesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    api.get.mockImplementation((url) => {
      if (url.includes('/workouts/device/')) {
        if (url.includes('/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({ data: { workouts: mockWorkouts } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it('renders the exercise library page', async () => {
    renderComponent();

    // Check for main heading
    expect(screen.getByText('Exercise Library')).toBeInTheDocument();
    expect(screen.getByText('Track your exercise history and see your progress over time')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Total Exercises')).toBeInTheDocument();
    });
  });

  it('displays exercise statistics', async () => {
    renderComponent();

    await waitFor(() => {
      // Check stats cards
      expect(screen.getByText('Total Exercises')).toBeInTheDocument();
      expect(screen.getByText('Unique Exercises')).toBeInTheDocument();
      expect(screen.getByText('Total Workouts')).toBeInTheDocument();
      expect(screen.getByText('Avg Sets')).toBeInTheDocument();
    });
  });

  it('displays fetched exercises', async () => {
    renderComponent();

    await waitFor(() => {
      // Check for exercises from mock data
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Squats')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
    });
  });

  it('shows exercise categories', async () => {
    renderComponent();

    await waitFor(() => {
      // Check category chips
      expect(screen.getByText('strength')).toBeInTheDocument();
      expect(screen.getByText('cardio')).toBeInTheDocument();
    });
  });

  it('filters exercises by category', async () => {
    renderComponent();

    await waitFor(() => {
      // Get category filter
      const categoryFilter = screen.getByLabelText('Category');
      expect(categoryFilter).toBeInTheDocument();
    });

    // Filter by strength
    const categoryFilter = screen.getByLabelText('Category');
    fireEvent.mouseDown(categoryFilter);
    const strengthOption = screen.getByText('Strength');
    fireEvent.click(strengthOption);

    await waitFor(() => {
      // Should only show strength exercises
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Squats')).toBeInTheDocument();
      // Running is cardio, should not be visible
      expect(screen.queryByText('Running')).not.toBeInTheDocument();
    });
  });

  it('searches exercises by name', async () => {
    renderComponent();

    await waitFor(() => {
      // Get search input
      const searchInput = screen.getByPlaceholderText('Search exercises...');
      expect(searchInput).toBeInTheDocument();
    });

    // Search for "bench"
    const searchInput = screen.getByPlaceholderText('Search exercises...');
    fireEvent.change(searchInput, { target: { value: 'bench' } });

    await waitFor(() => {
      // Should only show Bench Press
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.queryByText('Squats')).not.toBeInTheDocument();
    });
  });

  it('expands exercise details', async () => {
    renderComponent();

    await waitFor(() => {
      // Find expand button for first exercise
      const expandButtons = screen.getAllByTestId('expand-button');
      expect(expandButtons.length).toBeGreaterThan(0);
    });

    const expandButtons = screen.getAllByTestId('expand-button');
    fireEvent.click(expandButtons[0]);

    // Should show expanded details
    await waitFor(() => {
      expect(screen.getByText('Muscle Groups:')).toBeInTheDocument();
      expect(screen.getByText('Notes:')).toBeInTheDocument();
    });
  });

  it('formats exercise data correctly', async () => {
    renderComponent();

    await waitFor(() => {
      // Check for formatted values
      expect(screen.getByText('150 lbs')).toBeInTheDocument();
      expect(screen.getByText('10 reps')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // sets
      expect(screen.getByText('25m 0s')).toBeInTheDocument(); // duration
    });
  });

  it('handles pagination when there are many exercises', async () => {
    // Create many workouts for pagination test
    const manyWorkouts = Array.from({ length: 50 }, (_, i) => ({
      id: `workout-${i}`,
      date_completed: '2025-01-10T10:00:00Z',
      exercises: [{
        name: `Exercise ${i}`,
        category: 'strength'
      }]
    }));

    api.get.mockImplementation((url) => {
      if (url.includes('/workouts/device/')) {
        if (url.includes('/stats')) {
          return Promise.resolve({ data: mockStats });
        }
        return Promise.resolve({ data: { workouts: manyWorkouts } });
      }
      return Promise.resolve({ data: {} });
    });

    renderComponent();

    await waitFor(() => {
      // Should show pagination
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    // Mock a delayed response
    api.get.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderComponent();

    // Should show loading indicator
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows empty state when no exercises found', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/workouts/device/')) {
        return Promise.resolve({ data: { workouts: [] } });
      }
      return Promise.resolve({ data: { exerciseStats: { total: 0, unique: 0, categories: {} } } });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No exercises found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    api.get.mockRejectedValue(new Error('API Error'));

    renderComponent();

    await waitFor(() => {
      // Should not crash, should show empty state
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('uses device UUID from localStorage', async () => {
    renderComponent();

    // Verify localStorage was accessed
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('deviceUuid');

    // Verify API was called with device UUID
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('/workouts/device/test-device-123')
      );
    });
  });

  it('calculates average sets correctly', async () => {
    renderComponent();

    await waitFor(() => {
      // Average should be calculated from all exercises
      // From mock data: (3 + 4 + 0) / 3 = 2.33, rounded to 2.3
      expect(screen.getByText('2.3')).toBeInTheDocument();
    });
  });

  it('shows muscle group badges when available', async () => {
    const workoutWithMuscleGroups = [
      {
        id: 'workout-1',
        date_completed: '2025-01-10T10:00:00Z',
        exercises: [
          {
            name: 'Bench Press',
            category: 'strength',
            muscle_groups: ['chest', 'triceps'],
            sets: 3,
            reps: 10
          }
        ]
      }
    ];

    api.get.mockImplementation((url) => {
      if (url.includes('/workouts/device/')) {
        return Promise.resolve({ data: { workouts: workoutWithMuscleGroups } });
      }
      return Promise.resolve({ data: {} });
    });

    renderComponent();

    // Expand exercise to see muscle groups
    await waitFor(async () => {
      const expandButtons = await screen.findAllByTestId('expand-button');
      fireEvent.click(expandButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('chest')).toBeInTheDocument();
      expect(screen.getByText('triceps')).toBeInTheDocument();
    });
  });

  it('shows verified badge for verified exercises', async () => {
    const workoutWithVerifiedExercise = [
      {
        id: 'workout-1',
        date_completed: '2025-01-10T10:00:00Z',
        exercises: [
          {
            name: 'Bench Press',
            category: 'strength',
            verified: true,
            sets: 3,
            reps: 10
          }
        ]
      }
    ];

    api.get.mockImplementation((url) => {
      if (url.includes('/workouts/device/')) {
        return Promise.resolve({ data: { workouts: workoutWithVerifiedExercise } });
      }
      return Promise.resolve({ data: {} });
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });
});