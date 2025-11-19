import React from 'react';
import { useParams } from 'react-router-dom';

function UserProfilePage() {
  const params = useParams();
  const userId = params.id;

  return (
    <div
      data-easytag="id6-react/src/components/pages/UserProfilePage.jsx"
      className="page page-user-profile"
    >
      <h1 className="page-title">Профиль пользователя</h1>
      <p className="page-description">
        Здесь будет профиль пользователя с ID:
        {' '}
        <strong>{userId}</strong>
      </p>
    </div>
  );
}

export default UserProfilePage;
