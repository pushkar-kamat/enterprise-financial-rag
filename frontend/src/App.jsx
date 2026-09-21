import { useEffect, useMemo, useRef, useState } from "react";
import AuthScreen from "./auth/AuthScreen";
import {
  getAccessToken,
  getCurrentUser,
  signOut,
  getCurrentUserEmail,
} from "./auth/cognito";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NorthstarLoader from "./components/NorthstarLoader";
import NorthstarMark from "./components/NorthstarMark";

import {
  Archive,
  ChevronDown,
  FileText,
  Menu,
  MessageSquare,
  Mic,
  MoreHorizontal,
  PanelLeftClose,
  Pin,
  Plus,
  ArrowUp,
  ArrowLeft,
  RefreshCw,
  Settings,
  Shield,
  Users,
  Trash2,
  LogOut,
  X,
} from "lucide-react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const QUICK_QUESTIONS = [
  "What is the credit risk policy?",
  "What are the KYC requirements?",
  "What is the AML escalation process?",
  "What are the loan approval requirements?",
];

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const user = getCurrentUser();
    return user || null;
  });
  const [currentUserEmail, setCurrentUserEmail] = useState(
    () => localStorage.getItem("northstar_user_email") || "",
  );

  useEffect(() => {
    if (!currentUser) {
      setCurrentUserEmail("");
      return;
    }

    getCurrentUserEmail()
      .then((email) => {
        if (email) {
          setCurrentUserEmail(email);
          localStorage.setItem("northstar_user_email", email);
        }
      })
      .catch((error) => {
        console.error("Failed to load current user email:", error);
      });
  }, [currentUser]);

  const [conversations, setConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);

  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuChatId, setMenuChatId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSection, setAdminSection] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminUpdatingUserId, setAdminUpdatingUserId] = useState(null);
  const [roleChangeConfirmation, setRoleChangeConfirmation] = useState(null);
  const [adminDocuments, setAdminDocuments] = useState([]);
  const [adminDocumentsLoading, setAdminDocumentsLoading] = useState(false);
  const [adminDocumentsError, setAdminDocumentsError] = useState("");
  const [adminDeletingDocumentId, setAdminDeletingDocumentId] = useState(null);
  const [deleteDocumentId, setDeleteDocumentId] = useState(null);
  const [adminUploadFile, setAdminUploadFile] = useState(null);
  const [adminUploading, setAdminUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("northstar_appearance") || "system",
  );

  const recognitionRef = useRef(null);

  const speechBaseTextRef = useRef("");

  const loadCurrentUserRole = async () => {
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setIsAdmin(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/auth/test`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        setIsAdmin(false);
        return;
      }

      const data = await response.json();
      setIsAdmin(data.role === "admin");
    } catch {
      setIsAdmin(false);
    }
  };

  const loadConversations = async () => {
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch(`${API_URL}/api/conversations`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load conversations.");
      }

      const chats = (data.conversations || []).map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        pinned: conversation.is_pinned,
        messages: [],
      }));

      console.log("Northstar conversations loaded:", chats);

      setConversations(chats);

      if (chats.length > 0) {
        setActiveChatId(chats[0].id);
      } else {
        setActiveChatId(null);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load conversations.",
      );
    }
  };

  const loadConversationMessages = async (conversationId) => {
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Authentication required.");
      }

      const response = await fetch(
        `${API_URL}/api/conversations/${conversationId}/messages`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load conversation messages.");
      }

      const messages = (data.messages || []).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.created_at,
      }));

      setConversations((prev) =>
        prev.map((chat) =>
          chat.id === conversationId
            ? {
                ...chat,
                messages,
              }
            : chat,
        ),
      );

      return messages;
    } catch (error) {
      console.error("Failed to load conversation messages:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load conversation messages.",
      );

      return [];
    }
  };

  const loadArchivedConversations = async () => {
    setArchivedLoading(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Authentication required.");
      }

      const response = await fetch(`${API_URL}/api/conversations/archived`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load archived conversations.",
        );
      }

      const chats = (data.conversations || []).map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        pinned: conversation.is_pinned,
        archived: true,
        messages: [],
      }));

      setArchivedConversations(chats);
    } catch (error) {
      console.error("Failed to load archived conversations:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load archived conversations.",
      );
    } finally {
      setArchivedLoading(false);
    }
  };

  const archiveConversation = async (conversationId) => {
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Authentication required.");
      }

      const response = await fetch(
        `${API_URL}/api/conversations/${conversationId}/archive`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to archive conversation.");
      }

      setConversations((prev) =>
        prev.filter((chat) => chat.id !== conversationId),
      );

      setActiveChatId((currentId) =>
        currentId === conversationId ? null : currentId,
      );

      setMenuChatId(null);

      await loadArchivedConversations();
    } catch (error) {
      console.error("Failed to archive conversation:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to archive conversation.",
      );
    }
  };

  const unarchiveConversation = async (conversationId) => {
    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Authentication required.");
      }

      const response = await fetch(
        `${API_URL}/api/conversations/${conversationId}/unarchive`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to unarchive conversation.");
      }

      setArchivedConversations((prev) =>
        prev.filter((chat) => chat.id !== conversationId),
      );

      await loadConversations();
    } catch (error) {
      console.error("Failed to unarchive conversation:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to unarchive conversation.",
      );
    }
  };

  const loadAdminUsers = async () => {
    setAdminUsersLoading(true);
    setAdminUsersError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Authentication required.");
      }

      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load users.");
      }

      setAdminUsers(data.users || []);
    } catch (error) {
      setAdminUsersError(error.message || "Failed to load users.");
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const handleUserRoleChange = (user, newRole) => {
    setRoleChangeConfirmation({
      user,
      newRole,
    });
  };

  const confirmUserRoleChange = async () => {
    if (!roleChangeConfirmation) {
      return;
    }

    const { user, newRole } = roleChangeConfirmation;

    setAdminUpdatingUserId(user.id);
    setAdminUsersError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Authentication required.");
      }

      const response = await fetch(
        `${API_URL}/api/admin/users/${user.id}/role`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: newRole,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update user role.");
      }

      setRoleChangeConfirmation(null);
      await loadAdminUsers();
    } catch (error) {
      setRoleChangeConfirmation(null);

      setAdminUsersError(error.message || "Failed to update user role.");
    } finally {
      setAdminUpdatingUserId(null);
    }
  };

  useEffect(() => {
    if (adminSection === "users" && isAdmin) {
      loadAdminUsers();
    }
  }, [adminSection, isAdmin]);

  useEffect(() => {
    localStorage.setItem("northstar_appearance", appearance);

    if (appearance === "system") {
      document.documentElement.removeAttribute("data-theme");
      return;
    }

    document.documentElement.setAttribute("data-theme", appearance);
  }, [appearance]);

  useEffect(() => {
    if (currentUser) {
      loadCurrentUserRole();
      loadConversations();
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const activeChat = conversations.find((chat) => chat.id === activeChatId);

  const groupedChats = useMemo(() => {
    const pinned = conversations.filter((chat) => chat.pinned);

    const unpinned = conversations
      .filter((chat) => !chat.pinned)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return { pinned, unpinned };
  }, [conversations]);

  const loadAdminDocuments = async () => {
    setAdminDocumentsLoading(true);
    setAdminDocumentsError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Authentication session expired.");
      }

      const response = await fetch(`${API_URL}/api/admin/documents`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        let message = "Failed to load documents.";

        try {
          const data = await response.json();
          if (data?.detail) {
            message = data.detail;
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      const data = await response.json();
      setAdminDocuments(data.documents || []);
    } catch (error) {
      setAdminDocumentsError(
        error instanceof Error ? error.message : "Failed to load documents.",
      );
    } finally {
      setAdminDocumentsLoading(false);
    }
  };

  const deleteAdminDocument = (documentId) => {
    setDeleteDocumentId(documentId);
  };

  const confirmDeleteAdminDocument = async () => {
    if (!deleteDocumentId) {
      return;
    }

    const documentId = deleteDocumentId;

    setDeleteDocumentId(null);
    setAdminDeletingDocumentId(documentId);
    setAdminDocumentsError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Authentication session expired.");
      }

      const response = await fetch(
        `${API_URL}/api/admin/documents/${documentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        let message = "Failed to delete document.";

        try {
          const data = await response.json();

          if (data?.detail) {
            message = data.detail;
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      setAdminDocuments((documents) =>
        documents.filter((document) => document.id !== documentId),
      );
    } catch (error) {
      setAdminDocumentsError(
        error instanceof Error ? error.message : "Failed to delete document.",
      );
    } finally {
      setAdminDeletingDocumentId(null);
    }
  };

  const uploadAdminDocument = async () => {
    if (!adminUploadFile) {
      setAdminDocumentsError("Please select a document first.");
      return;
    }

    setAdminUploading(true);
    setAdminDocumentsError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error("Authentication session expired.");
      }

      const formData = new FormData();
      formData.append("file", adminUploadFile);

      const response = await fetch(`${API_URL}/api/admin/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let message = "Failed to upload document.";

        try {
          const data = await response.json();
          if (data?.detail) {
            message = data.detail;
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(message);
      }

      setAdminUploadFile(null);
      await loadAdminDocuments();
    } catch (error) {
      setAdminDocumentsError(
        error instanceof Error ? error.message : "Failed to upload document.",
      );
    } finally {
      setAdminUploading(false);
    }
  };

  if (!currentUser) {
    return (
      <AuthScreen
        onAuthenticated={() => {
          const user = getCurrentUser();
          setCurrentUser(user);
        }}
      />
    );
  }

  const createChat = () => {
    const chat = {
      id: crypto.randomUUID(),
      title: "New Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      messages: [],
    };

    setConversations((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    setInput("");
  };

  const deleteChat = (chatId) => {
    setConversations((prev) => prev.filter((chat) => chat.id !== chatId));

    if (activeChatId === chatId) {
      setActiveChatId(null);
    }

    setMenuChatId(null);
  };

  const togglePin = (chatId) => {
    setConversations((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat,
      ),
    );

    setMenuChatId(null);
  };

  const renameChat = (chatId) => {
    const chat = conversations.find((item) => item.id === chatId);

    if (!chat) return;

    const newTitle = window.prompt("Rename conversation", chat.title);

    if (!newTitle?.trim()) return;

    setConversations((prev) =>
      prev.map((item) =>
        item.id === chatId
          ? {
              ...item,
              title: newTitle.trim(),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );

    setMenuChatId(null);
  };

  const handleSignOut = () => {
    setSignOutConfirmOpen(true);
  };

  const confirmSignOut = async () => {
    setSignOutConfirmOpen(false);

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setIsListening(false);
    setSettingsOpen(false);
    setAppearanceOpen(false);
    setAdminOpen(false);
    setAdminSection(null);
    setIsAdmin(false);

    await signOut();
    setCurrentUser(null);
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        "Voice input is not supported by this browser. Try Chrome or Edge.",
      );
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    setErrorMessage("");

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    speechBaseTextRef.current = input.trim();

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }

      const baseText = speechBaseTextRef.current;

      setInput(
        baseText ? `${baseText} ${transcript}`.trim() : transcript.trim(),
      );
    };

    recognition.onerror = (event) => {
      setIsListening(false);

      if (event.error === "not-allowed") {
        setErrorMessage(
          "Microphone permission was denied. Allow microphone access and try again.",
        );
      } else if (event.error === "no-speech") {
        setErrorMessage("No speech was detected. Please try again.");
      } else {
        setErrorMessage("Voice input could not be started. Please try again.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const sendMessage = async (question = input) => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading) return;

    setErrorMessage("");

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setErrorMessage("Your session has expired. Please sign in again.");
      return;
    }

    let chatId = activeChatId;

    const existingChat = conversations.find((chat) => chat.id === chatId);

    const existingConversationId =
      existingChat && Number.isInteger(existingChat.id)
        ? existingChat.id
        : null;

    if (!chatId) {
      const newChat = {
        id: crypto.randomUUID(),
        title:
          trimmedQuestion.length > 42
            ? `${trimmedQuestion.slice(0, 42)}...`
            : trimmedQuestion,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: false,
        messages: [],
      };

      setConversations((prev) => [newChat, ...prev]);
      setActiveChatId(newChat.id);
      chatId = newChat.id;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedQuestion,
      createdAt: new Date().toISOString(),
    };

    setConversations((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              title:
                chat.title === "New Chat"
                  ? trimmedQuestion.length > 42
                    ? `${trimmedQuestion.slice(0, 42)}...`
                    : trimmedQuestion
                  : chat.title,
              updatedAt: new Date().toISOString(),
              messages: [...chat.messages, userMessage],
            }
          : chat,
      ),
    );

    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          conversation_id: existingConversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await signOut();
          setCurrentUser(null);
          setErrorMessage("Your session has expired. Please sign in again.");
          return;
        }

        throw new Error(data.detail || "Request failed.");
      }

      const savedConversationId = data.conversation_id;

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        provider: data.provider,
        cached: data.cached,
        frequency: data.frequency,
        createdAt: new Date().toISOString(),
      };

      setConversations((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                id: savedConversationId,
                updatedAt: new Date().toISOString(),
                messages: [...chat.messages, assistantMessage],
              }
            : chat,
        ),
      );

      setActiveChatId(savedConversationId);
    } catch (error) {
      const assistantErrorMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "Unable to connect to the Northstar API.",
        error: true,
        createdAt: new Date().toISOString(),
      };

      setConversations((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, assistantErrorMessage],
              }
            : chat,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "" : "closed"}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark">
              <NorthstarMark />
            </div>

            {sidebarOpen && (
              <div>
                <div className="brand-name">Northstar</div>
                <div className="brand-subtitle">Financial AI</div>
              </div>
            )}
          </div>

          <button
            className="icon-button"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <PanelLeftClose size={20} strokeWidth={1.8} />
          </button>
        </div>

        {sidebarOpen && (
          <>
            <button className="new-chat" onClick={createChat}>
              <Plus size={18} />
              <span>New Chat</span>
            </button>

            <div className="history">
              {groupedChats.pinned.length > 0 && (
                <ChatGroup
                  title="Pinned"
                  chats={groupedChats.pinned}
                  activeChatId={activeChatId}
                  menuChatId={menuChatId}
                  setActiveChatId={setActiveChatId}
                  setMenuChatId={setMenuChatId}
                  togglePin={togglePin}
                  renameChat={renameChat}
                  deleteChat={deleteChat}
                  archiveChat={archiveConversation}
                  loadConversationMessages={loadConversationMessages}
                />
              )}

              <ChatGroup
                title="Recent"
                chats={groupedChats.unpinned}
                activeChatId={activeChatId}
                menuChatId={menuChatId}
                setActiveChatId={setActiveChatId}
                setMenuChatId={setMenuChatId}
                togglePin={togglePin}
                renameChat={renameChat}
                deleteChat={deleteChat}
                archiveChat={archiveConversation}
                loadConversationMessages={loadConversationMessages}
              />

              {conversations.length === 0 && !archivedOpen && (
                <div className="empty-history">
                  <MessageSquare size={18} />
                  <span>Your conversations will appear here.</span>
                </div>
              )}

              {archivedOpen && (
                <ChatGroup
                  title="Archived"
                  chats={archivedConversations}
                  activeChatId={activeChatId}
                  menuChatId={menuChatId}
                  setActiveChatId={setActiveChatId}
                  setMenuChatId={setMenuChatId}
                  togglePin={() => {}}
                  renameChat={renameChat}
                  deleteChat={deleteChat}
                  archiveChat={unarchiveConversation}
                  archiveLabel="Unarchive"
                  loadConversationMessages={loadConversationMessages}
                />
              )}

              {archivedOpen &&
                !archivedLoading &&
                archivedConversations.length === 0 && (
                  <div className="empty-history">
                    <Archive size={18} />
                    <span>No archived conversations.</span>
                  </div>
                )}

              {archivedOpen && archivedLoading && (
                <div className="empty-history">
                  <span>Loading archived conversations...</span>
                </div>
              )}
            </div>

            <div className="sidebar-bottom">
              <button
                className={`sidebar-item ${settingsOpen ? "active" : ""}`}
                onClick={() => {
                  setSettingsOpen((prev) => !prev);
                  setAppearanceOpen(false);
                }}
              >
                <Settings size={17} />
                Settings
              </button>

              <button
                className={`sidebar-item ${archivedOpen ? "active" : ""}`}
                onClick={() => {
                  const nextOpen = !archivedOpen;

                  setArchivedOpen(nextOpen);
                  setSettingsOpen(false);
                  setAppearanceOpen(false);

                  if (nextOpen) {
                    loadArchivedConversations();
                  }
                }}
              >
                <Archive size={17} />
                Archived
              </button>
            </div>

            {settingsOpen && (
              <div className="settings-panel">
                <div className="settings-header">
                  <div>
                    <div className="settings-title">Settings</div>
                    <div className="settings-subtitle">
                      Customize your Northstar experience
                    </div>
                  </div>

                  <button
                    className="settings-close"
                    onClick={() => {
                      setSettingsOpen(false);
                      setAppearanceOpen(false);
                    }}
                    title="Close settings"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="settings-section">
                  <div className="settings-section-title">Account</div>

                  <div className="settings-user">
                    <div className="settings-avatar">
                      {currentUserEmail?.charAt(0).toUpperCase() || "U"}
                    </div>

                    <div>
                      <div className="settings-user-name">
                        {currentUserEmail || "Signed-in user"}
                      </div>

                      <div className="settings-user-status">
                        Authenticated account
                      </div>
                    </div>
                  </div>
                </div>

                <div className="settings-section">
                  <button
                    className={`appearance-button ${
                      appearanceOpen ? "active" : ""
                    }`}
                    onClick={() => setAppearanceOpen((prev) => !prev)}
                  >
                    <div>
                      <div className="appearance-name">Appearance</div>

                      <div className="appearance-description">
                        {appearance === "system"
                          ? "System"
                          : appearance === "dark"
                            ? "Dark"
                            : "Light"}
                      </div>
                    </div>

                    <ChevronDown
                      size={16}
                      className={
                        appearanceOpen
                          ? "appearance-chevron open"
                          : "appearance-chevron"
                      }
                    />
                  </button>

                  {appearanceOpen && (
                    <div className="appearance-options">
                      <button
                        className={`appearance-option ${
                          appearance === "system" ? "selected" : ""
                        }`}
                        onClick={() => {
                          setAppearance("system");
                          setAppearanceOpen(false);
                        }}
                      >
                        <div>
                          <div className="appearance-name">System</div>
                          <div className="appearance-description">
                            Follow your device settings
                          </div>
                        </div>

                        {appearance === "system" && (
                          <span className="appearance-check">✓</span>
                        )}
                      </button>

                      <button
                        className={`appearance-option ${
                          appearance === "dark" ? "selected" : ""
                        }`}
                        onClick={() => {
                          setAppearance("dark");
                          setAppearanceOpen(false);
                        }}
                      >
                        <div>
                          <div className="appearance-name">Dark</div>
                          <div className="appearance-description">
                            Always use dark mode
                          </div>
                        </div>

                        {appearance === "dark" && (
                          <span className="appearance-check">✓</span>
                        )}
                      </button>

                      <button
                        className={`appearance-option ${
                          appearance === "light" ? "selected" : ""
                        }`}
                        onClick={() => {
                          setAppearance("light");
                          setAppearanceOpen(false);
                        }}
                      >
                        <div>
                          <div className="appearance-name">Light</div>
                          <div className="appearance-description">
                            Always use light mode
                          </div>
                        </div>

                        {appearance === "light" && (
                          <span className="appearance-check">✓</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <button className="signout-button" onClick={handleSignOut}>
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </>
        )}
      </aside>

      {!sidebarOpen && (
        <button
          className="open-sidebar"
          onClick={() => setSidebarOpen(true)}
          title="Open sidebar"
        >
          <Menu size={19} />
        </button>
      )}

      <main className="main-content">
        {adminOpen && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>Admin</h2>
                <p>Manage Northstar Financial AI</p>
              </div>

              <button
                className="icon-button"
                onClick={() => setAdminOpen(false)}
                aria-label="Close admin panel"
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-panel-body">
              {adminSection === null && (
                <div className="admin-dashboard">
                  <div className="admin-dashboard-intro">
                    <div>
                      <span className="admin-eyebrow">CONTROL CENTER</span>
                      <h3>Workspace overview</h3>
                      <p>
                        Manage documents, users, and access across Northstar
                        Financial AI.
                      </p>
                    </div>
                  </div>

                  <div className="admin-overview-grid">
                    <button
                      type="button"
                      className="admin-overview-card admin-interactive-card"
                      onClick={() => {
                        setAdminSection("documents");
                        loadAdminDocuments();
                      }}
                    >
                      <div className="admin-card-main">
                        <div className="admin-overview-icon documents">
                          <FileText size={22} />
                        </div>

                        <div className="admin-overview-content">
                          <strong>Documents</strong>
                          <span>Manage financial policies</span>
                        </div>
                      </div>

                      <div className="admin-card-details">
                        <div className="admin-card-stat">
                          <strong>{adminDocuments.length}</strong>
                          <span>documents</span>
                        </div>

                        <p>
                          Upload, review, delete, and manage documents used by
                          the financial RAG system.
                        </p>

                        <span className="admin-card-action">
                          Open documents <span>→</span>
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="admin-overview-card admin-interactive-card"
                      onClick={() => setAdminSection("users")}
                    >
                      <div className="admin-card-main">
                        <div className="admin-overview-icon users">
                          <Users size={22} />
                        </div>

                        <div className="admin-overview-content">
                          <strong>Users</strong>
                          <span>Manage users and access</span>
                        </div>
                      </div>

                      <div className="admin-card-details">
                        <div className="admin-card-stat">
                          <strong>{adminUsers.length}</strong>
                          <span>registered users</span>
                        </div>

                        <p>
                          Manage administrator access and user roles across
                          Northstar Financial AI.
                        </p>

                        <span className="admin-card-action">
                          Open users <span>→</span>
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {adminSection === "documents" && (
                <div>
                  <div className="admin-section-header">
                    <div className="admin-section-title">
                      <h3>Documents</h3>
                      <p>Manage financial policies and RAG documents.</p>
                    </div>

                    <div className="admin-section-actions">
                      <button
                        className="admin-back-button"
                        onClick={() => setAdminSection(null)}
                      >
                        <ArrowLeft size={16} />
                        Back
                      </button>

                      <button
                        className="admin-refresh-button"
                        onClick={loadAdminDocuments}
                        disabled={adminDocumentsLoading}
                        aria-label="Refresh documents"
                      >
                        <RefreshCw
                          size={16}
                          className={adminDocumentsLoading ? "spin" : ""}
                        />
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="admin-upload">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.markdown,.csv,.xlsx,.xls"
                      onChange={(event) => {
                        setAdminUploadFile(event.target.files?.[0] || null);
                      }}
                      disabled={adminUploading}
                    />

                    <button
                      className="admin-upload-button"
                      onClick={uploadAdminDocument}
                      disabled={!adminUploadFile || adminUploading}
                    >
                      {adminUploading ? "Uploading..." : "Upload document"}
                    </button>

                    {adminUploadFile && (
                      <span className="admin-upload-filename">
                        Selected: {adminUploadFile.name}
                      </span>
                    )}
                  </div>

                  {adminDocumentsLoading && (
                    <p className="admin-state-message">Loading documents...</p>
                  )}

                  {adminDocumentsError && (
                    <p className="admin-error-message">{adminDocumentsError}</p>
                  )}

                  {!adminDocumentsLoading &&
                    !adminDocumentsError &&
                    adminDocuments.length === 0 && (
                      <p className="admin-state-message">No documents found.</p>
                    )}

                  {!adminDocumentsLoading && adminDocuments.length > 0 && (
                    <div className="admin-document-list">
                      {adminDocuments.map((document) => (
                        <div className="admin-document-item" key={document.id}>
                          <div className="admin-document-icon">
                            <FileText size={18} />
                          </div>

                          <div className="admin-document-info">
                            <strong>{document.filename}</strong>
                            <span>
                              Document #{document.id} · {document.status}
                            </span>
                          </div>

                          <span
                            className={`admin-document-status admin-document-status-${document.status}`}
                          >
                            {document.status}
                          </span>

                          <button
                            className="admin-document-delete"
                            onClick={() => deleteAdminDocument(document.id)}
                            disabled={adminDeletingDocumentId === document.id}
                            aria-label={`Delete ${document.filename}`}
                          >
                            <Trash2 size={16} />
                            {adminDeletingDocumentId === document.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {adminSection === "users" && (
                <div className="admin-users-section">
                  <div className="admin-section-header">
                    <div className="admin-section-title">
                      <h3>Users</h3>
                      <p>Manage user roles and administrator access.</p>
                    </div>

                    <div className="admin-section-actions">
                      <button
                        className="admin-back-button"
                        onClick={() => setAdminSection(null)}
                      >
                        <ArrowLeft size={16} />
                        Back
                      </button>

                      <button
                        type="button"
                        className="admin-refresh-button"
                        onClick={loadAdminUsers}
                        disabled={adminUsersLoading}
                        aria-label="Refresh users"
                      >
                        <RefreshCw
                          size={16}
                          className={adminUsersLoading ? "spin" : ""}
                        />
                        Refresh
                      </button>
                    </div>
                  </div>

                  {adminUsersLoading && (
                    <p className="admin-empty-state">Loading users...</p>
                  )}

                  {adminUsersError && (
                    <div className="admin-users-error" role="alert">
                      <span>{adminUsersError}</span>

                      <button
                        type="button"
                        onClick={() => setAdminUsersError("")}
                        aria-label="Dismiss error"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}

                  {!adminUsersLoading && (
                    <div className="admin-users-list">
                      {adminUsers.length === 0 ? (
                        <p className="admin-empty-state">No users found.</p>
                      ) : (
                        adminUsers.map((user) => (
                          <div className="admin-user-card" key={user.id}>
                            <div className="admin-user-info">
                              <div className="admin-user-avatar">
                                {(user.name || user.email || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div>
                                <strong>{user.name || "Unnamed user"}</strong>
                                <span>{user.email}</span>
                              </div>
                            </div>

                            <div className="admin-user-meta">
                              <span
                                className={`admin-role-badge ${
                                  user.role === "admin" ? "admin" : "user"
                                }`}
                              >
                                {user.role === "admin"
                                  ? "Administrator"
                                  : "User"}
                              </span>

                              <span
                                className={`admin-status-badge ${
                                  user.is_active ? "active" : "inactive"
                                }`}
                              >
                                {user.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>

                            <div className="admin-user-action">
                              {user.role === "admin" ? (
                                <button
                                  className="admin-role-button demote"
                                  onClick={() =>
                                    handleUserRoleChange(user, "user")
                                  }
                                  disabled={adminUpdatingUserId === user.id}
                                >
                                  {adminUpdatingUserId === user.id
                                    ? "Updating..."
                                    : "Remove admin"}
                                </button>
                              ) : (
                                <button
                                  className="admin-role-button promote"
                                  onClick={() =>
                                    handleUserRoleChange(user, "admin")
                                  }
                                  disabled={adminUpdatingUserId === user.id}
                                >
                                  {adminUpdatingUserId === user.id
                                    ? "Updating..."
                                    : "Make admin"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {roleChangeConfirmation && (
                <div
                  className="role-confirmation-overlay"
                  onClick={() => setRoleChangeConfirmation(null)}
                >
                  <div
                    className="role-confirmation-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="role-confirmation-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="role-confirmation-content">
                      <h3 id="role-confirmation-title">
                        {roleChangeConfirmation.newRole === "admin"
                          ? "Make administrator?"
                          : "Remove administrator access?"}
                      </h3>

                      <p>
                        {roleChangeConfirmation.newRole === "admin"
                          ? `Give ${roleChangeConfirmation.user.email} administrator access?`
                          : `Remove administrator access from ${roleChangeConfirmation.user.email}?`}
                      </p>
                    </div>

                    <div className="role-confirmation-actions">
                      <button
                        type="button"
                        className="role-confirmation-cancel"
                        onClick={() => setRoleChangeConfirmation(null)}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className={`role-confirmation-confirm ${
                          roleChangeConfirmation.newRole === "admin"
                            ? "promote"
                            : "demote"
                        }`}
                        onClick={confirmUserRoleChange}
                      >
                        {roleChangeConfirmation.newRole === "admin"
                          ? "Make administrator"
                          : "Remove access"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <header className="topbar">
          <div>
            <div className="topbar-title">
              {activeChat?.title || "Northstar Financial AI"}
            </div>

            <div className="topbar-status">
              <span className="status-dot" />
              Policy intelligence
            </div>
          </div>

          {isAdmin && (
            <button
              className={`admin-button ${adminOpen ? "active" : ""}`}
              onClick={() => setAdminOpen((prev) => !prev)}
            >
              <Shield size={16} />
              Admin
            </button>
          )}
        </header>

        <section className="chat-area">
          {!activeChat || activeChat.messages.length === 0 ? (
            loading ? (
              <div className="messages">
                <div className="message-row assistant-row">
                  <NorthstarLoader />
                </div>
              </div>
            ) : (
              <Welcome onQuestion={(question) => sendMessage(question)} />
            )
          ) : (
            <div className="messages">
              {activeChat.messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}

              {loading && (
                <div className="message-row assistant-row">
                  <NorthstarLoader />
                </div>
              )}
            </div>
          )}
        </section>

        <div className="composer-wrapper">
          {errorMessage && <div className="chat-error">{errorMessage}</div>}

          <div className="composer">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                isListening
                  ? "Listening..."
                  : "Ask about Northstar Financial policies..."
              }
              rows={1}
            />

            <button
              className={`voice-button ${isListening ? "listening" : ""}`}
              onClick={toggleVoiceInput}
              disabled={loading}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              <Mic size={17} />
            </button>

            <button
              className="send-button"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              title="Send"
            >
              <ArrowUp size={18} />
            </button>
          </div>

          <div className="composer-note">
            Northstar AI answers using indexed financial policies.
          </div>
        </div>
      </main>
      {deleteDocumentId !== null && (
        <div className="admin-confirm-overlay">
          <div
            className="admin-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-document-title"
            aria-describedby="delete-document-description"
          >
            <div className="admin-confirm-icon">!</div>

            <div className="admin-confirm-content">
              <h3 id="delete-document-title">Delete document?</h3>

              <p id="delete-document-description">
                This will permanently remove the document from storage and its
                indexed vectors. This action cannot be undone.
              </p>
            </div>

            <div className="admin-confirm-actions">
              <button
                type="button"
                className="admin-confirm-cancel"
                onClick={() => setDeleteDocumentId(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-confirm-delete"
                onClick={confirmDeleteAdminDocument}
              >
                Delete document
              </button>
            </div>
          </div>
        </div>
      )}

      {signOutConfirmOpen && (
        <div className="admin-confirm-overlay">
          <div
            className="admin-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-confirm-title"
            aria-describedby="signout-confirm-description"
          >
            <div className="admin-confirm-icon">!</div>

            <div className="admin-confirm-content">
              <h3 id="signout-confirm-title">Sign out?</h3>

              <p id="signout-confirm-description">
                You will need to sign in again to access your Northstar account.
              </p>
            </div>

            <div className="admin-confirm-actions">
              <button
                type="button"
                className="admin-confirm-cancel"
                onClick={() => setSignOutConfirmOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-confirm-delete"
                onClick={confirmSignOut}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatGroup({
  title,
  chats,
  activeChatId,
  menuChatId,
  setActiveChatId,
  setMenuChatId,
  togglePin,
  renameChat,
  deleteChat,
  archiveChat,
  archiveLabel = "Archive",
  loadConversationMessages,
}) {
  if (chats.length === 0) return null;

  const isArchivedGroup = title === "Archived";

  return (
    <div className="chat-group">
      <div className="group-title">{title}</div>

      {chats.map((chat) => (
        <div
          className={`history-item ${activeChatId === chat.id ? "active" : ""}`}
          key={chat.id}
        >
          <button
            className="history-main"
            onClick={async () => {
              setActiveChatId(chat.id);

              if (chat.messages.length === 0) {
                await loadConversationMessages(chat.id);
              }
            }}
          >
            <MessageSquare size={15} />
            <span>{chat.title}</span>
          </button>

          <button
            className="history-menu-button"
            onClick={() =>
              setMenuChatId(menuChatId === chat.id ? null : chat.id)
            }
          >
            <MoreHorizontal size={16} />
          </button>

          {menuChatId === chat.id && (
            <div className="chat-menu">
              {!isArchivedGroup && (
                <button onClick={() => togglePin(chat.id)}>
                  <Pin size={14} />
                  {chat.pinned ? "Unpin" : "Pin"}
                </button>
              )}

              <button onClick={() => renameChat(chat.id)}>
                <FileText size={14} />
                Rename
              </button>

              <button onClick={() => archiveChat(chat.id)}>
                <Archive size={14} />
                {archiveLabel}
              </button>

              <button className="danger" onClick={() => deleteChat(chat.id)}>
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Welcome({ onQuestion }) {
  return (
    <div className="welcome">
      <div className="northstar-title-wrap">
        <div className="northstar-welcome-animation" aria-hidden="true">
          <svg
            className="northstar-welcome-svg"
            viewBox="0 0 180 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Orbital ring */}
            <ellipse
              className="northstar-welcome-orbit"
              cx="35"
              cy="50"
              rx="80"
              ry="20"
              transform="rotate(-18 35 50)"
            />

            {/* Small stars following the orbit */}
            <g className="northstar-welcome-trail">
              <path
                d="M0 -2.2 L0.7 -0.7 L2.2 0 L0.7 0.7 L0 2.2 L-0.7 0.7 L-2.2 0 L-0.7 -0.7 Z"
                transform="translate(80 18)"
              />
              <path
                d="M0 -2.2 L0.7 -0.7 L2.2 0 L0.7 0.7 L0 2.2 L-0.7 0.7 L-2.2 0 L-0.7 -0.7 Z"
                transform="translate(70 20)"
              />
              <path
                d="M0 -2.7 L0.8 -0.8 L2.7 0 L0.8 0.8 L0 2.7 L-0.8 0.8 L-2.7 0 L-0.8 -0.8 Z"
                transform="translate(60 22)"
              />

              <path
                d="M0 -2.7 L0.8 -0.8 L2.7 0 L0.8 0.8 L0 2.7 L-0.8 0.8 L-2.7 0 L-0.8 -0.8 Z"
                transform="translate(50 25)"
              />

              <path
                d="M0 -3.5 L1 -1 L3.5 0 L1 1 L0 3.5 L-1 1 L-3.5 0 L-1 -1 Z"
                transform="translate(40 30)"
              />
            </g>

            {/* Main North Star — positioned directly on the orbit */}
            <g transform="translate(-30 -10)">
              <path
                className="northstar-welcome-main-star"
                d="M0 -9 L2.4 -2.4 L10 0 L2.4 2.4 L0 13 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z"
              />
            </g>
          </svg>
        </div>

        <h1>Northstar Financial AI</h1>
      </div>

      <p>
        Ask questions about your financial policies, procedures, controls, and
        requirements.
      </p>

      <div className="quick-grid">
        {QUICK_QUESTIONS.map((question) => (
          <button
            key={question}
            onClick={() => onQuestion(question)}
            className="quick-card"
          >
            <span>{question}</span>
            <ChevronDown size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ message }) {
  if (message.role === "user") {
    return (
      <div className="message-row user-row">
        <div className="user-message">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="message-row assistant-row">
      <div className="avatar assistant-avatar">
        <NorthstarMark />
      </div>
      <div className={`assistant-message ${message.error ? "error" : ""}`}>
        <div className="message-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {!message.error && message.sources && (
          <details className="sources">
            <summary>View sources</summary>
            <pre>{message.sources}</pre>
          </details>
        )}

        {!message.error && (
          <div className="message-meta">
            <span>{message.provider}</span>

            {message.cached && <span>Cached</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
