import React from 'react';
import { Navigate } from 'react-router-dom';

function PrivateRoute({ children, isAuthenticated }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default PrivateRoute;
