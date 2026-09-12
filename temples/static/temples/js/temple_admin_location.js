(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const pincodeInput =
      document.querySelector("#id_pincode");

    const locationSelect =
      document.querySelector("#id_pincode_location");

    const stateInput =
      document.querySelector("#id_state");

    const districtInput =
      document.querySelector("#id_district");

    const cityInput =
      document.querySelector("#id_city");

    if (
      !(pincodeInput instanceof HTMLInputElement) ||
      !(locationSelect instanceof HTMLSelectElement) ||
      !(stateInput instanceof HTMLInputElement) ||
      !(districtInput instanceof HTMLInputElement) ||
      !(cityInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const lookupBaseUrl =
      `${window.location.origin}/api/temples/pincode`;

    const initialLocationId = locationSelect.value;
    const initialPincode = pincodeInput.value.trim();
    const locationsById = new Map();

    let debounceTimer = null;
    let activeController = null;

    const messageElement =
      document.createElement("div");

    messageElement.id =
      "pincode-location-message";

    messageElement.style.marginTop = "8px";
    messageElement.style.fontSize = "12px";

    messageElement.setAttribute(
      "aria-live",
      "polite",
    );

    const pincodeRow =
      pincodeInput.closest(".form-row");

    const messageContainer =
      pincodeRow || pincodeInput.parentElement;

    if (messageContainer) {
      messageContainer.appendChild(
        messageElement,
      );
    }

    function setMessage(message, type = "info") {
      messageElement.textContent = message;

      const colors = {
        info: "#417690",
        success: "#2e7d32",
        warning: "#b26a00",
        error: "#ba2121",
      };

      messageElement.style.color =
        colors[type] || colors.info;
    }

    function getCityName(officeName) {
      return officeName
        .replace(
          /\s+(B\.O|S\.O|H\.O)$/i,
          "",
        )
        .trim();
    }

    function setLocationFieldsReadOnly(
      isReadOnly,
    ) {
      stateInput.readOnly = isReadOnly;
      districtInput.readOnly = isReadOnly;
      cityInput.readOnly = isReadOnly;
    }

    function clearLocationFields() {
      stateInput.value = "";
      districtInput.value = "";
      cityInput.value = "";
    }

    function resetLocationSelect(
      placeholder,
      disabled = true,
    ) {
      locationsById.clear();
      locationSelect.replaceChildren();

      const option =
        document.createElement("option");

      option.value = "";
      option.textContent = placeholder;

      locationSelect.appendChild(option);
      locationSelect.disabled = disabled;
    }

    function enableManualLocation(message) {
      resetLocationSelect(
        "No Post Offices found",
        true,
      );

      setLocationFieldsReadOnly(false);
      setMessage(message, "warning");
    }

    function disableLocationLookup(message) {
      resetLocationSelect(
        "Unable to load Post Offices",
        true,
      );

      setLocationFieldsReadOnly(true);
      setMessage(message, "error");
    }

    function fillLocation(location) {
      if (!location) {
        clearLocationFields();
        setLocationFieldsReadOnly(true);

        setMessage(
          "Correct Post Office / Area select cheyyandi.",
          "info",
        );

        return;
      }

      stateInput.value =
        location.state || "";

      districtInput.value =
        location.district || "";

      cityInput.value = getCityName(
        location.office_name || "",
      );

      setLocationFieldsReadOnly(true);

      setMessage(
        (
          "Official State, District and Area " +
          "details fill ayyayi."
        ),
        "success",
      );
    }

    function populateLocationOptions(
      locations,
      preferredLocationId = "",
    ) {
      resetLocationSelect(
        "Select Post Office / Area",
        false,
      );

      for (const location of locations) {
        const locationId =
          String(location.id);

        locationsById.set(
          locationId,
          location,
        );

        const option =
          document.createElement("option");

        option.value = locationId;

        option.textContent =
          `${location.office_name} — ` +
          `${location.district}`;

        locationSelect.appendChild(option);
      }

      let locationToSelect = "";

      if (
        preferredLocationId &&
        locationsById.has(preferredLocationId)
      ) {
        locationToSelect =
          preferredLocationId;
      } else if (locations.length === 1) {
        locationToSelect =
          String(locations[0].id);
      }

      locationSelect.value =
        locationToSelect;

      if (locationToSelect) {
        fillLocation(
          locationsById.get(locationToSelect),
        );
      } else {
        clearLocationFields();
        setLocationFieldsReadOnly(true);

        setMessage(
          (
            "Correct Post Office / Area " +
            "select cheyyandi."
          ),
          "info",
        );
      }
    }

    async function lookupPincode(
      pincode,
      preferredLocationId = "",
      preserveFields = false,
    ) {
      if (activeController) {
        activeController.abort();
      }

      activeController =
        new AbortController();

      resetLocationSelect(
        "Loading Post Offices...",
        true,
      );

      setLocationFieldsReadOnly(true);

      setMessage(
        "Pincode details loading...",
        "info",
      );

      if (!preserveFields) {
        clearLocationFields();
      }

      try {
        const response = await fetch(
          (
            `${lookupBaseUrl}/` +
            `${encodeURIComponent(pincode)}/`
          ),
          {
            headers: {
              Accept: "application/json",
            },
            credentials: "same-origin",
            signal: activeController.signal,
          },
        );

        let data = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        const locations =
          Array.isArray(
            data?.location_options,
          )
            ? data.location_options.filter(
                (location) =>
                  location &&
                  location.id !== undefined &&
                  location.office_name,
              )
            : [];

        if (
          response.status === 404 ||
          (
            data?.success === true &&
            locations.length === 0
          )
        ) {
          enableManualLocation(
            data?.message ||
              (
                "Ee pincode details dorakaledu. " +
                "Location manually enter cheyyandi."
              ),
          );

          return;
        }

        if (
          !response.ok ||
          data?.success !== true
        ) {
          disableLocationLookup(
            data?.message ||
              (
                "Pincode details load avvaledu. " +
                "Page refresh chesi malli try cheyyandi."
              ),
          );

          return;
        }

        populateLocationOptions(
          locations,
          preferredLocationId,
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        disableLocationLookup(
          (
            "Pincode service connect avvatledhu. " +
            "Page refresh chesi malli try cheyyandi."
          ),
        );
      }
    }

    function scheduleLookup(
      preferredLocationId = "",
      preserveFields = false,
    ) {
      const pincode = pincodeInput.value
        .replace(/\D/g, "")
        .slice(0, 6);

      pincodeInput.value = pincode;

      if (debounceTimer !== null) {
        window.clearTimeout(
          debounceTimer,
        );
      }

      if (pincode.length !== 6) {
        if (activeController) {
          activeController.abort();
        }

        resetLocationSelect(
          "Enter complete 6-digit pincode",
          true,
        );

        clearLocationFields();
        setLocationFieldsReadOnly(true);

        setMessage(
          pincode.length > 0
            ? (
                "Complete 6-digit pincode " +
                "enter cheyyandi."
              )
            : (
                "Pincode enter chesi Post " +
                "Office select cheyyandi."
              ),
          "info",
        );

        return;
      }

      debounceTimer =
        window.setTimeout(() => {
          void lookupPincode(
            pincode,
            preferredLocationId,
            preserveFields,
          );
        }, 250);
    }

    pincodeInput.addEventListener(
      "input",
      () => {
        scheduleLookup();
      },
    );

    locationSelect.addEventListener(
      "change",
      () => {
        const selectedLocation =
          locationsById.get(
            locationSelect.value,
          );

        fillLocation(selectedLocation);
      },
    );

    if (
      /^[1-9][0-9]{5}$/.test(
        initialPincode,
      )
    ) {
      scheduleLookup(
        initialLocationId,
        true,
      );
    } else {
      resetLocationSelect(
        "Enter pincode first",
        true,
      );

      setLocationFieldsReadOnly(true);

      setMessage(
        (
          "Pincode enter chesi Post Office / " +
          "Area select cheyyandi."
        ),
        "info",
      );
    }
  });
})();