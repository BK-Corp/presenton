"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notify } from "@/components/ui/sonner";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { formatFastApiDetail } from "@/utils/authErrors";
import { copyTextToClipboard } from "@/utils/clipboard";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { useT } from "@/lib/i18n";

type AdminUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at?: string | null;
};

type ApiKey = {
  id: string;
  user_id: string;
  created_by_id: string;
  label: string;
  created_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type ApiKeyCreated = ApiKey & { token: string };

type AdminDialog =
  | { kind: "reset-password"; user: AdminUser }
  | { kind: "delete-user"; user: AdminUser }
  | { kind: "revoke-key"; apiKey: ApiKey }
  | null;

type AdminPanelProps = {
  embedded?: boolean;
};

async function errorDetail(response: Response, requestFailedMessage: string): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.detail === undefined
    ? requestFailedMessage
    : formatFastApiDetail(payload.detail);
}

const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7C51F8] px-5 text-xs font-semibold text-white transition hover:bg-[#6D46E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const inputClass =
  "h-11 w-full rounded-lg border border-[#E1E1E5] bg-white px-4 text-sm text-[#101323] outline-none transition placeholder:text-[#98A2B3] focus:border-[#7A5AF8] focus:ring-2 focus:ring-[#7A5AF8]/15";

export default function AdminPanel({ embedded = false }: AdminPanelProps) {
  const t = useT();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyTokens, setApiKeyTokens] = useState<Record<string, string>>({});
  const [visibleApiKeys, setVisibleApiKeys] = useState<Set<string>>(() => new Set());
  const [apiKeyUserId, setApiKeyUserId] = useState("");
  const [apiKeyLabel, setApiKeyLabel] = useState("API client");
  const [apiKeyExpiryDays, setApiKeyExpiryDays] = useState(90);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AdminDialog>(null);

  const loadUsers = useCallback(async (
    trigger: "initial" | "manual" | "user_created" | "user_deleted" = "initial"
  ) => {
    setBusy("users");
    try {
      const response = await fetch("/api/v1/admin/users", {
        cache: "no-store",
        credentials: "include",
      });
      if (response.ok) {
        const loadedUsers = (await response.json()) as AdminUser[];
        setUsers(loadedUsers);
        setApiKeyUserId((current) =>
          current && loadedUsers.some((user) => user.id === current)
            ? current
            : loadedUsers.find((user) => user.role === "admin")?.id ?? loadedUsers[0]?.id ?? ""
        );
        trackEvent(MixpanelEvent.Auth_Admin_User_List_Loaded, {
          trigger,
          user_count: loadedUsers.length,
        });
      } else {
        const detail = await errorDetail(response, t("dashboard.admin.requestFailed", { status: response.status }));
        trackEvent(MixpanelEvent.Auth_Admin_User_List_Failed, {
          trigger,
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("dashboard.admin.loadUsersFailed"), detail);
      }
    } catch (loadError) {
      trackEvent(MixpanelEvent.Auth_Admin_User_List_Failed, {
        trigger,
        status_code: null,
        error_message: sanitizeAnalyticsError(
          loadError,
          "Could not load users"
        ),
      });
      notify.error(t("dashboard.admin.loadUsersFailed"), t("dashboard.admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  }, [t]);

  const loadApiKeys = useCallback(async () => {
    setBusy("api-keys");
    try {
      const response = await fetch("/api/v1/admin/api-keys", {
        cache: "no-store",
        credentials: "include",
      });
      if (response.ok) {
        const loaded = (await response.json()) as ApiKey[];
        const active = loaded.filter((apiKey) => !apiKey.revoked_at);
        setApiKeys(active);
        trackEvent(MixpanelEvent.Auth_Admin_API_Key_List_Loaded, {
          api_key_count: active.length,
        });
      } else {
        notify.error(t("dashboard.admin.loadKeysFailed"), await errorDetail(response, t("dashboard.admin.requestFailed", { status: response.status })));
      }
    } catch {
      notify.error(t("dashboard.admin.loadKeysFailed"), t("dashboard.admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  }, [t]);

  useEffect(() => {
    trackEvent(MixpanelEvent.Auth_Admin_Viewed, {
      embedded,
    });
    void Promise.all([loadUsers(), loadApiKeys()]);
  }, [embedded, loadApiKeys, loadUsers]);

  const addUser = async (event: FormEvent) => {
    event.preventDefault();
    const cleanedUsername = username.trim();
    setBusy("add");
    trackEvent(MixpanelEvent.Auth_Admin_User_Create_Started, {
      username_length: cleanedUsername.length,
      user_count_before: users.length,
    });
    try {
      const response = await fetch("/api/v1/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanedUsername, password }),
      });
      if (response.ok) {
        trackEvent(MixpanelEvent.Auth_Admin_User_Create_Completed, {
          username_length: cleanedUsername.length,
          user_count_after: users.length + 1,
        });
        notify.success(t("dashboard.admin.userCreated"), t("dashboard.admin.userCreatedMessage", { username: cleanedUsername }));
        setUsername("");
        setPassword("");
        await loadUsers("user_created");
      } else {
        const detail = await errorDetail(response, t("dashboard.admin.requestFailed", { status: response.status }));
        trackEvent(MixpanelEvent.Auth_Admin_User_Create_Failed, {
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("dashboard.admin.createUserFailed"), detail);
      }
    } catch (createError) {
      trackEvent(MixpanelEvent.Auth_Admin_User_Create_Failed, {
        status_code: null,
        error_message: sanitizeAnalyticsError(
          createError,
          "Could not create user"
        ),
      });
      notify.error(t("dashboard.admin.createUserFailed"), t("dashboard.admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const openResetPassword = (user: AdminUser) => {
    setResetPasswordValue("");
    setDialog({ kind: "reset-password", user });
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (dialog?.kind !== "reset-password") return;

    const { user } = dialog;
    setBusy(`reset:${user.id}`);
    trackEvent(MixpanelEvent.Auth_Admin_User_Password_Reset_Started, {
      target_role: user.role,
    });
    try {
      const response = await fetch(`/api/v1/admin/users/${user.id}/password`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      if (response.ok) {
        trackEvent(MixpanelEvent.Auth_Admin_User_Password_Reset_Completed, {
          target_role: user.role,
          sessions_invalidated: true,
        });
        notify.success(t("dashboard.admin.passwordReset"), t("dashboard.admin.passwordResetMessage"));
        setDialog(null);
        setResetPasswordValue("");
      } else {
        const detail = await errorDetail(response, t("dashboard.admin.requestFailed", { status: response.status }));
        trackEvent(MixpanelEvent.Auth_Admin_User_Password_Reset_Failed, {
          target_role: user.role,
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("dashboard.admin.resetPasswordFailed"), detail);
      }
    } catch (resetError) {
      trackEvent(MixpanelEvent.Auth_Admin_User_Password_Reset_Failed, {
        target_role: user.role,
        status_code: null,
        error_message: sanitizeAnalyticsError(
          resetError,
          "Could not reset password"
        ),
      });
      notify.error(t("dashboard.admin.resetPasswordFailed"), t("dashboard.admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const deleteUser = async () => {
    if (dialog?.kind !== "delete-user") return;

    const { user } = dialog;
    setBusy(`delete:${user.id}`);
    trackEvent(MixpanelEvent.Auth_Admin_User_Delete_Started, {
      target_role: user.role,
      user_count_before: users.length,
    });
    try {
      const response = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        trackEvent(MixpanelEvent.Auth_Admin_User_Delete_Completed, {
          target_role: user.role,
          user_count_after: Math.max(0, users.length - 1),
        });
        notify.success(t("dashboard.admin.userDeleted"), t("dashboard.admin.userDeletedMessage", { username: user.username }));
        setDialog(null);
        await loadUsers("user_deleted");
      } else {
        const detail = await errorDetail(response, t("dashboard.admin.requestFailed", { status: response.status }));
        trackEvent(MixpanelEvent.Auth_Admin_User_Delete_Failed, {
          target_role: user.role,
          status_code: response.status,
          error_message: sanitizeAnalyticsError(detail),
        });
        notify.error(t("dashboard.admin.deleteUserFailed"), detail);
      }
    } catch (deleteError) {
      trackEvent(MixpanelEvent.Auth_Admin_User_Delete_Failed, {
        target_role: user.role,
        status_code: null,
        error_message: sanitizeAnalyticsError(
          deleteError,
          "Could not delete user"
        ),
      });
      notify.error(t("dashboard.admin.deleteUserFailed"), t("dashboard.admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const createApiKey = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("create-api-key");
    trackEvent(MixpanelEvent.Auth_Admin_API_Key_Create_Started, {
      api_key_count_before: apiKeys.length,
    });
    try {
      const response = await fetch("/api/v1/admin/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: apiKeyUserId,
          label: apiKeyLabel.trim(),
          expiry_days: apiKeyExpiryDays,
        }),
      });
      if (!response.ok) {
        notify.error(t("dashboard.admin.createKeyFailed"), await errorDetail(response, t("dashboard.admin.requestFailed", { status: response.status })));
        return;
      }
      const created = (await response.json()) as ApiKeyCreated;
      const { token, ...apiKey } = created;
      setApiKeys((current) => [apiKey, ...current]);
      setApiKeyTokens((current) => ({ ...current, [apiKey.id]: token }));
      setVisibleApiKeys((current) => new Set(current).add(apiKey.id));
      trackEvent(MixpanelEvent.Auth_Admin_API_Key_Create_Completed, {
        api_key_count_after: apiKeys.length + 1,
      });
      try {
        await copyTextToClipboard(token);
        notify.success(t("dashboard.admin.keyCreated"), t("dashboard.admin.keyCreatedCopied"));
      } catch {
        notify.success(t("dashboard.admin.keyCreated"), t("dashboard.admin.keyCreatedVisible"));
      }
    } catch {
      notify.error(t("dashboard.admin.createKeyFailed"), t("dashboard.admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const getApiKeyToken = async (apiKeyId: string) => {
    const cached = apiKeyTokens[apiKeyId];
    if (cached) return cached;
    const response = await fetch(
      `/api/v1/admin/api-keys/${apiKeyId}/token`,
      { cache: "no-store", credentials: "include" }
    );
    if (!response.ok) throw new Error(await errorDetail(response, t("dashboard.admin.requestFailed", { status: response.status })));
    const payload = (await response.json()) as { token: string };
    setApiKeyTokens((current) => ({ ...current, [apiKeyId]: payload.token }));
    return payload.token;
  };

  const toggleApiKeyVisibility = async (apiKeyId: string) => {
    if (visibleApiKeys.has(apiKeyId)) {
      setVisibleApiKeys((current) => {
        const next = new Set(current);
        next.delete(apiKeyId);
        return next;
      });
      return;
    }
    setBusy(`reveal-api-key:${apiKeyId}`);
    try {
      await getApiKeyToken(apiKeyId);
      setVisibleApiKeys((current) => new Set(current).add(apiKeyId));
    } catch (revealError) {
      notify.error(
        t("dashboard.admin.revealKeyFailed"),
        revealError instanceof Error ? revealError.message : t("dashboard.admin.tryAgain")
      );
    } finally {
      setBusy(null);
    }
  };

  const copyApiKey = async (apiKeyId: string) => {
    setBusy(`reveal-api-key:${apiKeyId}`);
    try {
      await copyTextToClipboard(await getApiKeyToken(apiKeyId));
      notify.success(t("dashboard.admin.keyCopied"));
    } catch (copyError) {
      notify.error(
        t("dashboard.admin.copyKeyFailed"),
        copyError instanceof Error ? copyError.message : t("dashboard.admin.tryAgain")
      );
    } finally {
      setBusy(null);
    }
  };

  const revokeApiKey = async () => {
    if (dialog?.kind !== "revoke-key") return;
    const { apiKey } = dialog;
    setBusy(`revoke-api-key:${apiKey.id}`);
    trackEvent(MixpanelEvent.Auth_Admin_API_Key_Revoke_Started, {
      api_key_count_before: apiKeys.length,
    });
    try {
      const response = await fetch(
        `/api/v1/admin/api-keys/${apiKey.id}/revoke`,
        { method: "POST", credentials: "include" }
      );
      if (!response.ok) {
        notify.error(t("dashboard.admin.revokeKeyFailed"), await errorDetail(response, t("dashboard.admin.requestFailed", { status: response.status })));
        return;
      }
      const revoked = (await response.json()) as ApiKey;
      setApiKeys((current) =>
        current.filter((item) => item.id !== revoked.id)
      );
      setApiKeyTokens((current) => {
        const next = { ...current };
        delete next[apiKey.id];
        return next;
      });
      setVisibleApiKeys((current) => {
        const next = new Set(current);
        next.delete(apiKey.id);
        return next;
      });
      trackEvent(MixpanelEvent.Auth_Admin_API_Key_Revoke_Completed, {
        api_key_count_after: Math.max(0, apiKeys.length - 1),
      });
      setDialog(null);
      notify.success(t("dashboard.admin.keyRevoked"));
    } catch {
      notify.error(t("dashboard.admin.revokeKeyFailed"), t("dashboard.admin.tryAgain"));
    } finally {
      setBusy(null);
    }
  };

  const dialogBusy =
    (dialog?.kind === "reset-password" && busy === `reset:${dialog.user.id}`) ||
    (dialog?.kind === "delete-user" && busy === `delete:${dialog.user.id}`) ||
    (dialog?.kind === "revoke-key" && busy === `revoke-api-key:${dialog.apiKey.id}`);
  const RootElement = embedded ? "section" : "main";

  return (
    <RootElement
      className={
        embedded
          ? "h-[calc(100vh-104px)] overflow-y-auto pb-28 pr-6 font-syne"
          : "min-h-screen bg-white px-8 py-10 font-syne"
      }
    >
      <div className={embedded ? "max-w-5xl" : "mx-auto max-w-5xl"}>
        {!embedded ? (
          <h1 className="font-syne font-medium text-[28px] tracking-[-0.84px] text-black">
            {t("dashboard.admin.title")}
          </h1>
        ) : null}

        <div
          className={`rounded-[12px] bg-[#F9F8F8] p-7 ${
            embedded ? "" : "mt-7"
          }`}
        >
          <h2 className="text-sm font-semibold text-[#191919]">
            {t("dashboard.admin.manageAccess")}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#6B7280]">
            {t("dashboard.admin.manageDescription")}
          </p>

          <Tabs defaultValue="users" className="mt-6">
          <TabsList className="h-11 rounded-full border border-[#EDEEEF] bg-[#F9FAFB] p-1">
            <TabsTrigger
              value="users"
              className="h-9 rounded-full px-5 text-xs text-[#667085] shadow-none data-[state=active]:bg-white data-[state=active]:text-[#5146E5] data-[state=active]:shadow-sm"
            >
              {t("dashboard.admin.tabsUsers")}
            </TabsTrigger>
            <TabsTrigger
              value="keys"
              className="h-9 rounded-full px-5 text-xs text-[#667085] shadow-none data-[state=active]:bg-white data-[state=active]:text-[#5146E5] data-[state=active]:shadow-sm"
            >
              {t("dashboard.admin.tabsKeys")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6 space-y-5">
            <section className="rounded-[12px] border border-[#EDEEEF] bg-white p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F3FF]">
                  <UserPlus className="h-4 w-4 text-[#5146E5]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#101323]">{t("dashboard.admin.addUser")}</h2>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {t("dashboard.admin.addUserHint")}
                  </p>
                </div>
              </div>
              <form onSubmit={addUser} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  aria-label={t("dashboard.admin.usernamePlaceholder")}
                  className={inputClass}
                  placeholder={t("dashboard.admin.usernamePlaceholder")}
                  minLength={3}
                  maxLength={128}
                  pattern="\S+"
                  title={t("dashboard.admin.usernameNoSpaces")}
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value.replace(/\s/g, ""))
                  }
                  required
                  spellCheck={false}
                />
                <input
                  aria-label={t("dashboard.admin.passwordLabel")}
                  className={inputClass}
                  type="password"
                  placeholder={t("dashboard.admin.passwordPlaceholder")}
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button type="submit" className={primaryButtonClass} disabled={busy === "add"}>
                  {busy === "add" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("dashboard.admin.createUser")}
                </button>
              </form>
            </section>

            <section className="overflow-hidden rounded-[12px] border border-[#EDEEEF] bg-white">
              <div className="flex items-center justify-between border-b border-[#EDEEEF] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F3FF]">
                    <Users className="h-4 w-4 text-[#5146E5]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#101323]">{t("dashboard.admin.accounts")}</h2>
                    <p className="mt-0.5 text-xs text-[#667085]">
                      {t(users.length === 1 ? "dashboard.admin.accountsCountOne" : "dashboard.admin.accountsCountMany", { count: users.length })}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={t("dashboard.admin.refreshAccounts")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EDEEEF] text-[#667085] transition hover:bg-[#F9FAFB] hover:text-[#5146E5]"
                  onClick={() => void loadUsers("manual")}
                >
                  <RefreshCw className={`h-4 w-4 ${busy === "users" ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="divide-y divide-[#EDEEEF]">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#101323]">{user.username}</p>
                      <p className="mt-1 text-xs text-[#667085]">
                        {user.role === "admin" ? t("dashboard.admin.administrator") : t("dashboard.admin.userRole")}
                        {user.created_at
                          ? ` · ${new Date(user.created_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    {user.role === "user" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="h-9 rounded-full border border-[#EDEEEF] bg-white px-4 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
                          onClick={() => openResetPassword(user)}
                          disabled={busy !== null}
                        >
                          {t("dashboard.admin.resetPassword")}
                        </button>
                        <button
                          type="button"
                          aria-label={t("dashboard.admin.deleteUserAria", { username: user.username })}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#FEE4E2] bg-white text-[#D92D20] transition hover:bg-[#FEF3F2]"
                          onClick={() => setDialog({ kind: "delete-user", user })}
                          disabled={busy !== null}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="keys" className="mt-6 space-y-5">
            <section className="rounded-[12px] border border-[#EDEEEF] bg-white p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F3FF]">
                  <KeyRound className="h-4 w-4 text-[#5146E5]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#101323]">{t("dashboard.admin.generateKey")}</h2>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {t("dashboard.admin.generateKeyHint")}
                  </p>
                </div>
              </div>
              <form
                onSubmit={createApiKey}
                className="grid gap-3 lg:grid-cols-[1fr_1fr_150px_auto]"
              >
                <select
                  aria-label={t("dashboard.admin.apiKeyUserAria")}
                  className={inputClass}
                  value={apiKeyUserId}
                  onChange={(event) => setApiKeyUserId(event.target.value)}
                  required
                >
                  <option value="" disabled>{t("dashboard.admin.selectUser")}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.role === "admin" ? t("dashboard.admin.administrator") : t("dashboard.admin.userRole")})
                    </option>
                  ))}
                </select>
                <input
                  aria-label={t("dashboard.admin.apiKeyLabelAria")}
                  className={inputClass}
                  value={apiKeyLabel}
                  onChange={(event) => setApiKeyLabel(event.target.value)}
                  minLength={1}
                  maxLength={120}
                  placeholder={t("dashboard.admin.clientNamePlaceholder")}
                  required
                />
                <select
                  aria-label={t("dashboard.admin.apiKeyExpiryAria")}
                  className={inputClass}
                  value={apiKeyExpiryDays}
                  onChange={(event) => setApiKeyExpiryDays(Number(event.target.value))}
                  required
                >
                  <option value={30}>{t("dashboard.admin.expiryDays", { count: 30 })}</option>
                  <option value={90}>{t("dashboard.admin.expiryDays", { count: 90 })}</option>
                  <option value={180}>{t("dashboard.admin.expiryDays", { count: 180 })}</option>
                  <option value={365}>{t("dashboard.admin.expiryDays", { count: 365 })}</option>
                </select>
                <button
                  type="submit"
                  className={primaryButtonClass}
                  disabled={busy === "create-api-key" || !apiKeyUserId}
                >
                  {busy === "create-api-key" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("dashboard.admin.generateKeyButton")}
                </button>
              </form>
            </section>

            <section className="overflow-hidden rounded-[12px] border border-[#EDEEEF] bg-white">
              <div className="flex items-center justify-between border-b border-[#EDEEEF] px-6 py-5">
                <div>
                  <h2 className="text-sm font-semibold text-[#101323]">{t("dashboard.admin.apiKeysTitle")}</h2>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    {t("dashboard.admin.apiKeysHint")}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("dashboard.admin.refreshKeys")}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EDEEEF] text-[#667085] transition hover:bg-[#F9FAFB] hover:text-[#5146E5]"
                  onClick={() => void loadApiKeys()}
                >
                  <RefreshCw className={`h-4 w-4 ${busy === "api-keys" ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="divide-y divide-[#EDEEEF]">
                {apiKeys.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <KeyRound className="mx-auto h-6 w-6 text-[#B8B4C7]" />
                    <p className="mt-3 text-sm text-[#667085]">{t("dashboard.admin.noKeys")}</p>
                  </div>
                )}
                {apiKeys.map((apiKey) => {
                  const isVisible = visibleApiKeys.has(apiKey.id);
                  const token = apiKeyTokens[apiKey.id];
                  const user = users.find((item) => item.id === apiKey.user_id);
                  const isRevoked = Boolean(apiKey.revoked_at);
                  return (
                    <div key={apiKey.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                      <div className="min-w-[260px] flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#101323]">{apiKey.label}</p>
                          {isRevoked && (
                            <span className="rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[10px] font-semibold text-[#D92D20]">
                              {t("dashboard.admin.revoked")}
                            </span>
                          )}
                        </div>
                        <code className="mt-1 block truncate text-xs text-[#344054]">
                          {isVisible && token ? token : `sk-presenton-••••••••${apiKey.id.slice(-4)}`}
                        </code>
                        <p className="mt-1 text-[11px] text-[#98A2B3]">
                          {user?.username ?? apiKey.user_id} · {t("dashboard.admin.expiresOn", { date: new Date(apiKey.expires_at).toLocaleDateString() })}
                          {apiKey.last_used_at
                            ? ` · ${t("dashboard.admin.lastUsed", { date: new Date(apiKey.last_used_at).toLocaleDateString() })}`
                            : ` · ${t("dashboard.admin.neverUsed")}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={isVisible ? t("dashboard.admin.hideKey") : t("dashboard.admin.showKey")}
                        title={isVisible ? t("dashboard.admin.hideKey") : t("dashboard.admin.showKey")}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EDEEEF] text-[#667085] transition hover:bg-[#F4F3FF] hover:text-[#5146E5] disabled:opacity-50"
                        onClick={() => void toggleApiKeyVisibility(apiKey.id)}
                        disabled={busy === `reveal-api-key:${apiKey.id}`}
                      >
                        {busy === `reveal-api-key:${apiKey.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label={t("dashboard.admin.copyKey")}
                        title={t("dashboard.admin.copyKey")}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EDEEEF] text-[#667085] transition hover:bg-[#F4F3FF] hover:text-[#5146E5] disabled:opacity-50"
                        onClick={() => void copyApiKey(apiKey.id)}
                        disabled={busy === `reveal-api-key:${apiKey.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {!isRevoked && (
                        <button
                          type="button"
                          aria-label={t("dashboard.admin.revokeKeyAria")}
                          title={t("dashboard.admin.revokeKeyAria")}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#FEE4E2] text-[#D92D20] transition hover:bg-[#FEF3F2]"
                          onClick={() => setDialog({ kind: "revoke-key", apiKey })}
                          disabled={busy !== null}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !dialogBusy) {
            setDialog(null);
            setResetPasswordValue("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-32px)] max-w-[440px] gap-0 rounded-[24px] border-0 bg-white p-0 font-syne shadow-[0_24px_80px_rgba(15,23,42,0.18)] [&>button]:hidden">
          {dialog?.kind === "reset-password" && (
            <form onSubmit={resetPassword}>
              <DialogHeader className="px-7 pb-5 pt-7 text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F3FF]">
                  <LockKeyhole className="h-5 w-5 text-[#5146E5]" />
                </div>
                <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
                  {t("dashboard.admin.resetPasswordTitle")}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
                  {t("dashboard.admin.resetPasswordDesc", { username: dialog.user.username })}
                </DialogDescription>
                <label className="pt-4 text-xs font-semibold text-[#344054]" htmlFor="reset-password">
                  {t("dashboard.admin.newPassword")}
                </label>
                <input
                  id="reset-password"
                  autoFocus
                  className={inputClass}
                  type="password"
                  placeholder={t("dashboard.admin.minPassword")}
                  minLength={8}
                  maxLength={128}
                  value={resetPasswordValue}
                  onChange={(event) => setResetPasswordValue(event.target.value)}
                  required
                />
              </DialogHeader>
              <DialogFooter className="flex-row border-t border-[#EAECF0] p-4 sm:justify-end sm:space-x-0">
                <button
                  type="button"
                  className="h-10 rounded-full border border-[#E1E1E5] px-5 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
                  onClick={() => setDialog(null)}
                  disabled={dialogBusy}
                >
                  {t("dashboard.admin.cancel")}
                </button>
                <button type="submit" className={primaryButtonClass} disabled={dialogBusy}>
                  {dialogBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("dashboard.admin.resetPassword")}
                </button>
              </DialogFooter>
            </form>
          )}

          {dialog?.kind === "delete-user" && (
            <>
              <DialogHeader className="px-7 pb-6 pt-7 text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3F2]">
                  <AlertTriangle className="h-5 w-5 text-[#D92D20]" />
                </div>
                <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
                  {t("dashboard.admin.deleteUserTitle", { username: dialog.user.username })}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
                  {t("dashboard.admin.deleteUserDesc")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row border-t border-[#EAECF0] p-4 sm:justify-end sm:space-x-0">
                <button
                  type="button"
                  className="h-10 rounded-full border border-[#E1E1E5] px-5 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
                  onClick={() => setDialog(null)}
                  disabled={dialogBusy}
                >
                  {t("dashboard.admin.cancel")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#D92D20] px-5 text-xs font-semibold text-white transition hover:bg-[#B42318] disabled:opacity-60"
                  onClick={() => void deleteUser()}
                  disabled={dialogBusy}
                >
                  {dialogBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t("dashboard.admin.deleteUserButton")}
                </button>
              </DialogFooter>
            </>
          )}

          {dialog?.kind === "revoke-key" && (
            <>
              <DialogHeader className="px-7 pb-6 pt-7 text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3F2]">
                  <AlertTriangle className="h-5 w-5 text-[#D92D20]" />
                </div>
                <DialogTitle className="text-xl font-semibold leading-7 text-[#101323]">
                  {t("dashboard.admin.revokeKeyTitle")}
                </DialogTitle>
                <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">
                  {t("dashboard.admin.revokeKeyDesc", { label: dialog.apiKey.label })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row border-t border-[#EAECF0] p-4 sm:justify-end sm:space-x-0">
                <button
                  type="button"
                  className="h-10 rounded-full border border-[#E1E1E5] px-5 text-xs font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
                  onClick={() => setDialog(null)}
                  disabled={dialogBusy}
                >
                  {t("dashboard.admin.cancel")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#D92D20] px-5 text-xs font-semibold text-white transition hover:bg-[#B42318] disabled:opacity-60"
                  onClick={() => void revokeApiKey()}
                  disabled={dialogBusy}
                >
                  {dialogBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {t("dashboard.admin.revokeKeyButton")}
                </button>
              </DialogFooter>
            </>
          )}

        </DialogContent>
      </Dialog>
    </RootElement>
  );
}
