import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getFeed,
  createPost,
  updatePost,
  deletePost,
  togglePostLike,
} from '../../api/posts';
import {
  getPostComments,
  createComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
} from '../../api/comments';

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

function HomeFeedPage() {
  const { currentMember } = useAuth();

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newPostFiles, setNewPostFiles] = useState([]);
  const [newPostFilePreviews, setNewPostFilePreviews] = useState([]);
  const newPostFileInputRef = useRef(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  const [updatingPostId, setUpdatingPostId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [likingPostId, setLikingPostId] = useState(null);

  const loadPosts = useCallback(async (pageToLoad = 1, append = false) => {
    if (!append) {
      setIsInitialLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    setError('');

    try {
      const params = { page: pageToLoad };
      const response = await getFeed(params);
      const data = response.data || {};
      const results = Array.isArray(data.results) ? data.results : [];

      const normalized = results.map((post) => ({
        ...post,
        liked:
          typeof post.liked === 'boolean'
            ? post.liked
            : false,
      }));

      setPosts((prev) => {
        if (append) {
          return [...prev, ...normalized];
        }

        return normalized;
      });

      setPage(pageToLoad);
      setHasMore(Boolean(data.next));
    } catch (err) {
      setError('Не удалось загрузить ленту. Попробуйте позже.');
    } finally {
      setIsInitialLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPosts(1, false);
  }, [loadPosts]);

  useEffect(() => {
    if (!newPostFiles || newPostFiles.length === 0) {
      setNewPostFilePreviews([]);
      return;
    }

    const nextPreviews = newPostFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setNewPostFilePreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((item) => {
        URL.revokeObjectURL(item.url);
      });
    };
  }, [newPostFiles]);

  const handleCreatePost = async (event) => {
    event.preventDefault();

    const trimmedText = newPostText.trim();
    const trimmedImage = newPostImage.trim();

    if (!trimmedText) {
      return;
    }

    setIsCreatingPost(true);
    setError('');

    try {
      const payload = {
        text: trimmedText,
      };

      if (trimmedImage) {
        payload.image = trimmedImage;
      }

      await createPost(payload, newPostFiles);

      setNewPostText('');
      setNewPostImage('');
      setNewPostFiles([]);
      if (newPostFileInputRef.current) {
        newPostFileInputRef.current.value = '';
      }

      await loadPosts(1, false);
    } catch (err) {
      setError('Не удалось создать пост. Попробуйте ещё раз.');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handleUpdatePost = useCallback(async (postId, payload, files) => {
    setUpdatingPostId(postId);
    setError('');

    try {
      const response = await updatePost(postId, payload, files);
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
    } catch (err) {
      setError('Не удалось обновить пост. Попробуйте ещё раз.');
      throw err;
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
    } catch (err) {
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
    } catch (err) {
      // Silently ignore like errors for now
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

        const currentCount = typeof post.comments_count === 'number' ? post.comments_count : 0;
        const nextCount = currentCount + delta;

        return {
          ...post,
          comments_count: nextCount < 0 ? 0 : nextCount,
        };
      }),
    );
  }, []);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    const nextPage = page + 1;
    await loadPosts(nextPage, true);
  };

  const renderHeaderSubtitle = () => {
    if (!currentMember) {
      return 'Поделитесь своими мыслями с друзьями.';
    }

    return 'Поделитесь своими мыслями с подписчиками.';
  };

  const handleNewPostFilesChange = (event) => {
    const files = Array.from(event.target.files || []);
    setNewPostFiles(files);
  };

  return (
    <div
      data-easytag="id3-react/src/components/Home/HomeFeedPage.jsx"
      className="page feed-page"
    >
      <div className="feed-container">
        <section className="feed-create-card">
          <div className="feed-create-header">
            <div className="feed-create-avatar-placeholder" />
            <div className="feed-create-title-block">
              <div className="feed-create-title-text">
                {currentMember
                  ? `Что у вас нового, ${getMemberDisplayName(currentMember)}?`
                  : 'Создать пост'}
              </div>
              <div className="feed-create-subtitle">{renderHeaderSubtitle()}</div>
            </div>
          </div>

          <form className="feed-create-form" onSubmit={handleCreatePost}>
            <textarea
              className="feed-input feed-textarea"
              rows={3}
              placeholder="Напишите что-нибудь..."
              value={newPostText}
              onChange={(event) => setNewPostText(event.target.value)}
            />

            <input
              className="feed-input feed-input-image"
              type="text"
              placeholder="Ссылка на изображение (опционально)"
              value={newPostImage}
              onChange={(event) => setNewPostImage(event.target.value)}
            />

            <div className="feed-create-files">
              <label className="feed-file-input-label">
                <span className="feed-file-input-label-text">Добавить фото/видео</span>
                <input
                  ref={newPostFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="feed-file-input"
                  onChange={handleNewPostFilesChange}
                />
              </label>

              {newPostFilePreviews.length > 0 ? (
                <div className="feed-file-previews">
                  {newPostFilePreviews.map((item) => (
                    <div key={item.url} className="feed-file-preview-item">
                      {item.file.type && item.file.type.startsWith('image/') ? (
                        <img
                          src={item.url}
                          alt={item.file.name}
                          className="feed-file-preview-image"
                        />
                      ) : item.file.type && item.file.type.startsWith('video/') ? (
                        <video
                          src={item.url}
                          className="feed-file-preview-video"
                          controls
                        />
                      ) : (
                        <span className="feed-file-preview-name">{item.file.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="feed-create-actions">
              <button
                type="submit"
                className="feed-button-primary"
                disabled={isCreatingPost || !newPostText.trim()}
              >
                {isCreatingPost ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </form>
        </section>

        {error ? <div className="feed-error">{error}</div> : null}

        {isInitialLoading ? (
          <div className="feed-loading">Загрузка ленты...</div>
        ) : null}

        {!isInitialLoading && posts.length === 0 ? (
          <div className="feed-empty">Пока нет постов. Напишите что-нибудь первым!</div>
        ) : null}

        <div className="feed-posts-list">
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

        {hasMore && !isInitialLoading ? (
          <div className="feed-pagination">
            <button
              type="button"
              className="feed-button-secondary"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Загрузка...' : 'Показать ещё'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PostCard({
  post,
  currentMember,
  onUpdatePost,
  onDeletePost,
  onToggleLike,
  onCommentsCountChange,
  isUpdating,
  isDeleting,
  isLiking,
}) {
  const [isCommentsVisible, setIsCommentsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.text || '');
  const [editImage, setEditImage] = useState(post.image || '');
  const [editFiles, setEditFiles] = useState([]);
  const [editFilePreviews, setEditFilePreviews] = useState([]);
  const editFileInputRef = useRef(null);

  const isAuthor = Boolean(
    currentMember &&
      post &&
      post.author &&
      typeof currentMember.id === 'number' &&
      currentMember.id === post.author.id,
  );

  const mediaItems = Array.isArray(post.media) ? post.media : [];

  useEffect(() => {
    if (!editFiles || editFiles.length === 0) {
      setEditFilePreviews([]);
      return;
    }

    const nextPreviews = editFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setEditFilePreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((item) => {
        URL.revokeObjectURL(item.url);
      });
    };
  }, [editFiles]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditText(post.text || '');
    setEditImage(post.image || '');
    setEditFiles([]);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(post.text || '');
    setEditImage(post.image || '');
    setEditFiles([]);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  const handleSaveEdit = async () => {
    const trimmedText = editText.trim();
    const trimmedImage = editImage.trim();

    if (!trimmedText) {
      return;
    }

    const payload = {
      text: trimmedText,
    };

    if (trimmedImage) {
      payload.image = trimmedImage;
    }

    try {
      await onUpdatePost(post.id, payload, editFiles);
      setIsEditing(false);
      setEditFiles([]);
      if (editFileInputRef.current) {
        editFileInputRef.current.value = '';
      }
    } catch (err) {
      // Error is handled in parent; keep editing mode on failure
    }
  };

  const handleToggleComments = () => {
    setIsCommentsVisible((prev) => !prev);
  };

  const handleDelete = () => {
    onDeletePost(post.id);
  };

  const handleToggleLikeClick = () => {
    onToggleLike(post.id);
  };

  const handleEditFilesChange = (event) => {
    const files = Array.from(event.target.files || []);
    setEditFiles(files);
  };

  const likesCount = typeof post.likes_count === 'number' ? post.likes_count : 0;
  const commentsCount =
    typeof post.comments_count === 'number' ? post.comments_count : 0;

  return (
    <article
      data-easytag="id4-react/src/components/Home/HomeFeedPage.jsx"
      className="feed-post-card"
    >
      <header className="feed-post-header">
        <div className="feed-post-author-block">
          <div className="feed-post-avatar-placeholder" />
          <div className="feed-post-author-text">
            <div className="feed-post-author-name">
              {getMemberDisplayName(post.author)}
            </div>
            <div className="feed-post-meta">
              <span className="feed-post-date">
                Дата публикации: {formatDateTime(post.created_at)}
              </span>
            </div>
          </div>
        </div>

        {isAuthor ? (
          <div className="feed-post-header-actions">
            {!isEditing ? (
              <button
                type="button"
                className="feed-post-header-button"
                onClick={handleStartEdit}
              >
                Редактировать
              </button>
            ) : null}

            <button
              type="button"
              className="feed-post-header-button feed-post-header-button-danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        ) : null}
      </header>

      <div className="feed-post-body">
        {isEditing ? (
          <>
            <textarea
              className="feed-input feed-textarea feed-post-edit-textarea"
              rows={3}
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
            />

            <input
              className="feed-input feed-input-image"
              type="text"
              placeholder="Ссылка на изображение (опционально)"
              value={editImage}
              onChange={(event) => setEditImage(event.target.value)}
            />

            <div className="feed-post-edit-files">
              <label className="feed-file-input-label">
                <span className="feed-file-input-label-text">Добавить фото/видео</span>
                <input
                  ref={editFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="feed-file-input"
                  onChange={handleEditFilesChange}
                />
              </label>

              {editFilePreviews.length > 0 ? (
                <div className="feed-file-previews feed-post-edit-previews">
                  {editFilePreviews.map((item) => (
                    <div key={item.url} className="feed-file-preview-item">
                      {item.file.type && item.file.type.startsWith('image/') ? (
                        <img
                          src={item.url}
                          alt={item.file.name}
                          className="feed-file-preview-image"
                        />
                      ) : item.file.type && item.file.type.startsWith('video/') ? (
                        <video
                          src={item.url}
                          className="feed-file-preview-video"
                          controls
                        />
                      ) : (
                        <span className="feed-file-preview-name">{item.file.name}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="feed-post-edit-actions">
              <button
                type="button"
                className="feed-button-primary feed-post-edit-button"
                onClick={handleSaveEdit}
                disabled={isUpdating || !editText.trim()}
              >
                {isUpdating ? 'Сохранение...' : 'Сохранить'}
              </button>

              <button
                type="button"
                className="feed-button-secondary feed-post-edit-button"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                Отмена
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="feed-post-text">{post.text}</div>

            {post.image ? (
              <div className="feed-post-image-placeholder">
                Изображение поста
              </div>
            ) : null}

            {mediaItems.length > 0 ? (
              <div className="feed-post-media">
                {mediaItems.map((item) => (
                  <div key={item.id} className="feed-post-media-item">
                    {item.media_type === 'image' ? (
                      <img
                        src={item.file}
                        alt="Изображение поста"
                        className="feed-post-media-image"
                      />
                    ) : item.media_type === 'video' ? (
                      <video
                        src={item.file}
                        className="feed-post-media-video"
                        controls
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      <footer className="feed-post-footer">
        <div className="feed-post-actions">
          <button
            type="button"
            className={
              post.liked
                ? 'feed-post-action-button feed-post-action-button-liked'
                : 'feed-post-action-button'
            }
            onClick={handleToggleLikeClick}
            disabled={isLiking}
          >
            <span className="feed-post-action-label">
              {post.liked ? 'Лайкнуто' : 'Лайк'}
            </span>
            <span className="feed-post-action-count">{likesCount}</span>
          </button>

          <button
            type="button"
            className="feed-post-action-button"
            onClick={handleToggleComments}
          >
            <span className="feed-post-action-label">Комментарии</span>
            <span className="feed-post-action-count">{commentsCount}</span>
          </button>
        </div>

        {isCommentsVisible ? (
          <div className="feed-post-comments">
            <CommentsSection
              postId={post.id}
              currentMember={currentMember}
              onCommentsCountChange={onCommentsCountChange}
            />
          </div>
        ) : null}
      </footer>
    </article>
  );
}

function CommentsSection({ postId, currentMember, onCommentsCountChange }) {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');

  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const [replyToId, setReplyToId] = useState(null);
  const [replyText, setReplyText] = useState('');

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  const [processingCommentId, setProcessingCommentId] = useState(null);
  const [likingCommentId, setLikingCommentId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadComments = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await getPostComments(postId);
        const data = response.data || {};
        const results = Array.isArray(data.results) ? data.results : [];

        const normalized = results.map((comment) => ({
          ...comment,
          liked:
            typeof comment.liked === 'boolean'
              ? comment.liked
              : false,
        }));

        if (isMounted) {
          setComments(normalized);
          setIsLoaded(true);
        }
      } catch (err) {
        if (isMounted) {
          setError('Не удалось загрузить комментарии.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  const handleSubmitNewComment = async (event) => {
    event.preventDefault();

    const trimmedText = newCommentText.trim();

    if (!trimmedText) {
      return;
    }

    setIsSubmittingNew(true);
    setError('');

    try {
      const payload = {
        text: trimmedText,
      };

      const response = await createComment(postId, payload);
      const created = response.data;

      setComments((prev) => [...prev, created]);
      setNewCommentText('');

      if (onCommentsCountChange) {
        onCommentsCountChange(1);
      }
    } catch (err) {
      setError('Не удалось добавить комментарий. Попробуйте позже.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleReplyClick = (commentId) => {
    setReplyToId(commentId);
    setReplyText('');
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSubmitReply = async (event, parentId) => {
    event.preventDefault();

    const trimmedText = replyText.trim();

    if (!trimmedText || !parentId) {
      return;
    }

    setProcessingCommentId(parentId);
    setError('');

    try {
      const payload = {
        text: trimmedText,
        parent: parentId,
      };

      const response = await createComment(postId, payload);
      const created = response.data;

      setComments((prev) => [...prev, created]);
      setReplyToId(null);
      setReplyText('');

      if (onCommentsCountChange) {
        onCommentsCountChange(1);
      }
    } catch (err) {
      setError('Не удалось добавить ответ. Попробуйте позже.');
    } finally {
      setProcessingCommentId(null);
    }
  };

  const handleStartEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text || '');
    setReplyToId(null);
    setReplyText('');
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSubmitEditComment = async (commentId) => {
    const trimmedText = editingCommentText.trim();

    if (!trimmedText || !commentId) {
      return;
    }

    setProcessingCommentId(commentId);
    setError('');

    try {
      const payload = {
        text: trimmedText,
      };

      const response = await updateComment(commentId, payload);
      const updated = response.data;

      setComments((prev) =>
        prev.map((comment) => (comment.id === commentId ? updated : comment)),
      );

      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (err) {
      setError('Не удалось изменить комментарий. Попробуйте позже.');
    } finally {
      setProcessingCommentId(null);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const confirmed = window.confirm(
      'Вы уверены, что хотите удалить комментарий?',
    );

    if (!confirmed) {
      return;
    }

    setProcessingCommentId(commentId);
    setError('');

    try {
      await deleteComment(commentId);

      setComments((prev) => prev.filter((comment) => comment.id !== commentId));

      if (onCommentsCountChange) {
        onCommentsCountChange(-1);
      }
    } catch (err) {
      setError('Не удалось удалить комментарий. Попробуйте позже.');
    } finally {
      setProcessingCommentId(null);
    }
  };

  const handleToggleCommentLike = async (commentId) => {
    setLikingCommentId(commentId);

    try {
      const response = await toggleCommentLike(commentId);
      const data = response.data || {};

      setComments((prev) =>
        prev.map((comment) => {
          if (comment.id !== commentId) {
            return comment;
          }

          const nextLikesCount =
            typeof data.likes_count === 'number'
              ? data.likes_count
              : comment.likes_count;

          const nextLiked =
            typeof data.liked === 'boolean' ? data.liked : comment.liked;

          return {
            ...comment,
            likes_count: nextLikesCount,
            liked: nextLiked,
          };
        }),
      );
    } catch (err) {
      setError('Не удалось поставить лайк комментария.');
    } finally {
      setLikingCommentId(null);
    }
  };

  const renderComment = (comment, isReply) => {
    const isAuthor = Boolean(
      currentMember &&
        comment &&
        comment.author &&
        typeof currentMember.id === 'number' &&
        currentMember.id === comment.author.id,
    );

    const isEditingThis = editingCommentId === comment.id;
    const isReplyingToThis = replyToId === comment.id;
    const replies = comments.filter((item) => item.parent === comment.id);
    const likesCount =
      typeof comment.likes_count === 'number' ? comment.likes_count : 0;

    return (
      <div
        key={comment.id}
        className={
          isReply ? 'comment-item comment-item-reply' : 'comment-item'
        }
      >
        <div className="comment-avatar-placeholder" />
        <div className="comment-content">
          <div className="comment-header">
            <span className="comment-author">
              {getMemberDisplayName(comment.author)}
            </span>
            <span className="comment-date">
              {formatDateTime(comment.created_at)}
            </span>
          </div>

          {isEditingThis ? (
            <textarea
              className="comment-textarea"
              rows={2}
              value={editingCommentText}
              onChange={(event) =>
                setEditingCommentText(event.target.value)
              }
            />
          ) : (
            <div className="comment-text">{comment.text}</div>
          )}

          <div className="comment-actions-row">
            <button
              type="button"
              className={
                comment.liked
                  ? 'comment-like-button comment-like-button-active'
                  : 'comment-like-button'
              }
              onClick={() => handleToggleCommentLike(comment.id)}
              disabled={likingCommentId === comment.id}
            >
              <span className="comment-like-label">
                {comment.liked ? 'Лайкнуто' : 'Лайк'}
              </span>
              <span className="comment-like-count">{likesCount}</span>
            </button>

            <button
              type="button"
              className="comment-action-link"
              onClick={() => handleReplyClick(comment.id)}
            >
              Ответить
            </button>

            {isAuthor && !isEditingThis ? (
              <button
                type="button"
                className="comment-action-link"
                onClick={() => handleStartEditComment(comment)}
              >
                Редактировать
              </button>
            ) : null}

            {isAuthor && !isEditingThis ? (
              <button
                type="button"
                className="comment-action-link comment-action-link-danger"
                onClick={() => handleDeleteComment(comment.id)}
                disabled={processingCommentId === comment.id}
              >
                {processingCommentId === comment.id
                  ? 'Удаление...'
                  : 'Удалить'}
              </button>
            ) : null}

            {isAuthor && isEditingThis ? (
              <>
                <button
                  type="button"
                  className="comment-action-link"
                  onClick={() => handleSubmitEditComment(comment.id)}
                  disabled={
                    processingCommentId === comment.id ||
                    !editingCommentText.trim()
                  }
                >
                  {processingCommentId === comment.id
                    ? 'Сохранение...'
                    : 'Сохранить'}
                </button>
                <button
                  type="button"
                  className="comment-action-link comment-action-link-muted"
                  onClick={handleCancelEditComment}
                  disabled={processingCommentId === comment.id}
                >
                  Отмена
                </button>
              </>
            ) : null}
          </div>

          {isReplyingToThis ? (
            <form
              className="comment-reply-form"
              onSubmit={(event) => handleSubmitReply(event, comment.id)}
            >
              <textarea
                className="comment-textarea comment-reply-textarea"
                rows={2}
                placeholder="Ваш ответ"
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
              />
              <div className="comment-reply-actions">
                <button
                  type="submit"
                  className="comment-reply-submit"
                  disabled={
                    processingCommentId === comment.id || !replyText.trim()
                  }
                >
                  {processingCommentId === comment.id
                    ? 'Отправка...'
                    : 'Ответить'}
                </button>
                <button
                  type="button"
                  className="comment-reply-cancel"
                  onClick={() => {
                    setReplyToId(null);
                    setReplyText('');
                  }}
                  disabled={processingCommentId === comment.id}
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : null}

          {replies.length > 0 ? (
            <div className="comment-replies">
              {replies.map((reply) => renderComment(reply, true))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const rootComments = comments.filter((comment) => !comment.parent);

  return (
    <div
      data-easytag="id5-react/src/components/Home/HomeFeedPage.jsx"
      className="comments-section"
    >
      {isLoading && !isLoaded ? (
        <div className="comments-loading">Загрузка комментариев...</div>
      ) : null}

      {error ? <div className="comments-error">{error}</div> : null}

      {!isLoading && rootComments.length === 0 ? (
        <div className="comments-empty">
          Пока нет комментариев. Будьте первым!
        </div>
      ) : null}

      <div className="comments-list">
        {rootComments.map((comment) => renderComment(comment, false))}
      </div>

      <form className="comments-new-form" onSubmit={handleSubmitNewComment}>
        <textarea
          className="comment-textarea comments-new-textarea"
          rows={2}
          placeholder="Добавить комментарий"
          value={newCommentText}
          onChange={(event) => setNewCommentText(event.target.value)}
        />
        <div className="comments-new-actions">
          <button
            type="submit"
            className="comments-new-submit"
            disabled={isSubmittingNew || !newCommentText.trim()}
          >
            {isSubmittingNew ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default HomeFeedPage;

export { PostCard, getMemberDisplayName, formatDateTime };