import re

from django import forms

from .models import PincodeLocation, Temple


PINCODE_PATTERN = re.compile(r"^[1-9][0-9]{5}$")
POST_OFFICE_SUFFIX_PATTERN = re.compile(
    r"\s+(?:B\.O|S\.O|H\.O)$",
    re.IGNORECASE,
)


def get_city_name(office_name):
    return POST_OFFICE_SUFFIX_PATTERN.sub("", office_name).strip()


class TempleAdminForm(forms.ModelForm):
    class Meta:
        model = Temple
        fields = "__all__"
        widgets = {
            "pincode": forms.TextInput(
                attrs={
                    "maxlength": "6",
                    "inputmode": "numeric",
                    "autocomplete": "postal-code",
                }
            ),
            "state": forms.TextInput(
                attrs={"readonly": "readonly"}
            ),
            "district": forms.TextInput(
                attrs={"readonly": "readonly"}
            ),
            "city": forms.TextInput(
                attrs={"readonly": "readonly"}
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields["pincode"].required = True
        self.fields["pincode_location"].required = False
        self.fields["pincode_location"].label = "Post Office / Area"

        for field_name in ("state", "district", "city"):
            self.fields[field_name].required = False

        pincode = self._get_current_pincode()
        location_queryset = PincodeLocation.objects.none()

        if PINCODE_PATTERN.fullmatch(pincode):
            location_queryset = PincodeLocation.objects.filter(
                pincode=pincode
            ).order_by(
                "office_name",
                "district",
                "state",
            )
        elif (
            self.instance.pk
            and self.instance.pincode_location_id
        ):
            location_queryset = PincodeLocation.objects.filter(
                pk=self.instance.pincode_location_id
            )

        location_field = self.fields["pincode_location"]
        location_field.queryset = location_queryset
        location_field.empty_label = (
            "Select Post Office / Area"
            if pincode
            else "Enter pincode first"
        )

        self.fields["latitude"].help_text = (
            "Actual temple latitude enter cheyyandi; "
            "Post Office latitude kaadhu."
        )
        self.fields["longitude"].help_text = (
            "Actual temple longitude enter cheyyandi; "
            "Post Office longitude kaadhu."
        )

    def _get_current_pincode(self):
        if self.is_bound:
            return str(
                self.data.get(
                    self.add_prefix("pincode"),
                    "",
                )
            ).strip()

        return str(
            getattr(self.instance, "pincode", "") or ""
        ).strip()

    def clean_pincode(self):
        pincode = str(
            self.cleaned_data.get("pincode", "")
        ).strip()

        if not PINCODE_PATTERN.fullmatch(pincode):
            raise forms.ValidationError(
                "Valid 6-digit Indian pincode enter cheyyandi."
            )

        return pincode

    def clean(self):
        cleaned_data = super().clean()

        pincode = cleaned_data.get("pincode")
        location = cleaned_data.get("pincode_location")

        latitude = cleaned_data.get("latitude")
        longitude = cleaned_data.get("longitude")

        if (
            latitude is not None
            and not -90 <= latitude <= 90
        ):
            self.add_error(
                "latitude",
                "Latitude -90 nunchi 90 madhyalo undali.",
            )

        if (
            longitude is not None
            and not -180 <= longitude <= 180
        ):
            self.add_error(
                "longitude",
                "Longitude -180 nunchi 180 madhyalo undali.",
            )

        if cleaned_data.get("is_verified"):
            if latitude is None:
                self.add_error(
                    "latitude",
                    "Verified temple-ki actual latitude required.",
                )

            if longitude is None:
                self.add_error(
                    "longitude",
                    "Verified temple-ki actual longitude required.",
                )

        if not pincode:
            return cleaned_data

        available_locations = PincodeLocation.objects.filter(
            pincode=pincode
        )

        if location is not None:
            if location.pincode != pincode:
                self.add_error(
                    "pincode_location",
                    (
                        "Selected Post Office ee pincode-ki "
                        "match avvatledhu."
                    ),
                )
                return cleaned_data

            cleaned_data["state"] = location.state.strip()
            cleaned_data["district"] = (
                location.district.strip()
            )
            cleaned_data["city"] = get_city_name(
                location.office_name
            )

            return cleaned_data

        if available_locations.exists():
            if "pincode_location" not in self.errors:
                self.add_error(
                    "pincode_location",
                    (
                        "Ee pincode-ki correct Post Office / "
                        "Area select cheyyandi."
                    ),
                )

            return cleaned_data

        manual_fields = {
            "state": "State enter cheyyandi.",
            "district": "District enter cheyyandi.",
            "city": "Village / Town / City enter cheyyandi.",
        }

        for field_name, error_message in manual_fields.items():
            value = str(
                cleaned_data.get(field_name, "")
            ).strip()

            if not value:
                self.add_error(
                    field_name,
                    error_message,
                )
            else:
                cleaned_data[field_name] = value

        return cleaned_data