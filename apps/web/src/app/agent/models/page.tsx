"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModelAuthMode } from "@learning-agent-platform/ai-core";
import {
  createModelProviderAction,
  updateModelProviderAction,
  deleteModelProviderAction,
  listModelProvidersAction,
  getCredentialFieldsAction,
  saveProviderCredentialAction,
  deleteProviderCredentialAction,
  testProviderConnectionAction,
  createModelProfileAction,
  updateModelProfileAction,
  deleteModelProfileAction,
  listModelProfilesAction,
  setDefaultChatModelAction,
  getCurrentDefaultModelStatusAction,
} from "./model-config-actions";
import styles from "../page.module.css";

// --- Types ---

interface ProviderView {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string;
  authMode: string;
  enabled: boolean;
  requestTimeoutMs: number;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestLatencyMs: number | null;
  lastTestErrorCode: string | null;
  maskedHint: string | null;
  profileCount: number;
}

interface ProfileView {
  id: string;
  displayName: string;
  modelId: string;
  contextWindow: number;
  maxOutputTokens: number;
  temperature: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsJsonSchema: boolean;
  supportsFiles: boolean;
  enabled: boolean;
  usageType: string;
  priority: number;
  isDefault: boolean;
}

interface CredentialField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  placeholder?: string;
}

interface DefaultModelStatus {
  configured: boolean;
  providerName?: string;
  modelName?: string;
  providerId?: string;
  profileId?: string;
  connectionStatus?: string;
  lastTestedAt?: string;
  vaultConfigured: boolean;
}

type TabId = "providers" | "profile";

// --- Main Page ---

interface ModelConfigPanelProps {
  compact?: boolean;
}

export function ModelConfigPanel({ compact = false }: ModelConfigPanelProps) {
  const [tab, setTab] = useState<TabId>("providers");
  const [providers, setProviders] = useState<ProviderView[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileView[]>([]);
  const [defaultStatus, setDefaultStatus] = useState<DefaultModelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Provider form state
  const [formId, setFormId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formProviderType, setFormProviderType] = useState("OPENAI_COMPATIBLE");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formAuthMode, setFormAuthMode] = useState<ModelAuthMode>("bearer");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formTimeout, setFormTimeout] = useState(30000);

  // Credential form state
  const [credFields, setCredFields] = useState<CredentialField[] | null>(null);
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  const [showCredentialForm, setShowCredentialForm] = useState(false);

  // Profile form state
  const [profileFormId, setProfileFormId] = useState<string | null>(null);
  const [pDisplayName, setPDisplayName] = useState("");
  const [pModelId, setPModelId] = useState("");
  const [pContextWindow, setPContextWindow] = useState(4096);
  const [pMaxOutputTokens, setPMaxOutputTokens] = useState(2048);
  const [pTemperature, setPTemperature] = useState(0.1);
  const [pIsDefault, setPIsDefault] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);

  // Connection test state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Load providers
  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listModelProvidersAction();
      if (result.ok) {
        setProviders(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError("加载 Provider 列表失败");
    }
    setLoading(false);
  }, []);

  // Load default status
  const loadDefaultStatus = useCallback(async () => {
    try {
      const result = await getCurrentDefaultModelStatusAction();
      if (result.ok) {
        setDefaultStatus({
          ...result.data,
          lastTestedAt: result.data.lastTestedAt ?? undefined,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadProviders();
    void loadDefaultStatus();
  }, [loadProviders, loadDefaultStatus]);

  // --- Provider CRUD ---

  function startNewProvider() {
    setFormId(null);
    setFormName("");
    setFormProviderType("OPENAI_COMPATIBLE");
    setFormBaseUrl("");
    setFormAuthMode("bearer");
    setFormEnabled(true);
    setFormTimeout(30000);
    setCredValues({});
    setIsEditing(true);
    setShowCredentialForm(false);
    void loadCredFields("bearer");
  }

  function startEditProvider(p: ProviderView) {
    setFormId(p.id);
    setFormName(p.name);
    setFormProviderType(p.providerType);
    setFormBaseUrl(p.baseUrl);
    setFormAuthMode(p.authMode as ModelAuthMode);
    setFormEnabled(p.enabled);
    setFormTimeout(p.requestTimeoutMs);
    setCredValues({});
    setIsEditing(true);
    setShowCredentialForm(false);
    void loadCredFields(p.authMode as ModelAuthMode);
  }

  async function loadCredFields(mode: ModelAuthMode) {
    setCredFields(null); // reset before loading
    try {
      const result = await getCredentialFieldsAction({ authMode: mode });
      if (result.ok) {
        setCredFields(result.data);
      } else {
        console.error("loadCredFields failed:", result.error);
        setCredFields([]);
      }
    } catch (err) {
      console.error("loadCredFields error:", err);
      setCredFields([]);
    }
  }

  async function handleAuthModeChange(mode: ModelAuthMode) {
    setFormAuthMode(mode);
    await loadCredFields(mode);
  }

  async function saveProvider() {
    setError(null);
    setMessage(null);

    if (!formName.trim()) { setError("Provider 名称不能为空"); return; }
    if (!formBaseUrl.trim()) { setError("Base URL 不能为空"); return; }

    try {
      let providerId: string;

      if (formId) {
        const result = await updateModelProviderAction({
          id: formId,
          name: formName,
          baseUrl: formBaseUrl,
          authMode: formAuthMode,
          enabled: formEnabled,
          requestTimeoutMs: formTimeout,
        });
        if (!result.ok) { setError(result.error); return; }
        providerId = formId;
      } else {
        const result = await createModelProviderAction({
          name: formName,
          providerType: formProviderType,
          baseUrl: formBaseUrl,
          authMode: formAuthMode,
          enabled: formEnabled,
          requestTimeoutMs: formTimeout,
        });
        if (!result.ok) { setError(result.error); return; }
        providerId = result.data.id;
        setFormId(providerId);
      }

      // Save credential in the same step if user filled any fields
      const hasCredValues = Object.values(credValues).some(
        (v) => v && v.trim().length > 0,
      );
      if (hasCredValues && formAuthMode !== "none") {
        const credResult = await saveProviderCredentialAction({
          providerId,
          mode: formAuthMode,
          fields: credValues,
        });
        if (!credResult.ok) {
          setError(`Provider 已保存，但凭据保存失败: ${credResult.error}`);
        } else {
          setCredValues({});
        }
      }

      setMessage("Provider 已保存");
      await loadProviders();
    } catch {
      setError("保存失败");
    }
  }

  async function handleDeleteProvider(id: string) {
    if (!confirm("确定要删除此 Provider？相关凭据和模型配置将同时删除。")) return;
    setError(null);
    try {
      const result = await deleteModelProviderAction({ id });
      if (!result.ok) { setError(result.error); return; }
      setMessage("Provider 已删除");
      if (selectedProviderId === id) setSelectedProviderId(null);
      if (formId === id) { setIsEditing(false); setFormId(null); setShowCredentialForm(false); }
      await loadProviders();
      await loadDefaultStatus();
    } catch {
      setError("删除失败");
    }
  }

  // --- Credential ---

  async function saveCredential() {
    setError(null);
    if (!formId) { setError("请先保存 Provider"); return; }

    try {
      const result = await saveProviderCredentialAction({
        providerId: formId,
        mode: formAuthMode,
        fields: credValues,
      });
      if (!result.ok) { setError(result.error); return; }
      setMessage("凭据已加密保存");
      setCredValues({});
      setShowCredentialForm(false);
      await loadProviders();
    } catch {
      setError("保存凭据失败");
    }
  }

  async function handleDeleteCredential() {
    if (!formId) return;
    if (!confirm("确定要删除凭据？")) return;
    try {
      const result = await deleteProviderCredentialAction({ providerId: formId });
      if (!result.ok) { setError(result.error); return; }
      setMessage("凭据已删除");
      await loadProviders();
    } catch {
      setError("删除凭据失败");
    }
  }

  // --- Connection Test ---

  async function handleTestConnection(providerId: string) {
    setTestingId(providerId);
    setTestResult(null);
    setError(null);
    try {
      const result = await testProviderConnectionAction({ providerId });
      if (result.ok) {
        setTestResult(
          result.data.success
            ? `连接成功！延迟: ${result.data.latencyMs}ms，模型: ${result.data.resolvedModel ?? result.data.modelId}`
            : `连接失败: ${result.data.errorMessage ?? result.data.errorCode ?? "未知错误"}`,
        );
      } else {
        setError(result.error);
      }
    } catch {
      setError("连接测试失败");
    }
    setTestingId(null);
    await loadProviders();
    await loadDefaultStatus();
  }

  // --- Profile CRUD ---

  async function loadProfiles(providerId: string) {
    try {
      const result = await listModelProfilesAction({ providerId });
      if (result.ok) setProfiles(result.data);
    } catch {
      // ignore
    }
  }

  function selectProvider(id: string) {
    setSelectedProviderId(id);
    void loadProfiles(id);
  }

  function startNewProfile() {
    setProfileFormId(null);
    setPDisplayName("");
    setPModelId("");
    setPContextWindow(4096);
    setPMaxOutputTokens(2048);
    setPTemperature(0.1);
    setPIsDefault(false);
    setShowProfileForm(true);
  }

  function startEditProfile(p: ProfileView) {
    setProfileFormId(p.id);
    setPDisplayName(p.displayName);
    setPModelId(p.modelId);
    setPContextWindow(p.contextWindow);
    setPMaxOutputTokens(p.maxOutputTokens);
    setPTemperature(p.temperature);
    setPIsDefault(p.isDefault);
    setShowProfileForm(true);
  }

  async function saveProfile() {
    setError(null);
    if (!selectedProviderId) return;
    if (!pDisplayName.trim()) { setError("显示名称不能为空"); return; }
    if (!pModelId.trim()) { setError("模型 ID 不能为空"); return; }

    try {
      if (profileFormId) {
        const result = await updateModelProfileAction({
          id: profileFormId,
          displayName: pDisplayName,
          modelId: pModelId,
          contextWindow: pContextWindow,
          maxOutputTokens: pMaxOutputTokens,
          temperature: pTemperature,
          isDefault: pIsDefault,
        });
        if (!result.ok) { setError(result.error); return; }
      } else {
        const result = await createModelProfileAction({
          providerId: selectedProviderId,
          displayName: pDisplayName,
          modelId: pModelId,
          contextWindow: pContextWindow,
          maxOutputTokens: pMaxOutputTokens,
          temperature: pTemperature,
          isDefault: pIsDefault,
        });
        if (!result.ok) { setError(result.error); return; }
      }

      setMessage("模型配置已保存");
      setShowProfileForm(false);
      await loadProfiles(selectedProviderId);
      await loadDefaultStatus();
      await loadProviders();
    } catch {
      setError("保存模型配置失败");
    }
  }

  async function handleDeleteProfile(id: string) {
    if (!confirm("确定要删除此模型配置？")) return;
    try {
      const result = await deleteModelProfileAction({ id });
      if (!result.ok) { setError(result.error); return; }
      setMessage("模型配置已删除");
      if (selectedProviderId) await loadProfiles(selectedProviderId);
      await loadDefaultStatus();
    } catch {
      setError("删除模型配置失败");
    }
  }

  async function handleSetDefault(profileId: string) {
    try {
      const result = await setDefaultChatModelAction({ profileId });
      if (!result.ok) { setError(result.error); return; }
      setMessage("已设为默认对话模型");
      if (selectedProviderId) await loadProfiles(selectedProviderId);
      await loadProviders();
      await loadDefaultStatus();
    } catch {
      setError("设置默认模型失败");
    }
  }

  // --- Render ---

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  return (
    <section style={compact ? undefined : { maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      {!compact && (
        <div className={styles.topBar}>
          <a href="/agent" style={{ color: "#2563eb", textDecoration: "none", fontSize: "14px" }}>
            ← 返回 AI 助手
          </a>
          <span style={{
            fontSize: "12px", padding: "2px 8px", borderRadius: "4px",
            background: "#dbeafe", color: "#1e40af",
          }}>
            A490 · AI 助手模型配置
          </span>
        </div>
      )}

      {!compact && <h1 style={{ fontSize: "24px", margin: "16px 0 4px" }}>模型配置</h1>}
      {!compact && <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>
        配置 AI 助手使用的模型。连接测试会产生一次真实模型请求（少量 Token）。
      </p>}

      {/* Default Model Status */}
      {defaultStatus && (
        <div style={{
          background: defaultStatus.configured ? "#f0fdf4" : "#fefce8",
          border: `1px solid ${defaultStatus.configured ? "#bbf7d0" : "#fef08a"}`,
          borderRadius: "8px", padding: "12px 16px", marginBottom: "16px",
        }}>
          <strong style={{ fontSize: "14px" }}>
            {defaultStatus.configured ? "当前默认对话模型" : "尚未配置模型"}
          </strong>
          {defaultStatus.configured ? (
            <div style={{ fontSize: "13px", color: "#374151", marginTop: "4px" }}>
              <div>Provider: {defaultStatus.providerName}</div>
              <div>模型: {defaultStatus.modelName}</div>
              <div>
                连接状态:{" "}
                {defaultStatus.connectionStatus === "SUCCESS"
                  ? "✅ 已连接"
                  : defaultStatus.connectionStatus === "FAILED"
                    ? "❌ 连接失败"
                    : "⚠ 未测试"}
                {defaultStatus.lastTestedAt ? ` (${new Date(defaultStatus.lastTestedAt).toLocaleString()})` : ""}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "#92400e", marginTop: "4px" }}>
              请先创建 Provider 和模型配置，然后设为默认对话模型。
            </p>
          )}
          {!defaultStatus.vaultConfigured && (
            <p style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}>
              ⚠ 服务器未配置凭据加密密钥（LAP_CREDENTIAL_ENCRYPTION_KEY），凭据无法保存。
            </p>
          )}
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", fontSize: "13px", color: "#dc2626" }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "12px", background: "none", border: "none", cursor: "pointer", color: "#991b1b" }}>✕</button>
        </div>
      )}
      {message && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", fontSize: "13px", color: "#166534" }}>
          {message}
          <button onClick={() => setMessage(null)} style={{ marginLeft: "12px", background: "none", border: "none", cursor: "pointer", color: "#14532d" }}>✕</button>
        </div>
      )}
      {testResult && (
        <div style={{
          background: testResult.includes("成功") ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${testResult.includes("成功") ? "#bbf7d0" : "#fecaca"}`,
          borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", fontSize: "13px",
          color: testResult.includes("成功") ? "#166534" : "#dc2626",
        }}>
          {testResult}
          <button onClick={() => setTestResult(null)} style={{ marginLeft: "12px", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid #e5e7eb" }}>
        <TabButton active={tab === "providers"} onClick={() => setTab("providers")}>
          Provider 管理
        </TabButton>
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")}>
          模型配置
        </TabButton>
      </div>

      {/* Providers Tab */}
      {tab === "providers" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <h2 style={{ fontSize: "16px", margin: 0 }}>Provider 列表</h2>
            <button onClick={startNewProvider} style={{
              padding: "6px 16px", background: "#2563eb", color: "white", border: "none",
              borderRadius: "6px", cursor: "pointer", fontSize: "13px",
            }}>
              + 新增 Provider
            </button>
          </div>

          {loading && <p style={{ fontSize: "13px", color: "#6b7280" }}>加载中...</p>}

          {!loading && providers.length === 0 && (
            <p style={{ fontSize: "13px", color: "#6b7280" }}>暂无 Provider。请点击"新增 Provider"创建。</p>
          )}

          {!loading && providers.map((p) => (
            <div key={p.id} style={{
              border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px",
              marginBottom: "8px", fontSize: "13px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{p.name}</strong>
                  <span style={{
                    marginLeft: "8px", fontSize: "11px", padding: "1px 6px",
                    borderRadius: "3px", background: "#f3f4f6", color: "#6b7280",
                  }}>
                    {p.providerType === "OPENAI_COMPATIBLE" ? "OpenAI 兼容" : p.providerType}
                  </span>
                  <span style={{
                    marginLeft: "4px", fontSize: "11px", padding: "1px 6px",
                    borderRadius: "3px",
                    background: p.enabled ? "#d1fae5" : "#fee2e2",
                    color: p.enabled ? "#065f46" : "#991b1b",
                  }}>
                    {p.enabled ? "已启用" : "已禁用"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => handleTestConnection(p.id)} disabled={testingId === p.id}
                    style={smallBtnStyle("#059669")}>
                    {testingId === p.id ? "测试中..." : "测试连接"}
                  </button>
                  <button onClick={() => { startEditProvider(p); void loadCredFields(p.authMode as ModelAuthMode); }}
                    style={smallBtnStyle("#2563eb")}>
                    编辑
                  </button>
                  <button onClick={() => handleDeleteProvider(p.id)} style={smallBtnStyle("#dc2626")}>
                    删除
                  </button>
                </div>
              </div>
              <div style={{ marginTop: "6px", color: "#6b7280", fontSize: "12px" }}>
                <div>Base URL: {p.baseUrl}</div>
                <div>鉴权方式: {p.authMode} | 超时: {p.requestTimeoutMs}ms</div>
                <div>
                  凭据: {p.maskedHint ?? "未配置"} | 模型: {p.profileCount} 个
                </div>
                {p.lastTestedAt && (
                  <div>
                    最后测试: {new Date(p.lastTestedAt).toLocaleString()} | {" "}
                    {p.lastTestStatus === "SUCCESS"
                      ? `✅ 成功 (${p.lastTestLatencyMs}ms)`
                      : p.lastTestStatus === "FAILED"
                        ? `❌ 失败 (${p.lastTestErrorCode ?? "未知"})`
                        : "未测试"}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Provider Edit Form */}
          {isEditing && (
            <div style={{
              border: "1px solid #d1d5db", borderRadius: "8px", padding: "16px",
              marginTop: "12px", background: "#f9fafb",
            }}>
              <h3 style={{ fontSize: "15px", margin: "0 0 12px" }}>
                {formId ? "编辑 Provider" : "新增 Provider"}
              </h3>

              <FormField label="Provider 名称">
                <input value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：我的 OpenAI 兼容服务" style={inputStyle} />
              </FormField>

              <FormField label="Provider 类型">
                <select value={formProviderType} onChange={(e) => setFormProviderType(e.target.value)} style={inputStyle}>
                  <option value="OPENAI_COMPATIBLE">OpenAI 兼容</option>
                </select>
              </FormField>

              <FormField label="Base URL">
                <input value={formBaseUrl} onChange={(e) => setFormBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1" style={inputStyle} />
              </FormField>

              <FormField label="鉴权方式">
                <select value={formAuthMode} onChange={(e) => handleAuthModeChange(e.target.value as ModelAuthMode)} style={inputStyle}>
                  <option value="bearer">Bearer Token</option>
                  <option value="api_key_header">API Key Header</option>
                  <option value="basic_auth">Basic Auth</option>
                  <option value="custom_headers">自定义 Headers</option>
                  <option value="none">无鉴权</option>
                </select>
              </FormField>

              <FormField label="请求超时 (ms)">
                <input type="number" value={formTimeout} onChange={(e) => setFormTimeout(Number(e.target.value))}
                  min={1000} max={60000} style={inputStyle} />
              </FormField>

              <FormField label="">
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                  <input type="checkbox" checked={formEnabled} onChange={(e) => setFormEnabled(e.target.checked)} />
                  启用
                </label>
              </FormField>

              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button onClick={saveProvider} style={btnStyle("#2563eb")}>保存 Provider</button>
                <button onClick={() => { setIsEditing(false); setShowCredentialForm(false); }}
                  style={btnStyle("#6b7280")}>取消</button>
              </div>

              {/* Credential Section — always visible when editing */}
              {formAuthMode !== "none" && (
                <div style={{ marginTop: "16px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontSize: "14px", margin: 0 }}>
                      凭据配置 ({formAuthMode})
                    </h4>
                    {formId && (
                      <button onClick={handleDeleteCredential} style={smallBtnStyle("#dc2626")}>
                        删除凭据
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: "12px", color: "#6b7280", margin: "4px 0 8px" }}>
                    {formId
                      ? "留空表示保留旧值。输入新值将替换已有凭据。"
                      : "凭据将使用 AES-256-GCM 加密后保存。"}
                  </p>

                  {credFields === null && (
                    <p style={{ fontSize: "12px", color: "#9ca3af" }}>加载凭据字段中...</p>
                  )}

                  {credFields !== null && credFields.length === 0 && (
                    <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                      {formAuthMode === "custom_headers"
                        ? "此鉴权方式暂不支持可视化字段配置，请使用 Bearer 或 API Key Header 模式。你仍可保存 Provider 和凭据。"
                        : "此鉴权方式无需凭据。"}
                    </p>
                  )}

                  {credFields !== null && credFields.length > 0 && (
                    <>
                      {credFields.map((field) => (
                        <FormField key={field.key} label={`${field.label}${field.required ? " *" : ""}`}>
                          <input
                            type={field.secret ? "password" : "text"}
                            value={credValues[field.key] ?? ""}
                            onChange={(e) => setCredValues({ ...credValues, [field.key]: e.target.value })}
                            placeholder={field.placeholder ?? `输入 ${field.label}`}
                            style={inputStyle}
                            autoComplete="off"
                          />
                        </FormField>
                      ))}
                      <button
                        onClick={saveCredential}
                        style={{ ...btnStyle("#7c3aed"), marginTop: "4px" }}
                      >
                        单独保存凭据
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {tab === "profile" && (
        <div>
          <div style={{ marginBottom: "12px" }}>
            <FormField label="选择 Provider">
              <select value={selectedProviderId ?? ""} onChange={(e) => selectProvider(e.target.value)} style={inputStyle}>
                <option value="">-- 请选择 --</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.providerType})</option>
                ))}
              </select>
            </FormField>
          </div>

          {selectedProviderId && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <h2 style={{ fontSize: "16px", margin: 0 }}>
                  模型配置 ({selectedProvider?.name ?? ""})
                </h2>
                <button onClick={startNewProfile} style={{
                  padding: "6px 16px", background: "#2563eb", color: "white", border: "none",
                  borderRadius: "6px", cursor: "pointer", fontSize: "13px",
                }}>
                  + 新增模型
                </button>
              </div>

              {profiles.length === 0 && (
                <p style={{ fontSize: "13px", color: "#6b7280" }}>暂无模型配置。请点击"新增模型"。</p>
              )}

              {profiles.map((p) => (
                <div key={p.id} style={{
                  border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px",
                  marginBottom: "8px", fontSize: "13px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>{p.displayName}</strong>
                      <span style={{ marginLeft: "8px", fontSize: "11px", color: "#6b7280" }}>
                        ({p.modelId})
                      </span>
                      {p.isDefault && (
                        <span style={{
                          marginLeft: "6px", fontSize: "11px", padding: "1px 6px",
                          borderRadius: "3px", background: "#dbeafe", color: "#1e40af",
                        }}>
                          默认
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {!p.isDefault && (
                        <button onClick={() => handleSetDefault(p.id)} style={smallBtnStyle("#7c3aed")}>
                          设为默认
                        </button>
                      )}
                      <button onClick={() => startEditProfile(p)} style={smallBtnStyle("#2563eb")}>
                        编辑
                      </button>
                      <button onClick={() => handleDeleteProfile(p.id)} style={smallBtnStyle("#dc2626")}>
                        删除
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: "6px", color: "#6b7280", fontSize: "12px" }}>
                    <div>上下文: {p.contextWindow} | 最大输出: {p.maxOutputTokens} | Temperature: {p.temperature}</div>
                    <div>
                      流式: {p.supportsStreaming ? "✅" : "❌"} | 工具: {p.supportsTools ? "✅" : "❌"} |
                      JSON Schema: {p.supportsJsonSchema ? "✅" : "❌"} | 文件: {p.supportsFiles ? "✅" : "❌"}
                    </div>
                    <div>用途: {p.usageType} | 优先级: {p.priority} | {p.enabled ? "已启用" : "已禁用"}</div>
                  </div>
                </div>
              ))}

              {/* Profile Edit Form */}
              {showProfileForm && (
                <div style={{
                  border: "1px solid #d1d5db", borderRadius: "8px", padding: "16px",
                  marginTop: "12px", background: "#f9fafb",
                }}>
                  <h3 style={{ fontSize: "15px", margin: "0 0 12px" }}>
                    {profileFormId ? "编辑模型配置" : "新增模型配置"}
                  </h3>

                  <FormField label="显示名称 *">
                    <input value={pDisplayName} onChange={(e) => setPDisplayName(e.target.value)}
                      placeholder="例如：GPT-4o" style={inputStyle} />
                  </FormField>

                  <FormField label="模型 ID *">
                    <input value={pModelId} onChange={(e) => setPModelId(e.target.value)}
                      placeholder="例如：gpt-4o" style={inputStyle} />
                  </FormField>

                  <FormField label="上下文窗口">
                    <input type="number" value={pContextWindow} onChange={(e) => setPContextWindow(Number(e.target.value))}
                      min={256} max={1000000} style={inputStyle} />
                  </FormField>

                  <FormField label="最大输出 Token">
                    <input type="number" value={pMaxOutputTokens} onChange={(e) => setPMaxOutputTokens(Number(e.target.value))}
                      min={1} max={100000} style={inputStyle} />
                  </FormField>

                  <FormField label="Temperature">
                    <input type="number" value={pTemperature} onChange={(e) => setPTemperature(Number(e.target.value))}
                      min={0} max={2} step={0.1} style={inputStyle} />
                  </FormField>

                  <FormField label="">
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                      <input type="checkbox" checked={pIsDefault} onChange={(e) => setPIsDefault(e.target.checked)} />
                      设为默认对话模型
                    </label>
                  </FormField>

                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button onClick={saveProfile} style={btnStyle("#2563eb")}>保存</button>
                    <button onClick={() => setShowProfileForm(false)} style={btnStyle("#6b7280")}>取消</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: "24px", padding: "12px 16px", background: "#f9fafb",
        border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px", color: "#6b7280",
      }}>
        <p><strong>安全说明：</strong></p>
        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
          <li>所有 API Key、密码和 Secret 均使用 AES-256-GCM 加密后存储，不在数据库中保存明文。</li>
          <li>加密主密钥仅存储在服务器环境变量中，不会发送到浏览器。</li>
          <li>连接测试会产生一次真实模型请求（约 8 Token），不保存原始 Prompt 和 Response。</li>
          <li>Base URL 受 SSRF 保护，仅允许 HTTPS 连接（开发模式可选 HTTP）。</li>
        </ul>
      </div>
    </section>
  );
}

export default ModelConfigPanel;

// --- Helper Components ---

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", background: "none", border: "none",
      borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
      color: active ? "#2563eb" : "#6b7280", cursor: "pointer",
      fontSize: "14px", fontWeight: active ? 600 : 400,
      marginBottom: "-1px",
    }}>
      {children}
    </button>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      {label && <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#374151", marginBottom: "4px" }}>{label}</label>}
      {children}
    </div>
  );
}

// --- Style helpers ---

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px", fontSize: "13px",
  border: "1px solid #d1d5db", borderRadius: "6px",
  boxSizing: "border-box",
};

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "6px 16px", background: color, color: "white",
    border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px",
  };
}

function smallBtnStyle(color: string): React.CSSProperties {
  return {
    padding: "3px 10px", background: color, color: "white",
    border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px",
  };
}
