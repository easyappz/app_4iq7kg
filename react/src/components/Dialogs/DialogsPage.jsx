import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getDialogs,
  getDialogMessages,
  sendMessage,
  markDialogRead,
} from '../../api/dialogs';
import { getMemberDisplayName } from '../Home/HomeFeedPage';

function formatMessageTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DialogsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentMember } = useAuth();

  const [dialogs, setDialogs] = useState([]);
  const [isDialogsLoading, setIsDialogsLoading] = useState(false);
  const [dialogsError, setDialogsError] = useState('');

  const [selectedDialogId, setSelectedDialogId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');

  const [newMessageText, setNewMessageText] = useState('');
  const [newMessageImage, setNewMessageImage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [showDialogsListOnMobile, setShowDialogsListOnMobile] = useState(true);

  const messagesScrollRef = useRef(null);

  const handleUnauthorized = useCallback(
    (error) => {
      if (error && error.response && error.response.status === 401) {
        navigate('/login', { replace: true });
        return true;
      }

      return false;
    },
    [navigate],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      const nextIsMobile = window.innerWidth <= 768;
      setIsMobile(nextIsMobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const loadDialogs = useCallback(async () => {
    setIsDialogsLoading(true);
    setDialogsError('');

    try {
      const response = await getDialogs();
      const data = Array.isArray(response.data) ? response.data : [];
      setDialogs(data);
    } catch (error) {
      const redirected = handleUnauthorized(error);

      if (!redirected) {
        setDialogsError('Не удалось загрузить диалоги. Попробуйте позже.');
      }
    } finally {
      setIsDialogsLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    loadDialogs();
  }, [loadDialogs]);

  useEffect(() => {
    let targetDialogId = null;

    if (location.state && typeof location.state === 'object') {
      const possibleId = location.state.dialogId;

      if (possibleId) {
        const parsed = Number(possibleId);

        if (!Number.isNaN(parsed)) {
          targetDialogId = parsed;
        }
      }
    }

    if (!targetDialogId && location.search) {
      const params = new URLSearchParams(location.search);
      const queryId = params.get('dialog');

      if (queryId) {
        const parsed = Number(queryId);

        if (!Number.isNaN(parsed)) {
          targetDialogId = parsed;
        }
      }
    }

    if (targetDialogId && !Number.isNaN(targetDialogId)) {
      setSelectedDialogId(targetDialogId);
      setShowDialogsListOnMobile(false);
    }
  }, [location]);

  const selectedDialog = useMemo(() => {
    if (!selectedDialogId) {
      return null;
    }

    return dialogs.find((dialog) => dialog.id === selectedDialogId) || null;
  }, [dialogs, selectedDialogId]);

  const loadMessages = useCallback(
    async (dialogId, options) => {
      if (!dialogId) {
        return;
      }

      const isSilent = Boolean(options && options.silent);

      if (!isSilent) {
        setIsMessagesLoading(true);
        setMessagesError('');
      }

      try {
        const params = {
          page: 1,
          page_size: 50,
        };

        const response = await getDialogMessages(dialogId, params);
        const data = response.data || {};
        const results = Array.isArray(data.results) ? data.results : [];

        setMessages(results);

        try {
          await markDialogRead(dialogId);
        } catch (markError) {
          handleUnauthorized(markError);
        }
      } catch (error) {
        const redirected = handleUnauthorized(error);

        if (!redirected && !isSilent) {
          setMessagesError('Не удалось загрузить сообщения. Попробуйте позже.');
        }
      } finally {
        if (!isSilent) {
          setIsMessagesLoading(false);
        }
      }
    },
    [handleUnauthorized],
  );

  useEffect(() => {
    if (!selectedDialogId) {
      setMessages([]);
      setMessagesError('');
      setIsMessagesLoading(false);
      return;
    }

    loadMessages(selectedDialogId, { silent: false });
  }, [selectedDialogId, loadMessages]);

  useEffect(() => {
    if (!selectedDialogId) {
      return undefined;
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadMessages(selectedDialogId, { silent: true });
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedDialogId, loadMessages]);

  useEffect(() => {
    if (!messagesScrollRef.current) {
      return;
    }

    const element = messagesScrollRef.current;
    element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  const handleSelectDialog = (dialogId) => {
    setSelectedDialogId(dialogId);

    if (isMobile) {
      setShowDialogsListOnMobile(false);
    }
  };

  const handleBackToList = () => {
    setShowDialogsListOnMobile(true);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (!selectedDialogId) {
      return;
    }

    const trimmedText = newMessageText.trim();
    const trimmedImage = newMessageImage.trim();

    if (!trimmedText && !trimmedImage) {
      return;
    }

    setIsSending(true);
    setMessagesError('');

    try {
      const payload = {};

      if (trimmedText) {
        payload.text = trimmedText;
      }

      if (trimmedImage) {
        payload.image = trimmedImage;
      }

      const response = await sendMessage(selectedDialogId, payload);
      const created = response.data;

      if (created) {
        setMessages((prev) => [...prev, created]);
      }

      setNewMessageText('');
      setNewMessageImage('');
    } catch (error) {
      const redirected = handleUnauthorized(error);

      if (!redirected) {
        setMessagesError('Не удалось отправить сообщение. Попробуйте позже.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const renderDialogList = () => {
    if (isDialogsLoading && dialogs.length === 0) {
      return (
        <div className="dialogs-list-loading">Загрузка диалогов...</div>
      );
    }

    if (dialogsError) {
      return <div className="dialogs-list-error">{dialogsError}</div>;
    }

    if (!isDialogsLoading && dialogs.length === 0) {
      return (
        <div className="dialogs-list-empty">
          У вас пока нет диалогов. Найдите пользователя и нажмите «Написать
          сообщение» в его профиле.
        </div>
      );
    }

    return (
      <div className="dialogs-list">
        {dialogs.map((dialog) => {
          const otherMember = dialog.other_member || dialog.member1 || dialog.member2;
          const name = getMemberDisplayName(otherMember) || 'Пользователь';
          const lastMessage = dialog.last_message;
          const unreadCount =
            typeof dialog.unread_count === 'number' ? dialog.unread_count : 0;
          const isActive = dialog.id === selectedDialogId;

          let lastMessageText = '';

          if (lastMessage) {
            if (lastMessage.text) {
              lastMessageText = lastMessage.text;
            } else if (lastMessage.image) {
              lastMessageText = 'Изображение';
            }
          }

          const timeLabel = lastMessage
            ? formatMessageTime(lastMessage.created_at)
            : '';

          return (
            <button
              key={dialog.id}
              type="button"
              className={
                isActive
                  ? 'dialogs-list-item dialogs-list-item-active'
                  : 'dialogs-list-item'
              }
              onClick={() => handleSelectDialog(dialog.id)}
            >
              <div className="dialogs-list-avatar-placeholder" />

              <div className="dialogs-list-main">
                <div className="dialogs-list-header-row">
                  <div className="dialogs-list-name" title={name}>
                    {name}
                  </div>
                  {timeLabel ? (
                    <div className="dialogs-list-time">{timeLabel}</div>
                  ) : null}
                </div>

                <div className="dialogs-list-bottom-row">
                  <div className="dialogs-list-last-message" title={lastMessageText}>
                    {lastMessageText || 'Нет сообщений'}
                  </div>

                  {unreadCount > 0 ? (
                    <div className="dialogs-list-unread-badge">{unreadCount}</div>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderMessages = () => {
    if (!selectedDialog) {
      return (
        <div className="dialogs-messages-placeholder">
          Выберите диалог слева, чтобы начать общение.
        </div>
      );
    }

    if (isMessagesLoading && messages.length === 0) {
      return (
        <div className="dialogs-messages-placeholder">
          Загрузка сообщений...
        </div>
      );
    }

    return (
      <>
        {messagesError ? (
          <div className="dialogs-messages-error">{messagesError}</div>
        ) : null}

        {!isMessagesLoading && messages.length === 0 && !messagesError ? (
          <div className="dialogs-messages-placeholder">
            Сообщений пока нет. Напишите что-нибудь первым!
          </div>
        ) : null}

        {messages.map((message) => {
          const isOwnMessage = Boolean(
            currentMember &&
              message &&
              message.sender &&
              typeof currentMember.id === 'number' &&
              currentMember.id === message.sender.id,
          );

          const bubbleClassName = isOwnMessage
            ? 'dialogs-message-bubble dialogs-message-bubble-own'
            : 'dialogs-message-bubble';

          const rowClassName = isOwnMessage
            ? 'dialogs-message-row dialogs-message-row-own'
            : 'dialogs-message-row';

          const timeLabel = formatMessageTime(message.created_at);

          return (
            <div key={message.id} className={rowClassName}>
              <div className={bubbleClassName}>
                {message.text ? (
                  <div className="dialogs-message-text">{message.text}</div>
                ) : null}

                {message.image ? (
                  <div className="dialogs-message-image-placeholder">
                    Изображение сообщения
                  </div>
                ) : null}

                <div className="dialogs-message-meta">
                  <span className="dialogs-message-time">{timeLabel}</span>
                  {isOwnMessage ? (
                    <span
                      className={
                        message.is_read
                          ? 'dialogs-message-status dialogs-message-status-read'
                          : 'dialogs-message-status dialogs-message-status-unread'
                      }
                    >
                      {message.is_read ? 'Прочитано' : 'Не прочитано'}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
  };

  const otherMember = selectedDialog
    ? selectedDialog.other_member || selectedDialog.member1 || selectedDialog.member2
    : null;

  const dialogTitle = selectedDialog
    ? getMemberDisplayName(otherMember) || 'Диалог'
    : 'Диалоги';

  const canSend = Boolean(
    selectedDialogId && (newMessageText.trim() || newMessageImage.trim()),
  );

  const shouldShowSidebar = !isMobile || showDialogsListOnMobile;
  const shouldShowMain = !isMobile || !showDialogsListOnMobile;

  return (
    <div
      data-easytag="id9-react/src/components/Dialogs/DialogsPage.jsx"
      className="page page-dialogs"
    >
      <div className="dialogs-layout">
        {shouldShowSidebar ? (
          <section className="dialogs-sidebar">
            <div className="dialogs-sidebar-header">
              <div className="dialogs-sidebar-header-text">
                <h1 className="dialogs-sidebar-title">Диалоги</h1>
                <div className="dialogs-sidebar-subtitle">
                  Ваши личные переписки с пользователями
                </div>
              </div>
              <button
                type="button"
                className="dialogs-refresh-button"
                onClick={loadDialogs}
                disabled={isDialogsLoading}
              >
                {isDialogsLoading ? '...' : 'Обновить'}
              </button>
            </div>

            {renderDialogList()}
          </section>
        ) : null}

        {shouldShowMain ? (
          <section className="dialogs-main">
            <div className="dialogs-main-header">
              {isMobile ? (
                <button
                  type="button"
                  className="dialogs-back-button"
                  onClick={handleBackToList}
                >
                  Назад
                </button>
              ) : null}

              <div className="dialogs-main-header-text">
                <div className="dialogs-main-title">{dialogTitle}</div>
                <div className="dialogs-main-subtitle">
                  Мессенджер EasySocial
                </div>
              </div>
            </div>

            <div className="dialogs-messages-container">
              <div
                ref={messagesScrollRef}
                className="dialogs-messages-scroll"
              >
                {renderMessages()}
              </div>

              <form
                className="dialogs-send-form"
                onSubmit={handleSendMessage}
              >
                <textarea
                  className="dialogs-send-textarea"
                  rows={2}
                  placeholder="Введите сообщение"
                  value={newMessageText}
                  onChange={(event) => setNewMessageText(event.target.value)}
                />

                <input
                  className="dialogs-send-input-image"
                  type="text"
                  placeholder="Ссылка на изображение (опционально)"
                  value={newMessageImage}
                  onChange={(event) => setNewMessageImage(event.target.value)}
                />

                <div className="dialogs-send-actions">
                  <button
                    type="submit"
                    className="dialogs-send-button"
                    disabled={!canSend || isSending}
                  >
                    {isSending ? 'Отправка...' : 'Отправить'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default DialogsPage;
