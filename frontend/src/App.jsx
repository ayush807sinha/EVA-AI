
import { useEffect, useRef, useState } from "react";
import "./index.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/chat";

const suggestions = [
  "Tell me about Ayush's projects",
  "What is Ayush's work experience?",
  "What are Ayush's technical skills?",
  "Tell me about Ayush's education",
];

function Icon({ name, size = 18 }) {
  const paths = {
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </>
    ),
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5M12 15V3" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M7 17 17 7M7 7h10v10" />,
    sparkles: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z" />
        <path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2Z" />
      </>
    ),
    message: (
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z" />
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function Message({ message, isStreaming }) {
  const assistant = message.role === "assistant";

  return (
    <div className={`message-row ${assistant ? "from-eva" : "from-user"}`}>
      {assistant && <div className="message-avatar">E</div>}

      <div className="message-body">
        <div className="message-meta">
          <span>{assistant ? "EVA" : "You"}</span>
          {assistant && <span className="meta-label">PERSONAL AI</span>}
        </div>

        <div className={`message-bubble ${assistant ? "eva-bubble" : "user-bubble"}`}>
          {message.content ? (
            <div className="message-text">{message.content}</div>
          ) : isStreaming ? (
            <div className="typing-indicator" aria-label="EVA is responding">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="message-text">No response received.</div>
          )}

          {assistant && isStreaming && message.content && (
            <span className="stream-cursor" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("eva-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasStarted, setHasStarted] = useState(false);

  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("eva-theme", theme);
    } catch {
      // Theme still works when local storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function startNewChat() {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput("");
    setError("");
    setIsLoading(false);
    setHasStarted(false);
    textareaRef.current?.focus();
  }

  async function sendMessage(text = input) {
    const question = text.trim();
    if (!question || isLoading) return;

    setError("");
    setHasStarted(true);
    setInput("");
    setIsLoading(true);

    const assistantId = `${Date.now()}-assistant`;
    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((previous) => [
      ...previous,
      { id: `${Date.now()}-user`, role: "user", content: question },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/plain",
        },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = "";
        try {
          const body = await response.json();
          detail = body.detail || body.message || "";
        } catch {
          // Response might not be JSON.
        }
        throw new Error(detail || `Request failed (${response.status}).`);
      }

      if (!response.body) {
        throw new Error("The server did not provide a streaming response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? { ...message, content: accumulated }
              : message
          )
        );
      }

      accumulated += decoder.decode();

      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  accumulated || "I couldn't generate a response. Please try again.",
              }
            : message
        )
      );
    } catch (err) {
      if (err.name === "AbortError") return;

      setError(
        err.message ||
          "Couldn't connect to EVA. Check that your backend is running."
      );

      setMessages((previous) =>
        previous.filter(
          (message) =>
            message.id !== assistantId || message.content.trim() !== ""
        )
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className={`eva-app ${theme}`}>
      <header className="topbar">
        <button className="brand" onClick={startNewChat} aria-label="EVA home">
          <span className="brand-symbol">e<span>.</span></span>
          <span className="brand-title">EVA</span>
        </button>

        <div className="header-right">
          <span className="header-caption">AYUSH'S PERSONAL AI</span>

          <a
            className="resume-button"
            href="/resume.pdf"
            download="Ayush-Kumar-Sinha-Resume.pdf"
          >
            <Icon name="download" size={16} />
            <span>Download résumé</span>
          </a>

          <button
            className="theme-button"
            onClick={() => setTheme((value) => value === "light" ? "dark" : "light")}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            <Icon name={theme === "light" ? "moon" : "sun"} size={17} />
          </button>
        </div>
      </header>

      <main className="page-grid">
        <section className="profile-section">
          <div className="availability">
            <span className="availability-dot" />
            A PROFESSIONAL PROFILE, REIMAGINED
          </div>

          <div className="hero-copy">
            <p className="hero-overline">HELLO, I'M AYUSH'S AI ASSISTANT</p>
            <h1>
              Get to know
              <br />
              <span>Ayush.</span>
            </h1>
            <p className="hero-description">
              A conversation is better than a résumé alone. Ask EVA about
              Ayush's experience, projects, technical skills, and the work
              he's passionate about.
            </p>
          </div>

          <div className="profile-actions">
            <button
              className="chat-cta"
              onClick={() => {
                textareaRef.current?.focus();
                document.querySelector(".chat-panel")?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }}
            >
              <Icon name="message" size={17} />
              Talk to EVA
              <Icon name="arrow" size={15} />
            </button>

            <a
              className="resume-text-link"
              href="/resume.pdf"
              download="Ayush-Kumar-Sinha-Resume.pdf"
            >
              View résumé <Icon name="arrow" size={14} />
            </a>
          </div>

          <div className="profile-card">
            <div className="profile-card-top">
              <div className="profile-monogram">AS</div>
              <div className="profile-card-heading">
                <span className="card-eyebrow">CANDIDATE PROFILE</span>
                <h2>Ayush Kumar Sinha</h2>
                <p>Software Development · Computer Science</p>
              </div>
              <div className="profile-card-badge">01</div>
            </div>

            <div className="card-rule" />

            <div className="profile-facts">
              <div>
                <span className="fact-label">FOCUS</span>
                <span className="fact-value">Software Engineering</span>
              </div>
              <div>
                <span className="fact-label">TOOLKIT</span>
                <span className="fact-value">Java · Spring · React</span>
              </div>
              <div>
                <span className="fact-label">DISCOVER</span>
                <span className="fact-value">Projects & experience</span>
              </div>
            </div>

            <div className="profile-card-bottom">
              <span className="mini-status" />
              <span>Ask EVA. Explore the details.</span>
              <Icon name="arrow" size={15} />
            </div>
          </div>

          <div className="left-footer">
            <span>BUILT AROUND A CONVERSATION</span>
            <span>01 — PROFILE</span>
          </div>
        </section>

        <section className="chat-panel" aria-label="Conversation with EVA">
          <div className="chat-panel-header">
            <div className="eva-identity">
              <div className="eva-avatar">
                e<span>.</span>
                <i />
              </div>
              <div>
                <h2>EVA</h2>
                <p><span className="online-dot" /> Ayush's personal AI assistant</p>
              </div>
            </div>

            <button
              className="new-chat-button"
              onClick={startNewChat}
              aria-label="Start new conversation"
              title="New conversation"
            >
              <Icon name="plus" size={17} />
            </button>
          </div>

          <div className="chat-intro-strip">
            <Icon name="sparkles" size={16} />
            <span>Curious about Ayush? You're in the right place.</span>
          </div>

          <div className="chat-content" aria-live="polite">
            {!hasStarted && (
              <div className="welcome-state">
                <div className="welcome-symbol">
                  <Icon name="message" size={22} />
                </div>
                <span className="welcome-eyebrow">LET'S START HERE</span>
                <h3>What would you like to know about Ayush?</h3>
                <p>
                  Choose a question to start, or ask anything about his
                  professional journey.
                </p>

                <div className="suggestions">
                  {suggestions.map((suggestion, index) => (
                    <button
                      className="suggestion"
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      disabled={isLoading}
                    >
                      <span className="suggestion-index">
                        0{index + 1}
                      </span>
                      <span className="suggestion-text">{suggestion}</span>
                      <Icon name="arrow" size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasStarted && messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                isStreaming={
                  isLoading &&
                  message.role === "assistant" &&
                  message.id === messages[messages.length - 1]?.id
                }
              />
            ))}

            {error && (
              <div className="error-message" role="alert">
                <strong>Unable to connect</strong>
                <p>{error}</p>
                <button onClick={() => setError("")}>Dismiss</button>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div className="composer-area">
            <form className="composer" onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Ayush..."
                rows={1}
                disabled={isLoading}
                aria-label="Ask EVA about Ayush"
              />

              {isLoading ? (
                <button
                  className="send-button stop-button"
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  aria-label="Stop response"
                  title="Stop response"
                >
                  <span className="stop-square" />
                </button>
              ) : (
                <button
                  className="send-button"
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send message"
                >
                  <Icon name="send" size={16} />
                </button>
              )}
            </form>

            <div className="composer-footer">
              <span>ENTER TO SEND <i /> SHIFT + ENTER FOR NEW LINE</span>
              <span className="composer-brand"><span /> POWERED BY EVA</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="footer-logo">e.</span>
          <span>Personal profile of Ayush Kumar Sinha</span>
        </div>
        <div className="footer-links">
          <a href="/resume.pdf" download="Ayush-Kumar-Sinha-Resume.pdf">
            Résumé <Icon name="arrow" size={12} />
          </a>
          <span>© {new Date().getFullYear()} EVA</span>
        </div>
      </footer>
    </div>
  );
}
