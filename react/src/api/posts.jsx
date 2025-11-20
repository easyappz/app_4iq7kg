import instance from './axios';

/**
 * Post media item as returned by the backend.
 *
 * @typedef {Object} PostMediaItem
 * @property {number} id
 * @property {string} file - Absolute or relative URL to the uploaded media file.
 * @property {('image'|'video')} media_type - Type of the media.
 * @property {string} created_at - ISO datetime string.
 */

/**
 * Post object as returned by the backend.
 * Note: `media` is an array of attached image/video files if present.
 *
 * @typedef {Object} Post
 * @property {number} id
 * @property {Object} author
 * @property {string} text
 * @property {string} [image]
 * @property {PostMediaItem[]} [media]
 * @property {string} created_at
 * @property {string} updated_at
 * @property {number} likes_count
 * @property {number} comments_count
 */

/**
 * Build FormData payload for creating/updating posts with media attachments.
 *
 * Media files are appended under the "media" key so that the backend
 * can create PostMedia objects and later return them in the `media` array
 * of the Post response.
 */
function buildPostFormData(postData, files) {
  const formData = new FormData();

  if (postData) {
    Object.keys(postData).forEach((key) => {
      const value = postData[key];
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
  }

  if (files && files.length > 0) {
    files.forEach((file) => {
      if (file) {
        formData.append('media', file);
      }
    });
  }

  return formData;
}

export function getFeed(params) {
  return instance.get('/api/posts/', {
    params,
  });
}

/**
 * Create a new post.
 *
 * If `files` is provided and non-empty, the request is sent as multipart/form-data
 * with all post fields and each File appended under the "media" key.
 * Otherwise, a JSON body is sent as before.
 *
 * The response contains the full Post object including the `media` array
 * with attached image/video items (if any).
 *
 * @param {Object} postData - Plain post fields, e.g. { text, image }.
 * @param {File[]} [files] - Optional array of File objects (images/videos).
 * @returns {Promise<import('axios').AxiosResponse<Post>>}
 */
export function createPost(postData, files) {
  const hasFiles = Array.isArray(files) && files.length > 0;

  if (hasFiles) {
    const formData = buildPostFormData(postData, files);
    return instance.post('/api/posts/', formData);
  }

  return instance.post('/api/posts/', postData);
}

/**
 * Update an existing post (partial update).
 *
 * If `files` is provided and non-empty, the request is sent as multipart/form-data
 * with post fields and additional media files under the "media" key.
 * Otherwise, a JSON body is sent as before.
 *
 * The response contains the updated Post object including the `media` array.
 *
 * @param {number} id - Post identifier.
 * @param {Object} postData - Fields to update, e.g. { text, image }.
 * @param {File[]} [files] - Optional array of File objects (images/videos) to attach.
 * @returns {Promise<import('axios').AxiosResponse<Post>>}
 */
export function updatePost(id, postData, files) {
  const hasFiles = Array.isArray(files) && files.length > 0;

  if (hasFiles) {
    const formData = buildPostFormData(postData, files);
    return instance.patch(`/api/posts/${id}/`, formData);
  }

  return instance.patch(`/api/posts/${id}/`, postData);
}

export function deletePost(id) {
  return instance.delete(`/api/posts/${id}/`);
}

export function togglePostLike(id) {
  return instance.post(`/api/posts/${id}/like/`);
}

/**
 * Get posts authored by a specific member.
 * The returned posts include the `media` array with attachments when present.
 */
export function getUserPosts(memberId, params) {
  return instance.get(`/api/members/${memberId}/posts/`, {
    params,
  });
}
