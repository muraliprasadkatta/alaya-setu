export type UserRole =
  | "devotee"
  | "pending_temple_admin"
  | "temple_admin"
  | "temple_member"
  | "super_admin";

export type UserProfile = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: UserRole;
  role_display: string;
  date_joined: string;
};

export type UserProfileUpdatePayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
};

export type ProfileFieldErrors = Partial<
  Record<
    keyof UserProfileUpdatePayload,
    string[]
  >
>;

export type UserProfileResponse = {
  success: boolean;
  message?: string;
  profile?: UserProfile;
  errors?: ProfileFieldErrors;
};