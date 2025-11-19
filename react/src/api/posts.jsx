import instance from './axios';

export function getFeed(params) {
  return instance.get('/api/posts/', {
    params,
  });
}

export function createPost(data) {
  return instance.post('/api/posts/', data);
}

export function updatePost(id, data) {
  return instance.patch(`/api/posts/${id}/`, data);
}

export function deletePost(id) {
  return instance.delete(`/api/posts/${id}/`);
}

export function togglePostLike(id) {
  return instance.post(`/api/posts/${id}/like/`);
}

export function getUserPosts(memberId, params) {
  return instance.get(`/api/members/${memberId}/posts/`, {
    params,
  });
}
