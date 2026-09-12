import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router";

import { apiFetch } from "../services/apiFetch";

type LocationOption = {
  id: number;
  office_name: string;
  office_type: string;
  delivery_status: string;
  district: string;
  state: string;
  latitude: string | null;
  longitude: string | null;
};

type TempleOption = {
  id: number;
  name: string;
  main_deity: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  match_type: "selected_area" | "same_pincode";
  distance_km: number | null;
};

type PincodeLookupResponse = {
  success: boolean;
  message?: string;
  location_options?: LocationOption[];
};

type VerifiedTempleListResponse = {
  success: boolean;
  message?: string;
  temples?: TempleOption[];
  count?: number;
};

type TempleRequestSubmitResponse = {
  success: boolean;
  message?: string;
  errors?: Record<string, unknown>;
  temple_request?: {
    id: number;
    status: string;
    request_type: "new_temple" | "claim_temple";
  };
};

type TempleRequestDetails = {
  id: number;
  request_type: "new_temple" | "claim_temple";
  existing_temple: number | null;
  temple_name: string;
  main_deity: string;
  temple_image: string | null;
  opening_time: string | null;
  closing_time: string | null;
  description: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  pincode_location: number | null;
  latitude: string | null;
  longitude: string | null;
  contact_person_name: string;
  contact_phone: string;
  proof_image: string | null;
  status: string;
  rejection_reason: string;
  can_resubmit: boolean;
};

type TempleRequestLoadResponse = {
  success: boolean;
  message?: string;
  temple_request?: TempleRequestDetails;
};

type SubmitStatus = "idle" | "success" | "error";

const INITIAL_FORM_DATA = {
  temple_name: "",
  main_deity: "",
  description: "",
  address: "",
  city: "",
  state: "",
  district: "",
  pincode: "",
  contact_person_name: "",
  contact_phone: "",
  opening_time: "",
  closing_time: "",
};

const PINCODE_LOOKUP_URL =
  "http://127.0.0.1:8000/api/temples/pincode";

const VERIFIED_TEMPLES_URL =
  "http://127.0.0.1:8000/api/temples/verified/";

const TEMPLE_REQUEST_URL =
  "http://127.0.0.1:8000/api/temples/requests/";

const NEW_TEMPLE_SELECTION = "new_temple";
const TEMPLE_SELECTION_PREFIX = "temple:";

function getCityName(officeName: string) {
  return officeName.replace(/\s+(B\.O|S\.O|H\.O)$/i, "").trim();
}

function getFirstErrorMessage(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = getFirstErrorMessage(item);

      if (message) {
        return message;
      }
    }
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const message = getFirstErrorMessage(item);

      if (message) {
        return message;
      }
    }
  }

  return "";
}

function getMediaUrl(value: string | null) {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `http://127.0.0.1:8000${value.startsWith("/") ? "" : "/"}${value}`;
}

function TempleRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const resubmitParam = searchParams.get("resubmit");
  const hasInvalidResubmitParam =
    resubmitParam !== null && !/^[1-9][0-9]*$/.test(resubmitParam);

  const resubmitRequestId =
    resubmitParam && !hasInvalidResubmitParam
      ? Number(resubmitParam)
      : null;

  const isResubmitMode = resubmitRequestId !== null;

  const [formData, setFormData] = useState({ ...INITIAL_FORM_DATA });
  const [templeImage, setTempleImage] = useState<File | null>(null);
  const [proofImage, setProofImage] = useState<File | null>(null);

  const [currentTempleImageUrl, setCurrentTempleImageUrl] = useState("");
  const [currentProofImageUrl, setCurrentProofImageUrl] = useState("");

  const [isResubmitLoading, setIsResubmitLoading] = useState(
    isResubmitMode,
  );
  const [resubmitLoadError, setResubmitLoadError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [originalRequestType, setOriginalRequestType] = useState<
    "new_temple" | "claim_temple" | null
  >(null);
  const [resubmitExistingTempleId, setResubmitExistingTempleId] =
    useState<number | null>(null);
  const [resubmitLocationId, setResubmitLocationId] = useState("");

  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [pincodeMessage, setPincodeMessage] = useState("");

  const [templeOptions, setTempleOptions] = useState<TempleOption[]>([]);
  const [templeSelection, setTempleSelection] = useState("");
  const [isTempleLoading, setIsTempleLoading] = useState(false);
  const [templeMessage, setTempleMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const isClaimRequest = templeSelection.startsWith(TEMPLE_SELECTION_PREFIX);
  const isNewTempleRequest =
    isManualLocation || templeSelection === NEW_TEMPLE_SELECTION;

  const selectedTempleId = isClaimRequest
    ? Number(templeSelection.slice(TEMPLE_SELECTION_PREFIX.length))
    : null;

  const selectedTempleFromOptions =
    selectedTempleId === null
      ? undefined
      : templeOptions.find((temple) => temple.id === selectedTempleId);

  const resubmitClaimTemple: TempleOption | undefined =
    isResubmitMode &&
    originalRequestType === "claim_temple" &&
    resubmitExistingTempleId !== null
      ? {
          id: resubmitExistingTempleId,
          name: formData.temple_name,
          main_deity: formData.main_deity,
          city: formData.city,
          district: formData.district,
          state: formData.state,
          pincode: formData.pincode,
          match_type: "selected_area",
          distance_km: null,
        }
      : undefined;

  const selectedTemple =
    selectedTempleFromOptions ?? resubmitClaimTemple;

  useEffect(() => {
    if (!isResubmitMode || resubmitRequestId === null) {
      setIsResubmitLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadRejectedRequest() {
      setIsResubmitLoading(true);
      setResubmitLoadError("");
      setSubmitMessage("");
      setSubmitStatus("idle");

      try {
        const response = await apiFetch(
          `${TEMPLE_REQUEST_URL}${resubmitRequestId}/resubmit/`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        const data = (await response
          .json()
          .catch(() => null)) as TempleRequestLoadResponse | null;

        if (!response.ok || !data?.success || !data.temple_request) {
          throw new Error(
            data?.message ||
              "Rejected temple request details load avvaledhu.",
          );
        }

        const templeRequest = data.temple_request;

        if (!templeRequest.can_resubmit) {
          throw new Error(
            "Ee request already resubmit ayyindi. Latest request status dashboard lo check cheyyandi.",
          );
        }

        const locationId = templeRequest.pincode_location
          ? String(templeRequest.pincode_location)
          : "";

        setOriginalRequestType(templeRequest.request_type);
        setResubmitExistingTempleId(templeRequest.existing_temple);
        setResubmitLocationId(locationId);
        setRejectionReason(templeRequest.rejection_reason.trim());

        setFormData({
          temple_name: templeRequest.temple_name ?? "",
          main_deity: templeRequest.main_deity ?? "",
          description: templeRequest.description ?? "",
          address: templeRequest.address ?? "",
          city: templeRequest.city ?? "",
          state: templeRequest.state ?? "",
          district: templeRequest.district ?? "",
          pincode: templeRequest.pincode ?? "",
          contact_person_name:
            templeRequest.contact_person_name ?? "",
          contact_phone: templeRequest.contact_phone ?? "",
          opening_time: templeRequest.opening_time ?? "",
          closing_time: templeRequest.closing_time ?? "",
        });

        setCurrentTempleImageUrl(
          getMediaUrl(templeRequest.temple_image),
        );
        setCurrentProofImageUrl(
          getMediaUrl(templeRequest.proof_image),
        );

        setSelectedLocationId(locationId);
        setIsManualLocation(!locationId);

        setTempleSelection(
          templeRequest.request_type === "claim_temple" &&
            templeRequest.existing_temple
            ? `${TEMPLE_SELECTION_PREFIX}${templeRequest.existing_temple}`
            : NEW_TEMPLE_SELECTION,
        );

        setTempleOptions([]);
        setTempleMessage("");
        setPincodeMessage(
          locationId
            ? "Previous request location loaded."
            : "Previous request manual location loaded.",
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setResubmitLoadError(
          error instanceof Error
            ? error.message
            : "Rejected temple request details load avvaledhu.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsResubmitLoading(false);
        }
      }
    }

    void loadRejectedRequest();

    return () => {
      controller.abort();
    };
  }, [isResubmitMode, resubmitRequestId]);

  useEffect(() => {
    if (!isRedirecting) {
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      navigate("/temple-admin-dashboard", { replace: true });
    }, 1200);

    return () => {
      window.clearTimeout(redirectTimer);
    };
  }, [isRedirecting, navigate]);

  useEffect(() => {
    const pincode = formData.pincode;

    if (
      pincode.length !== 6 ||
      isManualLocation ||
      isResubmitLoading
    ) {
      return;
    }

    const controller = new AbortController();

    async function lookupPincode() {
      setIsPincodeLoading(true);
      setPincodeMessage("");

      try {
        const response = await fetch(`${PINCODE_LOOKUP_URL}/${pincode}/`, {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        const data = (await response.json()) as PincodeLookupResponse;

        if (!response.ok || !data.success) {
          setLocationOptions([]);
          setSelectedLocationId("");
          setTempleOptions([]);
          setTempleSelection(NEW_TEMPLE_SELECTION);
          setTempleMessage("");
          setIsManualLocation(true);
          setPincodeMessage(
            data.message ??
              "Pincode details dorakaledu. Location manually enter cheyyandi.",
          );
          return;
        }

        const options = data.location_options ?? [];

        if (options.length === 0) {
          setLocationOptions([]);
          setSelectedLocationId("");
          setTempleOptions([]);
          setTempleSelection(NEW_TEMPLE_SELECTION);
          setTempleMessage("");
          setIsManualLocation(true);
          setPincodeMessage(
            "Pincode details dorakaledu. Location manually enter cheyyandi.",
          );
          return;
        }

        setLocationOptions(options);

        const previousLocation = resubmitLocationId
          ? options.find(
              (location) =>
                String(location.id) === resubmitLocationId,
            )
          : undefined;

        if (previousLocation) {
          setSelectedLocationId(String(previousLocation.id));
          setFormData((currentData) => ({
            ...currentData,
            city: getCityName(previousLocation.office_name),
            district: previousLocation.district,
            state: previousLocation.state,
          }));
          setPincodeMessage("Previous request location selected.");
          return;
        }

        if (options.length === 1) {
          const location = options[0];

          setSelectedLocationId(String(location.id));
          setFormData((currentData) => ({
            ...currentData,
            city: getCityName(location.office_name),
            district: location.district,
            state: location.state,
          }));
          setPincodeMessage("Location details automatic-ga fill ayyayi.");
          return;
        }

        setSelectedLocationId("");
        setFormData((currentData) => ({
          ...currentData,
          city: "",
          district: "",
          state: "",
        }));
        setPincodeMessage("Mee temple area Post Office select cheyyandi.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLocationOptions([]);
        setSelectedLocationId("");
        setTempleOptions([]);
        setTempleSelection(NEW_TEMPLE_SELECTION);
        setTempleMessage("");
        setIsManualLocation(true);
        setPincodeMessage(
          "Backend connect avvatledhu. Location manually enter cheyyandi.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsPincodeLoading(false);
        }
      }
    }

    void lookupPincode();

    return () => {
      controller.abort();
    };
  }, [
    formData.pincode,
    isManualLocation,
    isResubmitLoading,
    isResubmitMode,
    originalRequestType,
    resubmitLocationId,
  ]);

  useEffect(() => {
    if (
      isResubmitMode ||
      !selectedLocationId ||
      isManualLocation
    ) {
      return;
    }

    const controller = new AbortController();

    async function loadVerifiedTemples() {
      setIsTempleLoading(true);
      setTempleOptions([]);
      setTempleSelection("");
      setTempleMessage("Verified temples loading...");

      try {
        const query = new URLSearchParams({
          pincode_location: selectedLocationId,
        });

        const response = await apiFetch(`${VERIFIED_TEMPLES_URL}?${query}`, {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        const data = (await response.json()) as VerifiedTempleListResponse;

        if (!response.ok || !data.success) {
          setTempleOptions([]);
          setTempleSelection("");
          setTempleMessage(
            data.message ??
              "Verified temples load avvaledu. Malli try cheyyandi.",
          );
          return;
        }

        const temples = data.temples ?? [];
        setTempleOptions(temples);

        if (temples.length === 0) {
          setTempleSelection(NEW_TEMPLE_SELECTION);
          setTempleMessage(
            "Ee area lo verified temples levu. New temple details enter cheyyandi.",
          );
          return;
        }

        setTempleSelection("");
        setTempleMessage(
          `${data.count ?? temples.length} verified temple(s) dorikayi. Mee temple select cheyyandi.`,
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setTempleOptions([]);
        setTempleSelection("");
        setTempleMessage(
          "Verified temples service connect avvatledhu. Malli try cheyyandi.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsTempleLoading(false);
        }
      }
    }

    void loadVerifiedTemples();

    return () => {
      controller.abort();
    };
  }, [
    isManualLocation,
    isResubmitMode,
    navigate,
    selectedLocationId,
  ]);

  function clearSubmitFeedback() {
    setSubmitStatus("idle");
    setSubmitMessage("");
  }

  function resetTempleDiscovery() {
    setTempleOptions([]);
    setTempleSelection("");
    setTempleMessage("");
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    clearSubmitFeedback();
    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function handlePincodeChange(event: ChangeEvent<HTMLInputElement>) {
    const numbersOnly = event.target.value.replace(/\D/g, "").slice(0, 6);

    clearSubmitFeedback();
    setLocationOptions([]);
    setSelectedLocationId("");
    setResubmitLocationId("");
    setIsManualLocation(false);
    setPincodeMessage("");
    resetTempleDiscovery();

    setFormData((currentData) => ({
      ...currentData,
      pincode: numbersOnly,
      city: "",
      district: "",
      state: "",
    }));
  }

  function handleLocationChange(event: ChangeEvent<HTMLSelectElement>) {
    const selectedValue = event.target.value;

    clearSubmitFeedback();
    setSelectedLocationId(selectedValue);
    setResubmitLocationId(selectedValue);
    resetTempleDiscovery();

    if (!selectedValue) {
      setFormData((currentData) => ({
        ...currentData,
        city: "",
        district: "",
        state: "",
      }));
      return;
    }

    const location = locationOptions.find(
      (option) => String(option.id) === selectedValue,
    );

    if (!location) {
      return;
    }

    setFormData((currentData) => ({
      ...currentData,
      city: getCityName(location.office_name),
      district: location.district,
      state: location.state,
    }));
    setPincodeMessage("Selected Post Office details fill ayyayi.");
  }

  function handleTempleSelection(event: ChangeEvent<HTMLSelectElement>) {
    clearSubmitFeedback();
    setTempleSelection(event.target.value);
  }

  function useAutomaticLookup() {
    clearSubmitFeedback();
    setLocationOptions([]);
    setSelectedLocationId("");
    setResubmitLocationId("");
    setPincodeMessage("");
    setIsManualLocation(false);
    resetTempleDiscovery();

    setFormData((currentData) => ({
      ...currentData,
      city: "",
      district: "",
      state: "",
    }));
  }

  function handlePhoneChange(event: ChangeEvent<HTMLInputElement>) {
    const numbersOnly = event.target.value.replace(/\D/g, "").slice(0, 10);

    clearSubmitFeedback();
    setFormData((currentData) => ({
      ...currentData,
      contact_phone: numbersOnly,
    }));
  }

  function handleTempleImageChange(event: ChangeEvent<HTMLInputElement>) {
    clearSubmitFeedback();
    setTempleImage(event.target.files?.[0] ?? null);
  }

  function handleProofImageChange(event: ChangeEvent<HTMLInputElement>) {
    clearSubmitFeedback();
    setProofImage(event.target.files?.[0] ?? null);
  }

  function validateForm() {
    if (hasInvalidResubmitParam) {
      return "Invalid resubmit request ID.";
    }

    if (isResubmitMode && resubmitLoadError) {
      return resubmitLoadError;
    }

    if (!/^[1-9][0-9]{5}$/.test(formData.pincode)) {
      return "Valid 6-digit Indian pincode enter cheyyandi.";
    }

    if (!isManualLocation && !selectedLocationId) {
      return "Mee temple area Post Office select cheyyandi.";
    }

    if (
      !formData.state.trim() ||
      !formData.district.trim() ||
      !formData.city.trim()
    ) {
      return "State, District and Village/Town/City details complete cheyyandi.";
    }

    if (!isNewTempleRequest && !isClaimRequest) {
      return "Existing temple select cheyyandi lekapothe New Temple option select cheyyandi.";
    }

    if (isNewTempleRequest) {
      if (formData.temple_name.trim().length < 3) {
        return "Temple name minimum 3 characters enter cheyyandi.";
      }

      if (!formData.main_deity.trim()) {
        return "Main deity enter cheyyandi.";
      }

      if (!formData.address.trim()) {
        return "Full temple address enter cheyyandi.";
      }

      if (templeImage) {
        const allowedImageTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        if (!allowedImageTypes.includes(templeImage.type)) {
          return "Temple image JPG, PNG leda WEBP format lo upload cheyyandi.";
        }

        if (templeImage.size > 5 * 1024 * 1024) {
          return "Temple image size 5 MB lopu undali.";
        }
      }
    }

    if (!formData.contact_person_name.trim()) {
      return "Contact person name enter cheyyandi.";
    }

    if (!/^[0-9]{10}$/.test(formData.contact_phone)) {
      return "Valid 10-digit contact phone enter cheyyandi.";
    }

    if (proofImage) {
      const allowedImageTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (!allowedImageTypes.includes(proofImage.type)) {
        return "Proof image JPG, PNG leda WEBP format lo upload cheyyandi.";
      }

      if (proofImage.size > 5 * 1024 * 1024) {
        return "Proof image size 5 MB lopu undali.";
      }
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmitStatus("idle");
    setSubmitMessage("");

    const validationError = validateForm();

    if (validationError) {
      setSubmitStatus("error");
      setSubmitMessage(validationError);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const requestBody = new FormData();

    requestBody.append(
      "request_type",
      isClaimRequest ? "claim_temple" : "new_temple",
    );
    requestBody.append(
      "contact_person_name",
      formData.contact_person_name.trim(),
    );
    requestBody.append("contact_phone", formData.contact_phone);

    if (isClaimRequest && selectedTempleId !== null) {
      requestBody.append("existing_temple", String(selectedTempleId));
    } else {
      requestBody.append("temple_name", formData.temple_name.trim());
      requestBody.append("main_deity", formData.main_deity.trim());
      requestBody.append("description", formData.description.trim());
      requestBody.append("address", formData.address.trim());
      requestBody.append("city", formData.city.trim());
      requestBody.append("district", formData.district.trim());
      requestBody.append("state", formData.state.trim());
      requestBody.append("pincode", formData.pincode);

      if (selectedLocationId) {
        requestBody.append("pincode_location", selectedLocationId);
      }

      if (formData.opening_time) {
        requestBody.append("opening_time", formData.opening_time);
      }

      if (formData.closing_time) {
        requestBody.append("closing_time", formData.closing_time);
      }

      if (templeImage) {
        requestBody.append("temple_image", templeImage);
      }
    }

    if (proofImage) {
      requestBody.append("proof_image", proofImage);
    }

    setIsSubmitting(true);

    try {
      const submitUrl =
        isResubmitMode && resubmitRequestId !== null
          ? `${TEMPLE_REQUEST_URL}${resubmitRequestId}/resubmit/`
          : TEMPLE_REQUEST_URL;

      const response = await apiFetch(submitUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: requestBody,
      });

      const data = (await response.json()) as TempleRequestSubmitResponse;

      if (!response.ok || !data.success) {
        const fieldError = getFirstErrorMessage(data.errors);

        setSubmitStatus("error");
        setSubmitMessage(
          fieldError ||
            data.message ||
            "Temple request submit avvaledu. Malli try cheyyandi.",
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const requestId = data.temple_request?.id;

      setSubmitStatus("success");
      setSubmitMessage(
        `${data.message ?? (isResubmitMode
          ? "Temple request successfully resubmit ayyindi."
          : "Temple request successfully submit ayyindi.")}${
          requestId ? ` Request ID: #${requestId}.` : ""
        } Dashboard-ki redirect avutunnaru...`,
      );
      setIsRedirecting(true);

      setFormData({ ...INITIAL_FORM_DATA });
      setTempleImage(null);
      setProofImage(null);
      setCurrentTempleImageUrl("");
      setCurrentProofImageUrl("");
      setLocationOptions([]);
      setSelectedLocationId("");
      setIsManualLocation(false);
      setPincodeMessage("");
      resetTempleDiscovery();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitStatus("error");
      setSubmitMessage(
        "Backend server connect avvatledhu. Django server running lo undha check cheyyi.",
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-orange-700 focus:ring-2 focus:ring-orange-100";

  const readOnlyInputClassName = `${inputClassName} cursor-not-allowed bg-gray-100 text-gray-600`;

  const labelClassName =
    "mb-1.5 block text-[13px] font-semibold text-gray-700";

  const locationIsReady =
    isManualLocation || Boolean(selectedLocationId && formData.city);

  return (
    <div className="space-y-4">
      {(isSubmitting || isRedirecting) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 px-4 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-w-64 flex-col items-center rounded-xl bg-white px-7 py-6 text-center shadow-2xl">
            <span
              className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-800"
              aria-hidden="true"
            />
            <p className="mt-4 text-sm font-bold text-gray-900">
              {isRedirecting
                ? isResubmitMode
                  ? "Request resubmitted successfully"
                  : "Request submitted successfully"
                : isResubmitMode
                  ? "Corrected request resubmitting..."
                  : "Temple request submitting..."}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              {isRedirecting
                ? "Dashboard-ki redirect avutunnaru..."
                : "Please wait, page close cheyyakandi."}
            </p>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-orange-100 bg-white px-5 py-4 shadow-sm sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700">
              Temple administration
            </p>
            <h1 className="mt-1 text-xl font-bold text-gray-950 sm:text-2xl">
              {isResubmitMode
                ? "Correct & Resubmit Temple Request"
                : "Add or Claim Your Temple"}
            </h1>
            <p className="mt-1 text-sm leading-5 text-gray-600">
              {isResubmitMode
                ? "Admin rejection reason review chesi required details correct chesi resubmit cheyyandi."
                : "Location select chesi existing temple claim cheyyandi, lekapothe new temple details submit cheyyandi."}
            </p>
          </div>

          <span className="w-fit rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800">
            {isResubmitMode
              ? "Correction required"
              : "Admin verification required"}
          </span>
        </div>
      </section>

      {isResubmitMode && isResubmitLoading && (
        <section
          aria-live="polite"
          className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm"
        >
          <div className="flex animate-pulse items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-orange-100" />
            <div className="flex-1">
              <div className="h-3 w-48 rounded bg-orange-100" />
              <div className="mt-3 h-4 w-72 max-w-full rounded bg-orange-50" />
            </div>
          </div>
        </section>
      )}

      {(hasInvalidResubmitParam || resubmitLoadError) && (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm"
        >
          <p className="text-sm font-bold text-red-900">
            Resubmit request open avvaledhu
          </p>
          <p className="mt-1 text-sm leading-6 text-red-700">
            {hasInvalidResubmitParam
              ? "Invalid resubmit request ID."
              : resubmitLoadError}
          </p>
          <button
            type="button"
            onClick={() =>
              navigate("/temple-admin-dashboard", {
                replace: true,
              })
            }
            className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            Back to Dashboard
          </button>
        </section>
      )}

      {isResubmitMode &&
        !isResubmitLoading &&
        !resubmitLoadError &&
        !hasInvalidResubmitParam && (
          <section
            role="note"
            className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-red-900">
              Reason for rejection
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-red-800">
              {rejectionReason ||
                "No rejection reason was provided. Required details verify chesi resubmit cheyyandi."}
            </p>
          </section>
        )}

      {submitMessage && (
        <div
          role={submitStatus === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-[13px] font-medium shadow-sm ${
            submitStatus === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {submitMessage}
        </div>
      )}

      {(!isResubmitMode ||
        (!isResubmitLoading &&
          !resubmitLoadError &&
          !hasInvalidResubmitParam)) && (
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 sm:px-6">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
              1
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">
                Temple location
              </h2>
              <p className="text-xs text-gray-500">
                Pincode enter chesi correct Post Office / Area select cheyyandi.
              </p>
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label htmlFor="pincode" className={labelClassName}>
                  Pincode
                </label>
                <input
                  id="pincode"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handlePincodeChange}
                  className={
                    isResubmitMode && isClaimRequest
                      ? readOnlyInputClassName
                      : inputClassName
                  }
                  placeholder="6-digit pincode"
                  readOnly={isResubmitMode && isClaimRequest}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="postal-code"
                  aria-describedby="pincode-message"
                  required
                />
                <div
                  id="pincode-message"
                  className="mt-1.5 min-h-4 text-xs text-gray-600"
                  aria-live="polite"
                >
                  {isPincodeLoading
                    ? "Pincode details loading..."
                    : pincodeMessage ||
                      (formData.pincode.length > 0 &&
                      formData.pincode.length < 6
                        ? "Complete 6-digit pincode enter cheyyandi."
                        : "")}
                </div>
              </div>

              {!isManualLocation ? (
                <div>
                  <label htmlFor="location_option" className={labelClassName}>
                    Post Office / Area
                  </label>
                  <select
                    id="location_option"
                    value={selectedLocationId}
                    onChange={handleLocationChange}
                    className={`${inputClassName} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400`}
                    disabled={
                      isPincodeLoading ||
                      locationOptions.length === 0 ||
                      (isResubmitMode && isClaimRequest)
                    }
                    required
                  >
                    <option value="">
                      {isPincodeLoading
                        ? "Loading Post Offices..."
                        : locationOptions.length > 0
                          ? "Select your Post Office / Area"
                          : "Enter pincode first"}
                    </option>
                    {locationOptions.map((location) => (
                      <option key={location.id} value={String(location.id)}>
                        {location.office_name} — {location.district}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] leading-5 text-orange-900">
                  Pincode location match avvaledu. New temple location details
                  manually enter cheyyandi.
                </div>
              )}
            </div>

            {!isManualLocation ? (
              <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="state" className={labelClassName}>
                      State
                    </label>
                    <input
                      id="state"
                      name="state"
                      value={formData.state}
                      className={readOnlyInputClassName}
                      placeholder="Select Post Office"
                      readOnly
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="district" className={labelClassName}>
                      District
                    </label>
                    <input
                      id="district"
                      name="district"
                      value={formData.district}
                      className={readOnlyInputClassName}
                      placeholder="Select Post Office"
                      readOnly
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="city" className={labelClassName}>
                      Village / Town / City
                    </label>
                    <input
                      id="city"
                      name="city"
                      value={formData.city}
                      className={readOnlyInputClassName}
                      placeholder="Select Post Office"
                      readOnly
                      required
                    />
                  </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="state" className={labelClassName}>
                      State
                    </label>
                    <input
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className={inputClassName}
                      placeholder="Enter state"
                      autoComplete="address-level1"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="district" className={labelClassName}>
                      District
                    </label>
                    <input
                      id="district"
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      className={inputClassName}
                      placeholder="Enter district"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="city" className={labelClassName}>
                      Village / Town / City
                    </label>
                    <input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className={inputClassName}
                      placeholder="Enter village or city"
                      autoComplete="address-level2"
                      required
                    />
                  </div>
                </div>

                {!(isResubmitMode && isClaimRequest) && (
                  <button
                    type="button"
                    onClick={useAutomaticLookup}
                    disabled={formData.pincode.length !== 6}
                    className="text-[13px] font-semibold text-orange-800 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    Pincode automatic lookup malli try cheyyandi
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {locationIsReady &&
          !isManualLocation &&
          !isResubmitMode && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 sm:px-6">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                2
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">
                  Find your temple
                </h2>
                <p className="text-xs text-gray-500">
                  Verified temple unte select cheyyandi; list lo lekapothe new
                  temple option use cheyyandi.
                </p>
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <label htmlFor="temple_selection" className={labelClassName}>
                  Temple name
                </label>
                <select
                  id="temple_selection"
                  value={templeSelection}
                  onChange={handleTempleSelection}
                  className={`${inputClassName} disabled:cursor-not-allowed disabled:bg-gray-100`}
                  disabled={isTempleLoading}
                  required
                >
                  <option value="">
                    {isTempleLoading
                      ? "Loading verified temples..."
                      : "Select your temple"}
                  </option>
                  {templeOptions.map((temple) => (
                    <option
                      key={temple.id}
                      value={`${TEMPLE_SELECTION_PREFIX}${temple.id}`}
                    >
                      {temple.name} — {temple.city}
                    </option>
                  ))}
                  <option value={NEW_TEMPLE_SELECTION}>
                    My temple is not listed — Register New Temple
                  </option>
                </select>
                <p className="mt-1.5 text-xs text-gray-600" aria-live="polite">
                  {templeMessage}
                </p>
              </div>

              {selectedTemple && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] leading-5 text-green-900">
                  <p className="font-bold">{selectedTemple.name}</p>
                  <p>
                    {selectedTemple.main_deity || "Main deity not added"} •{" "}
                    {selectedTemple.city}, {selectedTemple.district}
                  </p>
                  <p className="mt-1 text-xs">
                    {selectedTemple.match_type === "selected_area"
                      ? "Selected area temple"
                      : "Same pincode nearby temple"}
                    {selectedTemple.distance_km !== null
                      ? ` • Approx. ${selectedTemple.distance_km} km from Post Office`
                      : ""}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {isResubmitMode && locationIsReady && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 sm:px-6">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                2
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">
                  Request type
                </h2>
                <p className="text-xs text-gray-500">
                  Resubmit chestunnappudu request type change cheyyaleru.
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {isClaimRequest && selectedTemple ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] leading-5 text-green-900">
                  <p className="font-bold">Claim Existing Temple</p>
                  <p className="mt-1">{selectedTemple.name}</p>
                  <p>
                    {selectedTemple.main_deity || "Main deity not added"} •{" "}
                    {selectedTemple.city}, {selectedTemple.district}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] leading-5 text-orange-900">
                  <p className="font-bold">New Temple Registration</p>
                  <p className="mt-1">
                    Previous request details prefilled ayyayi. Rejection reason
                    prakaram required fields correct cheyyandi.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {isNewTempleRequest && locationIsReady && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 sm:px-6">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                {isResubmitMode ? "3" : isManualLocation ? "2" : "3"}
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">
                  New temple details
                </h2>
                <p className="text-xs text-gray-500">
                  List lo leni temple basic information enter cheyyandi.
                </p>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
              <div>
                <label htmlFor="temple_name" className={labelClassName}>
                  Temple name
                </label>
                <input
                  id="temple_name"
                  name="temple_name"
                  value={formData.temple_name}
                  onChange={handleChange}
                  className={inputClassName}
                  placeholder="Enter temple name"
                  autoComplete="organization"
                  required
                />
              </div>

              <div>
                <label htmlFor="main_deity" className={labelClassName}>
                  Main deity
                </label>
                <input
                  id="main_deity"
                  name="main_deity"
                  value={formData.main_deity}
                  onChange={handleChange}
                  className={inputClassName}
                  placeholder="Enter main deity"
                  required
                />
              </div>

              <div>
                <label htmlFor="opening_time" className={labelClassName}>
                  Opening time
                </label>
                <input
                  id="opening_time"
                  name="opening_time"
                  type="time"
                  value={formData.opening_time}
                  onChange={handleChange}
                  className={inputClassName}
                />
              </div>

              <div>
                <label htmlFor="closing_time" className={labelClassName}>
                  Closing time
                </label>
                <input
                  id="closing_time"
                  name="closing_time"
                  type="time"
                  value={formData.closing_time}
                  onChange={handleChange}
                  className={inputClassName}
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="temple_image" className={labelClassName}>
                  Temple image
                </label>
                <input
                  id="temple_image"
                  name="temple_image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleTempleImageChange}
                  className={`${inputClassName} cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-orange-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-orange-900 hover:file:bg-orange-200`}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  JPG, PNG or WEBP • Maximum 5 MB
                  {templeImage ? ` • Selected: ${templeImage.name}` : ""}
                </p>

                {isResubmitMode && currentTempleImageUrl && !templeImage && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <img
                      src={currentTempleImageUrl}
                      alt="Current temple"
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                    <div>
                      <p className="text-xs font-bold text-gray-800">
                        Current temple image
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Replacement select cheyyakapothe current image retain
                        avutundhi.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className={labelClassName}>
                  Temple description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className={inputClassName}
                  placeholder="Enter a short temple description"
                  rows={3}
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="address" className={labelClassName}>
                  Full address
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className={inputClassName}
                  placeholder="Street, area and nearby landmark"
                  rows={2}
                  required
                />
              </div>
            </div>
          </section>
        )}

        {(isClaimRequest || isNewTempleRequest) && locationIsReady && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 sm:px-6">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                {isResubmitMode
                  ? isClaimRequest
                    ? "3"
                    : "4"
                  : isClaimRequest
                    ? "3"
                    : isManualLocation
                      ? "3"
                      : "4"}
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">
                  Contact details
                </h2>
                <p className="text-xs text-gray-500">
                  Verification kosam contact information ivvandi.
                </p>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
              <div>
                <label htmlFor="contact_person_name" className={labelClassName}>
                  Contact person
                </label>
                <input
                  id="contact_person_name"
                  name="contact_person_name"
                  value={formData.contact_person_name}
                  onChange={handleChange}
                  className={inputClassName}
                  placeholder="Enter contact person"
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label htmlFor="contact_phone" className={labelClassName}>
                  Contact phone
                </label>
                <input
                  id="contact_phone"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handlePhoneChange}
                  className={inputClassName}
                  placeholder="10-digit phone number"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel"
                  required
                />
              </div>
            </div>
          </section>
        )}

        {(isClaimRequest || isNewTempleRequest) && locationIsReady && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5 sm:px-6">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                {isResubmitMode
                  ? isClaimRequest
                    ? "4"
                    : "5"
                  : isClaimRequest
                    ? "4"
                    : isManualLocation
                      ? "4"
                      : "5"}
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">
                  Verification proof
                </h2>
                <p className="text-xs text-gray-500">
                  Temple ownership or authorization proof upload cheyyandi.
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <label htmlFor="proof_image" className={labelClassName}>
                Proof image
              </label>
              <input
                id="proof_image"
                name="proof_image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProofImageChange}
                className={`${inputClassName} cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-orange-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-orange-900 hover:file:bg-orange-200`}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                JPG, PNG or WEBP • Maximum 5 MB
                {proofImage ? ` • Selected: ${proofImage.name}` : ""}
              </p>

              {isResubmitMode && currentProofImageUrl && !proofImage && (
                <div className="mt-3 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-800">
                      Current proof retained
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      New proof select cheyyakapothe previous proof retain
                      avutundhi.
                    </p>
                  </div>
                  <a
                    href={currentProofImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-orange-800 hover:underline"
                  >
                    View current proof
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {(isClaimRequest || isNewTempleRequest) && locationIsReady && (
          <div className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="max-w-2xl text-xs leading-5 text-gray-600">
              {isResubmitMode
                ? "Corrected request new pending request-ga create avutundhi. Previous rejected request history safe-ga untundhi."
                : isClaimRequest
                  ? "Existing temple claim ni Super Admin verify chestharu. Approval tarvatha owner access vastundi."
                  : "New temple details ni Super Admin verify chestharu. Approval varaku request pending status lo untundi."}
            </p>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isRedirecting ||
                isPincodeLoading ||
                isTempleLoading
              }
              className="rounded-lg bg-orange-800 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-44"
            >
              {isSubmitting
                ? isResubmitMode
                  ? "Resubmitting..."
                  : "Submitting..."
                : isResubmitMode
                  ? "Resubmit Corrected Request"
                  : isClaimRequest
                    ? "Submit Claim Request"
                    : "Submit New Temple"}
            </button>
          </div>
        )}
      </form>
      )}
    </div>
  );
}

export default TempleRequest;