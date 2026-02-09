"use client";

import { useState } from "react";
import { Button, TextArea, Tile, Tag, InlineLoading } from "@carbon/react";
import { Play } from "@carbon/icons-react";

interface ClassificationResult {
  text: string;
  sentiment: string;
  category: string;
  urgency: string;
  confidence: number;
  keyPhrases: string[];
}

type TagColor = "blue" | "cyan" | "gray" | "green" | "magenta" | "purple" | "red" | "teal" | "cool-gray" | "warm-gray" | "high-contrast" | "outline";

const sentimentColors: Record<string, TagColor> = {
  positive: "green",
  neutral: "blue",
  negative: "red",
  mixed: "purple",
};

const urgencyColors: Record<string, TagColor> = {
  high: "red",
  medium: "teal",
  low: "green",
};

export function TextClassificationClient({ demoId }: { demoId: string }) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ClassificationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadSampleData = async () => {
    try {
      const res = await fetch("/sample-data/customer-tickets.json");
      const tickets = await res.json();
      const texts = tickets.slice(0, 8).map((t: { text: string }) => t.text);
      setInput(texts.join("\n---\n"));
    } catch {
      setInput("The product is great, I love using it!\n---\nI've been waiting 3 days for a response, this is unacceptable.\n---\nCan you help me reset my password?\n---\nThe new update broke everything, I want a refund immediately.");
    }
  };

  const classify = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const texts = input.split("\n---\n").map((t) => t.trim()).filter(Boolean);
      const res = await fetch("/api/demos/text-classification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Classification failed");
      }
      setResults(data.classifications || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Classification failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const sentimentCounts = results.reduce((acc, r) => {
    acc[r.sentiment] = (acc[r.sentiment] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryCounts = results.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="custom-tabs" role="tablist" aria-label="Classification tabs">
        <button
          role="tab"
          aria-selected={activeTab === 0}
          className={`custom-tab ${activeTab === 0 ? "custom-tab--selected" : ""}`}
          onClick={() => setActiveTab(0)}
        >
          Input
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 1}
          className={`custom-tab ${activeTab === 1 ? "custom-tab--selected" : ""}`}
          onClick={() => results.length > 0 && setActiveTab(1)}
          disabled={results.length === 0}
        >
          Insights Dashboard
        </button>
      </div>

      {activeTab === 0 && (
        <div role="tabpanel" style={{ paddingTop: "1rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <Button kind="ghost" size="sm" onClick={loadSampleData}>
              Load Sample Tickets
            </Button>
          </div>
          <TextArea
            id="classification-input"
            labelText="Enter text to classify (separate multiple items with ---)"
            placeholder="Enter customer feedback, support tickets, or any text to classify..."
            rows={8}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div style={{ marginTop: "1rem" }}>
            <Button renderIcon={Play} onClick={classify} disabled={loading || !input.trim()}>
              {loading ? <InlineLoading description="Classifying..." /> : "Classify Text"}
            </Button>
          </div>

          {error && (
            <Tile style={{ marginTop: "1rem", padding: "1rem", background: "var(--cds-support-error)" }}>
              <p style={{ color: "#fff" }}>{error}</p>
            </Tile>
          )}

          {results.length > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h4 style={{ marginBottom: "0.75rem" }}>Results ({results.length} items)</h4>
              {results.map((r, i) => (
                <Tile key={i} style={{ marginBottom: "0.75rem", padding: "1rem" }}>
                  <p style={{ marginBottom: "0.5rem", fontSize: "0.875rem" }}>{r.text.slice(0, 200)}{r.text.length > 200 ? "..." : ""}</p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Tag type={sentimentColors[r.sentiment] || "gray"} size="sm">
                      {r.sentiment}
                    </Tag>
                    <Tag type="blue" size="sm">{r.category}</Tag>
                    <Tag type={urgencyColors[r.urgency] || "gray"} size="sm">
                      Urgency: {r.urgency}
                    </Tag>
                    <Tag type="outline" size="sm">
                      {Math.round(r.confidence * 100)}% confident
                    </Tag>
                  </div>
                </Tile>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 1 && results.length > 0 && (
        <div role="tabpanel" style={{ paddingTop: "1rem" }}>
          <div className="metric-cards">
            <Tile className="metric-card">
              <div className="metric-card__label">Total Classified</div>
              <div className="metric-card__value">{results.length}</div>
            </Tile>
            <Tile className="metric-card">
              <div className="metric-card__label">Avg Confidence</div>
              <div className="metric-card__value">
                {results.length ? Math.round((results.reduce((a, r) => a + r.confidence, 0) / results.length) * 100) : 0}%
              </div>
            </Tile>
          </div>

          <div className="charts-grid">
            <div className="chart-container">
              <h4>Sentiment Distribution</h4>
              <div style={{ marginTop: "1rem" }}>
                {Object.entries(sentimentCounts).map(([sentiment, count]) => (
                  <div key={sentiment} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <Tag type={sentimentColors[sentiment] || "gray"} size="sm" style={{ minWidth: 80 }}>{sentiment}</Tag>
                    <div style={{ flex: 1, height: 12, background: "var(--cds-layer-02)", borderRadius: 4 }}>
                      <div style={{ width: `${(count / results.length) * 100}%`, height: "100%", background: "var(--cds-interactive)", borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: "0.875rem", minWidth: 30, textAlign: "right" }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-container">
              <h4>Category Breakdown</h4>
              <div style={{ marginTop: "1rem" }}>
                {Object.entries(categoryCounts).map(([category, count]) => (
                  <div key={category} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "0.875rem", minWidth: 120 }}>{category}</span>
                    <div style={{ flex: 1, height: 12, background: "var(--cds-layer-02)", borderRadius: 4 }}>
                      <div style={{ width: `${(count / results.length) * 100}%`, height: "100%", background: "var(--cds-support-info)", borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: "0.875rem", minWidth: 30, textAlign: "right" }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
