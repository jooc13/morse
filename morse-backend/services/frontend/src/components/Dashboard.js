import React from 'react';
import HistoryPage from './HistoryPage';

const Dashboard = ({ user, userProfile, onProfileUpdate }) => {
  return <HistoryPage user={user} />;
};

export default Dashboard;