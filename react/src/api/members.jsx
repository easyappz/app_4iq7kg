import instance from './axios';

export function getMember(id) {
  return instance.get(`/api/members/${id}/`);
}

export function updateCurrentMember(data) {
  return instance.patch('/api/members/me/', data);
}

export function searchMembers(query) {
  return instance.get('/api/members/search/', {
    params: {
      q: query,
    },
  });
}

export function followMember(id) {
  return instance.post(`/api/members/${id}/follow/`);
}

export function unfollowMember(id) {
  return instance.post(`/api/members/${id}/unfollow/`);
}

export function getMemberFollowers(id) {
  return instance.get(`/api/members/${id}/followers/`);
}

export function getMemberFollowing(id) {
  return instance.get(`/api/members/${id}/following/`);
}
