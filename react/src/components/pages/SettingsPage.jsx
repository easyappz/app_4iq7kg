import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateCurrentMember } from '../../api/members';

function SettingsPage() {
  const { currentMember, setCurrentMember } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [avatar, setAvatar] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!currentMember) {
      return;
    }

    setFirstName(currentMember.first_name || '');
    setLastName(currentMember.last_name || '');
    setBio(currentMember.bio || '');
    setBirthDate(currentMember.birth_date || '');
    setAvatar(currentMember.avatar || '');
  }, [currentMember]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!currentMember) {
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const trimmedBio = bio.trim();
      const trimmedBirthDate = birthDate.trim();
      const trimmedAvatar = avatar.trim();

      const payload = {};

      payload.first_name = trimmedFirstName;
      payload.last_name = trimmedLastName;
      payload.bio = trimmedBio;

      if (trimmedBirthDate) {
        payload.birth_date = trimmedBirthDate;
      } else {
        payload.birth_date = null;
      }

      payload.avatar = trimmedAvatar;

      const response = await updateCurrentMember(payload);
      const updatedMember = response.data;

      setCurrentMember(updatedMember);
      setSuccess('Профиль успешно сохранён.');
    } catch (saveError) {
      setError('Не удалось сохранить профиль. Проверьте данные и попробуйте ещё раз.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      data-easytag="id9-react/src/components/pages/SettingsPage.jsx"
      className="page page-settings"
    >
      <h1 className="page-title">Настройки профиля</h1>
      <p className="page-description">
        Обновите личные данные, чтобы друзья могли легче найти вас.
      </p>

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="settings-field settings-field-row">
          <div className="settings-field-col">
            <label className="settings-label" htmlFor="settings-first-name">
              Имя
            </label>
            <input
              id="settings-first-name"
              type="text"
              className="settings-input"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Введите имя"
            />
          </div>

          <div className="settings-field-col">
            <label className="settings-label" htmlFor="settings-last-name">
              Фамилия
            </label>
            <input
              id="settings-last-name"
              type="text"
              className="settings-input"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Введите фамилию"
            />
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-bio">
            О себе
          </label>
          <textarea
            id="settings-bio"
            className="settings-textarea"
            rows={4}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Расскажите о себе, интересах и увлечениях"
          />
        </div>

        <div className="settings-field settings-field-row">
          <div className="settings-field-col">
            <label className="settings-label" htmlFor="settings-birth-date">
              Дата рождения
            </label>
            <input
              id="settings-birth-date"
              type="date"
              className="settings-input"
              value={birthDate || ''}
              onChange={(event) => setBirthDate(event.target.value)}
            />
          </div>

          <div className="settings-field-col">
            <label className="settings-label" htmlFor="settings-avatar">
              Фото профиля (URL)
            </label>
            <input
              id="settings-avatar"
              type="text"
              className="settings-input"
              value={avatar}
              onChange={(event) => setAvatar(event.target.value)}
              placeholder="Ссылка на изображение профиля"
            />
          </div>
        </div>

        <div className="settings-actions">
          <button
            type="submit"
            className="settings-submit"
            disabled={isSaving}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>

        {error ? <div className="settings-feedback settings-error">{error}</div> : null}
        {success ? (
          <div className="settings-feedback settings-success">{success}</div>
        ) : null}
      </form>
    </div>
  );
}

export default SettingsPage;
