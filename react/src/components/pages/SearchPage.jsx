import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  searchMembers,
  followMember,
  unfollowMember,
  getMemberFollowing,
} from '../../api/members';

function getMemberDisplayName(member) {
  if (!member) {
    return '';
  }

  const firstName = member.first_name || '';
  const lastName = member.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    return fullName;
  }

  return member.username || '';
}

function SearchPage() {
  const { currentMember } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const [followingIds, setFollowingIds] = useState(new Set());
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [changingFollowId, setChangingFollowId] = useState(null);

  useEffect(() => {
    if (!currentMember) {
      setFollowingIds(new Set());
      return;
    }

    let isMounted = true;

    const loadFollowing = async () => {
      setIsLoadingFollowing(true);

      try {
        const response = await getMemberFollowing(currentMember.id);
        const list = Array.isArray(response.data) ? response.data : [];
        const ids = new Set(list.map((item) => item.id));

        if (isMounted) {
          setFollowingIds(ids);
        }
      } catch (loadError) {
        if (isMounted) {
          setFollowingIds(new Set());
        }
      } finally {
        if (isMounted) {
          setIsLoadingFollowing(false);
        }
      }
    };

    loadFollowing();

    return () => {
      isMounted = false;
    };
  }, [currentMember]);

  const handleSearch = async (event) => {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setError('');
      return;
    }

    setIsSearching(true);
    setError('');
    setResults([]);

    try {
      const response = await searchMembers(trimmedQuery);
      const list = Array.isArray(response.data) ? response.data : [];
      setResults(list);
    } catch (searchError) {
      setError('Не удалось выполнить поиск. Попробуйте позже.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleToggleFollow = async (memberId) => {
    if (!currentMember) {
      return;
    }

    if (memberId === currentMember.id) {
      return;
    }

    setChangingFollowId(memberId);
    setError('');

    try {
      const currentlyFollowing = followingIds.has(memberId);
      const apiCall = currentlyFollowing ? unfollowMember : followMember;

      const response = await apiCall(memberId);
      const data = response.data || {};
      const followingNow =
        typeof data.following === 'boolean' ? data.following : !currentlyFollowing;

      setFollowingIds((prev) => {
        const next = new Set(prev);

        if (followingNow) {
          next.add(memberId);
        } else {
          next.delete(memberId);
        }

        return next;
      });
    } catch (toggleError) {
      setError('Не удалось изменить подписку. Попробуйте позже.');
    } finally {
      setChangingFollowId(null);
    }
  };

  const renderFollowButton = (member) => {
    if (!currentMember) {
      return null;
    }

    if (member.id === currentMember.id) {
      return null;
    }

    if (isLoadingFollowing) {
      return null;
    }

    const isFollowing = followingIds.has(member.id);

    return (
      <button
        type="button"
        className={isFollowing ? 'follow-button follow-button-secondary' : 'follow-button'}
        onClick={() => handleToggleFollow(member.id)}
        disabled={changingFollowId === member.id}
      >
        {changingFollowId === member.id
          ? 'Обновление...'
          : isFollowing
            ? 'Отписаться'
            : 'Подписаться'}
      </button>
    );
  };

  const hasQuery = Boolean(query.trim());

  return (
    <div
      data-easytag="id7-react/src/components/pages/SearchPage.jsx"
      className="page page-search"
    >
      <h1 className="page-title">Поиск пользователей</h1>
      <p className="page-description">
        Найдите друзей по имени или имени пользователя.
      </p>

      <form className="search-form" onSubmit={handleSearch}>
        <input
          type="text"
          className="search-input"
          placeholder="Поиск по имени или username"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="submit"
          className="search-button"
          disabled={isSearching || !query.trim()}
        >
          {isSearching ? 'Поиск...' : 'Найти'}
        </button>
      </form>

      {error ? <div className="search-error">{error}</div> : null}

      {!isSearching && results.length === 0 && !error && hasQuery ? (
        <div className="search-empty">Пользователи не найдены.</div>
      ) : null}

      {results.length > 0 ? (
        <div className="search-results">
          {results.map((member) => (
            <div key={member.id} className="search-result-item">
              <div className="search-result-main">
                <div className="search-result-avatar-placeholder" />
                <div className="search-result-text">
                  <Link
                    to={`/users/${member.id}`}
                    className="search-result-name"
                  >
                    {getMemberDisplayName(member)}
                  </Link>
                  <div className="search-result-username">
                    @{member.username}
                  </div>
                </div>
              </div>
              <div className="search-result-action">
                {renderFollowButton(member)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default SearchPage;
