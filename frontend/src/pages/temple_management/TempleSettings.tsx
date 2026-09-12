import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useNavigate, useOutletContext } from "react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Hourglass,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  PencilLine,
  Save,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

import { apiFetch } from "../../services/apiFetch";
import type {
  ManageTempleOutletContext,
  TempleManagementData,
  VerifiedEditStatus,
} from "../ManageTemple";


type TempleSettingsForm = {
  main_deity: string;
  description: string;
  address: string;
  opening_time: string;
  closing_time: string;
};

type VerifiedDetailsForm = {
  name: string;
  pincode: string;
  pincode_location: number | null;
  city: string;
  district: string;
  state: string;
};

type TempleUpdateResponse = {
  success: boolean;
  message?: string;
  temple?: TempleManagementData;
  errors?: Record<string, unknown>;
};

type VerifiedEditResponse = {
  success: boolean;
  message?: string;
  errors?: Record<string, unknown>;
};

type PincodeLocationOption = {
  id: number;
  office_name: string;
  office_type: string;
  delivery_status: string;
  district: string;
  state: string;
  latitude: string | null;
  longitude: string | null;
};

type PincodeLookupResponse = {
  success: boolean;
  message?: string;
  location_options?: PincodeLocationOption[];
};


const API_BASE_URL = "http://127.0.0.1:8000/api/temples";
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

const VERIFIED_STATUS_LABELS: Record<
  VerifiedEditStatus,
  string
> = {
  access_pending: "Edit access pending",
  edit_allowed: "Edit access approved",
  changes_pending: "Changes under review",
  approved: "Changes approved",
  rejected: "Request rejected",
};


function getInitialForm(
  temple: TempleManagementData,
): TempleSettingsForm {
  return {
    main_deity: temple.main_deity || "",
    description: temple.description || "",
    address: temple.address || "",
    opening_time: temple.opening_time?.slice(0, 5) || "",
    closing_time: temple.closing_time?.slice(0, 5) || "",
  };
}


function getInitialVerifiedForm(
  temple: TempleManagementData,
): VerifiedDetailsForm {
  return {
    name: temple.name || "",
    pincode: temple.pincode || "",
    pincode_location:
      temple.verified_edit_request
        ?.original_pincode_location ?? null,
    city: temple.city || "",
    district: temple.district || "",
    state: temple.state || "",
  };
}


function getCityName(officeName: string) {
  return officeName
    .replace(/\s+(?:B\.O|S\.O|H\.O)$/i, "")
    .trim();
}


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


function getRequestButtonLabel(
  status: VerifiedEditStatus | undefined,
) {
  if (status === "access_pending") {
    return "Approval Pending";
  }

  if (status === "edit_allowed") {
    return "Edit Access Approved";
  }

  if (status === "changes_pending") {
    return "Changes Under Review";
  }

  return "Request Edit";
}


function TempleSettings() {
  const navigate = useNavigate();
  const { temple, reloadTemple } =
    useOutletContext<ManageTempleOutletContext>();

  const [form, setForm] = useState<TempleSettingsForm>(
    () => getInitialForm(temple),
  );

  const [verifiedForm, setVerifiedForm] =
    useState<VerifiedDetailsForm>(
      () => getInitialVerifiedForm(temple),
    );

  const [selectedImage, setSelectedImage] =
    useState<File | null>(null);
  const [imagePreview, setImagePreview] =
    useState<string | null>(temple.image);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isRequestModalOpen, setIsRequestModalOpen] =
    useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestErrorMessage, setRequestErrorMessage] =
    useState("");
  const [isRequestingEdit, setIsRequestingEdit] =
    useState(false);

  const [locationOptions, setLocationOptions] = useState<
    PincodeLocationOption[]
  >([]);
  const [isLookingUpPincode, setIsLookingUpPincode] =
    useState(false);
  const [isManualLocation, setIsManualLocation] =
    useState(false);
  const [lookupMessage, setLookupMessage] = useState("");

  const [isSubmittingVerified, setIsSubmittingVerified] =
    useState(false);
  const [verifiedErrorMessage, setVerifiedErrorMessage] =
    useState("");
  const [verifiedSuccessMessage, setVerifiedSuccessMessage] =
    useState("");

  const isOwner = temple.membership_role === "owner";
  const editRequest = temple.verified_edit_request;
  const editStatus = editRequest?.status;
  const canEditVerified =
    temple.can_edit_verified_details &&
    editStatus === "edit_allowed";


  const lookupPincode = useCallback(
    async (
      pincode: string,
      preferredLocationId?: number | null,
    ) => {
      const normalizedPincode = pincode.trim();

      if (!PINCODE_PATTERN.test(normalizedPincode)) {
        setLocationOptions([]);
        setIsManualLocation(false);
        setLookupMessage(
          "Valid 6-digit Indian pincode enter cheyyandi.",
        );
        return;
      }

      setIsLookingUpPincode(true);
      setLookupMessage("");
      setVerifiedErrorMessage("");

      try {
        const response = await apiFetch(
          `${API_BASE_URL}/pincode/${normalizedPincode}/`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const data = (await response
          .json()
          .catch(() => null)) as PincodeLookupResponse | null;

        if (response.status === 404) {
          setLocationOptions([]);
          setIsManualLocation(true);
          setLookupMessage(
            data?.message ||
              "Postal database lo ee pincode dorakaledhu. Location manually enter cheyyandi.",
          );

          setVerifiedForm((current) => ({
            ...current,
            pincode_location: null,
          }));
          return;
        }

        if (!response.ok || !data?.success) {
          throw new Error(
            data?.message ||
              "Pincode location details load avvaledhu.",
          );
        }

        const options = data.location_options || [];
        setLocationOptions(options);
        setIsManualLocation(false);

        const preferredOption = options.find(
          (option) => option.id === preferredLocationId,
        );

        const selectedOption =
          preferredOption ||
          (options.length === 1 ? options[0] : null);

        if (selectedOption) {
          setVerifiedForm((current) => ({
            ...current,
            pincode: normalizedPincode,
            pincode_location: selectedOption.id,
            city: getCityName(selectedOption.office_name),
            district: selectedOption.district,
            state: selectedOption.state,
          }));
        } else {
          setVerifiedForm((current) => ({
            ...current,
            pincode: normalizedPincode,
            pincode_location: null,
            city: "",
            district: "",
            state: "",
          }));
        }

        setLookupMessage(
          options.length > 1
            ? "Correct Post Office / Area select cheyyandi."
            : "Location details verified.",
        );
      } catch (error) {
        setLocationOptions([]);
        setIsManualLocation(false);
        setLookupMessage("");
        setVerifiedErrorMessage(
          error instanceof Error
            ? error.message
            : "Pincode location details load avvaledhu.",
        );
      } finally {
        setIsLookingUpPincode(false);
      }
    },
    [],
  );


  useEffect(() => {
    setForm(getInitialForm(temple));
    setVerifiedForm(getInitialVerifiedForm(temple));
    setSelectedImage(null);
    setImagePreview(temple.image);
    setVerifiedErrorMessage("");
    setVerifiedSuccessMessage("");
  }, [temple]);

  useEffect(() => {
    if (!selectedImage) {
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImage]);


  useEffect(() => {
    if (!canEditVerified) {
      setLocationOptions([]);
      setLookupMessage("");
      setIsManualLocation(false);
      return;
    }

    const pincode = temple.pincode.trim();

    if (!PINCODE_PATTERN.test(pincode)) {
      return;
    }

    void lookupPincode(
      pincode,
      editRequest?.original_pincode_location,
    );
  }, [
    canEditVerified,
    editRequest?.id,
    editRequest?.original_pincode_location,
    lookupPincode,
    temple.pincode,
  ]);


  const handleImageChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] || null;

    setErrorMessage("");
    setSuccessMessage("");

    if (!file) {
      setSelectedImage(null);
      setImagePreview(temple.image);
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage(
        "JPG, PNG leda WEBP image select cheyyandi.",
      );
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Temple image size 5 MB lopu undali.");
      event.target.value = "";
      return;
    }

    setSelectedImage(file);
  };


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!isOwner) {
      setErrorMessage(
        "Temple owner matrame temple details edit cheyyagalaru.",
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const formData = new FormData();

    formData.append("main_deity", form.main_deity.trim());
    formData.append("description", form.description.trim());
    formData.append("address", form.address.trim());

    if (form.opening_time) {
      formData.append("opening_time", form.opening_time);
    }

    if (form.closing_time) {
      formData.append("closing_time", form.closing_time);
    }

    if (selectedImage) {
      formData.append("image", selectedImage);
    }

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/${temple.id}/manage/`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
          },
          body: formData,
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as TempleUpdateResponse | null;

      if (!response.ok || !data?.success) {
        throw new Error(
          getErrorMessage(
            data?.errors,
            data?.message || "Temple details save avvaledhu.",
          ),
        );
      }

      setSuccessMessage(
        data.message ||
          "Temple details successfully update ayyayi.",
      );
      setSelectedImage(null);

      await reloadTemple();
      navigate(`/temples/${temple.id}/manage`, {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Temple details save avvaledhu.",
      );
    } finally {
      setIsSaving(false);
    }
  };


  const handleRequestEdit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedReason = requestReason.trim();

    if (normalizedReason.length < 5) {
      setRequestErrorMessage(
        "Edit request reason clear-ga enter cheyyandi.",
      );
      return;
    }

    setIsRequestingEdit(true);
    setRequestErrorMessage("");
    setVerifiedErrorMessage("");
    setVerifiedSuccessMessage("");

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/${temple.id}/verified-edit-request/`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            request_reason: normalizedReason,
          }),
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as VerifiedEditResponse | null;

      if (!response.ok || !data?.success) {
        throw new Error(
          getErrorMessage(
            data?.errors,
            data?.message || "Edit request submit avvaledhu.",
          ),
        );
      }

      setIsRequestModalOpen(false);
      setRequestReason("");
      setVerifiedSuccessMessage(
        data.message ||
          "Edit request successfully submit ayyindi.",
      );

      await reloadTemple();
    } catch (error) {
      setRequestErrorMessage(
        error instanceof Error
          ? error.message
          : "Edit request submit avvaledhu.",
      );
    } finally {
      setIsRequestingEdit(false);
    }
  };


  const handleVerifiedPincodeChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const pincode = event.target.value
      .replace(/\D/g, "")
      .slice(0, 6);

    setVerifiedForm((current) => ({
      ...current,
      pincode,
      pincode_location: null,
      city: "",
      district: "",
      state: "",
    }));

    setLocationOptions([]);
    setLookupMessage("");
    setIsManualLocation(false);
    setVerifiedErrorMessage("");
    setVerifiedSuccessMessage("");
  };


  const handleLocationSelection = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const locationId = Number(event.target.value);
    const selectedLocation = locationOptions.find(
      (option) => option.id === locationId,
    );

    if (!selectedLocation) {
      setVerifiedForm((current) => ({
        ...current,
        pincode_location: null,
        city: "",
        district: "",
        state: "",
      }));
      return;
    }

    setVerifiedForm((current) => ({
      ...current,
      pincode_location: selectedLocation.id,
      city: getCityName(selectedLocation.office_name),
      district: selectedLocation.district,
      state: selectedLocation.state,
    }));
  };


  const handleVerifiedSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!canEditVerified) {
      setVerifiedErrorMessage(
        "Super admin edit access approve chesina tarvata matrame changes submit cheyyavachu.",
      );
      return;
    }

    const normalizedName = verifiedForm.name.trim();
    const normalizedPincode = verifiedForm.pincode.trim();

    if (normalizedName.length < 3) {
      setVerifiedErrorMessage(
        "Temple name minimum 3 characters undali.",
      );
      return;
    }

    if (!PINCODE_PATTERN.test(normalizedPincode)) {
      setVerifiedErrorMessage(
        "Valid 6-digit Indian pincode enter cheyyandi.",
      );
      return;
    }

    if (
      locationOptions.length > 0 &&
      !verifiedForm.pincode_location
    ) {
      setVerifiedErrorMessage(
        "Correct Post Office / Area select cheyyandi.",
      );
      return;
    }

    if (
      isManualLocation &&
      (!verifiedForm.city.trim() ||
        !verifiedForm.district.trim() ||
        !verifiedForm.state.trim())
    ) {
      setVerifiedErrorMessage(
        "City, district and state details complete-ga enter cheyyandi.",
      );
      return;
    }

    setIsSubmittingVerified(true);
    setVerifiedErrorMessage("");
    setVerifiedSuccessMessage("");

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/${temple.id}/verified-edit-request/submit/`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: normalizedName,
            pincode: normalizedPincode,
            pincode_location:
              verifiedForm.pincode_location,
            city: verifiedForm.city.trim(),
            district: verifiedForm.district.trim(),
            state: verifiedForm.state.trim(),
          }),
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as VerifiedEditResponse | null;

      if (!response.ok || !data?.success) {
        throw new Error(
          getErrorMessage(
            data?.errors,
            data?.message ||
              "Verified details submit avvaledhu.",
          ),
        );
      }

      setVerifiedSuccessMessage(
        data.message ||
          "Verified detail changes submit ayyayi.",
      );

      await reloadTemple();
    } catch (error) {
      setVerifiedErrorMessage(
        error instanceof Error
          ? error.message
          : "Verified details submit avvaledhu.",
      );
    } finally {
      setIsSubmittingVerified(false);
    }
  };

  if (!isOwner) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-6 w-6 shrink-0 text-amber-800" />

          <div>
            <h2 className="text-lg font-bold text-amber-950">
              Settings access restricted
            </h2>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              Temple owner matrame temple profile settings-ni edit cheyyagalaru.
            </p>
          </div>
        </div>
      </section>
    );
  }


  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit}>
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold text-[#332018]">
                  Temple Details
                </h2>
                <span className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
                  Direct Edit
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Changes made here are applied immediately.
              </p>
            </div>

            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified Temple
            </span>
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
              className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              {errorMessage}
            </div>
          )}


          <div className="mt-6 grid gap-7 lg:grid-cols-[200px_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-bold text-gray-700">
                Temple Image
              </p>

              <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-orange-50">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Temple preview"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center">
                    <ImagePlus className="h-12 w-12 text-orange-700" />
                  </div>
                )}
              </div>

              <label className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-bold text-orange-800 transition hover:bg-orange-50">
                <ImagePlus className="h-4 w-4" />
                Change Image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </label>

              <p className="mt-2 text-xs leading-5 text-gray-500">
                JPG, PNG or WEBP. Maximum 5 MB.
              </p>
            </div>


            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.8fr)_minmax(420px,1.5fr)]">
                <label>
                  <span className="text-sm font-bold text-gray-700">
                    Main Deity
                  </span>
                  <input
                    type="text"
                    maxLength={100}
                    value={form.main_deity}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        main_deity: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    placeholder="Enter main deity"
                  />
                </label>

                <fieldset>
                  <legend className="text-sm font-bold text-gray-700">
                    Temple Timings
                  </legend>

                  <div className="mt-1.5 grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        <Clock3 className="h-4 w-4 text-orange-700" />
                        Opening Time
                      </span>
                      <input
                        type="time"
                        value={form.opening_time}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            opening_time: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                      />
                    </label>

                    <label>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        <Clock3 className="h-4 w-4 text-orange-700" />
                        Closing Time
                      </span>
                      <input
                        type="time"
                        value={form.closing_time}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            closing_time: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                      />
                    </label>
                  </div>
                </fieldset>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-gray-700">
                  Description
                </span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full resize-y rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  placeholder="Describe the temple"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-gray-700">
                  Full Address
                </span>
                <textarea
                  required
                  rows={2}
                  value={form.address}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full resize-y rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                />
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-800 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSaving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </section>
      </form>


      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <MapPin className="h-5 w-5" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-bold text-[#332018]">
                  Verified Details
                </h2>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                  Approval Required
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Temple identity and location changes require Super Admin approval.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!temple.can_request_verified_edit}
            onClick={() => {
              setRequestErrorMessage("");
              setIsRequestModalOpen(true);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-orange-300 bg-white px-5 py-2.5 text-sm font-bold text-orange-800 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {editStatus === "access_pending" ||
            editStatus === "changes_pending" ? (
              <Hourglass className="h-4 w-4" />
            ) : editStatus === "edit_allowed" ? (
              <PencilLine className="h-4 w-4" />
            ) : (
              <LockKeyhole className="h-4 w-4" />
            )}
            {getRequestButtonLabel(editStatus)}
          </button>
        </div>


        {verifiedSuccessMessage && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            {verifiedSuccessMessage}
          </div>
        )}


        {verifiedErrorMessage && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {verifiedErrorMessage}
          </div>
        )}


        {editRequest &&
          editStatus !== "approved" && (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
                editStatus === "rejected"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : editStatus === "edit_allowed"
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {editStatus === "rejected" ? (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                ) : editStatus === "edit_allowed" ? (
                  <PencilLine className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Hourglass className="mt-0.5 h-5 w-5 shrink-0" />
                )}

                <div className="min-w-0">
                  <p className="font-bold">
                    {VERIFIED_STATUS_LABELS[editRequest.status]}
                  </p>

                  {editStatus === "access_pending" && (
                    <p className="mt-1 leading-6">
                      Super admin edit access review chesina tarvata fields unlock avuthayi.
                    </p>
                  )}

                  {editStatus === "edit_allowed" && (
                    <p className="mt-1 leading-6">
                      Verified fields ippudu editable. Changes submit chesina ventane malli lock avuthayi.
                    </p>
                  )}

                  {editStatus === "changes_pending" && (
                    <p className="mt-1 leading-6">
                      Submitted changes final Super Admin approval kosam wait chestunnayi.
                    </p>
                  )}

                  {editStatus === "rejected" && (
                    <>
                      <p className="mt-1 leading-6">
                        {editRequest.rejected_stage ===
                        "submitted_changes"
                          ? "Submitted changes reject ayyayi."
                          : "Edit access request reject ayyindi."}
                      </p>

                      {editRequest.rejection_reason && (
                        <p className="mt-2 font-semibold">
                          Reason: {editRequest.rejection_reason}
                        </p>
                      )}
                    </>
                  )}

                  <p className="mt-2 break-words text-xs opacity-80">
                    Request reason: {editRequest.request_reason}
                  </p>
                </div>
              </div>
            </div>
          )}


        {editRequest?.status === "approved" && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3.5 py-2 text-xs font-bold text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            Verified details approved and up to date
          </div>
        )}


        {canEditVerified ? (
          <form
            onSubmit={handleVerifiedSubmit}
            className="mt-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-blue-950">
                  Edit verified details
                </h3>
                <p className="mt-1 text-sm leading-6 text-blue-800">
                  Required field matrame change cheyyandi. Submit tarvata final approval pending untundhi.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-800">
                <PencilLine className="h-3.5 w-3.5" />
                Temporarily Unlocked
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="lg:col-span-2">
                <span className="text-sm font-bold text-gray-700">
                  Temple Name
                </span>
                <input
                  required
                  type="text"
                  maxLength={255}
                  value={verifiedForm.name}
                  onChange={(event) =>
                    setVerifiedForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label>
                <span className="text-sm font-bold text-gray-700">
                  Pincode
                </span>
                <div className="mt-1.5 flex gap-2">
                  <input
                    required
                    inputMode="numeric"
                    pattern="[1-9][0-9]{5}"
                    maxLength={6}
                    value={verifiedForm.pincode}
                    onChange={handleVerifiedPincodeChange}
                    className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    disabled={isLookingUpPincode}
                    onClick={() =>
                      void lookupPincode(
                        verifiedForm.pincode,
                        verifiedForm.pincode_location,
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-300 bg-white px-4 py-2.5 text-sm font-bold text-orange-800 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLookingUpPincode ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Lookup
                  </button>
                </div>
              </label>

              {locationOptions.length > 0 && (
                <label>
                  <span className="text-sm font-bold text-gray-700">
                    Post Office / Area
                  </span>
                  <select
                    required
                    value={
                      verifiedForm.pincode_location ?? ""
                    }
                    onChange={handleLocationSelection}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">
                      Select Post Office / Area
                    </option>
                    {locationOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.office_name} — {option.district}, {option.state}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {lookupMessage && (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 text-sm lg:col-span-2 ${
                    isManualLocation
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-green-200 bg-green-50 text-green-800"
                  }`}
                >
                  {lookupMessage}
                </div>
              )}

              <label>
                <span className="text-sm font-bold text-gray-700">
                  City / Village
                </span>
                <input
                  required
                  type="text"
                  maxLength={100}
                  readOnly={!isManualLocation}
                  value={verifiedForm.city}
                  onChange={(event) =>
                    setVerifiedForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 outline-none read-only:bg-gray-100 read-only:text-gray-600 focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label>
                <span className="text-sm font-bold text-gray-700">
                  District
                </span>
                <input
                  required
                  type="text"
                  maxLength={100}
                  readOnly={!isManualLocation}
                  value={verifiedForm.district}
                  onChange={(event) =>
                    setVerifiedForm((current) => ({
                      ...current,
                      district: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 outline-none read-only:bg-gray-100 read-only:text-gray-600 focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="lg:col-span-2">
                <span className="text-sm font-bold text-gray-700">
                  State
                </span>
                <input
                  required
                  type="text"
                  maxLength={100}
                  readOnly={!isManualLocation}
                  value={verifiedForm.state}
                  onChange={(event) =>
                    setVerifiedForm((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 outline-none read-only:bg-gray-100 read-only:text-gray-600 focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end border-t border-blue-100 pt-4">
              <button
                type="submit"
                disabled={
                  isSubmittingVerified || isLookingUpPincode
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-800 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isSubmittingVerified ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSubmittingVerified
                  ? "Submitting Changes..."
                  : "Submit for Final Approval"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 grid gap-x-0 gap-y-1 overflow-hidden rounded-xl border border-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Temple Name", temple.name],
              ["Pincode", temple.pincode],
              ["City", temple.city],
              ["District", temple.district],
              ["State", temple.state],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex min-h-20 items-start gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3.5 lg:border-r"
              >
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-bold text-gray-500">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-700">
                    {value || "Not available"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!canEditVerified && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Temple name or location change cheyyalante edit access request submit cheyyali.
          </div>
        )}
      </section>


      {isRequestModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verified-edit-request-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
        >
          <form
            onSubmit={handleRequestEdit}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="verified-edit-request-title"
                  className="text-xl font-bold text-[#332018]"
                >
                  Request Verified Details Edit
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Super admin ki edit access request pampadaniki clear reason enter cheyyandi.
                </p>
              </div>

              <button
                type="button"
                disabled={isRequestingEdit}
                onClick={() => {
                  setIsRequestModalOpen(false);
                  setRequestErrorMessage("");
                }}
                aria-label="Close edit request dialog"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {requestErrorMessage && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                {requestErrorMessage}
              </div>
            )}

            <label className="mt-5 block">
              <span className="text-sm font-bold text-gray-700">
                Reason for edit
              </span>
              <textarea
                autoFocus
                required
                rows={4}
                minLength={5}
                maxLength={1000}
                value={requestReason}
                onChange={(event) =>
                  setRequestReason(event.target.value)
                }
                placeholder="Example: Temple name spelling correction and pincode update required."
                className="mt-1.5 w-full resize-y rounded-xl border border-gray-300 px-3.5 py-2.5 outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
              />
              <p className="mt-1.5 text-right text-xs text-gray-500">
                {requestReason.length}/1000
              </p>
            </label>

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isRequestingEdit}
                onClick={() => {
                  setIsRequestModalOpen(false);
                  setRequestErrorMessage("");
                }}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isRequestingEdit}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRequestingEdit ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isRequestingEdit
                  ? "Submitting Request..."
                  : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


export default TempleSettings;