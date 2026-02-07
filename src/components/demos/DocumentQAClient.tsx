"use client";

import { useState, useRef, useEffect } from "react";
import { Button, TextInput, Tile, Tag, InlineLoading } from "@carbon/react";
import { Send, DocumentBlank, Checkmark } from "@carbon/icons-react";
import React from "react";

interface DocInfo {
  id: string;
  fileName: string;
  fileType: string;
  isPreloaded: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: { text: string; source: string }[];
}

const SUGGESTED_QUESTIONS = [
  "What are the key features of DataSphere Pro?",
  "What security certifications does the platform have?",
  "How does the pricing model work?",
  "What integrations are available?",
];

function formatInline(str: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.slice(lastIndex, match.index));
    }
    parts.push(<strong key={`b-${match.index}`}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [str];
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag key={`list-${elements.length}`} style={{ paddingLeft: "1.25rem", margin: "0.5rem 0" }}>
          {listItems}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/);

    if (bulletMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(
        <li key={`li-${i}`} style={{ marginBottom: "0.25rem", lineHeight: 1.5 }}>
          {formatInline(bulletMatch[1])}
        </li>
      );
    } else if (numberedMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(
        <li key={`li-${i}`} style={{ marginBottom: "0.25rem", lineHeight: 1.5 }}>
          {formatInline(numberedMatch[1])}
        </li>
      );
    } else {
      flushList();
      elements.push(
        <p key={`p-${i}`} style={{ margin: "0.375rem 0", lineHeight: 1.5 }}>
          {formatInline(trimmed)}
        </p>
      );
    }
  }

  flushList();
  return elements;
}

export function DocumentQAClient({ preloadedDocs, demoId }: { preloadedDocs: DocInfo[]; demoId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(preloadedDocs.map((d) => d.id));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askQuestion = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/demos/document-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, documentIds: selectedDocs }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Request failed");
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations },
      ]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-layout">
      <div className="chat-sidebar">
        <h4>Knowledge Base</h4>
        <div className="doc-list">
          {preloadedDocs.map((doc) => (
            <Tile
              key={doc.id}
              className={`doc-item ${selectedDocs.includes(doc.id) ? "doc-item--selected" : ""}`}
              onClick={() => {
                setSelectedDocs((prev) =>
                  prev.includes(doc.id) ? prev.filter((id) => id !== doc.id) : [...prev, doc.id]
                );
              }}
              style={{ cursor: "pointer", marginBottom: "0.5rem", padding: "0.75rem" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <DocumentBlank size={16} />
                <span style={{ fontSize: "0.875rem" }}>{doc.fileName}</span>
                {selectedDocs.includes(doc.id) && <Checkmark size={16} style={{ marginLeft: "auto", color: "var(--cds-interactive)" }} />}
              </div>
            </Tile>
          ))}
        </div>

        <h4 style={{ marginTop: "1.5rem" }}>Suggested Questions</h4>
        <div className="suggested-questions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              className="suggested-question"
              onClick={() => askQuestion(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <h3>Ask a Question</h3>
              <p>Select documents from the knowledge base and ask questions to get AI-powered answers with source citations.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message chat-message--${msg.role}`}>
              {msg.role === "assistant" ? (
                <div className="chat-message__content">{renderMarkdown(msg.content)}</div>
              ) : (
                <p>{msg.content}</p>
              )}
              {msg.citations && msg.citations.length > 0 && (
                <div className="chat-message__citations">
                  {msg.citations.map((c, j) => (
                    <Tag key={j} type="outline" size="sm">
                      {c.source}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="chat-message chat-message--assistant">
              <InlineLoading description="Thinking..." />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input">
          <TextInput
            id="chat-input"
            labelText=""
            hideLabel
            placeholder="Ask a question about your documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askQuestion(input)}
            disabled={loading}
          />
          <Button
            renderIcon={Send}
            hasIconOnly
            iconDescription="Send"
            onClick={() => askQuestion(input)}
            disabled={loading || !input.trim()}
          />
        </div>
      </div>
    </div>
  );
}
