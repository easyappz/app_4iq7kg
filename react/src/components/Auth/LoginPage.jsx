import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function LoginPage() {
  const { handleLogin } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await handleLogin({ username, password });
    } catch (error) {
      let message = 'Не удалось войти. Проверьте данные и попробуйте ещё раз.';

      if (error.response && error.response.data) {
        const data = error.response.data;

        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (
          Array.isArray(data.non_field_errors) &&
          data.non_field_errors.length > 0 &&
          typeof data.non_field_errors[0] === 'string'
        ) {
          message = data.non_field_errors[0];
        }
      }

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="auth-page"
      data-easytag="id2-react/src/components/Auth/LoginPage.jsx"
    >
      <div className="auth-card">
        <h1 className="auth-title">Вход</h1>
        <p className="auth-subtitle">
          Войдите в аккаунт, чтобы пользоваться социальной сетью.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-username">
              Имя пользователя
            </label>
            <input
              id="login-username"
              type="text"
              className="auth-input"
              placeholder="Введите имя пользователя"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">
              Пароль
            </label>
            <input
              id="login-password"
              type="password"
              className="auth-input"
              placeholder="Введите пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {errorMessage ? (
            <div className="auth-error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
