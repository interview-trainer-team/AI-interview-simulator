import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  updateFullNameRequest,
  changePasswordRequest,
  deleteAccountRequest,
  validateFullName,
  validatePasswordChange,
} from "@/api/profile";

const inputClass =
  "h-12 rounded-lg border-[#2E322E] bg-[#222522] px-4 text-sm text-white placeholder:text-gray-500 focus-visible:border-[#D2FF52] focus-visible:ring-[#D2FF52]/40";

function ArrowIcon() {
  return (
    <svg width="18" height="12" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 7h17M12 1l6 6-6 6" />
    </svg>
  );
}

function UserIcon({ className = "" }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function EditableField({ id, label, value, placeholder, buttonLabel, validate, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleStart = () => {
    setError("");
    setSuccess("");
    setDraft(value);
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft(value);
    setError("");
    setEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (draft.trim() === value) {
      setEditing(false);
      return;
    }
    const message = validate(draft);
    if (message) {
      setError(message);
      setSuccess("");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await onSave(draft.trim());
      setEditing(false);
      setSuccess("Изменения сохранены");
    } catch (err) {
      setError(err.details?.fields ? Object.values(err.details.fields)[0] : err.message || "Не удалось сохранить");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-white">
        {label}
      </Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          id={id}
          value={draft}
          placeholder={placeholder}
          readOnly={!editing}
          onChange={(e) => setDraft(e.target.value)}
          className={`${inputClass} ${!editing ? "cursor-default" : ""}`}
        />
        {editing ? (
          <div className="flex shrink-0 gap-2">
            <Button
              type="submit"
              disabled={isSaving}
              className="h-12 rounded-lg bg-[#D2FF52] px-4 text-sm font-semibold text-black hover:bg-[#bce646]"
            >
              {isSaving ? "Сохраняем..." : "Сохранить"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              className="h-12 rounded-lg border-[#2E322E] bg-transparent px-4 text-sm text-white hover:bg-[#262A26]"
            >
              Отмена
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={handleStart}
            className="h-12 shrink-0 rounded-lg border-[#2E322E] bg-transparent px-4 text-sm text-gray-200 hover:bg-[#262A26] hover:text-white"
          >
            {buttonLabel}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && !editing && <p className="text-sm text-[#D2FF52]">{success}</p>}
    </form>
  );
}

function PasswordForm({ onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = validatePasswordChange({ currentPassword, newPassword, repeatPassword });
    if (result.message) {
      setFieldErrors(result.field ? { [result.field]: result.message } : {});
      setError("");
      return;
    }

    setIsSaving(true);
    setFieldErrors({});
    setError("");
    try {
      const data = await changePasswordRequest({ currentPassword, newPassword });
      onSuccess(data.accessToken);
    } catch (err) {
      if (err.details?.fields) {
        setFieldErrors(err.details.fields);
      } else {
        setError(err.message || "Не удалось изменить пароль");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-[#2E322E] pt-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword" className="text-sm font-semibold text-white">
          Текущий пароль
        </Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
        />
        {fieldErrors.currentPassword && <p className="text-sm text-red-500">{fieldErrors.currentPassword}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword" className="text-sm font-semibold text-white">
          Новый пароль
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        {fieldErrors.newPassword && <p className="text-sm text-red-500">{fieldErrors.newPassword}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="repeatPassword" className="text-sm font-semibold text-white">
          Повтор нового пароля
        </Label>
        <Input
          id="repeatPassword"
          type="password"
          autoComplete="new-password"
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
          className={inputClass}
        />
        {fieldErrors.repeatPassword && <p className="text-sm text-red-500">{fieldErrors.repeatPassword}</p>}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          disabled={isSaving}
          className="h-12 rounded-lg bg-[#D2FF52] px-4 text-sm font-semibold text-black hover:bg-[#bce646]"
        >
          {isSaving ? "Сохраняем..." : "Сохранить"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSaving}
          className="h-12 rounded-lg border-[#2E322E] bg-transparent px-4 text-sm text-white hover:bg-[#262A26]"
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}

function DeleteAccountModal({ onClose, onConfirm }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!password) {
      setError("Укажи пароль");
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      await deleteAccountRequest({ password });
      onConfirm();
    } catch (err) {
      setError(err.message || "Не удалось удалить аккаунт");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2E322E] bg-[#1F221F] p-6">
        <h3 className="text-lg font-semibold">Удалить аккаунт</h3>
        <p className="mt-3 text-sm text-gray-300">
          Вы удалите аккаунт, историю интервью, ответы и результаты. Восстановить эти данные будет нельзя.
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="deletePassword" className="text-sm font-semibold text-white">
            Пароль для подтверждения
          </Label>
          <Input
            id="deletePassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="h-12 rounded-lg border-[#2E322E] bg-transparent px-4 text-sm text-white hover:bg-[#262A26]"
          >
            Отмена
          </Button>
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-12 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
          >
            {isDeleting ? "Удаляем..." : "Удалить аккаунт"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { user, logout, updateUser, updateToken } = useAuth() || {};

  const [fullName, setFullName] = useState(() => user?.fullName || "");
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const email = user?.email || "";
  const createdAt = formatDate(user?.createdAt);

  const handleSaveFullName = async (value) => {
    const data = await updateFullNameRequest({ fullName: value });
    setFullName(data.fullName || value);
    updateUser(data);
  };

  const handlePasswordSuccess = (newToken) => {
    if (newToken) updateToken(newToken);
    setIsPasswordOpen(false);
    setPasswordSuccess("Пароль изменён");
  };

  const handleDeleteConfirm = () => {
    setIsDeleteOpen(false);
    logout();
  };

  return (
    <div className="mx-auto max-w-[960px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D2FF52]">Личный кабинет</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">Мой профиль</h1>
      <p className="mt-3 text-sm text-gray-400">Управляй данными аккаунта и возвращайся к подготовке.</p>

      <section className="mt-8 rounded-2xl border border-[#2E322E] bg-[#1F221F] p-5 md:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-[#2E322E] bg-[#262A26] text-gray-300 md:size-[72px]">
              <UserIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Твой аккаунт для тренировочных собеседований
              </p>
              <h2 className="mt-2 truncate text-2xl font-bold tracking-tight">{fullName || "Пользователь"}</h2>
              {email && <p className="mt-1 truncate text-sm text-gray-400">{email}</p>}
              {createdAt && <p className="mt-1 text-xs text-gray-500">Зарегистрирован {createdAt}</p>}
              <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#3A4A1E] bg-[#222A18] px-2.5 py-0.5 text-[11px] font-medium text-[#D2FF52]">
                <span className="size-1.5 rounded-full bg-[#D2FF52]" aria-hidden="true" />
                Аккаунт активен
              </span>
            </div>
          </div>

          <div className="hidden self-stretch w-px bg-[#2E322E] lg:block" aria-hidden="true" />

          <div className="border-t border-[#2E322E] pt-4 lg:border-t-0 lg:pt-0 lg:pl-2 lg:min-w-[240px]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Готов продолжить?</p>
            <p className="mt-2 text-lg font-semibold">Следующая тренировка</p>
            <Button
              asChild
              className="mt-4 h-12 gap-3 rounded-lg bg-[#D2FF52] px-6 text-sm font-semibold text-black hover:bg-[#bce646]"
            >
              <Link to="/interview/setup">
                Начать интервью
                <ArrowIcon />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Данные аккаунта</h2>
        <p className="mt-1 text-sm text-gray-400">Основная информация, связанная с твоей учётной записью.</p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px] lg:items-start">
          <div className="space-y-8 rounded-2xl border border-[#2E322E] bg-[#1F221F] p-5 md:p-6">
            <EditableField
              id="fullName"
              label="Фамилия Имя Отчество"
              value={fullName}
              placeholder="Фамилия Имя Отчество"
              buttonLabel="Изменить ФИО"
              validate={validateFullName}
              onSave={handleSaveFullName}
            />

            <div>
              <p className="text-sm font-semibold text-white">Email</p>
              <p className="mt-2 text-sm text-gray-400">{email}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">Пароль</p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-400">Пароль используется для безопасного входа.</p>
                {!isPasswordOpen && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPasswordSuccess("");
                      setIsPasswordOpen(true);
                    }}
                    className="h-12 shrink-0 rounded-lg border-[#2E322E] bg-transparent px-4 text-sm text-gray-200 hover:bg-[#262A26] hover:text-white"
                  >
                    Изменить пароль
                  </Button>
                )}
              </div>
              {passwordSuccess && !isPasswordOpen && <p className="mt-2 text-sm text-[#D2FF52]">{passwordSuccess}</p>}
              {isPasswordOpen && (
                <PasswordForm
                  onClose={() => setIsPasswordOpen(false)}
                  onSuccess={handlePasswordSuccess}
                />
              )}
            </div>

            <div className="border-t border-[#2E322E] pt-6">
              <p className="text-sm font-semibold text-white">Удаление аккаунта</p>
              <p className="mt-2 text-sm text-gray-400">Это действие нельзя отменить.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOpen(true)}
                className="mt-3 h-12 rounded-lg border-red-900 bg-transparent px-4 text-sm text-red-400 hover:bg-red-950/40"
              >
                Удалить аккаунт
              </Button>
            </div>
          </div>

          <aside className="rounded-2xl border border-[#2E322E] bg-[#1F221F] p-5 md:p-6">
            <div className="flex items-start gap-3">
              <span className="text-[#D2FF52]">
                <ShieldIcon />
              </span>
              <div>
                <h3 className="text-base font-semibold">Безопасность</h3>
                <p className="mt-1 text-sm text-gray-400">Защита аккаунта</p>
              </div>
            </div>
            <div className="mt-4 border-t border-[#2E322E] pt-4">
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#D2FF52]" aria-hidden="true" />
                  Вход по email и паролю
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#D2FF52]" aria-hidden="true" />
                  Доступ только к твоим данным
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#D2FF52]" aria-hidden="true" />
                  Можно выйти в любой момент
                </li>
              </ul>
              <Button
                type="button"
                variant="outline"
                onClick={logout}
                className="mt-6 h-12 w-full rounded-lg border-[#2E322E] bg-transparent text-sm text-white hover:bg-[#262A26]"
              >
                Выйти
              </Button>
              <Button
                asChild
                variant="outline"
                className="mt-2 h-12 w-full rounded-lg border-[#2E322E] bg-transparent text-sm text-white hover:bg-[#262A26]"
              >
                <Link to="/history">История интервью</Link>
              </Button>
            </div>
          </aside>
        </div>
      </section>

      {isDeleteOpen && (
        <DeleteAccountModal
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}

export default ProfilePage;
