import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useOutletContext } from "react-router";
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { apiFetch } from "../../services/apiFetch";
import type { ManageTempleOutletContext } from "../ManageTemple";


type MemberRole = "owner" | "manager" | "editor";

type TempleMember = {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  phone_number: string | null;
  email: string;
  role: MemberRole;
  role_display: string;
  created_at: string;
};

type MembersResponse = {
  success: boolean;
  can_manage_members: boolean;
  members: TempleMember[];
  count: number;
  message?: string;
};

type MutationResponse = {
  success: boolean;
  member?: TempleMember;
  message?: string;
  errors?: Record<string, unknown>;
};

type AddMemberForm = {
  full_name: string;
  phone_number: string;
  username: string;
  password: string;
  confirm_password: string;
  role: "manager" | "editor";
};

type EditMemberForm = {
  full_name: string;
  phone_number: string;
  username: string;
  role: "manager" | "editor";
};


const initialForm: AddMemberForm = {
  full_name: "",
  phone_number: "",
  username: "",
  password: "",
  confirm_password: "",
  role: "editor",
};


function getErrorMessage(
  errors: Record<string, unknown> | undefined,
  fallback: string,
) {
  if (!errors) {
    return fallback;
  }

  for (const value of Object.values(errors)) {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value) && value.length > 0) {
      return String(value[0]);
    }
  }

  return fallback;
}


function formatJoinedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}


function TempleMembers() {
  const { temple, reloadTemple } =
    useOutletContext<ManageTempleOutletContext>();

  const [members, setMembers] = useState<TempleMember[]>([]);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<AddMemberForm>(initialForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [updatingMemberId, setUpdatingMemberId] =
    useState<number | null>(null);
  const [deletingMemberId, setDeletingMemberId] =
    useState<number | null>(null);

  const [editingMember, setEditingMember] =
    useState<TempleMember | null>(null);
  const [editForm, setEditForm] =
    useState<EditMemberForm | null>(null);
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const membersUrl =
    `http://127.0.0.1:8000/api/temples/${temple.id}/members/`;


  const loadMembers = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await apiFetch(membersUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal,
        });

        const data = (await response
          .json()
          .catch(() => null)) as MembersResponse | null;

        if (!response.ok || !data?.success) {
          throw new Error(
            data?.message || "Members load avvaledhu.",
          );
        }

        setMembers(data.members);
        setCanManageMembers(data.can_manage_members);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setMembers([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Members load avvaledhu.",
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [membersUrl],
  );


  useEffect(() => {
    const controller = new AbortController();

    void loadMembers(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadMembers]);


  const openAddMemberModal = () => {
    setForm(initialForm);
    setFormError("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };


  const closeAddMemberModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setFormError("");
  };


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (form.password !== form.confirm_password) {
      setFormError("Passwords match avvatledhu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch(membersUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          full_name: form.full_name.trim(),
          phone_number: form.phone_number.trim(),
          username: form.username.trim(),
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as MutationResponse | null;

      if (!response.ok || !data?.success || !data.member) {
        throw new Error(
          getErrorMessage(
            data?.errors,
            data?.message || "Member add avvaledhu.",
          ),
        );
      }

      setMembers((current) => [...current, data.member!]);
      setSuccessMessage(
        data.message || "Member successfully add ayyaru.",
      );
      setIsModalOpen(false);
      setForm(initialForm);

      await reloadTemple();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Member add avvaledhu.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleRoleChange = async (
    member: TempleMember,
    role: "manager" | "editor",
  ) => {
    setUpdatingMemberId(member.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await apiFetch(
        `${membersUrl}${member.id}/`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role }),
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as MutationResponse | null;

      if (!response.ok || !data?.success || !data.member) {
        throw new Error(
          getErrorMessage(
            data?.errors,
            data?.message || "Member role update avvaledhu.",
          ),
        );
      }

      setMembers((current) =>
        current.map((currentMember) =>
          currentMember.id === member.id
            ? data.member!
            : currentMember,
        ),
      );

      setSuccessMessage(
        data.message || "Member role update ayyindi.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Member role update avvaledhu.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };


  const openEditMemberModal = (member: TempleMember) => {
    if (member.role === "owner") {
      return;
    }

    setEditingMember(member);
    setEditForm({
      full_name: member.full_name,
      phone_number: member.phone_number || "",
      username: member.username,
      role: member.role,
    });
    setEditError("");
    setSuccessMessage("");
  };


  const closeEditMemberModal = () => {
    if (isSavingEdit) {
      return;
    }

    setEditingMember(null);
    setEditForm(null);
    setEditError("");
  };


  const handleEditSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!editingMember || !editForm) {
      return;
    }

    setIsSavingEdit(true);
    setEditError("");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await apiFetch(
        `${membersUrl}${editingMember.id}/`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...editForm,
            full_name: editForm.full_name.trim(),
            phone_number: editForm.phone_number.trim(),
            username: editForm.username.trim(),
          }),
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as MutationResponse | null;

      if (!response.ok || !data?.success || !data.member) {
        throw new Error(
          getErrorMessage(
            data?.errors,
            data?.message || "Member details update avvaledhu.",
          ),
        );
      }

      setMembers((current) =>
        current.map((member) =>
          member.id === editingMember.id
            ? data.member!
            : member,
        ),
      );

      setSuccessMessage(
        data.message || "Member details update ayyayi.",
      );
      setEditingMember(null);
      setEditForm(null);
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : "Member details update avvaledhu.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  };


  const handleRemoveMember = async (member: TempleMember) => {
    const shouldRemove = window.confirm(
      `${member.full_name} temple access remove cheyyala?`,
    );

    if (!shouldRemove) {
      return;
    }

    setDeletingMemberId(member.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await apiFetch(
        `${membersUrl}${member.id}/`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as MutationResponse | null;

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || "Member remove avvaledhu.",
        );
      }

      setMembers((current) =>
        current.filter(
          (currentMember) => currentMember.id !== member.id,
        ),
      );

      setSuccessMessage(
        data.message || "Member access remove ayyindi.",
      );

      await reloadTemple();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Member remove avvaledhu.",
      );
    } finally {
      setDeletingMemberId(null);
    }
  };


  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#332018]">
            Temple Members
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-600">
            Manage members and their access for {temple.name}.
          </p>
        </div>

        {canManageMembers && (
          <button
            type="button"
            onClick={openAddMemberModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-900"
          >
            <Plus className="h-4 w-4" />
            Add Member
          </button>
        )}
      </div>


      {successMessage && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
        >
          {successMessage}
        </div>
      )}


      {errorMessage && (
        <div
          role="alert"
          className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>

          <button
            type="button"
            onClick={() => void loadMembers()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-800"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}


      {isLoading ? (
        <div className="mt-6 space-y-3" aria-live="polite">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-xl bg-orange-50"
            />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 px-5 py-12 text-center">
          <Users className="h-10 w-10 text-orange-700" />
          <h3 className="mt-4 font-bold text-[#332018]">
            No members found
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
            Add a manager or editor to help manage this temple.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
          <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(150px,0.8fr)_160px_110px] gap-4 bg-orange-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-600 md:grid">
            <span>Member</span>
            <span>Mobile</span>
            <span>Role</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-gray-100">
            {members.map((member) => {
              const isOwner = member.role === "owner";
              const isUpdating = updatingMemberId === member.id;
              const isDeleting = deletingMemberId === member.id;

              return (
                <div
                  key={member.id}
                  className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(220px,1.5fr)_minmax(150px,0.8fr)_160px_110px] md:items-center md:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-800">
                      <UserRound className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#332018]">
                        {member.full_name}
                      </p>
                      <p className="truncate text-sm text-gray-500">
                        @{member.username} · Joined {formatJoinedDate(member.created_at)}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700">
                    {member.phone_number || "Not available"}
                  </p>

                  {isOwner ? (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-800">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Owner
                    </span>
                  ) : canManageMembers ? (
                    <select
                      value={member.role}
                      disabled={isUpdating || isDeleting}
                      onChange={(event) =>
                        void handleRoleChange(
                          member,
                          event.target.value as "manager" | "editor",
                        )
                      }
                      aria-label={`Role for ${member.full_name}`}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
                    >
                      <option value="manager">Manager</option>
                      <option value="editor">Editor</option>
                    </select>
                  ) : (
                    <span className="text-sm font-semibold text-gray-700">
                      {member.role_display}
                    </span>
                  )}

                  <div className="flex items-center gap-2 md:justify-end">
                    {!isOwner && canManageMembers && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditMemberModal(member)}
                          disabled={isUpdating || isDeleting}
                          aria-label={`Edit ${member.full_name}`}
                          title="Edit member"
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-orange-50 hover:text-orange-800 disabled:opacity-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(member)}
                          disabled={isUpdating || isDeleting}
                          aria-label={`Remove ${member.full_name}`}
                          title="Remove member"
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {isModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-member-title"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <div>
                <h2
                  id="add-member-title"
                  className="text-xl font-bold text-[#332018]"
                >
                  Add Temple Member
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Create temporary login credentials for this member.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddMemberModal}
                disabled={isSubmitting}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5">
              {formError && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-sm font-bold text-gray-700">
                    Full Name
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={form.full_name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        full_name: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    placeholder="Enter member full name"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-gray-700">
                    Mobile Number
                  </span>
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={form.phone_number}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        phone_number: event.target.value.replace(/\D/g, ""),
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    placeholder="10-digit mobile number"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-gray-700">
                    Username
                  </span>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={150}
                    value={form.username}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        username: event.target.value
                          .toLowerCase()
                          .replace(/\s+/g, "_"),
                      }))
                    }
                    autoCapitalize="none"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    placeholder="Create username"
                  />
                  <span className="mt-1.5 block text-xs text-gray-500">
                    Spaces automatically underscore-ga maruthayi.
                  </span>
                </label>

                <label>
                  <span className="text-sm font-bold text-gray-700">
                    Temporary Password
                  </span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    autoComplete="new-password"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    placeholder="Minimum 8 characters"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-gray-700">
                    Confirm Password
                  </span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={form.confirm_password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        confirm_password: event.target.value,
                      }))
                    }
                    autoComplete="new-password"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    placeholder="Re-enter password"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm font-bold text-gray-700">
                    Member Role
                  </span>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        role: event.target.value as "manager" | "editor",
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="editor">Editor</option>
                    <option value="manager">Manager</option>
                  </select>
                </label>
              </div>

              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                This is a temporary development login. Share the username and password securely with the member.
              </p>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeAddMemberModal}
                  disabled={isSubmitting}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  {isSubmitting ? "Adding Member..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {editingMember && editForm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-member-title"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
              <div>
                <h2
                  id="edit-member-title"
                  className="text-xl font-bold text-[#332018]"
                >
                  Edit Member
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Update member details and temple role.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditMemberModal}
                disabled={isSavingEdit}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5">
              {editError && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {editError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-sm font-bold text-gray-700">
                    Full Name
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={editForm.full_name}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              full_name: event.target.value,
                            }
                          : current,
                      )
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-gray-700">
                    Mobile Number
                  </span>
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={editForm.phone_number}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              phone_number: event.target.value.replace(/\D/g, ""),
                            }
                          : current,
                      )
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-gray-700">
                    Username
                  </span>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={150}
                    value={editForm.username}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              username: event.target.value
                                .toLowerCase()
                                .replace(/\s+/g, "_"),
                            }
                          : current,
                      )
                    }
                    autoCapitalize="none"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm font-bold text-gray-700">
                    Member Role
                  </span>
                  <select
                    value={editForm.role}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              role: event.target.value as "manager" | "editor",
                            }
                          : current,
                      )
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="editor">Editor</option>
                    <option value="manager">Manager</option>
                  </select>
                </label>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditMemberModal}
                  disabled={isSavingEdit}
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-900 disabled:opacity-60"
                >
                  {isSavingEdit && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}


export default TempleMembers;