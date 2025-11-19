import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

function RegisterPage() {
  const { handleRegister } = useAuth();

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (event) => {
    event.preventDefault();

    setFormError('');
    setFieldErrors({});
    setIsSubmitting(true);

    const payload = {
      username,
      first_name: firstName,
      last_name: lastName,
      password,
    };

    if (bio) {
      payload.bio = bio;
    }

    if (birthDate) {
      payload.birth_date = birthDate;
    }

    try {
      await handleRegister(payload);
    } catch (error) {
      if (error.response && error.response.status === 400 && error.response.data) {
        const data = error.response.data;
        const newFieldErrors = {};

        Object.keys(data).forEach((key) => {
          const value = data[key];

          if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
            newFieldErrors[key] = value[0];
          } else if (typeof value === 'string') {
            newFieldErrors[key] = value;
          }
        });

        setFieldErrors(newFieldErrors);

        if (
          Array.isArray(data.non_field_errors) &&
          data.non_field_errors.length > 0 &&
          typeof data.non_field_errors[0] === 'string'
        ) {
          setFormError(data.non_field_errors[0]);
        }
      } else {
        setFormError('Не удалось создать аккаунт. Попробуйте ещё раз.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFieldError = (fieldName) => {
    if (!fieldErrors[fieldName]) {
      return null;
    }

    return <div className="auth-field-error">{fieldErrors[fieldName]}</div>;
  };

  return (
    <div
      className="auth-page"
      data-easytag="id3-react/src/components/Auth/RegisterPage.jsx"
    >
      <div className="auth-card">
        <h1 className="auth-title">Регистрация</h1>
        <p className="auth-subtitle">
          Создайте аккаунт, чтобы начать пользоваться социальной сетью.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-username">
              Имя пользователя
            </label>
            <input
              id="register-username"
              type="text"
              className="auth-input"
              placeholder="Придумайте уникальное имя пользователя"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
            {renderFieldError('username')}
          </div>

          <div className="auth-field auth-field-row">
            <div className="auth-field-col">
              <label className="auth-label" htmlFor="register-first-name">
                Имя
              </label>
              <input
                id="register-first-name"
                type="text"
                className="auth-input"
                placeholder="Ваше имя"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                required
              />
              {renderFieldError('first_name')}
            </div>

            <div className="auth-field-col">
              <label className="auth-label" htmlFor="register-last-name">
                Фамилия
              </label>
              <input
                id="register-last-name"
                type="text"
                className="auth-input"
                placeholder="Ваша фамилия"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                required
              />
              {renderFieldError('last_name')}
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-birth-date">
              Дата рождения
            </label>
            <input
              id="register-birth-date"
              type="date"
              className="auth-input"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
            {renderFieldError('birth_date')}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-password">
              Пароль
            </label>
            <input
              id="register-password"
              type="password"
              className="auth-input"
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
            {renderFieldError('password')}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="register-bio">
              О себе (необязательно)
            </label>
            <textarea
              id="register-bio"
              className="auth-input auth-textarea"
              placeholder="Расскажите немного о себе"
              rows={3}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
            {renderFieldError('bio')}
          </div>

          {formError ? (
            <div className="auth-error" role="alert">
              {formError}
            </div>
          ) : null}

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;
