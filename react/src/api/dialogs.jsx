import instance from './axios';

export function getDialogs() {
  return instance.get('/api/dialogs/');
}

export function getDialogWithMember(memberId) {
  return instance.post(`/api/dialogs/with/${memberId}/`);
}

export function getDialogMessages(dialogId, params) {
  return instance.get(`/api/dialogs/${dialogId}/messages/`, {
    params,
  });
}

export function sendMessage(dialogId, data) {
  return instance.post(`/api/dialogs/${dialogId}/messages/`, data);
}

export function markMessageRead(messageId) {
  return instance.post(`/api/messages/${messageId}/read/`);
}

export function markDialogRead(dialogId) {
  return instance.post(`/api/dialogs/${dialogId}/read/`);
}
