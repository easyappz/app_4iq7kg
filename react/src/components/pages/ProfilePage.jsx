import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMemberFollowers, getMemberFollowing } from '../../api/members';
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

function ProfilePage() {
  const { currentMember } = useAuth();

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [postsCount, setPostsCount] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [updatingPostId, setUpdatingPostId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [likingPostId, setLikingPostId] = useState(null);

  useEffect(() => {
    if (!currentMember) {
      return;
    }

    let isMounted = true;

    const loadProfileData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const memberId = currentMember.id;

        const [followersResponse, followingResponse, postsResponse] =
          await Promise.all([
            getMemberFollowers(memberId),
            getMemberFollowing(memberId),
            getUserPosts(memberId, { page: 1 }),
          ]);

        if (!isMounted) {
          return;
        }

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

        setFollowersCount(followers.length);
        setFollowingCount(following.length);
        setPosts(normalizedPosts);
        setPostsCount(
          typeof postsData.count === 'number' ? postsData.count : normalizedPosts.length,
        );
      } catch (loadError) {
        if (isMounted) {
          setError('Не удалось загрузить данные профиля. Попробуйте позже.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProfileData();

    return () => {
      isMounted = false;
    };
  }, [currentMember]);

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

  if (!currentMember) {
    return (
      <div
        data-easytag="id5-react/src/components/pages/ProfilePage.jsx"
        className="page page-profile"
      >
        <h1 className="page-title">Мой профиль</h1>
        <p className="page-description">Загрузка профиля...</p>
      </div>
    );
  }

  const displayName = getMemberDisplayName(currentMember);
  const usernameLabel = currentMember.username ? `@${currentMember.username}` : '';
  const birthDateLabel = formatBirthDate(currentMember.birth_date);

  return (
    <div
      data-easytag="id5-react/src/components/pages/ProfilePage.jsx"
      className="page page-profile"
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

            <div className="profile-section">
              <div className="profile-section-title">О себе</div>
              <div className="profile-section-body">
                {currentMember.bio ? (
                  <p className="profile-bio">{currentMember.bio}</p>
                ) : (
                  <p className="profile-bio profile-bio-empty">
                    Расскажите о себе в настройках профиля.
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
              У вас пока нет постов. Создайте первый пост в ленте.
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

export default ProfilePage;
