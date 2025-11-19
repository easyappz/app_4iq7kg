import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getMember,
  followMember,
  unfollowMember,
  getMemberFollowers,
  getMemberFollowing,
} from '../../api/members';
import {
  getUserPosts,
  updatePost,
  deletePost,
  togglePostLike,
} from '../../api/posts';
import { PostCard } from '../Home/HomeFeedPage';

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

function formatBirthDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function UserProfilePage() {
  const params = useParams();
  const rawId = params.id;
  const memberId = Number(rawId);

  const { currentMember } = useAuth();

  const [member, setMember] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [postsCount, setPostsCount] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowChanging, setIsFollowChanging] = useState(false);
  const [followError, setFollowError] = useState('');

  const [updatingPostId, setUpdatingPostId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [likingPostId, setLikingPostId] = useState(null);

  useEffect(() => {
    if (!memberId || Number.isNaN(memberId)) {
      setError('Некорректный идентификатор пользователя.');
      return;
    }

    let isMounted = true;

    const loadUserProfile = async () => {
      setIsLoading(true);
      setError('');
      setFollowError('');

      try {
        const [
          memberResponse,
          followersResponse,
          followingResponse,
          postsResponse,
        ] = await Promise.all([
          getMember(memberId),
          getMemberFollowers(memberId),
          getMemberFollowing(memberId),
          getUserPosts(memberId, { page: 1 }),
        ]);

        if (!isMounted) {
          return;
        }

        const loadedMember = memberResponse.data;
        const followers = Array.isArray(followersResponse.data)
          ? followersResponse.data
          : [];
        const following = Array.isArray(followingResponse.data)
          ? followingResponse.data
          : [];

        const postsData = postsResponse.data || {};
        const postResults = Array.isArray(postsData.results)
          ? postsData.results
          : [];

        const normalizedPosts = postResults.map((post) => ({
          ...post,
          liked:
            typeof post.liked === 'boolean'
              ? post.liked
              : false,
        }));

        setMember(loadedMember);
        setFollowersCount(followers.length);
        setFollowingCount(following.length);
        setPosts(normalizedPosts);
        setPostsCount(
          typeof postsData.count === 'number' ? postsData.count : normalizedPosts.length,
        );

        if (
          currentMember &&
          typeof currentMember.id === 'number'
        ) {
          const isAlreadyFollowing = followers.some(
            (item) => item.id === currentMember.id,
          );
          setIsFollowing(isAlreadyFollowing);
        } else {
          setIsFollowing(false);
        }
      } catch (loadError) {
        if (isMounted) {
          setError('Не удалось загрузить профиль пользователя. Попробуйте позже.');
          setMember(null);
          setFollowersCount(0);
          setFollowingCount(0);
          setPosts([]);
          setPostsCount(0);
          setIsFollowing(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadUserProfile();

    return () => {
      isMounted = false;
    };
  }, [memberId, currentMember]);

  const handleToggleFollow = async () => {
    if (!member || !currentMember) {
      return;
    }

    if (member.id === currentMember.id) {
      return;
    }

    setIsFollowChanging(true);
    setFollowError('');

    try {
      const currentlyFollowing = isFollowing;
      const apiCall = currentlyFollowing ? unfollowMember : followMember;

      const response = await apiCall(member.id);
      const data = response.data || {};

      const followingNow =
        typeof data.following === 'boolean' ? data.following : !currentlyFollowing;

      setIsFollowing(followingNow);

      setFollowersCount((prev) => {
        const base = typeof prev === 'number' ? prev : 0;

        if (!currentlyFollowing && followingNow) {
          return base + 1;
        }

        if (currentlyFollowing && !followingNow && base > 0) {
          return base - 1;
        }

        return base;
      });
    } catch (toggleError) {
      setFollowError('Не удалось изменить подписку. Попробуйте позже.');
    } finally {
      setIsFollowChanging(false);
    }
  };

  const handleUpdatePost = useCallback(async (postId, payload) => {
    setUpdatingPostId(postId);
    setError('');

    try {
      const response = await updatePost(postId, payload);
      const updatedPost = response.data;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) {
            return post;
          }

          return {
            ...updatedPost,
            liked:
              typeof post.liked === 'boolean'
                ? post.liked
                : false,
          };
        }),
      );
    } catch (updateError) {
      setError('Не удалось обновить пост. Попробуйте ещё раз.');
      throw updateError;
    } finally {
      setUpdatingPostId(null);
    }
  }, []);

  const handleDeletePost = useCallback(async (postId) => {
    const confirmed = window.confirm('Вы уверены, что хотите удалить этот пост?');

    if (!confirmed) {
      return;
    }

    setDeletingPostId(postId);
    setError('');

    try {
      await deletePost(postId);

      setPosts((prev) => prev.filter((post) => post.id !== postId));
      setPostsCount((prev) => {
        const next = typeof prev === 'number' ? prev - 1 : 0;
        return next < 0 ? 0 : next;
      });
    } catch (deleteError) {
      setError('Не удалось удалить пост. Попробуйте позже.');
    } finally {
      setDeletingPostId(null);
    }
  }, []);

  const handleToggleLike = useCallback(async (postId) => {
    setLikingPostId(postId);

    try {
      const response = await togglePostLike(postId);
      const data = response.data || {};

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== postId) {
            return post;
          }

          const nextLikesCount =
            typeof data.likes_count === 'number'
              ? data.likes_count
              : post.likes_count;

          const nextLiked =
            typeof data.liked === 'boolean' ? data.liked : post.liked;

          return {
            ...post,
            likes_count: nextLikesCount,
            liked: nextLiked,
          };
        }),
      );
    } catch (likeError) {
      // Ignore like errors for now
    } finally {
      setLikingPostId(null);
    }
  }, []);

  const handlePostCommentsCountChange = useCallback((postId, delta) => {
    if (!delta) {
      return;
    }

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        const currentCount =
          typeof post.comments_count === 'number' ? post.comments_count : 0;
        const nextCount = currentCount + delta;

        return {
          ...post,
          comments_count: nextCount < 0 ? 0 : nextCount,
        };
      }),
    );
  }, []);

  if (!memberId || Number.isNaN(memberId)) {
    return (
      <div
        data-easytag="id6-react/src/components/pages/UserProfilePage.jsx"
        className="page page-user-profile"
      >
        <h1 className="page-title">Профиль пользователя</h1>
        <p className="page-description">
          Некорректный идентификатор пользователя.
        </p>
      </div>
    );
  }

  if (isLoading && !member) {
    return (
      <div
        data-easytag="id6-react/src/components/pages/UserProfilePage.jsx"
        className="page page-user-profile"
      >
        <h1 className="page-title">Профиль пользователя</h1>
        <p className="page-description">Загрузка профиля...</p>
      </div>
    );
  }

  if (error && !member) {
    return (
      <div
        data-easytag="id6-react/src/components/pages/UserProfilePage.jsx"
        className="page page-user-profile"
      >
        <h1 className="page-title">Профиль пользователя</h1>
        <p className="page-description">{error}</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div
        data-easytag="id6-react/src/components/pages/UserProfilePage.jsx"
        className="page page-user-profile"
      >
        <h1 className="page-title">Профиль пользователя</h1>
        <p className="page-description">Пользователь не найден.</p>
      </div>
    );
  }

  const isOwnProfile =
    currentMember &&
    typeof currentMember.id === 'number' &&
    currentMember.id === member.id;

  const displayName = getMemberDisplayName(member);
  const usernameLabel = member.username ? `@${member.username}` : '';
  const birthDateLabel = formatBirthDate(member.birth_date);

  return (
    <div
      data-easytag="id6-react/src/components/pages/UserProfilePage.jsx"
      className="page page-user-profile"
    >
      <div className="profile-layout">
        <section className="profile-sidebar">
          <div className="profile-card">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-placeholder" />
            </div>

            <div className="profile-main-info">
              <h1 className="profile-name">
                {displayName || 'Без имени'}
              </h1>
              {usernameLabel ? (
                <div className="profile-username">{usernameLabel}</div>
              ) : null}
            </div>

            <div className="profile-stats">
              <div className="profile-stat-item">
                <div className="profile-stat-label">Посты</div>
                <div className="profile-stat-value">{postsCount}</div>
              </div>
              <div className="profile-stat-item">
                <div className="profile-stat-label">Подписчики</div>
                <div className="profile-stat-value">{followersCount}</div>
              </div>
              <div className="profile-stat-item">
                <div className="profile-stat-label">Подписки</div>
                <div className="profile-stat-value">{followingCount}</div>
              </div>
            </div>

            {!isOwnProfile ? (
              <div className="profile-actions">
                <button
                  type="button"
                  className={
                    isFollowing ? 'follow-button follow-button-secondary' : 'follow-button'
                  }
                  onClick={handleToggleFollow}
                  disabled={isFollowChanging}
                >
                  {isFollowChanging
                    ? 'Обновление...'
                    : isFollowing
                      ? 'Отписаться'
                      : 'Подписаться'}
                </button>
                {followError ? (
                  <div className="profile-follow-error">{followError}</div>
                ) : null}
              </div>
            ) : null}

            <div className="profile-section">
              <div className="profile-section-title">О себе</div>
              <div className="profile-section-body">
                {member.bio ? (
                  <p className="profile-bio">{member.bio}</p>
                ) : (
                  <p className="profile-bio profile-bio-empty">
                    Пользователь пока ничего не рассказал о себе.
                  </p>
                )}
              </div>
            </div>

            <div className="profile-section">
              <div className="profile-section-title">Дата рождения</div>
              <div className="profile-section-body">
                {birthDateLabel ? (
                  <p className="profile-meta-text">{birthDateLabel}</p>
                ) : (
                  <p className="profile-meta-text profile-meta-text-muted">
                    Не указана
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="profile-main">
          <div className="profile-main-header">
            <h2 className="profile-main-title">Посты</h2>
            {isLoading ? (
              <span className="profile-main-subtitle">Загрузка...</span>
            ) : (
              <span className="profile-main-subtitle">
                Всего постов: {postsCount}
              </span>
            )}
          </div>

          {error ? <div className="feed-error">{error}</div> : null}

          {isLoading && posts.length === 0 ? (
            <div className="feed-loading">Загрузка постов...</div>
          ) : null}

          {!isLoading && posts.length === 0 ? (
            <div className="feed-empty">
              У пользователя пока нет постов.
            </div>
          ) : null}

          <div className="profile-posts-list">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentMember={currentMember}
                onUpdatePost={handleUpdatePost}
                onDeletePost={handleDeletePost}
                onToggleLike={handleToggleLike}
                onCommentsCountChange={(delta) =>
                  handlePostCommentsCountChange(post.id, delta)
                }
                isUpdating={updatingPostId === post.id}
                isDeleting={deletingPostId === post.id}
                isLiking={likingPostId === post.id}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default UserProfilePage;
