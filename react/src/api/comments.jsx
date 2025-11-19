import instance from './axios';

export function getPostComments(postId) {
  return instance.get(`/api/posts/${postId}/comments/`);
}

export function createComment(postId, data) {
  return instance.post(`/api/posts/${postId}/comments/`, data);
}

export function updateComment(id, data) {
  return instance.patch(`/api/comments/${id}/`, data);
}

export function deleteComment(id) {
  return instance.delete(`/api/comments/${id}/`);
}

export function toggleCommentLike(id) {
  return instance.post(`/api/comments/${id}/like/`);
}
