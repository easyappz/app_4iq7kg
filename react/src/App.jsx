import React, { useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import './App.css';

import HomeFeedPage from './components/pages/HomeFeedPage';
import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import ProfilePage from './components/pages/ProfilePage';
import UserProfilePage from './components/pages/UserProfilePage';
import SearchPage from './components/pages/SearchPage';
import DialogsPage from './components/pages/DialogsPage';
import SettingsPage from './components/pages/SettingsPage';
import PrivateRoute from './components/routing/PrivateRoute';
import PublicRoute from './components/routing/PublicRoute';
import { useAuth } from './context/AuthContext';

function App() {
  const { token, currentMember, handleLogout } = useAuth();

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.handleRoutes === 'function') {
      window.handleRoutes([
        '/',
        '/login',
        '/register',
        '/profile',
        '/users/:id',
        '/search',
        '/dialogs',
        '/settings',
      ]);
    }
  }, []);

  const isAuthenticated = Boolean(token);

  const renderNavLinkClassName = ({ isActive }) => {
    if (isActive) {
      return 'app-nav-link app-nav-link-active';
    }

    return 'app-nav-link';
  };

  const renderCurrentMemberName = () => {
    if (!currentMember) {
      return 'Загрузка...';
    }

    const firstName = currentMember.first_name || '';
    const lastName = currentMember.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) {
      return fullName;
    }

    return currentMember.username;
  };

  return (
    <ErrorBoundary>
      <div className="app-root" data-easytag="id1-react/src/App.jsx">
        <header className="app-header">
          <div className="app-header-inner">
            <div className="app-header-left">
              <button type="button" className="app-header-burger" aria-label="Меню">
                ☰
              </button>

              <div className="app-logo">EasySocial</div>

              <nav className="app-nav">
                <NavLink to="/" className={renderNavLinkClassName}>
                  Лента
                </NavLink>
                <NavLink to="/search" className={renderNavLinkClassName}>
                  Поиск
                </NavLink>
                <NavLink to="/dialogs" className={renderNavLinkClassName}>
                  Диалоги
                </NavLink>
                <NavLink to="/profile" className={renderNavLinkClassName}>
                  Профиль
                </NavLink>
                <NavLink to="/settings" className={renderNavLinkClassName}>
                  Настройки
                </NavLink>
              </nav>
            </div>

            <div className="app-header-right">
              {isAuthenticated ? (
                <>
                  <div className="app-current-user">
                    <div className="app-current-user-avatar-placeholder" />
                    <div className="app-current-user-text">
                      <div className="app-current-user-name">{renderCurrentMemberName()}</div>
                      {currentMember ? (
                        <div className="app-current-user-username">@{currentMember.username}</div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="app-logout-button"
                    onClick={handleLogout}
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <div className="app-auth-links">
                  <NavLink to="/login" className={renderNavLinkClassName}>
                    Войти
                  </NavLink>
                  <NavLink to="/register" className={renderNavLinkClassName}>
                    Регистрация
                  </NavLink>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route
              path="/login"
              element={
                (
                  <PublicRoute isAuthenticated={isAuthenticated}>
                    <LoginPage />
                  </PublicRoute>
                )
              }
            />

            <Route
              path="/register"
              element={
                (
                  <PublicRoute isAuthenticated={isAuthenticated}>
                    <RegisterPage />
                  </PublicRoute>
                )
              }
            />

            <Route
              path="/"
              element={
                (
                  <PrivateRoute isAuthenticated={isAuthenticated}>
                    <HomeFeedPage />
                  </PrivateRoute>
                )
              }
            />

            <Route
              path="/profile"
              element={
                (
                  <PrivateRoute isAuthenticated={isAuthenticated}>
                    <ProfilePage />
                  </PrivateRoute>
                )
              }
            />

            <Route
              path="/users/:id"
              element={
                (
                  <PrivateRoute isAuthenticated={isAuthenticated}>
                    <UserProfilePage />
                  </PrivateRoute>
                )
              }
            />

            <Route
              path="/search"
              element={
                (
                  <PrivateRoute isAuthenticated={isAuthenticated}>
                    <SearchPage />
                  </PrivateRoute>
                )
              }
            />

            <Route
              path="/dialogs"
              element={
                (
                  <PrivateRoute isAuthenticated={isAuthenticated}>
                    <DialogsPage />
                  </PrivateRoute>
                )
              }
            />

            <Route
              path="/settings"
              element={
                (
                  <PrivateRoute isAuthenticated={isAuthenticated}>
                    <SettingsPage />
                  </PrivateRoute>
                )
              }
            />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
