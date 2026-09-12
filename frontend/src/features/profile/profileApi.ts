import { apiFetch } from "../../services/apiFetch";

import type {
  ProfileFieldErrors,
  UserProfile,
  UserProfileResponse,
  UserProfileUpdatePayload,
} from "./types";


const PROFILE_API_URL =
  "http://127.0.0.1:8000/api/accounts/profile/";


export class ProfileApiError extends Error {
  fieldErrors: ProfileFieldErrors;

  constructor(
    message: string,
    fieldErrors: ProfileFieldErrors = {},
  ) {
    super(message);

    this.name = "ProfileApiError";
    this.fieldErrors = fieldErrors;
  }
}


async function parseProfileResponse(
  response: Response,
  fallbackMessage: string,
) {
  const data = (await response
    .json()
    .catch(() => null)) as
    | UserProfileResponse
    | null;

  if (
    !response.ok ||
    !data?.success ||
    !data.profile
  ) {
    throw new ProfileApiError(
      data?.message || fallbackMessage,
      data?.errors || {},
    );
  }

  return {
    profile: data.profile,
    message: data.message || "",
  };
}


export async function getUserProfile(
  signal?: AbortSignal,
): Promise<UserProfile> {
  const response = await apiFetch(
    PROFILE_API_URL,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  const result = await parseProfileResponse(
    response,
    "Profile details load avvaledhu.",
  );

  return result.profile;
}


export async function updateUserProfile(
  payload: UserProfileUpdatePayload,
) {
  const response = await apiFetch(
    PROFILE_API_URL,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return parseProfileResponse(
    response,
    "Profile update avvaledhu.",
  );
}